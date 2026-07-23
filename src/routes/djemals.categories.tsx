import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listCategories, upsertCategory, deleteCategory } from "@/lib/blog.functions";

const q = queryOptions({ queryKey: ["categories"], queryFn: () => listCategories() });

export const Route = createFileRoute("/djemals/categories")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Page,
});

function Page() {
  const { data: cats } = useSuspenseQuery(q);
  const qc = useQueryClient();
  const save = useServerFn(upsertCategory);
  const del = useServerFn(deleteCategory);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_320px]">
      <div>
        <h1 className="font-serif text-3xl font-bold">Categories</h1>
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
          {cats.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">/{c.slug} · {c.description ?? "—"}</div>
              </div>
              <div className="flex gap-2 text-sm">
                <button className="text-primary hover:underline" onClick={() => { setEditing(c.id); setName(c.name); setSlug(c.slug); setDesc(c.description ?? ""); }}>Edit</button>
                <button className="text-destructive hover:underline" onClick={async () => {
                  if (!confirm(`Delete "${c.name}"?`)) return;
                  await del({ data: { id: c.id } }); refresh();
                }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <aside className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-serif text-lg font-semibold">{editing ? "Edit category" : "New category"}</h2>
        <form className="mt-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const trimmedName = name.trim();
          if (!trimmedName) return;
          await save({ data: { id: editing ?? undefined, name: trimmedName, slug: slug.trim() || undefined, description: desc.trim() || null } });
          setName(""); setSlug(""); setDesc(""); setEditing(null); refresh();
        }}>

          <input className="w-full rounded border border-input bg-background px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="w-full rounded border border-input bg-background px-3 py-2 text-sm" placeholder="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <textarea className="w-full rounded border border-input bg-background px-3 py-2 text-sm" rows={2} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground">{editing ? "Update" : "Create"}</button>
            {editing && <button type="button" className="text-sm text-muted-foreground" onClick={() => { setEditing(null); setName(""); setSlug(""); setDesc(""); }}>Cancel</button>}
          </div>
        </form>
      </aside>
    </div>
  );
}
