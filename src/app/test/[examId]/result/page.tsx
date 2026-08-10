"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { QuestionContent } from "@/components/cbt/question-content";
import { sectionLabel } from "@/lib/cbt-questions";
import { cn } from "@/lib/utils";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";
import {
  Loader2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Target,
  Clock,
  ChevronDown,
  Lock,
} from "lucide-react";

interface SessionResult {
  raw_score: number;
  net_score: number;
  correct: number;
  wrong: number;
  skipped: number;
  attempted: number;
  accuracy: number;
  section_breakdown: Array<{
    key: string;
    name: string;
    total: number;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    netScore: number;
    accuracy: number;
    avgTimeMs: number;
  }>;
}

interface ReviewItem {
  questionId: string;
  questionNumber: number;
  section: string;
  stem: unknown;
  stemText: string;
  options: Array<{ key: string; text: string; isImage?: boolean; blocks?: unknown }>;
  correctOption: string | null;
  solution: unknown;
  solutionText: string;
  selectedOption: string | null;
  status: string;
  confidence: string | null;
  timeSpentMs: number | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

interface ReportData {
  result: SessionResult;
  analysis: MentorAnalysis | null;
  optimalScore: number | null;
  narrative: string | null;
  narrationAvailable?: boolean;
  review: ReviewItem[];
  plan?: "free" | "pro" | "mentor";
  canReport?: boolean;
  canMentor?: boolean;
}

const CONF_TONE: Record<string, string> = {
  guessed: "danger",
  unsure: "warning",
  confident: "success",
};

function fmtTime(ms: number | null): string {
  const s = Math.round((ms ?? 0) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function ExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const examId = (params?.examId as string) || "";

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mentorLocked, setMentorLocked] = useState(false);

  // The LLM narrative is PURELY ADDITIVE. When the server can't produce one
  // (no API key), the section is never rendered and never fetched — the
  // deterministic report stands alone as the complete report.
  const [narrative, setNarrative] = useState<string | null>(null);
  // "idle" = decided not to show; "loading"/"done" are the only rendered states.
  const [narrativeState, setNarrativeState] = useState<"idle" | "loading" | "done">("idle");
  const [narrationAvailable, setNarrationAvailable] = useState(false);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cbt/exams/${examId}/report`);
        if (!res.ok) {
          setError("Report is not available for this session yet.");
          return;
        }
        const json: ReportData = await res.json();
        // Paywall gate: free/unauthed users don't get the full report — send
        // them to the blurred conversion screen to unlock.
        if (json.canReport === false) {
          router.replace(`/sample/${examId}`);
          return;
        }
        // plan == pro sees the deterministic report but not the Mentor engine.
        setMentorLocked(json.canMentor === false);
        setData(json);
        setNarrationAvailable(!!json.narrationAvailable);
        if (json.narrative) {
          setNarrative(json.narrative);
          setNarrativeState("done");
        }
      } catch {
        setError("Network error loading your report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const generateNarrative = useCallback(async () => {
    setNarrativeState("loading");
    try {
      const res = await fetch(`/api/cbt/exams/${examId}/report`, { method: "POST" });
      const json = await res.json();
      if (json.narrative) {
        setNarrative(json.narrative);
        setNarrativeState("done");
      } else {
        // No narrative came back — leave it out entirely (no placeholder).
        setNarrativeState("idle");
      }
    } catch {
      setNarrativeState("idle");
    }
  }, [examId]);

  // Only reach out to generate a narrative when the server says it can make one.
  // With no key, narrationAvailable is false → no fetch, no section.
  useEffect(() => {
    if (data && narrationAvailable && !narrative && narrativeState === "idle") {
      generateNarrative();
    }
  }, [data, narrationAvailable, narrative, narrativeState, generateNarrative]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-bg text-ink-secondary">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span className="text-sm">Building your report…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-4 text-center">
        <p className="text-sm text-danger">{error ?? "Report unavailable."}</p>
        <ButtonLink href="/dashboard" variant="secondary" size="sm">
          Back to dashboard
        </ButtonLink>
      </div>
    );
  }

  const { result, analysis, optimalScore } = data;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        {/* Hero */}
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Mock report
            </p>
            <h1 className="mt-1 font-report text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              You scored{" "}
              <span className="text-accent tabular">{result.net_score}</span>
              <span className="text-ink-tertiary"> / 200</span>
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Net score" value={`${result.net_score}`} tone="accent" />
            <StatTile label="Raw score" value={`${result.raw_score}`} />
            <StatTile label="Accuracy" value={`${result.accuracy}%`} tone="success" />
            <StatTile
              label="Correct / Wrong / Skipped"
              value={`${result.correct} · ${result.wrong} · ${result.skipped}`}
              small
            />
          </div>
        </section>

        {/* Optimal score — AI Mentor engine (mentor plan only) */}
        {analysis && optimalScore != null && (
          <OptimalScoreCard
            actual={result.net_score}
            optimal={optimalScore}
            gain={analysis.optimal.gain}
            dropped={analysis.optimal.droppedBuckets}
            max={result.raw_score > 0 ? 200 : 200}
          />
        )}

        {/* Pro plan: has the report, not the Mentor engine — show the upsell. */}
        {mentorLocked && <MentorLockedCard />}

        {/* Coaching narrative — purely additive. Rendered only while generating
            or when present; entirely absent when narration isn't available. */}
        {(narrativeState === "loading" || (narrativeState === "done" && narrative)) && (
          <section>
            <SectionHeading icon={Sparkles}>AI Mentor</SectionHeading>
            <Card className="p-6">
              {narrativeState === "loading" ? (
                <div className="flex items-center gap-2 text-sm text-ink-secondary">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  Writing your personalised coaching…
                </div>
              ) : (
                <Markdown content={narrative!} />
              )}
            </Card>
          </section>
        )}

        {/* Sections (deterministic — every report viewer) + calibration (mentor). */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {analysis && <CalibrationCard analysis={analysis} />}
          <SectionPerformanceCard breakdown={result.section_breakdown} />
        </div>

        {/* Score leaks — AI Mentor engine (mentor plan only) */}
        {analysis && <ScoreLeaksCard analysis={analysis} />}

        {/* Question review */}
        <QuestionReview review={data.review} />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Shown to Pro users: they have the report, the Mentor engine is one tier up. */
function MentorLockedCard() {
  return (
    <section>
      <SectionHeading icon={Sparkles}>AI Mentor</SectionHeading>
      <div className="relative overflow-hidden rounded-2xl bg-panel-dark p-6 ring-1 ring-gold-bright/30 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(70% 60% at 85% 0%, rgba(217,119,6,0.16), transparent 60%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-bright">
              <Lock className="h-3.5 w-3.5" /> Locked on your plan
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Unlock the LastMilePrep Mentor Engine&trade;
            </h3>
            <p className="mt-2 max-w-md text-sm text-white/70">
              Your exact skip strategy, your own break-even guess rule, the
              optimal-score gap, pacing analysis, and improvement tracking —
              computed from this attempt.
            </p>
          </div>
          <ButtonLink
            href="/#pricing"
            size="md"
            className="flex-shrink-0 bg-gold-bright text-white hover:bg-gold"
          >
            <Sparkles className="h-4 w-4" />
            Unlock — ₹49/mo
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
      <Icon className="h-4 w-4 text-accent" />
      {children}
    </h2>
  );
}

function StatTile({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "accent" | "success";
  small?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="truncate text-xs font-medium text-ink-tertiary">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular",
          small ? "text-base" : "text-2xl",
          tone === "accent" ? "text-accent" : tone === "success" ? "text-success" : "text-ink"
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function OptimalScoreCard({
  actual,
  optimal,
  gain,
  dropped,
  max,
}: {
  actual: number;
  optimal: number;
  gain: number;
  dropped: string[];
  max: number;
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <section>
      <SectionHeading icon={TrendingUp}>Optimal achievable score</SectionHeading>
      <Card className="space-y-4 p-6">
        <p className="text-sm text-ink-secondary">
          {gain > 0 ? (
            <>
              With smarter skip decisions —{" "}
              <span className="font-medium text-ink">
                skipping your {dropped.join(" & ") || "lowest-EV"} answers
              </span>{" "}
              — you&apos;d have scored{" "}
              <span className="font-semibold text-success tabular">{optimal}</span> with the
              same knowledge:{" "}
              <span className="font-semibold text-success">+{gain} marks</span>.
            </>
          ) : (
            <>Your attempt strategy was already efficient — no easy marks were left on the table by over-guessing.</>
          )}
        </p>
        <div className="space-y-2">
          <Bar label="You scored" value={actual} display={`${actual}`} pct={pct(actual)} tone="ink" />
          <Bar label="Achievable" value={optimal} display={`${optimal}`} pct={pct(optimal)} tone="success" />
        </div>
      </Card>
    </section>
  );
}

function Bar({
  label,
  display,
  pct,
  tone,
}: {
  label: string;
  value: number;
  display: string;
  pct: string;
  tone: "ink" | "success" | "accent" | "danger" | "warning";
}) {
  const bg =
    tone === "success"
      ? "bg-success"
      : tone === "accent"
      ? "bg-accent"
      : tone === "danger"
      ? "bg-danger"
      : tone === "warning"
      ? "bg-warning"
      : "bg-ink";
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 flex-shrink-0 text-xs text-ink-secondary">{label}</span>
      <div className="h-6 flex-1 overflow-hidden rounded-md bg-panel">
        <div
          className={cn("flex h-full items-center justify-end rounded-md px-2 transition-premium", bg)}
          style={{ width: pct }}
        >
          <span className="text-xs font-semibold tabular text-white">{display}</span>
        </div>
      </div>
    </div>
  );
}

function CalibrationCard({ analysis }: { analysis: MentorAnalysis }) {
  const { buckets, overconfident, underconfident } = analysis.calibration;
  return (
    <section>
      <SectionHeading icon={Target}>Confidence calibration</SectionHeading>
      <Card className="space-y-4 p-6">
        <div className="space-y-3">
          {buckets.map((b) => (
            <div key={b.level}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium capitalize text-ink">{b.level}</span>
                <span className="tabular text-ink-tertiary">
                  {b.count > 0 ? `${Math.round(b.accuracy * 100)}% · ${b.count} Q` : "not used"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panel">
                <div
                  className={cn(
                    "h-full rounded-full",
                    b.level === "confident" ? "bg-success" : b.level === "unsure" ? "bg-warning" : "bg-danger"
                  )}
                  style={{ width: `${Math.round(b.accuracy * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {overconfident && (
          <Badge tone="danger">Overconfident — high certainty, low accuracy</Badge>
        )}
        {underconfident && (
          <Badge tone="success">Underconfident — you know more than you trust</Badge>
        )}
      </Card>
    </section>
  );
}

function SectionPerformanceCard({
  breakdown,
}: {
  breakdown: SessionResult["section_breakdown"];
}) {
  return (
    <section>
      <SectionHeading icon={TrendingUp}>Section performance</SectionHeading>
      <Card className="space-y-3 p-6">
        {breakdown.map((s) => (
          <div key={s.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink">{s.name}</span>
              <span className="tabular text-ink-tertiary">
                {s.attempted > 0 ? `${Math.round(s.accuracy * 100)}%` : "—"} · net {s.netScore}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round((s.accuracy || 0) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}

function ScoreLeaksCard({ analysis }: { analysis: MentorAnalysis }) {
  const leaks: { label: string; detail: string; marks?: string }[] = [];
  const skip = analysis.skipStrategy;
  if (skip.marksLostShouldHaveSkipped > 0) {
    leaks.push({
      label: "Guessing on questions you should have skipped",
      detail: `${skip.shouldHaveSkipped.length} wrong low-confidence answers`,
      marks: `−${skip.marksLostShouldHaveSkipped}`,
    });
  }
  if (analysis.time.rushedErrors.length > 0) {
    leaks.push({
      label: "Rushed errors",
      detail: `${analysis.time.rushedErrors.length} confident answers, wrong and answered too fast`,
    });
  }
  if (analysis.time.timeSinks.length > 0) {
    leaks.push({
      label: "Time sinks",
      detail: `${analysis.time.timeSinks.length} questions you spent heavily on and still got wrong`,
    });
  }
  const weakest = analysis.weakness.sections.find((s) => s.attempted > 0);
  if (weakest) {
    leaks.push({
      label: `Weakest section — ${weakest.name}`,
      detail: `${Math.round(weakest.accuracy * 100)}% accuracy · revise this first`,
    });
  }

  if (leaks.length === 0) return null;

  return (
    <section>
      <SectionHeading icon={Target}>Biggest score leaks</SectionHeading>
      <Card className="divide-y divide-hairline">
        {leaks.map((l, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-ink">{l.label}</p>
              <p className="text-xs text-ink-secondary">{l.detail}</p>
            </div>
            {l.marks && (
              <span className="tabular text-sm font-semibold text-danger">{l.marks}</span>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}

type Filter = "all" | "wrong" | "skipped" | "marked";

function QuestionReview({ review }: { review: ReviewItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return review.filter((r) => {
      if (filter === "wrong") return r.isCorrect === false;
      if (filter === "skipped") return !r.selectedOption;
      if (filter === "marked") return r.status === "marked" || r.status === "answered_marked";
      return true;
    });
  }, [review, filter]);

  const counts = useMemo(
    () => ({
      all: review.length,
      wrong: review.filter((r) => r.isCorrect === false).length,
      skipped: review.filter((r) => !r.selectedOption).length,
      marked: review.filter((r) => r.status === "marked" || r.status === "answered_marked").length,
    }),
    [review]
  );

  return (
    <section>
      <SectionHeading icon={Clock}>Question-by-question review</SectionHeading>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "wrong", "skipped", "marked"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-premium",
              filter === f
                ? "border-accent bg-accent-soft text-accent"
                : "border-hairline text-ink-secondary hover:bg-panel"
            )}
          >
            {f} <span className="tabular text-ink-tertiary">({counts[f]})</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((r) => {
          const open = openId === r.questionId;
          const answered = !!r.selectedOption;
          const tone = !answered ? "neutral" : r.isCorrect ? "success" : "danger";
          return (
            <Card key={r.questionId} className="overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : r.questionId)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular",
                    tone === "success"
                      ? "bg-success-soft text-success"
                      : tone === "danger"
                      ? "bg-danger-soft text-danger"
                      : "bg-panel text-ink-tertiary"
                  )}
                >
                  {r.questionNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {r.stemText || sectionLabel(r.section)}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-ink-tertiary">{sectionLabel(r.section)}</span>
                    {r.confidence && (
                      <Badge tone={CONF_TONE[r.confidence] as "danger" | "warning" | "success"}>
                        {r.confidence}
                      </Badge>
                    )}
                    <span className="text-ink-tertiary">· {fmtTime(r.timeSpentMs)}</span>
                    {r.marksAwarded != null && (
                      <span
                        className={cn(
                          "tabular font-semibold",
                          r.marksAwarded > 0 ? "text-success" : r.marksAwarded < 0 ? "text-danger" : "text-ink-tertiary"
                        )}
                      >
                        {r.marksAwarded > 0 ? "+" : ""}
                        {r.marksAwarded}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={cn("h-4 w-4 flex-shrink-0 text-ink-tertiary transition-premium", open && "rotate-180")}
                />
              </button>

              {open && (
                <div className="space-y-4 border-t border-hairline bg-panel/40 p-4">
                  {Array.isArray(r.stem) && r.stem.length > 0 && (
                    <QuestionContent
                      blocks={r.stem as never}
                      textClassName="text-sm text-ink"
                      imageMaxHeight="max-h-56"
                    />
                  )}
                  <div className="space-y-1.5">
                    {r.options.map((o) => {
                      const isCorrect = o.key === r.correctOption;
                      const isChosen = o.key === r.selectedOption;
                      return (
                        <div
                          key={o.key}
                          className={cn(
                            "flex items-start gap-2 rounded-lg border p-2.5 text-sm",
                            isCorrect
                              ? "border-success/40 bg-success-soft"
                              : isChosen
                              ? "border-danger/40 bg-danger-soft"
                              : "border-hairline bg-surface"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              isCorrect
                                ? "bg-success text-white"
                                : isChosen
                                ? "bg-danger text-white"
                                : "bg-panel text-ink-tertiary"
                            )}
                          >
                            {o.key}
                          </span>
                          <span className="min-w-0 flex-1 text-ink">
                            {Array.isArray(o.blocks) && o.blocks.length > 0 ? (
                              <QuestionContent blocks={o.blocks as never} textClassName="text-sm" imageMaxHeight="max-h-32" />
                            ) : (
                              o.text
                            )}
                          </span>
                          {isCorrect && <span className="text-[11px] font-semibold text-success">Correct</span>}
                          {isChosen && !isCorrect && <span className="text-[11px] font-semibold text-danger">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  {Array.isArray(r.solution) && r.solution.length > 0 && (
                    <div className="rounded-lg border border-hairline bg-surface p-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
                        Solution
                      </p>
                      <QuestionContent blocks={r.solution as never} textClassName="text-sm text-ink-secondary" imageMaxHeight="max-h-56" />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-ink-secondary">
            No questions in this filter.
          </Card>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <ButtonLink href="/dashboard" variant="primary" size="md">
          Back to dashboard
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </section>
  );
}
