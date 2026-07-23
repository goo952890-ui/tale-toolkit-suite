import { useRef, useState } from "react";
import { uploadImage } from "@/lib/blog.functions";
import { useServerFn } from "@tanstack/react-start";

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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
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
  const [uploading, setUploading] = useState<"cover" | "inline" | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const upload = useServerFn(uploadImage);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | null>(null);

  async function handleCoverFile(file: File) {
    setUploadErr(null);
    setUploading("cover");
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await upload({ data: { data_url: dataUrl } });
      setCover(res.url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function handleInlineFile(file: File) {
    setUploadErr(null);
    setUploading("inline");
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await upload({ data: { data_url: dataUrl } });
      insertAtCursor(`\n\n![](${res.url})\n\n`);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(null);
    }
  }

  function insertAtCursor(snippet: string) {
    const ta = contentRef.current;
    if (!ta) { setContent((c) => c + snippet); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  }

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inlineInputRef.current?.click()}
            disabled={uploading !== null}
            className="rounded border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            {uploading === "inline" ? "Uploading..." : "📷 Insert image at cursor"}
          </button>
          <span className="text-[11px] text-muted-foreground">Uses <code>![](url)</code> markdown. Move it anywhere in the text.</span>
          <input
            ref={inlineInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleInlineFile(f); e.target.value = ""; }}
          />
        </div>

        <textarea
          ref={contentRef}
          className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm"
          rows={20}
          placeholder="Body. Blank lines make paragraphs. Insert images with ![alt](url)."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
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
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image</label>
          {cover && (
            <div className="mt-2 overflow-hidden rounded border border-border">
              <img src={cover} alt="" className="h-32 w-full object-cover" />
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading !== null}
              className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {uploading === "cover" ? "Uploading..." : cover ? "Replace" : "Upload"}
            </button>
            {cover && (
              <button type="button" onClick={() => setCover("")} className="rounded border border-input bg-background px-3 py-1.5 text-xs hover:bg-muted">
                Remove
              </button>
            )}
          </div>
          <input
            ref={coverInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); e.target.value = ""; }}
          />
          <input
            className="mt-2 w-full rounded border border-input bg-background px-3 py-2 text-[11px]"
            value={cover ?? ""} onChange={(e) => setCover(e.target.value)} placeholder="or paste URL"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Author</label>
          <input className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        {uploadErr && <p className="text-xs text-destructive">{uploadErr}</p>}
        <button disabled={busy || uploading !== null} className="w-full rounded bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy ? "Saving..." : "Save post"}
        </button>
      </aside>
    </form>
  );
}
