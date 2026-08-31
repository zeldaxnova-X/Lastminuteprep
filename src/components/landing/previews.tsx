import { cn } from "@/lib/utils";

/* Honest UI mocks used as proof on the landing page, they mirror the real
   product (five-state palette, calibration, optimal-score gap) without exposing
   the Mentor's method. */

const LEGEND = [
  { label: "Answered", cls: "bg-success text-white" },
  { label: "Not answered", cls: "bg-danger text-white" },
  { label: "Marked", cls: "bg-[#7c3aed] text-white" },
  { label: "Ans & marked", cls: "bg-[#7c3aed] text-white ring-2 ring-success ring-offset-1" },
  { label: "Not visited", cls: "", darkCls: "bg-white/10 text-white/60", lightCls: "bg-white text-ink-tertiary border border-hairline-strong" },
];

const STATES = [0, 1, 2, 4, 0, 0, 1, 4, 3, 0, 2, 0, 4, 1, 0, 0, 3, 0, 4, 4, 1, 0, 0, 4, 2];

/** Faithful five-state CBT palette. `dark` renders it on a near-black panel. */
export function PalettePreview({ dark = false }: { dark?: boolean }) {
  const cellCls = (s: number) =>
    s === 4 && LEGEND[4]
      ? dark
        ? LEGEND[4].darkCls
        : LEGEND[4].lightCls
      : LEGEND[s].cls;
  return (
    <div
      className={cn(
        "rounded-2xl p-5",
        dark
          ? "bg-white/[0.04] ring-1 ring-white/10"
          : "border border-hairline bg-surface shadow-soft"
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className={cn("text-xs font-semibold uppercase tracking-wider", dark ? "text-white/50" : "text-ink-tertiary")}>
          Question palette
        </span>
        <span
          className={cn(
            "rounded-md px-2 py-1 font-mono text-xs font-semibold tabular",
            dark ? "bg-white/10 text-white" : "bg-panel text-ink"
          )}
        >
          58:24
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {STATES.map((s, i) => (
          <span
            key={i}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md text-xs font-bold tabular",
              cellCls(s)
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <div className={cn("mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-4 sm:grid-cols-3", dark ? "border-white/10" : "border-hairline")}>
        {LEGEND.map((l, i) => (
          <div key={l.label} className="flex items-center gap-2">
            <span
              className={cn(
                "h-3.5 w-3.5 flex-shrink-0 rounded-[4px]",
                i === 4 ? (dark ? l.darkCls : l.lightCls) : l.cls
              )}
            />
            <span className={cn("text-[11px]", dark ? "text-white/70" : "text-ink-secondary")}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CAL = [
  { level: "Confident", pct: 92, tone: "bg-success" },
  { level: "Unsure", pct: 61, tone: "bg-warning" },
  { level: "Guessed", pct: 18, tone: "bg-danger" },
];

export function CalibrationPreview() {
  return (
    <div className="space-y-3.5">
      {CAL.map((c) => (
        <div key={c.level}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">{c.level}</span>
            <span className="tabular text-ink-tertiary">{c.pct}% correct</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel">
            <div className={cn("h-full rounded-full", c.tone)} style={{ width: `${c.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OptimalGapBar() {
  return (
    <div className="space-y-2.5">
      <Bar label="You scored" pct={65} display="65" tone="bg-ink" />
      <Bar label="Achievable" pct={72} display="72" tone="bg-success" />
      <p className="pt-1 text-xs text-ink-secondary">
        Same knowledge, smarter skip decisions, {" "}
        <span className="font-semibold text-success">+7 marks</span>.
      </p>
    </div>
  );
}

function Bar({ label, pct, display, tone }: { label: string; pct: number; display: string; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 flex-shrink-0 text-[11px] text-ink-secondary">{label}</span>
      <div className="h-6 flex-1 overflow-hidden rounded-md bg-panel">
        <div className={cn("flex h-full items-center justify-end rounded-md px-2", tone)} style={{ width: `${pct}%` }}>
          <span className="text-[11px] font-semibold tabular text-white">{display}</span>
        </div>
      </div>
    </div>
  );
}
