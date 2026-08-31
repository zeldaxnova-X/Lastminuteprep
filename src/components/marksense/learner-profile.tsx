"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  RotateCcw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors src/lib/ai/learner-profile.ts and learner-signals.ts (client copies).
interface Weakpoint {
  area: string;
  kind: "topic" | "section" | "strategy";
  severity: "critical" | "high" | "moderate";
  evidence: string;
  drill: string;
  drillSubject: string | null;
}
interface Profile {
  persona: string;
  headline: string;
  trajectory: string;
  strengths: string[];
  weakpoints: Weakpoint[];
  focusPlan: string[];
  projectedGain: number;
}
interface Signals {
  attemptsAnalyzed: number;
  score: { latestNet: number; bestNet: number; avgNet: number; trendPerAttempt: number; maxScore: number };
  accuracy: { overallPct: number; trendPct: number };
  sections: Array<{ name: string; accuracyPct: number; trendPct: number }>;
  topicWeakpoints: Array<{ topic: string; accuracyPct: number; attempted: number; appearedInAttempts: number }>;
  consistency: { label: string };
}
interface ProfileResponse {
  locked?: boolean;
  hasProfile?: boolean;
  aiAvailable?: boolean;
  attemptsAnalyzed?: number;
  generatedAt?: string | null;
  signals?: Signals | null;
  profile?: Profile | null;
  reason?: string;
}

