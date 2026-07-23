// Lovable Cloud Edge Function REST API Gateway
// Public URL: https://<project>.supabase.co/functions/v1/api
// Auth: x-api-key header required on ALL endpoints except GET /health.
// Fail-closed: if ADMIN_API_KEY env is missing, every admin endpoint returns 503.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_API_KEY = Deno.env.get("ADMIN_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const IMAGE_BUCKET = "post-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,x-api-key,authorization,apikey",
  "access-control-max-age": "86400",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}
function err(status: number, code: string, message: string, details?: unknown) {
  return json({ ok: false, error: { code, message, details } }, status);
}
function ok<T>(data: T, status = 200) {
  return json({ ok: true, data }, status);
}

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")
    .slice(0, 80) || `post-${Date.now()}`;
}

function requireAdmin(req: Request): Response | null {
  if (!ADMIN_API_KEY) {
    return err(503, "admin_disabled",
      "ADMIN_API_KEY is not configured on the server. All admin endpoints are disabled (fail-closed).");
  }
  const key = req.headers.get("x-api-key") ?? "";
  if (key !== ADMIN_API_KEY) return err(401, "unauthorized", "Invalid or missing x-api-key");
  return null;
}

async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return null; }
}

async function uploadDataUrl(dataUrl: string): Promise<{ key: string; url: string }> {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("invalid data_url");
  const contentType = m[1];
  const ext = ALLOWED_MIME[contentType];
  if (!ext) throw new Error(`unsupported image type: ${contentType}`);
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bin.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large (max 8MB)");
  const key = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(key, bin, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return { key, url: `/api/public/images/${key}` };
}

// ---------- routing ----------

type Ctx = { req: Request; url: URL; segs: string[]; method: string };

async function route(ctx: Ctx): Promise<Response> {
  const { segs, method } = ctx;

  // /health
  if (segs.length === 1 && segs[0] === "health") {
    if (method !== "GET") return err(405, "method_not_allowed", "GET only");
    return ok({
      status: "ok",
      time: new Date().toISOString(),
      admin_enabled: Boolean(ADMIN_API_KEY),
    });
  }

  // Everything else requires x-api-key
  const authFail = requireAdmin(ctx.req);
  if (authFail) return authFail;

  const [resource, id, sub] = segs;

  switch (resource) {
    case "posts":       return handlePosts(ctx, id, sub);
    case "categories":  return handleCategories(ctx, id);
    case "comments":    return handleComments(ctx, id, sub);
    case "images":      return handleImages(ctx, id);
    case "about":       return handleAbout(ctx);
    case "settings":    return handleSettings(ctx, id);
    case "openapi.json":return ok(openapi());
    default:            return err(404, "not_found", `Unknown path: /${segs.join("/")}`);
  }
}

// ---------- posts ----------
async function handlePosts(ctx: Ctx, id?: string, sub?: string): Promise<Response> {
  const { method, req, url } = ctx;
  if (sub) return err(404, "not_found", "unknown subpath");

  if (!id) {
    if (method === "GET") {
      const category = url.searchParams.get("category");
      const includeUnpublished = url.searchParams.get("include_unpublished") === "true";
      let q = supabase.from("posts")
        .select("id, slug, title, excerpt, cover_image, category_id, author_name, published, published_at, updated_at, created_at, category:categories(slug, name)")
        .order("published_at", { ascending: false });
      if (!includeUnpublished) q = q.eq("published", true);
      const { data, error } = await q;
      if (error) return err(500, "db_error", error.message);
      const filtered = category ? (data ?? []).filter((r: any) => r.category?.slug === category) : (data ?? []);
      return ok(filtered);
    }
    if (method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.title !== "string" || body.title.length < 1 || body.title.length > 200)
        return err(400, "invalid_input", "title required (1-200 chars)");

      const images: Array<{ placeholder: string; data_url: string }> = Array.isArray(body.images) ? body.images : [];
      let content: string = typeof body.content === "string" ? body.content : "";
      for (const img of images) {
        if (!img?.placeholder || !img?.data_url) continue;
        const { url: u } = await uploadDataUrl(img.data_url);
        content = content.split(`{{${img.placeholder}}}`).join(`![${img.placeholder}](${u})`);
      }
      let cover: string | null = body.cover_image ?? null;
      if (typeof body.cover_image_upload === "string" && body.cover_image_upload.startsWith("data:")) {
        cover = (await uploadDataUrl(body.cover_image_upload)).url;
      }
      const payload = {
        title: body.title,
        slug: (typeof body.slug === "string" && body.slug.trim()) || slugify(body.title),
        excerpt: body.excerpt ?? null,
        content,
        cover_image: cover,
        category_id: body.category_id ?? null,
        author_name: typeof body.author_name === "string" ? body.author_name : "Editor",
        published: body.published !== false,
        published_at: body.published_at ? new Date(body.published_at).toISOString() : new Date().toISOString(),
      };
      const { data, error } = await supabase.from("posts").insert(payload).select().single();
      if (error) return err(400, "db_error", error.message);
      return ok(data, 201);
    }
    return err(405, "method_not_allowed", "GET, POST");
  }

  // /posts/:id  (id may be uuid or slug via ?by=slug)
  const bySlug = url.searchParams.get("by") === "slug";
  const col = bySlug ? "slug" : "id";

  if (method === "GET") {
    const { data, error } = await supabase.from("posts")
      .select("*, category:categories(slug, name)").eq(col, id).maybeSingle();
    if (error) return err(500, "db_error", error.message);
    if (!data) return err(404, "not_found", "post not found");
    return ok(data);
  }
  if (method === "PATCH" || method === "PUT") {
    const body = await readJson(req);
    if (!body) return err(400, "invalid_input", "JSON body required");
    const patch: Record<string, unknown> = {};
    for (const k of ["title","slug","excerpt","content","cover_image","category_id","author_name","published"]) {
      if (k in body) patch[k] = body[k];
    }
    if (body.published_at) patch.published_at = new Date(body.published_at).toISOString();
    if (typeof body.cover_image_upload === "string" && body.cover_image_upload.startsWith("data:")) {
      patch.cover_image = (await uploadDataUrl(body.cover_image_upload)).url;
    }
    const { data, error } = await supabase.from("posts").update(patch).eq(col, id).select().single();
    if (error) return err(400, "db_error", error.message);
    return ok(data);
  }
  if (method === "DELETE") {
    const { error } = await supabase.from("posts").delete().eq(col, id);
    if (error) return err(400, "db_error", error.message);
    return ok({ deleted: true });
  }
  return err(405, "method_not_allowed", "GET, PATCH, PUT, DELETE");
}

