import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/djemals/api-docs")({
  component: ApiDocs,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-foreground/90">{children}</div>
    </section>
  );
}

function ApiDocs() {
  const base = typeof window !== "undefined" ? window.location.origin : "https://your-site";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">API Usage</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Public endpoints for creating posts and comments programmatically.
        </p>
      </div>

      <Section title="Authentication">
        <p>
          The posts endpoint checks the <code>x-api-key</code> header against the server env
          variable <code>ADMIN_API_KEY</code>. If <code>ADMIN_API_KEY</code> is not set, the
          endpoint is open. The comments endpoint is always open.
        </p>
      </Section>

      <Section title="POST /api/public/posts">
        <p>Create a new post. Optionally upload cover + inline images in the same request.</p>
        <p className="font-semibold">Body (JSON)</p>
        <Code>{`{
  "title": "My trip to Lisbon",
  "slug": "my-trip-to-lisbon",           // optional, auto from title
  "excerpt": "Short summary",             // optional
  "content": "Intro paragraph.\\n\\n{{hero}}\\n\\nMore text here. {{map}}",
  "cover_image": "https://...",           // optional, or use cover_image_upload
  "cover_image_upload": {                 // optional
    "data_url": "data:image/jpeg;base64,..."
  },
  "category_slug": "guides",              // optional
  "author_name": "Editor",
  "published": true,
  "published_at": "2025-01-15T09:00:00Z", // optional, backdate allowed
  "images": [
    { "placeholder": "hero", "data_url": "data:image/png;base64,..." },
    { "placeholder": "map",  "base64": "iVBORw0K...", "content_type": "image/png" }
  ]
}`}</Code>
        <p className="font-semibold">How inline images work</p>
        <p>
          For each entry in <code>images</code>, the server uploads the image and replaces every{" "}
          <code>{"{{placeholder}}"}</code> token in <code>content</code> with a markdown image
          pointing to the uploaded URL. Move the <code>{"{{placeholder}}"}</code> token in the
          content to change where the image appears.
        </p>
        <p className="font-semibold">cURL example</p>
        <Code>{`curl -X POST ${base}/api/public/posts \\
  -H "content-type: application/json" \\
  -H "x-api-key: $ADMIN_API_KEY" \\
  -d '{
    "title": "Hello world",
    "content": "Opening line.\\n\\n{{shot1}}\\n\\nClosing line.",
    "images": [
      { "placeholder": "shot1", "data_url": "data:image/jpeg;base64,/9j/4AAQ..." }
    ]
  }'`}</Code>
        <p className="font-semibold">Response</p>
        <Code>{`201 Created
{ "post": { "id": "...", "slug": "hello-world", ... },
  "images": [ { "placeholder": "shot1", "url": "/api/public/images/xxx.jpg" } ] }`}</Code>
      </Section>

      <Section title="POST /api/public/comments">
        <p>Add a comment or reply. Provide either <code>post_id</code> or <code>post_slug</code>.</p>
        <p className="font-semibold">Body (JSON)</p>
        <Code>{`{
  "post_slug": "my-trip-to-lisbon",       // or "post_id": "<uuid>"
  "parent_id": null,                       // set to a comment id for a reply
  "author_name": "Alex",
  "content": "Great write-up!"
}`}</Code>
        <p className="font-semibold">cURL example</p>
        <Code>{`curl -X POST ${base}/api/public/comments \\
  -H "content-type: application/json" \\
  -d '{"post_slug":"my-trip-to-lisbon","author_name":"Alex","content":"Nice!"}'`}</Code>
        <p className="font-semibold">Reply to a comment</p>
        <Code>{`{
  "post_slug": "my-trip-to-lisbon",
  "parent_id": "COMMENT_UUID_YOU_ARE_REPLYING_TO",
  "author_name": "Editor",
  "content": "Thanks!"
}`}</Code>
      </Section>

      <Section title="Errors">
        <p>All errors return JSON: <code>{`{ "error": "message" }`}</code>. Validation errors
          include <code>details</code>. Common statuses: <code>400</code> invalid input,{" "}
          <code>401</code> bad api key, <code>404</code> post not found, <code>500</code> server error.</p>
      </Section>
    </div>
  );
}
