import Link from "next/link";
import {
  ArrowRight,
  Gauge,
  SkipForward,
  Scale,
  TrendingUp,
  Clock,
  ListFilter,
  Repeat,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Reveal } from "@/components/landing/motion";
import { MarksenseCinematic } from "@/components/landing/marksense-cinematic";

export const metadata = {
  title: "MarksenseAI: the intelligence behind every mark you earn",
  description:
    "MarksenseAI reads your confidence, timing, and decisions against the marks behind them, then shows you exactly how to score more. See how it works.",
};

/* The full engine benefit set. Every item is something the deterministic
   analysis already computes, honest by construction (no invented capabilities). */
const ENGINE = [
  {
    icon: Gauge,
    title: "Confidence calibration",
    body: "Where you were sure but wrong (overconfidence) and unsure but right: the marks you left on the table.",
  },
  {
    icon: SkipForward,
    title: "Exact skip strategy",
    body: "The specific questions you should have skipped under negative marking. Named, not generic advice.",
  },
  {
    icon: Scale,
    title: "Your personal guess rule",
    body: "Your own break-even. Guess only when your odds beat the penalty, computed for you, not a rule of thumb.",
  },
  {
    icon: TrendingUp,
    title: "Optimal-score gap",
    body: "Same knowledge, smarter decisions: the exact plus-marks you could have scored this attempt.",
  },
  {
    icon: Clock,
    title: "Pacing and attempt order",
    body: "Where you burned time and where you rushed into errors, so the clock stops quietly costing you marks.",
  },
  {
    icon: ListFilter,
    title: "Weakness ranking",
    body: "Section and topic weaknesses ranked, so you always know exactly what to revise next.",
  },
  {
    icon: Repeat,
    title: "Improvement tracking",
    body: "Every decision, every attempt, tracked over time. Watch the gap close mock after mock.",
  },
];

export default function MarksenseAIPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-50 border-b border-hairline bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo priority />
          <Link href="/" className="text-sm font-medium text-ink-secondary transition-premium hover:text-ink">
            Back to home
          </Link>
        </div>
      </header>

      <main className="bg-panel-dark">
        {/* Cinematic intro */}
        <MarksenseCinematic />

        {/* Everything inside the engine (stays on the dark cinematic ground so
            there is no jarring dark-to-white jump out of the sequence) */}
        <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
              Everything inside the engine
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Seven reads on a single attempt
            </h2>
            <p className="mt-3 text-base text-white/60">
              Each one is computed from what you actually did on the mock. No guesswork, no invented scores.
            </p>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {ENGINE.map((b, i) => (
              <Reveal key={b.title} delay={(i % 2) * 60}>
                <div className="flex h-full gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-bright/15 text-gold-bright ring-1 ring-gold-bright/20">
                    <b.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{b.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/60">{b.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Exam-aware configuration (short factual note, ties to per-exam scoring) */}
        <section className="mx-auto w-full max-w-4xl px-4 pb-8 sm:px-6">
          <Reveal>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center sm:p-10">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Tuned to the exam you are sitting
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base text-white/60">
                Every number is computed under your exam&apos;s own marking scheme. SSC CGL runs plus-2 and minus-0.5, so the break-even for a guess sits at one in five. When IBPS Clerk and SBI Clerk go live at plus-1 and minus-0.25, that math shifts, and MarksenseAI shifts with it.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Bottom CTA / pricing block */}
        <section id="plans" className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-white/[0.03] p-8 text-center ring-1 ring-gold-bright/25 sm:p-12">
              <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(70% 60% at 50% 0%, rgba(217,119,6,0.16), transparent 60%)" }} aria-hidden />
              <div className="relative">
              <h2 className="font-report text-3xl font-medium tracking-tight text-white sm:text-4xl">
                Start free. Unlock MarksenseAI when you are ready.
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-base text-white/70">
                One subscription covers every exam, current and upcoming. No repurchase, no separate accounts.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/sample"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-ink transition-premium hover:bg-white/90"
                >
                  Try a free mock
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition-premium hover:border-white/50"
                >
                  View full plans
                </Link>
              </div>
              <p className="mt-4 text-xs text-white/45">Plans from ₹99/mo. Cancel anytime.</p>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <BrandLogo />
          <p className="text-xs text-ink-tertiary">© {new Date().getFullYear()} LastMilePrep</p>
        </div>
      </footer>
    </div>
  );
}
