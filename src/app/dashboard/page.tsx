"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ButtonLink } from "@/components/ui/button";
import { sectionLabel } from "@/lib/cbt-questions";
import {
  BookOpen,
  Target,
  Shuffle,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

interface AnalyticsData {
  unique_questions_practiced: number;
  overall_accuracy: number;
  avg_score: number;
  tests_completed: number;
  current_streak: number;
  avg_time_per_question: number;
  weakest_subject: string | null;
  strongest_subject: string | null;
  has_completed_attempts: boolean;
}

const MODES = [
  {
    href: "/test/create?mode=pyp",
    icon: BookOpen,
    title: "Previous Year Paper",
    desc: "Real SSC CGL shift papers (2020–2024) with official TCS answer keys.",
    cta: "Select paper",
  },
  {
    href: "/test/create?mode=subject",
    icon: Target,
    title: "Topic Test",
    desc: "Target Reasoning, GA, Quant, or English individually.",
    cta: "Select subject",
  },
  {
    href: "/test/create?mode=random",
    icon: Shuffle,
    title: "Random Mock",
    desc: "A balanced 100-question mock — 25 per section — drawn from the bank.",
    cta: "Launch mock",
  },
];

export default function DashboardPage() {
  const { examId, isSubmitted, resetTest } = useTestStore();
  const hasActiveAttempt = !!(examId && !isSubmitted);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/cbt/analytics");
        if (res.ok) setAnalytics(await res.json());
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const hasData = analytics?.has_completed_attempts ?? false;
  const dash = (v: React.ReactNode) => (loading ? "…" : v);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-10 sm:px-6">
        {/* Resume banner */}
        {hasActiveAttempt && (
          <Card className="flex flex-col items-start justify-between gap-4 border-warning/30 bg-warning-soft p-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
                <h3 className="text-sm font-semibold text-ink">
                  Active test in progress
                </h3>
              </div>
              <p className="text-xs text-ink-secondary">
                You have an ongoing exam session saved on this device.
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Discard your current active test? Progress will be lost."
                    )
                  )
                    resetTest();
                }}
                className="min-h-[40px] flex-1 rounded-lg border border-hairline-strong px-3 py-2 text-xs font-semibold text-ink-secondary transition-premium hover:bg-panel sm:flex-none"
              >
                Discard
              </button>
              <ButtonLink
                href={`/test/${examId}`}
                variant="primary"
                size="sm"
                className="flex-1 sm:flex-none"
              >
                Resume test
              </ButtonLink>
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Dashboard
          </h1>
          <p className="text-sm text-ink-secondary">
            {hasData
              ? "Performance analytics from your completed CBT mocks."
              : "Take your first mock to unlock analytics."}
          </p>
        </div>

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Unique Questions Practised"
            value={dash(analytics?.unique_questions_practiced ?? 0)}
            empty={!loading && !hasData}
          />
          <StatTile
            label="Overall Accuracy"
            value={dash(
              hasData ? `${analytics!.overall_accuracy.toFixed(1)}%` : "—"
            )}
            empty={!loading && !hasData}
            valueClassName={hasData ? "text-success" : undefined}
          />
          <StatTile
            label="Average Score"
            value={dash(
              hasData ? `${analytics!.avg_score.toFixed(1)}/200` : "—"
            )}
            empty={!loading && !hasData}
            valueClassName={hasData ? "text-accent" : undefined}
          />
          <StatTile
            label="Tests Completed"
            value={dash(analytics?.tests_completed ?? 0)}
            empty={!loading && !hasData}
          />
          <StatTile
            label="Current Streak"
            value={dash(`${analytics?.current_streak ?? 0}d`)}
            empty={!loading && !hasData}
          />
          <StatTile
            label="Avg Time / Question"
            value={dash(
              hasData ? `${analytics!.avg_time_per_question}s` : "—"
            )}
            empty={!loading && !hasData}
          />
          <StatTile
            label="Weakest Subject"
            value={dash(analytics?.weakest_subject ? sectionLabel(analytics.weakest_subject) : "—")}
            empty={!loading && !hasData}
            valueClassName="text-base font-semibold text-danger truncate"
          />
          <StatTile
            label="Strongest Subject"
            value={dash(analytics?.strongest_subject ? sectionLabel(analytics.strongest_subject) : "—")}
            empty={!loading && !hasData}
            valueClassName="text-base font-semibold text-success truncate"
          />
        </section>

        {/* Start a session */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
            Start a session
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODES.map(({ href, icon: Icon, title, desc, cta }) => (
              <Link key={href} href={href} className="group">
                <Card
                  interactive
                  className="flex h-full flex-col justify-between p-6"
                >
                  <div className="space-y-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-semibold text-ink">{title}</h3>
                    <p className="text-sm leading-relaxed text-ink-secondary">
                      {desc}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-sm font-semibold text-accent">
                    <span>{cta}</span>
                    <ArrowRight className="h-4 w-4 transition-premium group-hover:translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent sessions — honest empty state until history is wired */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Recent sessions
            </h2>
            {hasData && (
              <Link
                href="/analytics"
                className="flex items-center gap-1 text-xs font-semibold text-accent"
              >
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          {!hasData && !loading && (
            <Card className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium text-ink">No sessions yet</p>
              <p className="max-w-sm text-sm text-ink-secondary">
                Complete a mock to see your recent attempts and their AI Mentor
                reports here.
              </p>
              <ButtonLink
                href="/test/create?mode=pyp"
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                Take your first mock
              </ButtonLink>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
