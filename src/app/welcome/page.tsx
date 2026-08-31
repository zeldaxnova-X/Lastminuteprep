import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = { title: "Welcome to LastMilePrep" };

/**
 * Post-signup fork. New accounts land here (unless they arrived with a specific
 * intent, e.g. a checkout link) so buying is never gated behind the free mock:
 * take a mock, or go straight to plans.
 */
export default function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <BrandLogo />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">You&apos;re in</p>
          <h1 className="mt-3 font-report text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Where do you want to start?
          </h1>
          <p className="mt-3 text-base text-ink-secondary">
            Take a real mock and see where your marks are hiding, or jump straight to a plan. No wrong answer.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link
            href="/sample"
            className="group flex flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-soft transition-premium hover:border-accent/40"
          >
            <h2 className="text-lg font-bold text-ink">Take a free mock</h2>
            <p className="mt-1 flex-1 text-sm text-ink-secondary">
              A 20-question CBT in the real interface. See your net score and a preview of the full report.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              Start the mock <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/#pricing"
            className="group flex flex-col rounded-2xl bg-panel-dark p-6 text-white ring-1 ring-gold-bright/30 transition-premium hover:ring-gold-bright/50"
          >
            <h2 className="inline-flex items-center gap-1.5 text-lg font-bold text-white">
              <Sparkles className="h-4 w-4 text-gold-bright" /> Skip to plans
            </h2>
            <p className="mt-1 flex-1 text-sm text-white/70">
              Unlock unlimited mocks, the full report, and MarksenseAI. One subscription covers every exam.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-bright">
              See plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/dashboard" className="text-sm font-medium text-ink-tertiary transition-premium hover:text-ink">
            Or go to your dashboard →
          </Link>
        </div>
      </main>
    </div>
  );
}