// ---------- categories ----------
async function handleCategories(ctx: Ctx, id?: string): Promise<Response> {
  const { method, req, url } = ctx;
  if (!id) {
    if (method === "GET") {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) return err(500, "db_error", error.message);
      return ok(data ?? []);
    }
    if (method === "POST") {
      const b = await readJson(req);
      if (!b?.name || typeof b.name !== "string") return err(400, "invalid_input", "name required");
      const payload = { name: b.name, slug: (b.slug?.trim?.() || slugify(b.name)), description: b.description ?? null };
      const { data, error } = await supabase.from("categories").insert(payload).select().single();
      if (error) return err(400, "db_error", error.message);
      return ok(data, 201);
    }
    return err(405, "method_not_allowed", "GET, POST");
  }
  const bySlug = url.searchParams.get("by") === "slug";
  const col = bySlug ? "slug" : "id";
  if (method === "GET") {
    const { data, error } = await supabase.from("categories").select("*").eq(col, id).maybeSingle();
    if (error) return err(500, "db_error", error.message);
    if (!data) return err(404, "not_found", "category not found");
    return ok(data);
  }
  if (method === "PATCH" || method === "PUT") {
    const b = await readJson(req);
    if (!b) return err(400, "invalid_input", "JSON body required");
    const patch: Record<string, unknown> = {};
    for (const k of ["name","slug","description"]) if (k in b) patch[k] = b[k];
    const { data, error } = await supabase.from("categories").update(patch).eq(col, id).select().single();
    if (error) return err(400, "db_error", error.message);
    return ok(data);
  }
  if (method === "DELETE") {
    const { error } = await supabase.from("categories").delete().eq(col, id);
    if (error) return err(400, "db_error", error.message);
    return ok({ deleted: true });
  }
  return err(405, "method_not_allowed", "GET, PATCH, PUT, DELETE");
}

