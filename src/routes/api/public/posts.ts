import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { uploadImageToBucket } from "@/lib/blog.functions";

const imageInput = z.object({
  placeholder: z.string().min(1),
  data_url: z.string().optional(),
  base64: z.string().optional(),
  content_type: z.string().optional(),
}).refine((v) => v.data_url || (v.base64 && v.content_type), {
  message: "each image needs data_url, or base64+content_type",
});

const schema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().default(""),
  cover_image: z.string().url().optional().nullable(),
  cover_image_upload: z.object({
    data_url: z.string().optional(),
    base64: z.string().optional(),
    content_type: z.string().optional(),
  }).optional(),
  category_slug: z.string().optional().nullable(),
  author_name: z.string().min(1).max(80).default("Editor"),
  published: z.boolean().default(true),
  published_at: z.string().optional(),
  images: z.array(imageInput).optional(),
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || `post-${Date.now()}`;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const Route = createFileRoute("/api/public/posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminKey = process.env.ADMIN_API_KEY;
        const provided = request.headers.get("x-api-key");
        if (adminKey && provided !== adminKey) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        let body: unknown;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 }); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid input", details: parsed.error.flatten() }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let content = parsed.data.content;
        const uploaded: Array<{ placeholder: string; url: string }> = [];
        try {
          if (parsed.data.images?.length) {
            for (const img of parsed.data.images) {
              const res = await uploadImageToBucket({
                data_url: img.data_url,
                base64: img.base64,
                content_type: img.content_type,
              });
              uploaded.push({ placeholder: img.placeholder, url: res.url });
              const re = new RegExp(`\\{\\{\\s*${escapeRe(img.placeholder)}\\s*\\}\\}`, "g");
              content = content.replace(re, `![](${res.url})`);
            }
          }

          let coverUrl = parsed.data.cover_image ?? null;
          if (parsed.data.cover_image_upload) {
            const res = await uploadImageToBucket(parsed.data.cover_image_upload);
            coverUrl = res.url;
          }

          let categoryId: string | null = null;
          if (parsed.data.category_slug) {
            const { data: cat } = await supabaseAdmin.from("categories").select("id").eq("slug", parsed.data.category_slug).maybeSingle();
            categoryId = cat?.id ?? null;
          }
          const slug = parsed.data.slug?.trim() || slugify(parsed.data.title);
          const { data, error } = await supabaseAdmin.from("posts").insert({
            title: parsed.data.title,
            slug,
            excerpt: parsed.data.excerpt ?? null,
            content,
            cover_image: coverUrl,
            category_id: categoryId,
            author_name: parsed.data.author_name,
            published: parsed.data.published,
            published_at: parsed.data.published_at ? new Date(parsed.data.published_at).toISOString() : new Date().toISOString(),
          }).select().single();
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
          return Response.json({ post: data, images: uploaded }, { status: 201 });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "failed" }), { status: 400, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
