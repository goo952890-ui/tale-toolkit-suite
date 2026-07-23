import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function SiteHeader({ categories }: { categories: { slug: string; name: string }[] }) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="container-blog flex items-center justify-between py-4">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight">
          mysextrip<span className="text-primary">.</span>
        </Link>
        <nav className="hidden gap-6 text-sm font-medium md:flex">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              {c.name}
            </Link>
          ))}
          <Link to="/about" className="hover:text-primary" activeProps={{ className: "text-primary" }}>
            About Me
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-secondary/30">
      <div className="container-blog flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} mysextrip. All roads lead somewhere.</p>
        <p>Made for readers who want the truth on the road.</p>
      </div>
    </footer>
  );
}

export function SiteShell({ categories, children }: { categories: { slug: string; name: string }[]; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={categories} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
