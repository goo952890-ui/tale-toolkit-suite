import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().default(""),
  cover_image: z.string().url().optional().nullable(),
  category_slug: z.string().optional().nullable(),
  author_name: z.string().min(1).max(80).default("Editor"),
  published: z.boolean().default(true),
  published_at: z.string().optional(),
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80) || `post-${Date.now()}`;
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
          content: parsed.data.content,
          cover_image: parsed.data.cover_image ?? null,
          category_id: categoryId,
          author_name: parsed.data.author_name,
          published: parsed.data.published,
          published_at: parsed.data.published_at ? new Date(parsed.data.published_at).toISOString() : new Date().toISOString(),
        }).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        return Response.json({ post: data }, { status: 201 });
      },
    },
  },
});
