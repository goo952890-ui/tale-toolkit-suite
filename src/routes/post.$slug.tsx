import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPostBySlug, listCategories, createComment } from "@/lib/blog.functions";
import { SiteShell } from "@/components/SiteChrome";
import { AdSlot } from "@/components/AdSlot";

const categoriesQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const postQ = (slug: string) =>
  queryOptions({ queryKey: ["post", slug], queryFn: () => getPostBySlug({ data: { slug } }) });

export const Route = createFileRoute("/post/$slug")({
  loader: async ({ context, params }) => {
    context.queryClient.ensureQueryData(categoriesQ);
    const data = await context.queryClient.ensureQueryData(postQ(params.slug));
    if (!data) throw notFound();
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
            setBusy(true);
            try {
              await post({ data: { post_id: postId, parent_id: comment.id, author_name: name, content: text } });
              setName(""); setText(""); setOpen(false);
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
  const post = useServerFn(createComment);
  if (!data) return null;
  const { post: p, comments } = data;
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
        <div className="mx-auto mt-10 max-w-3xl">
          <AdSlot size="leaderboard" />
        </div>
        <div className="mx-auto mt-10 max-w-3xl prose-blog">
          {p.content.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        <div className="mx-auto my-12 max-w-3xl">
          <AdSlot size="inline" />
        </div>

        <section className="mx-auto max-w-3xl">
          <h2 className="font-serif text-2xl font-bold">Comments</h2>
          <form
            className="mt-4 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim() || !text.trim()) return;
              setBusy(true);
              try {
                await post({ data: { post_id: p.id, author_name: name, content: text } });
                setName(""); setText(""); refresh();
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
            <button disabled={busy} className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
              {busy ? "Posting..." : "Post comment"}
            </button>
          </form>

          <div className="mt-8">
            <CommentThread items={comments as CommentRow[]} postId={p.id} onReplyPosted={refresh} />
            {comments.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
          </div>
        </section>
      </article>
    </SiteShell>
  );
}
