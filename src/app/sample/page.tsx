"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTestStore } from "@/lib/store/use-test-store";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { ArrowRight, Timer, ListChecks, Gauge, Loader2, AlertTriangle, Check, Lock } from "lucide-react";
import { allAccessPriceInr, isLaunchOffer, ALL_ACCESS_OFFER_END_LABEL, SINGLE_REPORT_PRICE_INR } from "@/lib/payments/pricing";
import { sectionsFromQuestions } from "@/lib/cbt-sections";

// Local UX hint only (not a security control — the server enforces the caps).
const SAMPLE_USED_KEY = "lastmileprep_sample_used_v1";

/** Exams offered on the free-mock picker. SSC CGL + SBI Clerk are live. */
const EXAMS: Array<{ slug: string; name: string; tagline: string; logo: string; live: boolean; title: string }> = [
  { slug: "ssc-cgl", name: "SSC CGL", tagline: "Tier 1 · 2026 pattern", logo: "/images/exams/ssc-cgl.png", live: true, title: "SSC CGL Full Mock" },
  { slug: "sbi-clerk", name: "SBI Clerk", tagline: "Prelims · 2025 pattern", logo: "/images/exams/sbi.svg", live: true, title: "SBI Clerk Prelims Mock" },
  { slug: "ibps-clerk", name: "IBPS Clerk", tagline: "Prelims + Mains", logo: "/images/exams/ibps-clerk.png", live: false, title: "" },
];

export default function SamplePage() {
  const router = useRouter();
  const { initTest, resetTest } = useTestStore();
  // Funnel flag decides the flow: exam picker → CBT instructions → full mock
  // (new) vs the legacy single 25-Q sample.
  const [flow, setFlow] = useState<null | { freeMock: boolean; authed: boolean }>(null);
  const [legacyUsed, setLegacyUsed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  /** New flow: a live exam sends the user to the real CBT instructions screen,
   *  which then starts the full mock. Coming-soon exams are inert. */
  function chooseExam(slug: string, live: boolean) {
    if (!live) return;
    const exam = EXAMS.find((e) => e.slug === slug);
    const params = new URLSearchParams({
      exam_type: "random_test",
      exam_code: slug,
      questions: "100",
      time: "60",
      title: exam?.title || "Full Mock",
      free: "1",
    });
    router.push(`/test/instructions?${params.toString()}`);
  }

  /** Legacy (flag off): start the 25-Q sample directly. */
  async function beginLegacySample() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/cbt/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_type: "random_test",
          sample: true,
          subject: "Quantitative Aptitude",
          total_questions: 25,
          time_limit_minutes: 15,
          title: "Free Section, Quantitative Aptitude",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.attempt_id) throw new Error(data.error || "Could not start the sample.");
      localStorage.setItem(SAMPLE_USED_KEY, "1");
      resetTest();
      const { sections } = sectionsFromQuestions(
        (data.questions ?? []) as Array<{ id: string; subject?: string | null }>
      );
      initTest(data.attempt_id, data.attempt_id, sections);
      router.push(`/test/${data.attempt_id}?sample=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the sample.");
      setStarting(false);
    }
  }

  const loading = flow === null;
  const freeMock = flow?.freeMock === true;
  const showLegacyUsed = !freeMock && legacyUsed;

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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        {loading ? (
          <div className="mx-auto flex items-center gap-2 text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : freeMock ? (
          /* ---------------- New flow: exam picker ---------------- */
          <div className="space-y-8">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Free full mock</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Choose your exam
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
                Pick an exam to start a full mock in the real CBT interface. No signup, no card. SSC CGL is
                live today.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {EXAMS.map((e) =>
                e.live ? (
                  <button key={e.slug} type="button" onClick={() => chooseExam(e.slug, e.live)} className="group text-left">
                    <Card interactive className="relative flex h-full flex-col justify-between overflow-hidden p-5">
                      <div
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{ background: "radial-gradient(80% 60% at 100% 0%, rgba(79,70,229,0.10), transparent 60%)" }}
                        aria-hidden
                      />
                      <div className="relative space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-panel ring-1 ring-hairline">
                            <Image src={e.logo} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                            <Check className="h-3 w-3" /> Live
                          </span>
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-ink">{e.name}</h2>
                          <p className="text-xs text-ink-tertiary">{e.tagline}</p>
                        </div>
                      </div>
                      <div className="relative mt-4 flex items-center justify-between border-t border-hairline pt-3 text-sm font-semibold text-accent">
                        <span>Start mock</span>
                        <ArrowRight className="h-4 w-4 transition-premium group-hover:translate-x-0.5" />
                      </div>
                    </Card>
                  </button>
                ) : (
                  <Card key={e.slug} className="flex h-full flex-col justify-between p-5 opacity-90">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-panel ring-1 ring-hairline grayscale">
                          <Image src={e.logo} alt="" width={28} height={28} className="h-7 w-7 object-contain opacity-60" />
                        </span>
                        <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary ring-1 ring-hairline">
                          Soon
                        </span>
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-ink">{e.name}</h2>
                        <p className="text-xs text-ink-tertiary">{e.tagline}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-3 text-xs font-medium text-ink-tertiary">
                      <Lock className="h-3.5 w-3.5" /> Coming soon
                    </div>
                  </Card>
                )
              )}
            </div>

            <p className="text-center text-[11px] text-ink-tertiary">
              Net score is always free · Full report from ₹{SINGLE_REPORT_PRICE_INR} · All-Access ₹{allAccessPriceInr()}
              {isLaunchOffer() ? ` (until ${ALL_ACCESS_OFFER_END_LABEL})` : ""}
            </p>
          </div>
        ) : showLegacyUsed ? (
          <Card className="mx-auto w-full max-w-md space-y-6 p-8 text-center">
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
          /* ---------------- Legacy flow: 25-Q sample ---------------- */
          <Card className="mx-auto w-full max-w-md space-y-6 p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Free sample</p>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">One full timed section. The real lock.</h1>
              <p className="text-sm leading-relaxed text-ink-secondary">
                25 Quantitative Aptitude questions, 15 minutes, the exact CBT interface with the real sectional
                lock. At the end you&apos;ll see your net score and a preview of the full report.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <MiniFact icon={ListChecks} label="25 questions" />
              <MiniFact icon={Timer} label="15 minutes" />
              <MiniFact icon={Gauge} label="Real lock" />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button onClick={beginLegacySample} disabled={starting} className="w-full" size="lg">
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing your sample…
                </>
              ) : (
                <>
                  Begin sample <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="text-center text-xs text-ink-tertiary">One free sample per device. No signup required to try.</p>
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
