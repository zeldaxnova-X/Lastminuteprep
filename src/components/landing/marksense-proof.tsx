import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { MarksenseWordmark } from "@/components/marksense/wordmark";
import { Reveal } from "./motion";

/*
 * The MarksenseAI proof, placed directly below the hero. An in-code replica of
 * the real report (no screenshot, no stock imagery): section breakdown, the
 * confidence bands, and the score delta, plus the worked value example, the real
 * in-test confidence control, and the break-even explanation. Every figure here
 * is an illustrative example, labelled as such, never a fabricated user stat.
 */

const SECTIONS = [
  { name: "Reasoning", acc: 84 },
  { name: "General Awareness", acc: 56 },
  { name: "Quantitative Aptitude", acc: 64 },
  { name: "English", acc: 72 },
];

// Confidence bands mirror the real 3-level in-test control.
const BANDS = [
  { label: "Confident", acc: 84, tone: "text-success", bar: "bg-success" },
  { label: "Unsure", acc: 52, tone: "text-gold", bar: "bg-gold-bright" },
  { label: "Guessing", acc: 18, tone: "text-danger", bar: "bg-danger" },
];

export function MarksenseProof() {
  return (
    <section id="marksense" className="relative border-b border-hairline bg-panel/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal className="mx-auto mb-8 max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            The differentiator
          </p>
          <h2 className="mt-3 font-report text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            The report that finds the marks your score is hiding
          </h2>
          <p className="mt-3 text-base text-ink-secondary">
            Two of your decisions cost you marks you already had the knowledge to win.{" "}
            <MarksenseWordmark /> reads every attempt and shows you exactly which, and what they were worth.
          </p>
        </Reveal>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          {/* B2: the report replica */}
          <Reveal>
            <div className="overflow-hidden rounded-2xl bg-panel-dark p-5 text-white ring-1 ring-white/10 shadow-lift sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <MarksenseWordmark tone="white" className="text-lg" />
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                  Full mock
                </span>
              </div>

              {/* Score delta */}
              <div className="mt-5 flex items-end gap-4 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">You scored</p>
                  <p className="font-report text-4xl font-semibold tabular text-white">65</p>
                </div>
                <ArrowRight className="mb-2 h-5 w-5 text-white/30" />
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Same knowledge, better decisions</p>
                  <p className="font-report text-4xl font-semibold tabular text-[#86efac]">71</p>
                </div>
                <span className="mb-1.5 ml-auto rounded-full bg-[#86efac]/15 px-2.5 py-1 text-xs font-bold text-[#86efac]">
                  +6
                </span>
              </div>

              {/* Section breakdown */}
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-white/45">Section accuracy</p>
              <div className="mt-2 space-y-2">
                {SECTIONS.map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="w-36 flex-shrink-0 text-xs text-white/70">{s.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-gradient-to-r from-[#818cf8] to-[#c084fc]" style={{ width: `${s.acc}%` }} />
                    </span>
                    <span className="w-9 flex-shrink-0 text-right text-xs font-semibold tabular text-white/80">{s.acc}%</span>
                  </div>
                ))}
              </div>

              {/* Confidence bands */}
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-white/45">Accuracy by how sure you were</p>
              <div className="mt-2 space-y-2">
                {BANDS.map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-36 flex-shrink-0 text-xs text-white/70">{b.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className={`block h-full rounded-full ${b.bar}`} style={{ width: `${b.acc}%` }} />
                    </span>
                    <span className="w-9 flex-shrink-0 text-right text-xs font-semibold tabular text-white/80">{b.acc}%</span>
                  </div>
                ))}
              </div>

              <p className="mt-5 text-center text-[11px] text-white/40">
                Example report. Your numbers come from your own mock.
              </p>
            </div>
          </Reveal>

          {/* B3 + B5 stacked */}
          <div className="space-y-5">
            {/* B3: the value example */}
            <Reveal delay={80}>
              <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-report text-xl font-medium tracking-tight text-ink">
                    You scored 65. Your decisions were worth about 6 more.
                  </h3>
                </div>
                <span className="mt-2 inline-block rounded-full bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary">
                  Illustrative example
                </span>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-secondary">
                  <p>
                    You attempted <b className="text-ink">11 questions you&apos;d flagged as pure guesses</b>. Two landed (+4),
                    nine didn&apos;t (−4.5). Net effect on your score: <b className="text-ink">−0.5 marks</b>, for about three
                    minutes of clock.
                  </p>
                  <p>
                    You skipped <b className="text-ink">4 questions you&apos;d flagged &ldquo;confident&rdquo;</b>. Across this mock
                    your confident answers were 84% correct, so attempting those four was worth about{" "}
                    <b className="text-success">+5.5</b> (three land, one misses).
                  </p>
                  <p className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 font-semibold text-success">
                    <Check className="h-4 w-4 flex-shrink-0" />
                    Skip the guesses, attempt the confident-but-skipped → 71.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* B5: break-even */}
            <Reveal delay={140}>
              <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
                <h3 className="font-report text-xl font-medium tracking-tight text-ink">
                  The textbook rule is probably costing you marks.
                </h3>
                <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-secondary">
                  <p>
                    At +2 and −0.5, the maths says guess anything you&apos;re more than 20% likely to get right, which,
                    after eliminating a single option from four, you always are. So the textbook rule is: always guess.
                  </p>
                  <p>
                    Your actual guess accuracy last mock was{" "}
                    <b className="text-danger">18%</b>{" "}
                    <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary">
                      example
                    </span>.
                  </p>
                  <p>
                    MarksenseAI doesn&apos;t hand you the textbook rule. It works out your break-even from how you actually
                    perform when you&apos;re unsure, which is the only number that pays.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* B4: the confidence control, exactly as it appears in the mock */}
        <Reveal delay={80}>
          <div className="mt-5 rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-tertiary">How confident were you?</span>
                <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-hidden>
                  {[
                    { label: "Guessing", on: false },
                    { label: "Unsure", on: false },
                    { label: "Confident", on: true },
                  ].map((o) => (
                    <span
                      key={o.label}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                        o.on
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-hairline-strong bg-surface text-ink-tertiary"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full border ${o.on ? "border-success bg-success" : "border-ink-tertiary/50"}`} />
                      {o.label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-ink-secondary">
                One tap per question. Nothing to fill in afterwards, nothing to remember. MarksenseAI reads confidence
                against correctness, time spent, and question type, four signals, not one.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-6 text-center">
            <Link
              href="/marksenseai"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-premium hover:text-accent/80"
            >
              See how MarksenseAI works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
