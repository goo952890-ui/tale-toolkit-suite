import { lazy, Suspense, useEffect, useState } from "react";

const MDEditor = lazy(() => import("@uiw/react-md-editor"));

export function MarkdownEditor({
  value,
  onChange,
  height = 500,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  placeholder?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        className="flex w-full items-center justify-center rounded border border-input bg-background text-sm text-muted-foreground"
        style={{ height }}
      >
        Loading editor…
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <div
          className="flex w-full items-center justify-center rounded border border-input bg-background text-sm text-muted-foreground"
          style={{ height }}
        >
          Loading editor…
        </div>
      }
    >
      <div data-color-mode="light">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          height={height}
          preview="edit"
          textareaProps={{ placeholder }}
        />
      </div>
    </Suspense>
  );
}
