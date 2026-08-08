"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { ArrowRight, Timer, ListChecks, Gauge, Loader2, AlertTriangle } from "lucide-react";

// Stub for the one-time-per-account/device guard. // TODO: replace with an
// auth + server-side entitlement check so the free sample can't be farmed.
const SAMPLE_USED_KEY = "lastmileprep_sample_used_v1";

export default function SamplePage() {
  const router = useRouter();
  const { initTest, resetTest } = useTestStore();
  const [used, setUsed] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsed(localStorage.getItem(SAMPLE_USED_KEY) === "1");
  }, []);

  async function beginSample() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/cbt/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_type: "random_test",
          total_questions: 20,
          time_limit_minutes: 15,
          title: "Free Sample — 20 Questions",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.attempt_id) {
        throw new Error(data.error || "Could not start the sample.");
      }
      // Mark the one-time sample as consumed (stubbed identity). // TODO: auth.
      localStorage.setItem(SAMPLE_USED_KEY, "1");
      resetTest();
      initTest(
        data.attempt_id,
        data.attempt_id,
        data.questions.map((q: { id: string }) => q.id),
        Math.round(data.time_limit_seconds / 60)
      );
      router.push(`/test/${data.attempt_id}?sample=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the sample.");
      setStarting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
              LM
            </span>
            LastMile<span className="-ml-1.5 text-accent">Prep</span>
          </Link>
          <Link href="/#pricing" className="text-sm text-ink-secondary transition-premium hover:text-ink">
            Pricing
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12 sm:px-6">
        {used === null ? (
          <div className="mx-auto flex items-center gap-2 text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : used ? (
          <Card className="w-full space-y-4 p-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-panel text-ink-tertiary">
              <ListChecks className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-semibold text-ink">You&apos;ve used your free sample</h1>
            <p className="text-sm text-ink-secondary">
              The one-time sample is tied to this device. Unlock the full question
              bank, report, and AI Mentor for your exam cycle.
            </p>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
              <ButtonLink href="/#pricing" variant="primary" size="md">
                See pricing
              </ButtonLink>
              <ButtonLink href="/dashboard" variant="secondary" size="md">
                Go to dashboard
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <Card className="w-full space-y-6 p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Free sample
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                20 questions. The real interface.
              </h1>
              <p className="text-sm leading-relaxed text-ink-secondary">
                A short mock in the exact CBT interface — palette, timer, and
                confidence capture included. At the end you&apos;ll see your net
                score and a preview of what the full report reveals.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniFact icon={ListChecks} label="20 questions" />
              <MiniFact icon={Timer} label="15 minutes" />
              <MiniFact icon={Gauge} label="Real CBT" />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button onClick={beginSample} disabled={starting} className="w-full" size="lg">
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing your sample…
                </>
              ) : (
                <>
                  Begin sample
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-ink-tertiary">
              One free sample per device. No signup required to try.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}

function MiniFact({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-hairline bg-panel py-3 text-center">
      <Icon className="h-4 w-4 text-accent" />
      <span className="text-[11px] font-medium text-ink-secondary">{label}</span>
    </div>
  );
}
