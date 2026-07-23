import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  post_id: z.string().uuid().optional(),
  post_slug: z.string().optional(),
  parent_id: z.string().uuid().optional().nullable(),
  author_name: z.string().min(1).max(50),
  content: z.string().min(1).max(2000),
}).refine((v) => v.post_id || v.post_slug, { message: "post_id or post_slug required" });

export const Route = createFileRoute("/api/public/comments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 }); }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid input", details: parsed.error.flatten() }), { status: 400, headers: { "content-type": "application/json" } });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let postId = parsed.data.post_id;
        if (!postId && parsed.data.post_slug) {
          const { data: p } = await supabaseAdmin.from("posts").select("id").eq("slug", parsed.data.post_slug).maybeSingle();
          if (!p) return new Response(JSON.stringify({ error: "post not found" }), { status: 404, headers: { "content-type": "application/json" } });
          postId = p.id;
        }
        const { data, error } = await supabaseAdmin.from("comments").insert({
          post_id: postId!,
          parent_id: parsed.data.parent_id || null,
          author_name: parsed.data.author_name,
          content: parsed.data.content,
          approved: true,
        }).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
        return Response.json({ comment: data }, { status: 201 });
      },
    },
  },
});