// ---------- comments ----------
async function handleComments(ctx: Ctx, id?: string, sub?: string): Promise<Response> {
  const { method, req, url } = ctx;
  if (!id) {
    if (method === "GET") {
      const postId = url.searchParams.get("post_id");
      const approvedParam = url.searchParams.get("approved");
      let q = supabase.from("comments")
        .select("*, post:posts(title, slug)")
        .order("created_at", { ascending: false }).limit(1000);
      if (postId) q = q.eq("post_id", postId);
      if (approvedParam === "true") q = q.eq("approved", true);
      if (approvedParam === "false") q = q.eq("approved", false);
      const { data, error } = await q;
      if (error) return err(500, "db_error", error.message);
      return ok(data ?? []);
    }
    if (method === "POST") {
      const b = await readJson(req);
      if (!b?.post_id || !b?.author_name || !b?.content)
        return err(400, "invalid_input", "post_id, author_name, content required");
      if (String(b.author_name).length > 50) return err(400, "invalid_input", "author_name max 50");
      if (String(b.content).length > 2000) return err(400, "invalid_input", "content max 2000");
      const payload = {
        post_id: b.post_id,
        parent_id: b.parent_id ?? null,
        author_name: b.author_name,
        content: b.content,
        approved: b.approved !== false,
        ...(b.created_at ? { created_at: new Date(b.created_at).toISOString() } : {}),
      };
      const { data, error } = await supabase.from("comments").insert(payload).select().single();
      if (error) return err(400, "db_error", error.message);
      return ok(data, 201);
    }
    return err(405, "method_not_allowed", "GET, POST");
  }
  // /comments/:id/approve  or  /comments/:id
  if (sub === "approve" && method === "POST") {
    const b = await readJson(req) ?? {};
    const approved = b.approved !== false;
    const { data, error } = await supabase.from("comments")
      .update({ approved }).eq("id", id).select().single();
    if (error) return err(400, "db_error", error.message);
    return ok(data);
  }
  if (sub) return err(404, "not_found", "unknown subpath");

  if (method === "GET") {
    const { data, error } = await supabase.from("comments").select("*").eq("id", id).maybeSingle();
    if (error) return err(500, "db_error", error.message);
    if (!data) return err(404, "not_found", "comment not found");
    return ok(data);
  }
  if (method === "PATCH" || method === "PUT") {
    const b = await readJson(req);
    if (!b) return err(400, "invalid_input", "JSON body required");
    const patch: Record<string, unknown> = {};
    for (const k of ["author_name","content","approved","parent_id"]) if (k in b) patch[k] = b[k];
    if (b.created_at) patch.created_at = new Date(b.created_at).toISOString();
    const { data, error } = await supabase.from("comments").update(patch).eq("id", id).select().single();
    if (error) return err(400, "db_error", error.message);
    return ok(data);
  }
  if (method === "DELETE") {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return err(400, "db_error", error.message);
    return ok({ deleted: true });
  }
  return err(405, "method_not_allowed", "GET, PATCH, PUT, DELETE");
}

// ---------- images ----------
async function handleImages(ctx: Ctx, key?: string): Promise<Response> {
  const { method, req } = ctx;
  if (!key) {
    if (method === "POST") {
      const b = await readJson(req);
      if (!b?.data_url) return err(400, "invalid_input", "data_url required (data:<mime>;base64,...)");
      try {
        const r = await uploadDataUrl(b.data_url);
        return ok(r, 201);
      } catch (e) { return err(400, "upload_failed", (e as Error).message); }
    }
    if (method === "GET") {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).list("", { limit: 1000 });
      if (error) return err(500, "storage_error", error.message);
      return ok((data ?? []).map((f) => ({ key: f.name, size: (f as any).metadata?.size, url: `/api/public/images/${f.name}` })));
    }
    return err(405, "method_not_allowed", "GET, POST");
  }
  if (key.includes("/") || key.includes("..")) return err(400, "invalid_input", "bad key");
  if (method === "GET") {
    const { data, error } = await supabase.storage.from(IMAGE_BUCKET).download(key);
    if (error || !data) return err(404, "not_found", "image not found");
    const buf = await data.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: { ...CORS, "content-type": data.type || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable" },
    });
  }
  if (method === "DELETE") {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([key]);
    if (error) return err(400, "storage_error", error.message);
    return ok({ deleted: true, key });
  }
  return err(405, "method_not_allowed", "GET, DELETE");
}

