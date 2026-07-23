import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: posts }, { data: cats }] = await Promise.all([
          supabaseAdmin.from("posts").select("slug, updated_at").eq("published", true),
          supabaseAdmin.from("categories").select("slug"),
        ]);
        const urls = [
          `<url><loc>${BASE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
          ...(cats ?? []).map((c) => `<url><loc>${BASE_URL}/category/${c.slug}</loc><changefreq>weekly</changefreq></url>`),
          ...(posts ?? []).map((p) => `<url><loc>${BASE_URL}/post/${p.slug}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
