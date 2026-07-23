import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listCategories, listPosts } from "@/lib/blog.functions";
import { SiteShell } from "@/components/SiteChrome";
import { AdSlot } from "@/components/AdSlot";

const categoriesQ = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });
const catPostsQ = (slug: string) =>
  queryOptions({ queryKey: ["posts", "cat", slug], queryFn: () => listPosts({ data: { categorySlug: slug } }) });

export const Route = createFileRoute("/category/$slug")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(categoriesQ);
    context.queryClient.ensureQueryData(catPostsQ(params.slug));
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — mysextrip` },
      { name: "description", content: `Posts in ${params.slug}` },
      { property: "og:title", content: `${params.slug} — mysextrip` },
      { property: "og:description", content: `Posts in ${params.slug}` },
    ],
  }),
  component: CategoryPage,
});

function fmt(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: categories } = useSuspenseQuery(categoriesQ);
  const { data: posts } = useSuspenseQuery(catPostsQ(slug));
  const cat = categories.find((c) => c.slug === slug);
  return (
    <SiteShell categories={categories}>
      <section className="container-blog py-10">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Category</span>
        <h1 className="mt-1 font-serif text-4xl font-bold md:text-5xl">{cat?.name ?? slug}</h1>
        {cat?.description && <p className="mt-2 text-muted-foreground">{cat.description}</p>}
      </section>
      <div className="container-blog pb-6"><AdSlot size="leaderboard" /></div>
      <section className="container-blog grid gap-8 pb-16 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.id} to="/post/$slug" params={{ slug: p.slug }} className="group">
            <div className="aspect-[4/3] overflow-hidden rounded-md bg-gradient-to-br from-accent to-secondary">
              {p.cover_image && <img src={p.cover_image} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
            </div>
            <h3 className="mt-3 font-serif text-xl font-semibold leading-snug group-hover:text-primary">{p.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.excerpt}</p>
            <div className="mt-1 text-xs text-muted-foreground">{fmt(p.published_at)}</div>
          </Link>
        ))}
        {posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
      </section>
    </SiteShell>
  );
}
