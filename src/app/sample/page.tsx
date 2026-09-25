"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight, Timer, ListChecks, Gauge, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { allAccessPriceInr, isLaunchOffer, ALL_ACCESS_OFFER_END_LABEL } from "@/lib/payments/pricing";
import { sectionsFromQuestions } from "@/lib/cbt-sections";

// Local UX hint only (not a security control — the server enforces the caps).
const SAMPLE_USED_KEY = "lastmileprep_sample_used_v1";

export default function SamplePage() {
  const router = useRouter();
  const { initTest, resetTest } = useTestStore();
  // Funnel flag decides the flavour: full free mock (new) vs legacy 25-Q sample.
  const [flow, setFlow] = useState<null | { freeMock: boolean; authed: boolean }>(null);
  const [legacyUsed, setLegacyUsed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needSignup, setNeedSignup] = useState(false);

  useEffect(() => {
    setLegacyUsed(localStorage.getItem(SAMPLE_USED_KEY) === "1");
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const j = r.ok ? await r.json() : {};
        setFlow({ freeMock: !!j.freeMockFlow, authed: !!j.authenticated });
      } catch {
        setFlow({ freeMock: false, authed: false });
      }
    })();
  }, []);

  async function begin() {
    setStarting(true);
    setError(null);
    setNeedSignup(false);
    const fullMock = flow?.freeMock === true;
    try {
      const body = fullMock
        ? {
            // The real thing: a full 100-question mock, four 15-minute sectional
            // locks, the exact CBT interface. No signup required.
            exam_type: "random_test",
            total_questions: 100,
            time_limit_minutes: 60,
            title: "SSC CGL Full Mock",
          }
        : {
            // Legacy taste: one 25-Q / 15-min section (flag off).
            exam_type: "random_test",
            sample: true,
            subject: "Quantitative Aptitude",
            total_questions: 25,
            time_limit_minutes: 15,
            title: "Free Section, Quantitative Aptitude",
          };
      const res = await fetch("/api/cbt/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 403 && (data.error === "signup_required" || data.error === "upgrade_required")) {
        setNeedSignup(true);
        setStarting(false);
        return;
      }
      if (!res.ok || !data.attempt_id) {
        throw new Error(data.error || "Could not start the mock.");
      }
      if (!fullMock) localStorage.setItem(SAMPLE_USED_KEY, "1");
      resetTest();
      const { sections } = sectionsFromQuestions(
        (data.questions ?? []) as Array<{ id: string; subject?: string | null }>
      );
      initTest(data.attempt_id, data.attempt_id, sections);
      router.push(`/test/${data.attempt_id}${fullMock ? "" : "?sample=1"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the mock.");
      setStarting(false);
    }
  }

  const loading = flow === null;
  const fullMock = flow?.freeMock === true;
  // The legacy "already used" screen only applies to the flag-off sample.
  const showLegacyUsed = !fullMock && legacyUsed;

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
        {loading ? (
          <div className="mx-auto flex items-center gap-2 text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : needSignup ? (
          <Card className="w-full space-y-6 p-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-ink">Sign up to keep practising</h1>
              <p className="text-sm text-ink-secondary">
                You&apos;ve used your free mock for now. Create a free account to take more mocks and keep your results.
              </p>
            </div>
            <div className="space-y-2">
              <ButtonLink href="/login?mode=signup&next=/sample" variant="primary" size="md" className="w-full">
                Create a free account
              </ButtonLink>
              <p className="text-center text-xs text-ink-secondary">
                Already have an account?{" "}
                <Link href="/login?next=/sample" className="font-semibold text-accent hover:text-accent-hover">Sign in</Link>
              </p>
            </div>
          </Card>
        ) : showLegacyUsed ? (
          <Card className="w-full space-y-6 p-8 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-panel text-ink-tertiary">
              <ListChecks className="h-5 w-5" />
            </span>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-ink">You&apos;ve used your free sample</h1>
              <p className="text-sm text-ink-secondary">
                Create an account to unlock the full question bank, report, and MarksenseAI.
              </p>
            </div>
            <ButtonLink href="/login?mode=signup&next=/dashboard" variant="primary" size="md" className="w-full">
              Sign up to unlock
            </ButtonLink>
          </Card>
        ) : (
          <Card className="w-full space-y-6 p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                {fullMock ? "Free full mock" : "Free sample"}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                {fullMock ? "A full SSC CGL mock. No signup." : "One full timed section. The real lock."}
              </h1>
              <p className="text-sm leading-relaxed text-ink-secondary">
                {fullMock
                  ? "100 questions across all four sections, four 15-minute sectional timers that lock — the exact 2026 CBT interface. At the end you'll see your net score free; unlock the full report to see exactly how to score more."
                  : "25 Quantitative Aptitude questions, 15 minutes, the exact CBT interface with the real sectional lock. At the end you'll see your net score and a preview of the full report."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniFact icon={ListChecks} label={fullMock ? "100 questions" : "25 questions"} />
              <MiniFact icon={Timer} label={fullMock ? "4 × 15 min" : "15 minutes"} />
              <MiniFact icon={Gauge} label="Real locks" />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button onClick={begin} disabled={starting} className="w-full" size="lg">
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing your mock…
                </>
              ) : (
                <>
                  {fullMock ? "Start the free mock" : "Begin sample"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-ink-tertiary">
              {fullMock
                ? "No signup required to take it. Net score is always free."
                : "One free sample per device. No signup required to try."}
            </p>

            {/* Quiet nod to the upgrade, kept honest. */}
            <p className="text-center text-[11px] text-ink-tertiary">
              Full report from ₹9 · All-Access ₹{allAccessPriceInr()}
              {isLaunchOffer() ? ` (until ${ALL_ACCESS_OFFER_END_LABEL})` : ""}
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
