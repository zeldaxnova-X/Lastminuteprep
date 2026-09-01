"use client";

import { TrendingUp, TrendingDown, Minus, Gauge, Timer, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionLabel } from "@/lib/cbt-questions";
import type { Signals } from "./learner-profile";

/**
 * Deterministic detail view of the longitudinal signals: score journey,
 * per-section mastery bars with trend, topic strengths/weaknesses, and the
 * behavioural tendencies. Pure CSS bars, theme-aware. Shown on the dedicated
 * MarksenseAI profile page beneath the AI card.
 */
export function SignalsDetail({ signals: s, hideScoreJourney = false }: { signals: Signals; hideScoreJourney?: boolean }) {
  return (
    <div className="space-y-6">
      {/* Score journey (hidden when the hero/progress views already cover it) */}
      {!hideScoreJourney && (
      <Panel title="Score journey" subtitle={`${s.attemptsAnalyzed} mocks analysed`}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="First" value={s.score.firstNet} sub={`/ ${s.score.maxScore}`} />
          <Stat label="Latest" value={s.score.latestNet} sub={`avg ${s.score.avgNet}`} tone="accent" />
          <Stat label="Best" value={s.score.bestNet} sub={`/ ${s.score.maxScore}`} tone="success" />
          <Stat
            label="Trend"
            value={`${s.score.trendPerAttempt > 0 ? "+" : ""}${s.score.trendPerAttempt}`}
            sub="per mock"
            tone={s.score.trendPerAttempt > 0 ? "success" : s.score.trendPerAttempt < 0 ? "danger" : undefined}
            trend={s.score.trendPerAttempt}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-tertiary">
          <span className="capitalize">{s.consistency.label}</span> consistency
          <span className="text-ink-tertiary/60">·</span>
          {s.accuracy.overallPct}% overall accuracy
          <span className="text-ink-tertiary/60">·</span>
          latest {s.accuracy.latestPct}%
        </div>
      </Panel>
      )}

      {/* Section mastery */}
      <Panel title="Section mastery" subtitle="Accuracy across every mock, with direction">
        <div className="space-y-3">
          {s.sections.map((sec) => (
            <div key={sec.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{sectionLabel(sec.name)}</span>
                <span className="flex items-center gap-1.5 tabular-nums text-ink-secondary">
                  {sec.accuracyPct}%
                  <TrendPill v={sec.trendPct} />
                </span>
              </div>
              <Bar pct={sec.accuracyPct} />
            </div>
          ))}
        </div>
      </Panel>

      {/* Topic weakpoints + strengths */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recurring weakpoints" subtitle="Lowest accuracy, weighted by recurrence">
          <ul className="space-y-2.5">
            {s.topicWeakpoints.length === 0 && (
              <li className="text-sm text-ink-tertiary">Not enough repeated topics yet.</li>
            )}
            {s.topicWeakpoints.map((t) => (
              <TopicRow key={t.topic} topic={t.topic} pct={t.accuracyPct} n={t.attempted} mocks={t.appearedInAttempts} tone="danger" />
            ))}
          </ul>
        </Panel>
        <Panel title="Reliable strengths" subtitle="Highest accuracy you can bank on">
          <ul className="space-y-2.5">
            {s.topicStrengths.length === 0 && (
              <li className="text-sm text-ink-tertiary">Strengths appear as topics repeat.</li>
            )}
            {s.topicStrengths.map((t) => (
              <TopicRow key={t.topic} topic={t.topic} pct={t.accuracyPct} n={t.attempted} mocks={t.appearedInAttempts} tone="success" />
            ))}
          </ul>
        </Panel>
      </div>

      {/* Tendencies */}
      <Panel title="How you play the test" subtitle="Behaviour patterns MarksenseAI tracks">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Tendency
            icon={Crosshair}
            label="Calibration"
            value={s.tendencies.calibration}
            note={
              s.tendencies.calibration === "overconfident"
                ? `Overconfident in ${s.tendencies.overconfidentCount} mocks`
                : s.tendencies.calibration === "underconfident"
                  ? `Too cautious in ${s.tendencies.underconfidentCount} mocks`
                  : "Well judged"
            }
          />
          <Tendency
            icon={Gauge}
            label="Guess discipline"
            value={`${s.tendencies.avgMarksLostToBadGuessing} lost`}
            note="avg marks / mock to bad guesses"
          />
          <Tendency
            icon={Timer}
            label="Pacing"
            value={s.tendencies.pacing}
            note={`${s.tendencies.avgOptimalGain} marks reachable`}
          />
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-ink-tertiary">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "accent" | "success" | "danger";
  trend?: number;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-bg px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1 text-lg font-bold tabular-nums text-ink",
          tone === "accent" && "text-accent",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger"
        )}
      >
        {trend !== undefined && trend > 0 && <TrendingUp className="h-4 w-4" />}
        {trend !== undefined && trend < 0 && <TrendingDown className="h-4 w-4" />}
        {value}
      </p>
      {sub && <p className="text-[11px] tabular-nums text-ink-tertiary">{sub}</p>}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = clamped < 45 ? "bg-danger" : clamped < 65 ? "bg-gold-bright" : "bg-success";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function TrendPill({ v }: { v: number }) {
  if (v > 0.2)
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-success">
        <TrendingUp className="h-3 w-3" />+{v}
      </span>
    );
  if (v < -0.2)
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-danger">
        <TrendingDown className="h-3 w-3" />
        {v}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-ink-tertiary">
      <Minus className="h-3 w-3" />
    </span>
  );
}

function TopicRow({
  topic,
  pct,
  n,
  mocks,
  tone,
}: {
  topic: string;
  pct: number;
  n: number;
  mocks: number;
  tone: "danger" | "success";
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{topic}</p>
        <p className="text-[11px] text-ink-tertiary">
          {n} questions · {mocks} mock{mocks === 1 ? "" : "s"}
        </p>
      </div>
      <span
        className={cn(
          "flex-shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums",
          tone === "danger" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
        )}
      >
        {pct}%
      </span>
    </li>
  );
}

function Tendency({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-bg p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 text-sm font-bold capitalize text-ink">{value}</p>
      <p className="text-[11px] text-ink-tertiary">{note}</p>
    </div>
  );
}
