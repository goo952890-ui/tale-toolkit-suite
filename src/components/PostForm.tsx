import { useState } from "react";

type Category = { id: string; name: string; slug: string };
type Initial = {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  cover_image?: string | null;
  category_id?: string | null;
  author_name?: string;
  published?: boolean;
  published_at?: string;
};

export type PostFormValues = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  cover_image?: string | null;
  category_id?: string | null;
  author_name: string;
  published: boolean;
  published_at: string;
};

function toLocalDT(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostForm({
  categories, initial, onSubmit, busy,
}: {
  categories: Category[];
  initial?: Initial;
  busy: boolean;
  onSubmit: (v: PostFormValues) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [cover, setCover] = useState(initial?.cover_image ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [author, setAuthor] = useState(initial?.author_name ?? "Editor");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [publishedAt, setPublishedAt] = useState(toLocalDT(initial?.published_at));

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title, slug: slug || undefined, excerpt: excerpt || null, content,
          cover_image: cover || null, category_id: categoryId || null,
          author_name: author, published,
          published_at: new Date(publishedAt).toISOString(),
        });
      }}
    >
      <div className="space-y-4">
        <input className="w-full rounded border border-input bg-background px-3 py-3 text-xl" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="w-full rounded border border-input bg-background px-3 py-2 text-sm" placeholder="Slug (auto if empty)" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <textarea className="w-full rounded border border-input bg-background px-3 py-2 text-sm" rows={2} placeholder="Excerpt" value={excerpt ?? ""} onChange={(e) => setExcerpt(e.target.value)} />
        <textarea className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm" rows={18} placeholder="Body (plain text or markdown-ish; blank lines make paragraphs)" value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
      <aside className="space-y-4 rounded-lg border border-border bg-card p-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Publish date</label>
          <input type="datetime-local" className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} required />
          <p className="mt-1 text-[11px] text-muted-foreground">Sets what the post shows as "posted on".</p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
          <select className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— none —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image URL</label>
          <input className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" value={cover ?? ""} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Author</label>
          <input className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <button disabled={busy} className="w-full rounded bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving..." : "Save post"}
        </button>
      </aside>
    </form>
  );
}
