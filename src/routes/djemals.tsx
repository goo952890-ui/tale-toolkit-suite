import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/djemals")({
  head: () => ({ meta: [{ title: "Admin" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminLayout,
});

const tabs = [
  { to: "/djemals", label: "Dashboard", exact: true },
  { to: "/djemals/posts", label: "Posts" },
  { to: "/djemals/categories", label: "Categories" },
  { to: "/djemals/comments", label: "Comments" },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container-blog flex items-center justify-between py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">mysextrip</div>
            <div className="font-serif text-lg font-bold">Admin console</div>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to site</Link>
        </div>
        <nav className="container-blog flex gap-1 overflow-x-auto pb-2 text-sm">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`rounded-md px-3 py-1.5 ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="container-blog py-8">
        <Outlet />
      </main>
    </div>
  );
}
