import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { deleteComment, listAllComments, updateComment } from "@/lib/blog.functions";

const q = queryOptions({ queryKey: ["admin", "comments"], queryFn: () => listAllComments() });

export const Route = createFileRoute("/djemals/comments")({
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Page,
});

function toLocalDT(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Row({ c, onDone }: { c: any; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.author_name);
  const [content, setContent] = useState(c.content);
  const [date, setDate] = useState(toLocalDT(c.created_at));
  const [approved, setApproved] = useState<boolean>(c.approved);
  const upd = useServerFn(updateComment);
  const del = useServerFn(deleteComment);
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
              <textarea className="w-full rounded border border-input bg-background px-2 py-1 text-sm" rows={3} value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label>Date: <input type="datetime-local" className="rounded border border-input bg-background px-2 py-1" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> Approved</label>
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm"><span className="font-semibold">{c.author_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">on <em>{c.post?.title ?? "—"}</em> · {new Date(c.created_at).toLocaleString()}</span>
                {!c.approved && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">hidden</span>}
                {c.parent_id && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] uppercase">reply</span>}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          {editing ? (
            <>
              <button className="text-primary hover:underline" onClick={async () => {
                await upd({ data: { id: c.id, author_name: name, content, created_at: new Date(date).toISOString(), approved } });
                setEditing(false); onDone();
              }}>Save</button>
              <button className="text-muted-foreground" onClick={() => setEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              <button className="text-primary hover:underline" onClick={() => setEditing(true)}>Edit</button>
              <button className="text-destructive hover:underline" onClick={async () => {
                if (!confirm("Delete comment?")) return;
                await del({ data: { id: c.id } }); onDone();
              }}>Delete</button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function Page() {
  const { data } = useSuspenseQuery(q);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "comments"] });
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold">Comments</h1>
      <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
        {data.map((c: any) => <Row key={c.id} c={c} onDone={refresh} />)}
        {data.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No comments yet.</li>}
      </ul>
    </div>
  );
}
