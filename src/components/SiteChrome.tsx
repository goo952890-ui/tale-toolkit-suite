import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

type Cat = { slug: string; name: string };

function CategoriesMenu({ categories, onNavigate }: { categories: Cat[]; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:text-primary"
        aria-haspopup="true"
        aria-expanded={open}
      >
        Categories ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[200px] rounded-md border border-border bg-background p-2 shadow-lg">
          {categories.length === 0 && (
            <span className="block px-3 py-2 text-xs text-muted-foreground">No categories yet</span>
          )}
          {categories.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="block rounded px-3 py-2 text-sm hover:bg-muted hover:text-primary"
              activeProps={{ className: "block rounded px-3 py-2 text-sm bg-muted text-primary" }}
              onClick={() => { setOpen(false); onNavigate?.(); }}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ categories }: { categories: Cat[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-blog flex items-center justify-between gap-4 py-4">
        <Link to="/" className="font-serif text-2xl font-bold tracking-tight shrink-0">
          mysextrip<span className="text-primary">.</span>
        </Link>
        <nav className="hidden gap-6 text-sm font-medium md:flex md:items-center">
          <Link to="/about" className="hover:text-primary" activeProps={{ className: "text-primary" }}>
            About Me
          </Link>
          <CategoriesMenu categories={categories} />
        </nav>
        <button
          type="button"
          aria-label="Toggle menu"
          className="rounded-md border border-input p-2 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <>
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </>
            )}
          </svg>
        </button>
      </div>
      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container-blog flex flex-col gap-1 py-3 text-sm">
            <Link
              to="/about"
              onClick={() => setMobileOpen(false)}
              className="rounded px-3 py-2 hover:bg-muted"
              activeProps={{ className: "rounded px-3 py-2 bg-muted text-primary" }}
            >
              About Me
            </Link>
            <div className="mt-1 border-t border-border pt-2">
              <div className="px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground">Categories</div>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-3 py-2 hover:bg-muted"
                  activeProps={{ className: "block rounded px-3 py-2 bg-muted text-primary" }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
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

export function SiteShell({ categories, children }: { categories: Cat[]; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={categories} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
