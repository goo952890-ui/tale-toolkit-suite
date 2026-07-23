import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listCategories, listPosts } from "@/lib/blog.functions";
import { SiteShell } from "@/components/SiteChrome";
import { AdSlot } from "@/components/AdSlot";

const categoriesQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const postsQ = queryOptions({ queryKey: ["posts"], queryFn: () => listPosts({ data: {} }) });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "mysextrip — uncensored travel stories" },
      { name: "description", content: "Long-form travel essays, city guides worth using, and reviews without the fluff." },
      { property: "og:title", content: "mysextrip" },
      { property: "og:description", content: "Long-form travel essays, city guides worth using, and reviews without the fluff." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(categoriesQ);
    context.queryClient.ensureQueryData(postsQ);
  },
  component: Home,
});

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Home() {
  const { data: categories } = useSuspenseQuery(categoriesQ);
  const { data: posts } = useSuspenseQuery(postsQ);
  const [featured, ...rest] = posts;

  return (
    <SiteShell categories={categories}>
      <div className="border-b border-border bg-secondary/40">
        <div className="container-blog py-4">
          <AdSlot size="leaderboard" />
        </div>
      </div>

      <section className="container-blog py-10">
        <div className="mb-2 flex items-baseline justify-between">
          <h1 className="font-serif text-4xl font-bold md:text-6xl">Roads worth taking.</h1>
          <span className="hidden text-sm text-muted-foreground md:block">Fresh dispatch, weekly.</span>
        </div>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Long-form travel writing that doesn't take itself too seriously. Cities, stories, and honest reviews.
        </p>
      </section>

      {featured && (
        <section className="container-blog pb-12">
          <Link
            to="/post/$slug"
            params={{ slug: featured.slug }}
            className="group grid gap-6 md:grid-cols-[3fr_2fr] md:gap-10"
          >
            <div className="aspect-[16/10] overflow-hidden rounded-lg bg-gradient-to-br from-primary/30 via-accent to-secondary">
              {featured.cover_image && (
                <img src={featured.cover_image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              )}
            </div>
            <div className="flex flex-col justify-center">
              {featured.category && (
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">{featured.category.name}</span>
              )}
              <h2 className="mt-2 font-serif text-3xl font-bold leading-tight md:text-5xl group-hover:text-primary">
                {featured.title}
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">{featured.excerpt}</p>
              <div className="mt-4 text-sm text-muted-foreground">
                {featured.author_name} · {formatDate(featured.published_at)}
              </div>
            </div>
          </Link>
        </section>
      )}

      <section className="container-blog grid gap-10 pb-16 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-8 md:grid-cols-2">
          {rest.map((p, i) => (
            <>
              <article key={p.id} className="flex flex-col">
                <Link to="/post/$slug" params={{ slug: p.slug }} className="group">
                  <div className="aspect-[4/3] overflow-hidden rounded-md bg-gradient-to-br from-accent to-secondary">
                    {p.cover_image && (
                      <img src={p.cover_image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    )}
                  </div>
                  {p.category && (
                    <span className="mt-3 block text-[11px] font-semibold uppercase tracking-widest text-primary">
                      {p.category.name}
                    </span>
                  )}
                  <h3 className="mt-1 font-serif text-2xl font-semibold leading-tight group-hover:text-primary">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>
                  <div className="mt-2 text-xs text-muted-foreground">{formatDate(p.published_at)}</div>
                </Link>
              </article>
              {i === 1 && (
                <div key={`ad-${i}`} className="md:col-span-2">
                  <AdSlot size="inline" />
                </div>
              )}
            </>
          ))}
        </div>
        <aside className="space-y-8">
          <AdSlot size="square" />
          <div className="rounded-lg border border-border bg-card p-5">
            <h4 className="font-serif text-lg font-semibold">Categories</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link to="/category/$slug" params={{ slug: c.slug }} className="text-muted-foreground hover:text-primary">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <AdSlot size="skyscraper" />
        </aside>
      </section>
    </SiteShell>
  );
}
