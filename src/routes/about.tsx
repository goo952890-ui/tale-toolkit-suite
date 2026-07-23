import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getAboutPost, listCategories, createComment } from "@/lib/blog.functions";
import { SiteShell } from "@/components/SiteChrome";
import { AdSlot } from "@/components/AdSlot";
import { useCaptcha, CaptchaField } from "@/components/Captcha";

const categoriesQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const aboutQ = queryOptions({ queryKey: ["about-public"], queryFn: () => getAboutPost() });

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Me — mysextrip" },
      { name: "description", content: "About the person behind mysextrip." },
      { property: "og:title", content: "About Me — mysextrip" },
      { property: "og:description", content: "About the person behind mysextrip." },
    ],
  }),
  loader: async ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQ);
    const data = await context.queryClient.ensureQueryData(aboutQ);
    if (!data) throw notFound();
  },
  component: AboutPage,
});

const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

function renderInline(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<img key={`${keyPrefix}-${m.index}`} src={m[2]} alt={m[1]} className="my-6 h-auto w-full rounded-lg" />);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderContent(content: string) {
  return content.split(/\n{2,}/).map((para, i) => {
    const trimmed = para.trim();
    const h1 = /^#\s+(.+)$/.exec(trimmed);
    if (h1) return <h1 key={i} className="font-serif text-4xl font-bold">{h1[1]}</h1>;
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    if (h2) return <h2 key={i} className="mt-8 font-serif text-2xl font-semibold">{h2[1]}</h2>;
    const onlyImg = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (onlyImg) return <img key={i} src={onlyImg[2]} alt={onlyImg[1]} className="my-6 h-auto w-full rounded-lg" />;
    return <p key={i} className="whitespace-pre-wrap leading-relaxed">{renderInline(para, String(i))}</p>;
  });
}

type CommentRow = {
  id: string; post_id: string; parent_id: string | null;
  author_name: string; content: string; created_at: string;
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

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
        <span className="ml-2 text-xs text-muted-foreground">{fmt(comment.created_at)}</span>
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
          <input className="w-full rounded border border-input bg-background px-3 py-2 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
          <textarea className="w-full rounded border border-input bg-background px-3 py-2 text-sm" rows={3} placeholder="Reply..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
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

function AboutPage() {
  const { data: categories } = useSuspenseQuery(categoriesQ);
  const { data } = useSuspenseQuery(aboutQ);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cap = useCaptcha();
  const post = useServerFn(createComment);
  if (!data) return null;
  const { post: p, comments } = data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["about-public"] });

  return (
    <SiteShell categories={categories}>
      <article className="container-blog py-10">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif text-4xl font-bold leading-tight md:text-6xl">About Me</h1>
        </div>
        {p.cover_image && (
          <div className="mx-auto mt-8 aspect-[16/9] max-w-4xl overflow-hidden rounded-lg">
            <img src={p.cover_image} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="prose-blog space-y-4 text-lg text-foreground">
            {p.content ? renderContent(p.content) : <p className="text-muted-foreground">Nothing here yet.</p>}
          </div>
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <AdSlot size="square" />
            <AdSlot size="skyscraper" />
          </aside>
        </div>

        <section className="mx-auto mt-12 max-w-3xl">
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
            <input className="w-full rounded border border-input bg-background px-3 py-2 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
            <textarea className="w-full rounded border border-input bg-background px-3 py-2 text-sm" rows={4} placeholder="Say something..." value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
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
      </article>
    </SiteShell>
  );
}
