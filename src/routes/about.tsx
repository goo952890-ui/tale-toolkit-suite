import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getSetting, listCategories } from "@/lib/blog.functions";
import { SiteShell } from "@/components/SiteChrome";

const categoriesQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const aboutQ = queryOptions({
  queryKey: ["setting", "about"],
  queryFn: () => getSetting({ data: { key: "about" } }),
});

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Me — mysextrip" },
      { name: "description", content: "About the person behind mysextrip." },
      { property: "og:title", content: "About Me — mysextrip" },
      { property: "og:description", content: "About the person behind mysextrip." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQ);
    context.queryClient.ensureQueryData(aboutQ);
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

function AboutPage() {
  const { data: categories } = useSuspenseQuery(categoriesQ);
  const { data: content } = useSuspenseQuery(aboutQ);
  return (
    <SiteShell categories={categories}>
      <article className="container-blog max-w-3xl py-16">
        <div className="space-y-4 text-lg text-foreground">
          {content ? renderContent(content) : <p className="text-muted-foreground">Nothing here yet.</p>}
        </div>
      </article>
    </SiteShell>
  );
}
