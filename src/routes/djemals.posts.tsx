import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/djemals/posts")({
  component: PostsLayout,
});

function PostsLayout() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">Posts</h1>
        <Link to="/djemals/posts/new" className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">+ New post</Link>
      </div>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  );
}
