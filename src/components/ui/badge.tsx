import { cn } from "@/lib/ui/cn";

export function Badge({ label, tone }: { label: string; tone: "ok" | "error" | "syncing" | "idle" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        tone === "ok" && "bg-emerald-100 text-emerald-900",
        tone === "error" && "bg-rose-100 text-rose-900",
        tone === "syncing" && "bg-sky-100 text-sky-900",
        tone === "idle" && "bg-stone-200 text-stone-800"
      )}
    >
      {label}
    </span>
  );
}
