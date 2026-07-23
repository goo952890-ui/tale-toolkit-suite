import { cn } from "@/lib/utils";

type Size = "leaderboard" | "square" | "skyscraper" | "inline";

const SIZES: Record<Size, { w: string; h: string; label: string }> = {
  leaderboard: { w: "w-full max-w-[728px]", h: "h-[90px]", label: "728 × 90" },
  square: { w: "w-[300px]", h: "h-[250px]", label: "300 × 250" },
  skyscraper: { w: "w-[300px]", h: "h-[600px]", label: "300 × 600" },
  inline: { w: "w-full", h: "h-[120px]", label: "Responsive" },
};

export function AdSlot({ size = "leaderboard", label, className }: { size?: Size; label?: string; className?: string }) {
  const s = SIZES[size];
  return (
    <div className={cn("mx-auto flex flex-col items-center gap-1", className)}>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Advertisement</span>
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-dashed border-border bg-muted/50 text-xs text-muted-foreground",
          s.w,
          s.h,
        )}
      >
        {label ?? `Ad slot · ${s.label}`}
      </div>
    </div>
  );
}