// ---------- about ----------
async function handleAbout(ctx: Ctx): Promise<Response> {
  const { method, req } = ctx;
  if (method === "GET") {
    const { data: post, error } = await supabase.from("posts")
      .select("id, slug, title, content, cover_image, author_name, published_at, updated_at")
      .eq("slug", "_about").maybeSingle();
    if (error) return err(500, "db_error", error.message);
    return ok(post);
  }
  if (method === "PATCH" || method === "PUT") {
    const b = await readJson(req);
    if (!b) return err(400, "invalid_input", "JSON body required");
    const patch: Record<string, unknown> = {};
    if ("content" in b) patch.content = String(b.content ?? "");
    if ("cover_image" in b) patch.cover_image = b.cover_image ?? null;
    if ("title" in b) patch.title = b.title;
    if (typeof b.cover_image_upload === "string" && b.cover_image_upload.startsWith("data:")) {
      patch.cover_image = (await uploadDataUrl(b.cover_image_upload)).url;
    }
    const { data, error } = await supabase.from("posts").update(patch).eq("slug", "_about").select().single();
    if (error) return err(400, "db_error", error.message);
    return ok(data);
  }
  return err(405, "method_not_allowed", "GET, PATCH, PUT");
}

// ---------- settings ----------
async function handleSettings(ctx: Ctx, key?: string): Promise<Response> {
  const { method, req } = ctx;
  if (!key) {
    if (method === "GET") {
      const { data, error } = await supabase.from("site_settings").select("*").order("key");
      if (error) return err(500, "db_error", error.message);
      return ok(data ?? []);
    }
    if (method === "POST") {
      const b = await readJson(req);
      if (!b?.key || typeof b.value !== "string") return err(400, "invalid_input", "key and value required");
      if (String(b.value).length > 200000) return err(400, "invalid_input", "value too large (max 200000)");
      const { data, error } = await supabase.from("site_settings")
        .upsert({ key: b.key, value: b.value, updated_at: new Date().toISOString() }).select().single();
      if (error) return err(400, "db_error", error.message);
      return ok(data, 201);
    }
    return err(405, "method_not_allowed", "GET, POST");
  }
  if (method === "GET") {
    const { data, error } = await supabase.from("site_settings").select("*").eq("key", key).maybeSingle();
    if (error) return err(500, "db_error", error.message);
    if (!data) return err(404, "not_found", "setting not found");
    return ok(data);
  }
  if (method === "PUT" || method === "PATCH") {
    const b = await readJson(req);
    if (!b || typeof b.value !== "string") return err(400, "invalid_input", "value required");
    if (b.value.length > 200000) return err(400, "invalid_input", "value too large (max 200000)");
    const { data, error } = await supabase.from("site_settings")
      .upsert({ key, value: b.value, updated_at: new Date().toISOString() }).select().single();
    if (error) return err(400, "db_error", error.message);
    return ok(data);
  }
  if (method === "DELETE") {
    const { error } = await supabase.from("site_settings").delete().eq("key", key);
    if (error) return err(400, "db_error", error.message);
    return ok({ deleted: true });
  }
  return err(405, "method_not_allowed", "GET, PUT, PATCH, DELETE");
}

// ---------- openapi ----------
function openapi() {
  return {
    openapi: "3.0.3",
    info: { title: "Lovable Cloud Blog API", version: "1.0.0",
      description: "Admin REST API. All endpoints except GET /health require header `x-api-key: <ADMIN_API_KEY>`." },
    components: {
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" } },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/health": { get: { security: [], summary: "Health check" } },
      "/posts": { get: { summary: "List posts (query: category, include_unpublished)" },
                  post: { summary: "Create post" } },
      "/posts/{id}": { get: {}, patch: {}, put: {}, delete: {},
                       parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } },
                                    { name: "by", in: "query", schema: { type: "string", enum: ["id","slug"] } }] },
      "/categories": { get: {}, post: {} },
      "/categories/{id}": { get: {}, patch: {}, put: {}, delete: {} },
      "/comments": { get: { summary: "List comments (query: post_id, approved)" }, post: {} },
      "/comments/{id}": { get: {}, patch: {}, put: {}, delete: {} },
      "/comments/{id}/approve": { post: { summary: "Body: {approved: boolean}" } },
      "/images": { get: { summary: "List images" }, post: { summary: "Upload {data_url}" } },
      "/images/{key}": { get: { summary: "Download raw image" }, delete: {} },
      "/about": { get: {}, patch: {}, put: {} },
      "/settings": { get: {}, post: {} },
      "/settings/{key}": { get: {}, put: {}, patch: {}, delete: {} },
    },
  };
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  // path is /api/... after functions/v1 stripping — normalize to segments after "api"
  const parts = url.pathname.split("/").filter(Boolean);
  const apiIdx = parts.indexOf("api");
  const segs = apiIdx >= 0 ? parts.slice(apiIdx + 1) : parts;
  try {
    return await route({ req, url, segs, method: req.method });
  } catch (e) {
    console.error(e);
    return err(500, "internal_error", (e as Error).message ?? "unknown");
  }
});
