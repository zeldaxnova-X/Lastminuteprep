import Link from "next/link";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Weakpoint } from "./learner-profile";

const SEVERITY: Record<Weakpoint["severity"], string> = {
  critical: "bg-danger/12 text-danger ring-1 ring-danger/25",
  high: "bg-gold-soft text-gold ring-1 ring-gold-bright/30",
  moderate: "bg-panel text-ink-secondary ring-1 ring-hairline",
};

function drillHref(subject: string | null): string {
  const base = "/test/create?mode=subject_test";
  return subject ? `${base}&subject=${encodeURIComponent(subject)}` : base;
}

/** One weakpoint: severity, area, cited evidence, and a concrete drill CTA. */
export function WeakpointCard({ w }: { w: Weakpoint }) {
  return (
    <div className="rounded-xl border border-hairline bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", SEVERITY[w.severity])}>
          {w.severity}
        </span>
        <span className="text-sm font-semibold text-ink">{w.area}</span>
        <span className="text-[11px] text-ink-tertiary">{w.kind}</span>
        <Link
          href={drillHref(w.drillSubject)}
          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold transition-premium hover:bg-gold-bright/20"
        >
          <Target className="h-3.5 w-3.5" /> Drill
        </Link>
      </div>
      {w.evidence && <p className="mt-2 text-xs leading-relaxed text-ink-secondary">{w.evidence}</p>}
      {w.drill && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink">
          <span className="font-semibold text-gold">Do this: </span>
          {w.drill}
        </p>
      )}
    </div>
  );
}
