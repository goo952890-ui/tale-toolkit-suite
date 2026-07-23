import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/blog.functions";

const aboutQ = queryOptions({
  queryKey: ["setting", "about"],
  queryFn: () => getSetting({ data: { key: "about" } }),
});

export const Route = createFileRoute("/djemals/about")({
  loader: ({ context }) => context.queryClient.ensureQueryData(aboutQ),
  component: AdminAbout,
});

function AdminAbout() {
  const { data } = useSuspenseQuery(aboutQ);
  const qc = useQueryClient();
  const save = useServerFn(setSetting);
  const [value, setValue] = useState(data);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => { setValue(data); }, [data]);

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl font-bold">About Me</h1>
        <a href="/about" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary">
          View page ↗
        </a>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Plain text with markdown-style images: <code>![alt](https://...)</code>. Blank line = new paragraph.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={24}
        className="mt-4 w-full rounded-md border border-input bg-background p-4 font-mono text-sm"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true); setStatus(null);
            try {
              await save({ data: { key: "about", value } });
              await qc.invalidateQueries({ queryKey: ["setting", "about"] });
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
