"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight, Timer, ListChecks, Gauge, Loader2, AlertTriangle } from "lucide-react";

// One-time-per-device guard for the anonymous sample. Access to premium areas
// (dashboard, report, AI Mentor) is enforced server-side in middleware +
// getViewer(), so this local flag is only a UX hint, not a security control.
const SAMPLE_USED_KEY = "lastmileprep_sample_used_v1";

// Founding prices, kept in sync with the landing #pricing section.
const PRICING_TIERS: {
  name: string;
  blurb: string;
  price: string;
  strike?: string;
  highlight?: boolean;
}[] = [
  { name: "Pro", blurb: "Full bank · unlimited mocks · report", price: "₹19/mo" },
  { name: "AI Mentor", blurb: "Everything in Pro + the Mentor Engine", price: "₹79/mo", highlight: true },
];

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
          title: "Free Sample, 20 Questions",
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
          <BrandLogo />
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
          <Card className="w-full space-y-6 p-8">
            <div className="space-y-3 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-panel text-ink-tertiary">
                <ListChecks className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-semibold text-ink">You&apos;ve used your free sample</h1>
              <p className="text-sm text-ink-secondary">
                The one-time sample is tied to this device. Create an account to
                unlock the full question bank, report, and AI Mentor.
              </p>
            </div>

            {/* Pricing, founding prices */}
            <div className="space-y-2.5">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    tier.highlight
                      ? "border-accent/30 bg-accent-soft"
                      : "border-hairline bg-panel"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{tier.name}</p>
                    <p className="truncate text-xs text-ink-secondary">{tier.blurb}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-baseline gap-1.5">
                    {tier.strike && (
                      <span className="text-xs text-ink-tertiary line-through">{tier.strike}</span>
                    )}
                    <span className="text-sm font-bold text-ink">{tier.price}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-1">
              <ButtonLink href="/login?mode=signup&next=/dashboard" variant="primary" size="md" className="w-full">
                Sign up to unlock
              </ButtonLink>
              <p className="text-center text-xs text-ink-secondary">
                Already have an account?{" "}
                <Link href="/login?next=/dashboard" className="font-semibold text-accent transition-premium hover:text-accent-hover">
                  Sign in
                </Link>
              </p>
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
                A short mock in the exact CBT interface, palette, timer, and
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
