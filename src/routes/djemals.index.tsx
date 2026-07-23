import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listAllComments, listCategories, listPosts } from "@/lib/blog.functions";

const q = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: async () => {
    const [posts, cats, comments] = await Promise.all([
      listPosts({ data: { includeUnpublished: true } }),
      listCategories(),
      listAllComments(),
    ]);
    return { posts, cats, comments };
  },
});

export const Route = createFileRoute("/djemals/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Dashboard,
});

function Card({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-card p-6 hover:border-primary">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-4xl font-bold">{value}</div>
    </Link>
  );
}

function Dashboard() {
  const { data } = useSuspenseQuery(q);
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Posts" value={data.posts.length} to="/djemals/posts" />
        <Card label="Categories" value={data.cats.length} to="/djemals/categories" />
        <Card label="Comments" value={data.comments.length} to="/djemals/comments" />
      </div>
      <div className="mt-10 rounded-lg border border-border bg-card p-6">
        <h2 className="font-serif text-xl font-semibold">API endpoints</h2>
        <ul className="mt-3 space-y-2 font-mono text-sm">
          <li><span className="rounded bg-primary/10 px-2 py-0.5 text-primary">POST</span> /api/public/posts — create a post</li>
          <li><span className="rounded bg-primary/10 px-2 py-0.5 text-primary">POST</span> /api/public/comments — add a comment or reply</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Header: <code>x-api-key: &lt;ADMIN_API_KEY&gt;</code> (posts only). Comments endpoint is open.</p>
      </div>
    </div>
  );
}