const SEVERITY: Record<Weakpoint["severity"], string> = {
  critical: "bg-danger/12 text-danger ring-1 ring-danger/25",
  high: "bg-gold-soft text-gold ring-1 ring-gold-bright/30",
  moderate: "bg-panel text-ink-secondary ring-1 ring-hairline",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

/** URL for a targeted subject drill. */
function drillHref(subject: string | null): string {
  const base = "/test/create?mode=subject_test";
  return subject ? `${base}&subject=${encodeURIComponent(subject)}` : base;
}

export function MarksenseProfile() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/marksense/profile")
      .then((r) => r.json())
      .then((d: ProfileResponse) => alive && setData(d))
      .catch(() => alive && setData({ hasProfile: false }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const r = await fetch("/api/marksense/profile", { method: "POST" });
      if (r.ok) setData(await r.json());
    } catch {
      /* keep prior view */
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-gold-bright/25 bg-surface p-5 text-sm text-ink-tertiary">
        <Loader2 className="h-4 w-4 animate-spin text-gold" /> Building your MarksenseAI profile…
      </div>
    );
  }

  if (!data || data.locked) return null; // gated elsewhere; nothing to show

  // No analyzed attempts yet.
  if (!data.hasProfile || !data.signals) {
    return (
      <div className="rounded-2xl border border-gold-bright/25 bg-surface p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-bright/15 text-gold ring-1 ring-gold-bright/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">Your MarksenseAI profile</p>
            <p className="text-xs text-ink-tertiary">
              Take a full mock and MarksenseAI starts learning your patterns.
            </p>
          </div>
          <Link
            href="/test/create?mode=random_test"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gold-bright px-3 py-2 text-xs font-semibold text-white transition-premium hover:bg-gold"
          >
            Take a mock <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const s = data.signals;
  const p = data.profile;
  const persona = p?.persona ?? "Building your profile";
  const netTrend = s.score.trendPerAttempt;

  // Deterministic weakpoint fallback (used when the AI layer is unavailable).
  const fallbackWeak: Weakpoint[] = s.topicWeakpoints.slice(0, 4).map((t) => ({
    area: t.topic,
    kind: "topic",
    severity: t.accuracyPct < 40 ? "critical" : t.accuracyPct < 60 ? "high" : "moderate",
    evidence: `${t.accuracyPct}% accuracy across ${t.appearedInAttempts} mock${t.appearedInAttempts === 1 ? "" : "s"} (${t.attempted} questions).`,
    drill: `Focused practice on ${t.topic}.`,
    drillSubject: null,
  }));
  const weakpoints = p?.weakpoints?.length ? p.weakpoints : fallbackWeak;

  return (
    <section className="overflow-hidden rounded-2xl border border-gold-bright/30 bg-gradient-to-br from-gold-soft/60 to-surface shadow-soft">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-bright/20 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-bright/15 text-gold ring-1 ring-gold-bright/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink">
              Your MarksenseAI profile
              <span className="ml-2 rounded-full bg-gold-bright/15 px-2 py-0.5 text-[11px] font-bold text-gold">
                {persona}
              </span>
            </p>
            <p className="text-xs text-ink-tertiary">
              Learned from {data.attemptsAnalyzed ?? s.attemptsAnalyzed} mock
              {(data.attemptsAnalyzed ?? s.attemptsAnalyzed) === 1 ? "" : "s"}
              {data.generatedAt ? ` · updated ${fmtDate(data.generatedAt)}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline-strong px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-premium hover:bg-panel disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {/* Verdict + trajectory */}
        {p?.headline && <p className="text-[15px] font-semibold leading-snug text-ink">{p.headline}</p>}
        {p?.trajectory && <p className="-mt-2 text-sm leading-relaxed text-ink-secondary">{p.trajectory}</p>}

        {/* Signal strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric label="Latest" value={`${s.score.latestNet}`} sub={`/ ${s.score.maxScore}`} />
          <Metric label="Best" value={`${s.score.bestNet}`} sub={`avg ${s.score.avgNet}`} />
          <Metric
            label="Trend"
            value={`${netTrend > 0 ? "+" : ""}${netTrend}`}
            sub="per mock"
            tone={netTrend > 0 ? "up" : netTrend < 0 ? "down" : undefined}
          />
          {p && p.projectedGain > 0 ? (
            <Metric label="Reachable next" value={`+${p.projectedGain}`} sub="marks" tone="up" />
          ) : (
            <Metric label="Consistency" value={s.consistency.label} valueSm sub={`${s.accuracy.overallPct}% acc`} />
          )}
        </div>

        {/* Strengths */}
        {p?.strengths?.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
              <ShieldCheck className="h-3.5 w-3.5" /> Strengths
            </span>
            {p.strengths.map((str) => (
              <span key={str} className="rounded-full bg-success/10 px-2.5 py-1 text-xs text-success ring-1 ring-success/20">
                {str}
              </span>
            ))}
          </div>
        ) : null}

        {/* Weakpoints */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
            Weakpoints, most costly first
          </p>
          {weakpoints.map((w, i) => (
            <div key={`${w.area}-${i}`} className="rounded-xl border border-hairline bg-surface p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", SEVERITY[w.severity])}>
                  {w.severity}
                </span>
                <span className="text-sm font-semibold text-ink">{w.area}</span>
                <span className="text-[11px] text-ink-tertiary">{w.kind}</span>
                <Link
                  href={drillHref(w.drillSubject)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg bg-gold-bright/10 px-2.5 py-1 text-xs font-semibold text-gold transition-premium hover:bg-gold-bright/20"
                >
                  <Target className="h-3.5 w-3.5" /> Drill
                </Link>
              </div>
              {w.evidence && <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{w.evidence}</p>}
              {w.drill && (
                <p className="mt-1 text-xs leading-relaxed text-ink">
                  <span className="font-semibold text-gold">Do this: </span>
                  {w.drill}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Focus plan */}
        {p?.focusPlan?.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">This week</p>
            <ol className="space-y-1.5">
              {p.focusPlan.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold-bright/15 text-[11px] font-bold text-gold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
  valueSm,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
  valueSm?: boolean;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1 font-bold text-ink",
          valueSm ? "text-sm capitalize" : "text-lg",
          tone === "up" && "text-success",
          tone === "down" && "text-danger"
        )}
      >
        {tone === "up" && <TrendingUp className="h-4 w-4" />}
        {tone === "down" && <TrendingDown className="h-4 w-4" />}
        {value}
      </p>
      {sub && <p className="text-[11px] text-ink-tertiary">{sub}</p>}
    </div>
  );
}
