"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  index: number;
  date: string;
  net: number;
  accuracyPct: number;
  sections: Record<string, number>;
}

// Fixed categorical order + CVD-safe hues validated on the dark surface (dataviz).
const SECTION_META: Array<{ name: string; short: string; color: string }> = [
  { name: "Quantitative Aptitude", short: "Quant", color: "#3987e5" },
  { name: "General Awareness", short: "GA", color: "#d95926" },
  { name: "General Intelligence & Reasoning", short: "Reasoning", color: "#199e70" },
  { name: "English Comprehension", short: "English", color: "#c98500" },
];

/**
 * Section accuracy across every mock: a multi-series line chart. One y-axis
 * (accuracy %), fixed-order categorical colors, a legend, direct end-labels, and
 * a hover crosshair with a per-mock tooltip. Colours validated against the light
 * surface with the dataviz validator.
 */
export function SectionTrendsChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const present = SECTION_META.filter((s) => points.some((p) => p.sections[s.name] != null));
  const n = points.length;

  const W = 720;
  const H = 300;
  const padL = 34;
  const padR = 74; // room for end labels
  const padT = 16;
  const padB = 34;

  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / 100) * (H - padT - padB);

  const hp = hover != null ? points[hover] : null;

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {present.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.short}
          </span>
        ))}
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[340px] touch-none"
          role="img"
          aria-label="Section accuracy over mocks"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            let best = 0;
            let bestD = Infinity;
            for (let i = 0; i < n; i++) {
              const d = Math.abs(x(i) - px);
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
            setHover(best);
          }}
        >
          <defs>
            <filter id="ms-line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Gridlines + y labels */}
          {[0, 25, 50, 75, 100].map((gv) => (
            <g key={gv}>
              <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} className="stroke-hairline" strokeWidth={1} />
              <text x={padL - 6} y={y(gv) + 3} textAnchor="end" className="fill-ink-tertiary" fontSize={10}>
                {gv}
              </text>
            </g>
          ))}

          {/* Hover crosshair */}
          {hp && <line x1={x(hover!)} x2={x(hover!)} y1={padT} y2={H - padB} className="stroke-hairline-strong" strokeWidth={1} strokeDasharray="3 3" />}

          {/* Series */}
          {present.map((s) => {
            const pts = points.map((p, i) => ({ i, v: p.sections[s.name] })).filter((d) => d.v != null) as { i: number; v: number }[];
            const d = pts.map((pt, k) => `${k === 0 ? "M" : "L"}${x(pt.i).toFixed(1)},${y(pt.v).toFixed(1)}`).join(" ");
            const last = pts[pts.length - 1];
            return (
              <g key={s.name}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" filter="url(#ms-line-glow)" opacity={0.95} />
                {pts.map((pt) => (
                  <circle key={pt.i} cx={x(pt.i)} cy={y(pt.v)} r={hover === pt.i ? 4 : 2.5} fill={s.color} stroke="var(--surface)" strokeWidth={hover === pt.i ? 1.5 : 0} />
                ))}
                {last && (
                  <text x={x(last.i) + 8} y={y(last.v) + 3} className="font-semibold" fontSize={10} fill={s.color}>
                    {s.short}
                  </text>
                )}
              </g>
            );
          })}

          {/* X labels (mock index) */}
          {points.map((p, i) =>
            i === 0 || i === n - 1 || n <= 5 ? (
              <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-tertiary" fontSize={10}>
                M{p.index}
              </text>
            ) : null
          )}
        </svg>
      </div>

      {/* Tooltip (below chart, avoids clipping) */}
      <div className={cn("mt-2 rounded-lg border border-hairline bg-bg px-3 py-2 text-xs transition-opacity", hp ? "opacity-100" : "opacity-0")}>
        {hp ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-ink">Mock {hp.index}</span>
            <span className="text-ink-tertiary">net {hp.net}</span>
            {present.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1 tabular-nums text-ink-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {hp.sections[s.name] ?? "-"}%
              </span>
            ))}
          </div>
        ) : (
          <span className="text-ink-tertiary">Hover the chart to inspect a mock.</span>
        )}
      </div>
    </div>
  );
}
