import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { uploadImageToBucket } from "@/lib/blog.functions";

const jsonSchema = z.object({
  data_url: z.string().optional(),
  base64: z.string().optional(),
  content_type: z.string().optional(),
  filename: z.string().optional(),
}).refine((v) => v.data_url || (v.base64 && v.content_type), {
  message: "provide data_url, or base64+content_type",
});

export const Route = createFileRoute("/api/public/images")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminKey = process.env.ADMIN_API_KEY;
        const provided = request.headers.get("x-api-key");
        if (adminKey && provided !== adminKey) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
        }
        const ct = request.headers.get("content-type") || "";
        try {
          if (ct.includes("multipart/form-data")) {
            const form = await request.formData();
            const file = form.get("file");
            if (!(file instanceof File)) {
              return new Response(JSON.stringify({ error: "missing file" }), { status: 400, headers: { "content-type": "application/json" } });
            }
            const bytes = new Uint8Array(await file.arrayBuffer());
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            const b64 = btoa(bin);
            const result = await uploadImageToBucket({ base64: b64, content_type: file.type, filename: file.name });
            return Response.json(result, { status: 201 });
          }
          const body = await request.json();
          const parsed = jsonSchema.safeParse(body);
          if (!parsed.success) {
            return new Response(JSON.stringify({ error: "invalid input", details: parsed.error.flatten() }), { status: 400, headers: { "content-type": "application/json" } });
          }
          const result = await uploadImageToBucket(parsed.data);
          return Response.json(result, { status: 201 });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "upload failed" }), { status: 400, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
