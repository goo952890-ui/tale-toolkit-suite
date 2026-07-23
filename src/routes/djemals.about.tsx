import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getAboutPost, updateAboutContent } from "@/lib/blog.functions";
import { MarkdownEditor } from "@/components/MarkdownEditor";

const aboutQ = queryOptions({
  queryKey: ["about-post"],
  queryFn: () => getAboutPost(),
});

export const Route = createFileRoute("/djemals/about")({
  loader: ({ context }) => context.queryClient.ensureQueryData(aboutQ),
  component: AdminAbout,
});

function AdminAbout() {
  const { data } = useSuspenseQuery(aboutQ);
  const qc = useQueryClient();
  const save = useServerFn(updateAboutContent);
  const [value, setValue] = useState(data?.post.content ?? "");
  const [cover, setCover] = useState(data?.post.cover_image ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setValue(data?.post.content ?? "");
    setCover(data?.post.cover_image ?? "");
  }, [data]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl font-bold">About Me</h1>
        <a href="/about" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary">
          View page ↗
        </a>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Rendered as a regular post with a comments section. Use markdown; images with <code>![alt](url)</code>.
      </p>
      <div className="mt-4 space-y-2">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Cover image URL (optional)</label>
        <input
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          value={cover ?? ""}
          onChange={(e) => setCover(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="mt-4">
        <MarkdownEditor value={value} onChange={setValue} height={520} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true); setStatus(null);
            try {
              await save({ data: { content: value, cover_image: cover || null } });
              await qc.invalidateQueries({ queryKey: ["about-post"] });
              setStatus("Saved.");
            } catch (err) {
              setStatus((err as Error).message);
            } finally { setBusy(false); }
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
}
