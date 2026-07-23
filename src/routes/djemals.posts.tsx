import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deletePost, listPosts } from "@/lib/blog.functions";

const q = queryOptions({ queryKey: ["admin", "posts"], queryFn: () => listPosts({ data: { includeUnpublished: true } }) });

export const Route = createFileRoute("/djemals/posts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Page,
});

function Page() {
  const { data: posts } = useSuspenseQuery(q);
  const qc = useQueryClient();
  const del = useServerFn(deletePost);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">Posts</h1>
        <Link to="/djemals/posts/new" className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">+ New post</Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Published at</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((p: any) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-muted-foreground">/{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(p.published_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs ${p.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {p.published ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to="/djemals/posts/$id" params={{ id: p.id }} className="text-primary hover:underline">Edit</Link>
                  <button className="ml-3 text-destructive hover:underline" onClick={async () => {
                    if (!confirm(`Delete "${p.title}"?`)) return;
                    await del({ data: { id: p.id } });
                    qc.invalidateQueries({ queryKey: ["admin", "posts"] });
                  }}>Delete</button>
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No posts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
