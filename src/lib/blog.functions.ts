import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || `post-${Date.now()}`;
}

const IMAGE_BUCKET = "post-images";
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/gif": "gif", "image/avif": "avif",
};

export async function uploadImageToBucket(input: { data_url?: string; base64?: string; content_type?: string; filename?: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let contentType = input.content_type ?? "";
  let base64 = input.base64 ?? "";
  if (input.data_url) {
    const m = /^data:([^;]+);base64,(.+)$/.exec(input.data_url);
    if (!m) throw new Error("invalid data_url");
    contentType = m[1];
    base64 = m[2];
  }
  const ext = ALLOWED_MIME[contentType];
  if (!ext) throw new Error(`unsupported image type: ${contentType}`);
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bin.byteLength > 8 * 1024 * 1024) throw new Error("image too large (max 8MB)");
  const key = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(key, bin, {
    contentType, upsert: false,
  });
  if (error) throw new Error(error.message);
  return { key, url: `/api/public/images/${key}` };
}

export const uploadImage = createServerFn({ method: "POST" })
  .inputValidator((d: { data_url: string }) => z.object({ data_url: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => uploadImageToBucket({ data_url: data.data_url }));



export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("categories")
    .select("id, slug, name, description")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listPosts = createServerFn({ method: "GET" })
  .inputValidator((d: { categorySlug?: string; includeUnpublished?: boolean } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("posts")
      .select("id, slug, title, excerpt, cover_image, published, published_at, author_name, category:categories(slug, name)")
      .order("published_at", { ascending: false });
    if (!data.includeUnpublished) q = q.eq("published", true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const filtered = data.categorySlug
      ? (rows ?? []).filter((r: any) => r.category?.slug === data.categorySlug)
      : (rows ?? []);
    return filtered;
  });

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("posts")
      .select("id, slug, title, excerpt, content, cover_image, published, published_at, author_name, category:categories(slug, name)")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!post) return null;
    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select("id, post_id, parent_id, author_name, content, created_at, approved")
      .eq("post_id", post.id)
      .eq("approved", true)
      .order("created_at", { ascending: true });
    return { post, comments: comments ?? [] };
  });

const postInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().default(""),
  cover_image: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  author_name: z.string().min(1).max(80).default("Editor"),
  published: z.boolean().default(true),
  published_at: z.string().optional(),
});

export const upsertPost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => postInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.slug?.trim() || slugify(data.title);
    const payload = {
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      content: data.content,
      cover_image: data.cover_image || null,
      category_id: data.category_id || null,
      author_name: data.author_name,
      published: data.published,
      published_at: data.published_at ? new Date(data.published_at).toISOString() : new Date().toISOString(),
    };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin.from("posts").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabaseAdmin.from("posts").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePost = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPostById = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("posts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

const categoryInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  slug: z.string().optional(),
  description: z.string().max(500).optional().nullable(),
});

export const upsertCategory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => categoryInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slug = data.slug?.trim() || slugify(data.name);
    const payload = { name: data.name, slug, description: data.description || null };
    if (data.id) {
      const { data: row, error } = await supabaseAdmin.from("categories").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabaseAdmin.from("categories").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const commentInput = z.object({
  post_id: z.string().uuid(),
  parent_id: z.string().uuid().optional().nullable(),
  author_name: z.string().min(1).max(50),
  content: z.string().min(1).max(2000),
});

export const createComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commentInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("comments")
      .insert({
        post_id: data.post_id,
        parent_id: data.parent_id || null,
        author_name: data.author_name,
        content: data.content,
        approved: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listAllComments = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, post_id, parent_id, author_name, content, approved, created_at, post:posts(title, slug)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const commentUpdate = z.object({
  id: z.string().uuid(),
  author_name: z.string().min(1).max(50).optional(),
  content: z.string().min(1).max(2000).optional(),
  approved: z.boolean().optional(),
  created_at: z.string().optional(),
});

export const updateComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commentUpdate.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      author_name?: string;
      content?: string;
      approved?: boolean;
      created_at?: string;
    } = {};
    if (data.author_name !== undefined) patch.author_name = data.author_name;
    if (data.content !== undefined) patch.content = data.content;
    if (data.approved !== undefined) patch.approved = data.approved;
    if (data.created_at !== undefined) patch.created_at = new Date(data.created_at).toISOString();
    const { data: row, error } = await supabaseAdmin.from("comments").update(patch).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSetting = createServerFn({ method: "GET" })
  .inputValidator((d: { key: string }) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("site_settings").select("key, value").eq("key", data.key).maybeSingle();
    if (error) throw new Error(error.message);
    return row?.value ?? "";
  });

export const setSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; value: string }) =>
    z.object({ key: z.string().min(1), value: z.string().max(200000) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
