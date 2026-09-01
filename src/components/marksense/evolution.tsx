"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Check, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Point {
  attemptsAnalyzed: number;
  persona: string | null;
  projectedGain: number | null;
  latestNet: number | null;
  avgNet: number | null;
  overallAccuracy: number | null;
  generatedAt: string;
}
interface Timeline {
  locked?: boolean;
  points: number;
  series: Point[];
  personaChanges: Array<{ persona: string; generatedAt: string; attemptsAnalyzed: number }>;
  evolution: {
    resolved: Array<{ topic: string; wasPct: number }>;
    persistent: Array<{ topic: string; fromPct: number; toPct: number }>;
    emerged: Array<{ topic: string; nowPct: number }>;
  };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function MarksenseEvolution() {
  const [data, setData] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/marksense/timeline")
      .then((r) => r.json())
      .then((d: Timeline) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading || !data || data.locked) return null;

  // Need at least two points to show a trajectory.
  if (data.points < 2) {
    return (
      <section className="rounded-2xl border border-hairline bg-surface p-5 sm:p-6">
        <h3 className="text-sm font-bold text-ink">Your evolution</h3>
        <p className="mt-1 text-xs text-ink-secondary">
          Take another mock and this becomes a live trajectory of your score, persona, and weakpoints over time.
        </p>
      </section>
    );
  }

  const series = data.series;
  const first = series[0];
  const last = series[series.length - 1];
  const netDelta = (last.latestNet ?? 0) - (first.latestNet ?? 0);
  const accFirst = first.overallAccuracy ?? 0;
  const accLast = last.overallAccuracy ?? 0;

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ink">Your evolution</h3>
        <p className="text-xs text-ink-tertiary">
          {data.points} checkpoints · {fmtDate(first.generatedAt)} to {fmtDate(last.generatedAt)}
        </p>
      </div>

      {/* Net score trajectory */}
      <NetChart series={series} />

      {/* Deltas */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Delta label="Net score" from={first.latestNet ?? 0} to={last.latestNet ?? 0} />
        <Delta label="Accuracy" from={accFirst} to={accLast} suffix="%" />
        <div className="rounded-xl border border-hairline bg-bg px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">Reachable now</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-gold">
            +{last.projectedGain ?? 0}
          </p>
          <p className="text-[11px] text-ink-tertiary">marks</p>
        </div>
      </div>

      {/* Persona journey */}
      {data.personaChanges.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Persona journey</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {data.personaChanges.map((pc, i) => (
              <span key={`${pc.persona}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-ink-tertiary" />}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    i === data.personaChanges.length - 1
                      ? "bg-gold-bright/15 text-gold ring-1 ring-gold-bright/30"
                      : "bg-panel text-ink-secondary"
                  )}
                >
                  {i === data.personaChanges.length - 1 && <Sparkles className="h-3 w-3" />}
                  {pc.persona}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weakpoint evolution */}
      {(data.evolution.resolved.length > 0 ||
        data.evolution.persistent.length > 0 ||
        data.evolution.emerged.length > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <EvoColumn
            icon={Check}
            tone="success"
            title="Resolved"
            empty="Nothing cleared yet"
            items={data.evolution.resolved.map((t) => ({ topic: t.topic, note: `was ${t.wasPct}%` }))}
          />
          <EvoColumn
            icon={AlertTriangle}
            tone="gold"
            title="Still working on"
            empty="None carried over"
            items={data.evolution.persistent.map((t) => ({
              topic: t.topic,
              note: `${t.fromPct}% to ${t.toPct}%`,
              improved: t.toPct >= t.fromPct,
            }))}
          />
          <EvoColumn
            icon={TrendingDown}
            tone="danger"
            title="New to watch"
            empty="No new weakpoints"
            items={data.evolution.emerged.map((t) => ({ topic: t.topic, note: `now ${t.nowPct}%` }))}
          />
        </div>
      )}

      {netDelta !== 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-secondary">
          {netDelta > 0 ? (
            <>
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              Up {Math.round(netDelta)} net marks since MarksenseAI started tracking you.
            </>
          ) : (
            <>
              <TrendingDown className="h-3.5 w-3.5 text-danger" />
              Down {Math.abs(Math.round(netDelta))} net marks; your focus plan targets the reversal.
            </>
          )}
        </p>
      )}
    </section>
  );
}

/** Net-score line chart with a soft area fill. Dynamic Y domain. */
function NetChart({ series }: { series: Point[] }) {
  const W = 640;
  const H = 180;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const nets = series.map((s) => s.latestNet ?? 0);
  const n = nets.length;
  const rawMin = Math.min(...nets);
  const rawMax = Math.max(...nets);
  const span = Math.max(10, rawMax - rawMin);
  const yMin = Math.max(0, Math.floor((rawMin - span * 0.15) / 5) * 5);
  const yMax = Math.ceil((rawMax + span * 0.15) / 5) * 5;

  const x = (i: number) => padL + (n === 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - padT - padB);

  const line = nets.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;
  const gridVals = [yMin, Math.round((yMin + yMax) / 2), yMax];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[320px]" role="img" aria-label="Net score over time">
        {/* Gridlines + Y labels */}
        {gridVals.map((gv) => (
          <g key={gv}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} className="stroke-hairline" strokeWidth={1} />
            <text x={padL - 6} y={y(gv) + 3} textAnchor="end" className="fill-ink-tertiary" fontSize={10}>
              {gv}
            </text>
          </g>
        ))}
        {/* Area + line (accent via currentColor) */}
        <g className="text-accent">
          <path d={area} fill="currentColor" opacity={0.08} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {nets.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="currentColor" />
          ))}
        </g>
        {/* First / last value labels */}
        <text x={x(0)} y={y(nets[0]) - 8} textAnchor="start" className="fill-ink" fontSize={11} fontWeight={700}>
          {nets[0]}
        </text>
        <text x={x(n - 1)} y={y(nets[n - 1]) - 8} textAnchor="end" className="fill-ink" fontSize={11} fontWeight={700}>
          {nets[n - 1]}
        </text>
        {/* X endpoints */}
        <text x={padL} y={H - 8} textAnchor="start" className="fill-ink-tertiary" fontSize={10}>
          {series[0].attemptsAnalyzed} mocks
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" className="fill-ink-tertiary" fontSize={10}>
          {series[n - 1].attemptsAnalyzed} mocks
        </text>
      </svg>
    </div>
  );
}

function Delta({ label, from, to, suffix = "" }: { label: string; from: number; to: number; suffix?: string }) {
  const d = to - from;
  const tone = d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-ink";
  return (
    <div className="rounded-xl border border-hairline bg-bg px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-ink">
        {Math.round(from)}
        {suffix}
        <ArrowRight className="h-3 w-3 text-ink-tertiary" />
        <span className={tone}>
          {Math.round(to)}
          {suffix}
        </span>
      </p>
      <p className={cn("text-[11px] font-semibold tabular-nums", tone)}>
        {d > 0 ? "+" : ""}
        {Math.round(d)}
        {suffix}
      </p>
    </div>
  );
}

function EvoColumn({
  icon: Icon,
  tone,
  title,
  empty,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "gold" | "danger";
  title: string;
  empty: string;
  items: Array<{ topic: string; note: string; improved?: boolean }>;
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "gold" ? "text-gold" : "text-danger";
  return (
    <div className="rounded-xl border border-hairline bg-bg p-3">
      <p className={cn("mb-2 flex items-center gap-1.5 text-xs font-bold", toneCls)}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[11px] text-ink-tertiary">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.topic} className="text-xs">
              <span className="block truncate font-medium text-ink">{it.topic}</span>
              <span
                className={cn(
                  "text-[11px] tabular-nums text-ink-tertiary",
                  it.improved === true && "text-success",
                  it.improved === false && "text-danger"
                )}
              >
                {it.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
