import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPostBySlug, listCategories, createComment, listRelatedPosts } from "@/lib/blog.functions";
import { SiteShell } from "@/components/SiteChrome";
import { AdSlot } from "@/components/AdSlot";
import { useCaptcha, CaptchaField } from "@/components/Captcha";

const categoriesQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const postQ = (slug: string) =>
  queryOptions({ queryKey: ["post", slug], queryFn: () => getPostBySlug({ data: { slug } }) });
const relatedQ = (categorySlug: string | null | undefined, excludeSlug: string) =>
  queryOptions({
    queryKey: ["related", categorySlug ?? "_none", excludeSlug],
    queryFn: () => listRelatedPosts({ data: { categorySlug: categorySlug ?? null, excludeSlug, limit: 5 } }),
  });

export const Route = createFileRoute("/post/$slug")({
  loader: async ({ context, params }) => {
    context.queryClient.ensureQueryData(categoriesQ);
    const data = await context.queryClient.ensureQueryData(postQ(params.slug));
    if (!data) throw notFound();
    context.queryClient.ensureQueryData(relatedQ(data.post.category?.slug ?? null, params.slug));
    return { title: data.post.title, excerpt: data.post.excerpt, cover: data.post.cover_image };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} — mysextrip` : "mysextrip";
    const desc = loaderData?.excerpt ?? "Travel writing worth reading.";
    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
    ];
    if (loaderData?.cover) {
      meta.push({ property: "og:image", content: loaderData.cover });
      meta.push({ name: "twitter:image", content: loaderData.cover });
    }
    return { meta };
  },
  component: PostPage,
});

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

function renderInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <img key={`${keyPrefix}-img-${m.index}`} src={m[2]} alt={m[1]} className="my-6 h-auto w-full rounded-lg" />,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderContent(content: string) {
  const paras = content.split(/\n{2,}/);
  return paras.map((para, i) => {
    const trimmed = para.trim();
    const onlyImg = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (onlyImg) {
      return <img key={i} src={onlyImg[2]} alt={onlyImg[1]} className="my-6 h-auto w-full rounded-lg" />;
    }
    return <p key={i} className="whitespace-pre-wrap">{renderInline(para, String(i))}</p>;
  });
}

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  content: string;
  created_at: string;
};

function CommentThread({ items, parentId = null, postId, onReplyPosted }: {
  items: CommentRow[]; parentId?: string | null; postId: string; onReplyPosted: () => void;
}) {
  const kids = items.filter((c) => c.parent_id === parentId);
  if (!kids.length) return null;
  return (
    <ul className={parentId ? "mt-3 space-y-4 border-l-2 border-border pl-4" : "space-y-6"}>
      {kids.map((c) => (
        <li key={c.id}>
          <CommentItem comment={c} postId={postId} onReplyPosted={onReplyPosted} />
          <CommentThread items={items} parentId={c.id} postId={postId} onReplyPosted={onReplyPosted} />
        </li>
      ))}
    </ul>
  );
}

function CommentItem({ comment, postId, onReplyPosted }: { comment: CommentRow; postId: string; onReplyPosted: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cap = useCaptcha();
  const post = useServerFn(createComment);
  return (
    <div>
      <div className="text-sm">
        <span className="font-semibold">{comment.author_name}</span>
        <span className="ml-2 text-xs text-muted-foreground">{fmtDate(comment.created_at)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      <button className="mt-1 text-xs text-primary hover:underline" onClick={() => setOpen((v) => !v)}>
        {open ? "Cancel" : "Reply"}
      </button>
      {open && (
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || !text.trim()) return;
            if (!cap.valid) { setErr("Captcha answer is wrong."); return; }
            setBusy(true); setErr(null);
            try {
              await post({ data: { post_id: postId, parent_id: comment.id, author_name: name, content: text } });
              setName(""); setText(""); setOpen(false); cap.reset();
              onReplyPosted();
            } finally { setBusy(false); }
          }}
        >
          <input
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50}
          />
          <textarea
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm" rows={3}
            placeholder="Reply..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          />
          <CaptchaField question={cap.question} value={cap.user} onChange={cap.setUser} />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button disabled={busy} className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60">
            {busy ? "Posting..." : "Post reply"}
          </button>
        </form>
      )}
    </div>
  );
}

function PostPage() {
  const { slug } = Route.useParams();
  const { data: categories } = useSuspenseQuery(categoriesQ);
  const { data } = useSuspenseQuery(postQ(slug));
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cap = useCaptcha();
  const post = useServerFn(createComment);
  if (!data) return null;
  const { post: p, comments } = data;
  const { data: related } = useSuspenseQuery(relatedQ(p.category?.slug ?? null, slug));
  const refresh = () => qc.invalidateQueries({ queryKey: ["post", slug] });

  return (
    <SiteShell categories={categories}>
      <article className="container-blog py-10">
        <div className="mx-auto max-w-3xl">
          {p.category && (
            <Link to="/category/$slug" params={{ slug: p.category.slug }} className="text-xs font-semibold uppercase tracking-widest text-primary">
              {p.category.name}
            </Link>
          )}
          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight md:text-6xl">{p.title}</h1>
          {p.excerpt && <p className="mt-3 text-xl text-muted-foreground">{p.excerpt}</p>}
          <div className="mt-4 text-sm text-muted-foreground">
            {p.author_name} · {fmtDate(p.published_at)}
          </div>
        </div>
        {p.cover_image && (
          <div className="mx-auto mt-8 aspect-[16/9] max-w-4xl overflow-hidden rounded-lg">
            <img src={p.cover_image} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="mx-auto mt-10 grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="prose-blog">{renderContent(p.content)}</div>

            <section className="mt-12">
              <h2 className="font-serif text-2xl font-bold">Comments</h2>
              <form
                className="mt-4 space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!name.trim() || !text.trim()) return;
                  if (!cap.valid) { setErr("Captcha answer is wrong."); return; }
                  setBusy(true); setErr(null);
                  try {
                    await post({ data: { post_id: p.id, author_name: name, content: text } });
                    setName(""); setText(""); cap.reset(); refresh();
                  } finally { setBusy(false); }
                }}
              >
                <input
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50}
                />
                <textarea
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm" rows={4}
                  placeholder="Say something..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
                />
                <CaptchaField question={cap.question} value={cap.user} onChange={cap.setUser} />
                {err && <p className="text-xs text-destructive">{err}</p>}
                <button disabled={busy} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
                  {busy ? "Posting..." : "Post comment"}
                </button>
              </form>

              <div className="mt-8">
                <CommentThread items={comments as CommentRow[]} postId={p.id} onReplyPosted={refresh} />
                {comments.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
              </div>
            </section>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
            <AdSlot size="square" />
            {related.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5">
                <h4 className="font-serif text-lg font-semibold">
                  {p.category ? `More in ${p.category.name}` : "More stories"}
                </h4>
                <ul className="mt-4 space-y-4">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link to="/post/$slug" params={{ slug: r.slug }} className="group flex gap-3">
                        <div className="h-16 w-20 shrink-0 overflow-hidden rounded bg-muted">
                          {r.cover_image && (
                            <img src={r.cover_image} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-primary">{r.title}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{fmtDate(r.published_at)}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AdSlot size="skyscraper" />
          </aside>
        </div>
      </article>
    </SiteShell>
  );
}
