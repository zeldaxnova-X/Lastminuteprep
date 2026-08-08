import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Timer,
  Compass,
  Target,
  Sparkles,
  Lock,
  Layers,
  LineChart,
  BrainCircuit,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal, CountUp } from "@/components/landing/motion";
import { HeroVisual } from "@/components/landing/hero-visual";
import { ExamMarquee, Faq } from "@/components/landing/interactive";
import { MentorSilhouette } from "@/components/landing/mentor-silhouette";
import { AspirationBand, GoalMontage } from "@/components/landing/bands";
import { GhostImage, Duotone, Framed } from "@/components/landing/photo";
import {
  PalettePreview,
  CalibrationPreview,
  OptimalGapBar,
} from "@/components/landing/previews";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "LastMilePrep — The last mile is where exams are won",
  description:
    "Real CBT mocks for SSC CGL, 10,000+ questions, and an AI Strategy Mentor that reads your confidence and tells you exactly how to score more.",
};

const EXAMS = [
  { name: "SSC CGL", status: "live" as const, note: "Tier 1 · live now", img: "/images/goal-secretariat.jpg" },
  { name: "NEET", status: "soon" as const, note: "Coming soon", img: null },
  { name: "JEE", status: "soon" as const, note: "Coming soon", img: null },
  { name: "NEET PG", status: "soon" as const, note: "Coming soon", img: null },
  { name: "UPSC", status: "soon" as const, note: "Coming soon", img: "/images/goal-india-gate.jpg" },
];

const STEPS = [
  { n: "01", icon: Timer, title: "Sit a real CBT mock", body: "The exact interface — five-state palette, live timer, free navigation. No training wheels." },
  { n: "02", icon: Compass, title: "Get your confidence-calibrated analysis", body: "We capture how sure you were on every question, then read it back against how you actually did." },
  { n: "03", icon: Target, title: "Know exactly what to fix", body: "Which questions to skip, how to guess under negative marking, and the marks each decision was worth." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Nav />
      <main>
        <Hero />
        <ExamMarquee />
        <Tension />
        <ExamBreadth />
        <CbtRealism />
        <Features />
        <MentorSection />
        <AspirationBand />
        <HowItWorks />
        <Stats />
        <Pricing />
        <FaqSection />
        <GoalMontage />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-ink-secondary md:flex">
          <a href="#how" className="transition-premium hover:text-ink">The Method</a>
          <a href="#exams" className="transition-premium hover:text-ink">Exams</a>
          <a href="#features" className="transition-premium hover:text-ink">Features</a>
          <a href="#pricing" className="transition-premium hover:text-ink">Pricing</a>
        </nav>
        <ButtonLink href="/sample" variant="primary" size="sm">
          Try free
          <ArrowRight className="h-3.5 w-3.5" />
        </ButtonLink>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* animated backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-grid" />
        <div className="absolute inset-0 hero-wash" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/70 px-3.5 py-1.5 text-xs font-medium text-ink-secondary backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              CBT mocks for SSC CGL — NEET · JEE · UPSC coming soon
            </div>
          </Reveal>

          <h1 className="mt-6 font-report text-[2.75rem] font-medium leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-[4.25rem]">
            <Reveal>The last mile is</Reveal>
            <Reveal delay={110}>where exams are</Reveal>
            <Reveal delay={220}>
              <span className="text-accent">won.</span>
            </Reveal>
          </h1>

          <Reveal delay={300}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-secondary">
              Exact CBT mocks, 10,000+ real questions, and an AI Strategy Mentor
              that reads your confidence on every question — built for the final
              stretch, when marks are won or lost on decisions, not just knowledge.
            </p>
          </Reveal>

          <Reveal delay={380}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sample" variant="primary" size="lg">
                Start with 20 free questions
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#how" variant="secondary" size="lg">
                See how it works
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-tertiary">
              One-time sample · real CBT · no signup to try.
            </p>
          </Reveal>
        </div>

        <Reveal delay={160}>
          <HeroVisual />
        </Reveal>
      </div>
    </section>
  );
}

function Tension() {
  return (
    <section className="border-b border-hairline bg-panel/40">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl ring-1 ring-hairline lg:max-w-none">
            <Image
              src="/images/tension-focus.jpg"
              alt="An aspirant deep in concentration"
              fill
              sizes="(max-width: 1024px) 80vw, 30vw"
              loading="lazy"
              className="object-cover opacity-90 [filter:grayscale(0.5)_contrast(1.03)]"
              style={{ objectPosition: "center 25%" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.28),transparent_55%)]" />
          </div>
        </Reveal>

        <Reveal delay={100} className="order-1 text-center lg:order-2 lg:text-left">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-tertiary">
            The real reason marks slip
          </p>
          <p className="font-report text-3xl font-medium leading-snug tracking-tight text-ink sm:text-[2.75rem] sm:leading-[1.14]">
            You&apos;re not losing marks on what you don&apos;t know —
            you&apos;re losing them on questions you{" "}
            <span className="text-accent">should have skipped.</span>
          </p>
          <p className="mt-6 max-w-xl text-base text-ink-secondary lg:mx-0">
            Under negative marking, a wrong guess costs you twice. That single
            decision — attempt or skip — is where the Mentor lives.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function ExamBreadth() {
  return (
    <section id="exams" className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>One platform, every exam</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Built to scale across India&apos;s exams
        </h2>
        <p className="mt-3 text-base text-ink-secondary">
          SSC CGL is live today. The rest is an honest roadmap — the engine is
          config-driven, so more exams arrive without compromise.
        </p>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {EXAMS.map((e, i) => (
          <Reveal key={e.name} delay={i * 60}>
            {e.img ? (
              <div className="relative flex h-full min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl p-5 ring-1 ring-hairline">
                <GhostImage
                  src={e.img}
                  sizes="(max-width: 640px) 50vw, 20vw"
                  overlay="strong"
                  position="center"
                />
                <span
                  className={cn(
                    "relative self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    e.status === "live" ? "bg-success text-white" : "bg-white/15 text-white backdrop-blur-sm"
                  )}
                >
                  {e.status === "live" ? "Live" : "Soon"}
                </span>
                <div className="relative mt-6">
                  <p className="text-lg font-semibold text-white">{e.name}</p>
                  <p className="text-xs text-white/70">{e.note}</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[168px] flex-col justify-between rounded-2xl border border-hairline bg-surface p-5">
                <span className="self-start rounded-md bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary">
                  Soon
                </span>
                <div className="mt-6">
                  <p className="text-lg font-semibold text-ink">{e.name}</p>
                  <p className="text-xs text-ink-tertiary">{e.note}</p>
                </div>
              </div>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CbtRealism() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-panel-dark p-6 ring-1 ring-white/10 sm:p-10 lg:p-14">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: "radial-gradient(60% 60% at 15% 0%, rgba(4,120,87,0.18), transparent 60%)" }}
            aria-hidden
          />
          <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                Exam-day realism
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                The exact CBT interface — down to the muscle memory
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70">
                Same timer, same five-state palette, same navigator. It faithfully
                replicates the real computer-based test experience, so by exam day
                it feels like your 40th test — not your first.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Five-state palette: answered, not answered, marked, both, unvisited",
                  "Single 60-minute timer that auto-submits — and survives a refresh",
                  "Save & Next, Mark for Review, Clear — exactly as they behave in the hall",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <PalettePreview dark />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl space-y-16 px-4 py-24 sm:space-y-24 sm:px-6 sm:py-28">
      <FeatureRow
        n="01"
        icon={Layers}
        title="10,000+ real questions"
        body="A deep bank of genuine exam-standard questions — no filler, no padding. Practise full 100-question mocks or drill a single section, as many times as your cycle needs."
        visual={
          <div className="relative">
            <Framed
              src="/images/feature-questions.jpg"
              alt="A student working through practice questions"
              aspect="4 / 3"
              position="center"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-panel-dark/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="tabular text-accent">10,000+</span> questions
            </span>
          </div>
        }
      />
      <FeatureRow
        n="02"
        icon={LineChart}
        reverse
        title="Reports that expose the gap"
        body="Accuracy, timing, and section-by-section breakdown — plus confidence calibration that shows where you felt sure and were wrong. The leaks you can't see are the ones costing you marks."
        visual={
          <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-6 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Confidence calibration</p>
            <CalibrationPreview />
            <div className="border-t border-hairline pt-4">
              <OptimalGapBar />
            </div>
          </div>
        }
      />
      <FeatureRow
        n="03"
        icon={BrainCircuit}
        title="An AI mentor in your corner"
        body="Your exact skip strategy, how to guess when you must under negative marking, a score-maximisation plan, and improvement tracking across every attempt. Not a scorecard — a plan."
        visual={<MentorFeatureVisual />}
      />
    </section>
  );
}

function MentorSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-panel-dark p-6 ring-1 ring-white/10 sm:p-10 lg:p-14">
          <Duotone src="/images/ai-mentor.jpg" opacity={0.38} position="center 18%" />
          <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright">
                <Sparkles className="h-3.5 w-3.5" /> The AI Mentor
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                It reads every attempt — and finds the marks you left behind
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70">
                Where you guessed, what you should have skipped, how to pace, and
                exactly how you could have scored more. It shows you the shape of
                your report — the substance is yours once you unlock it.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Your exact skip strategy under negative marking",
                  "When a guess is worth the −0.5 risk",
                  "Optimal-score plan and improvement tracking",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-bright" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <MentorSilhouette />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="border-y border-hairline bg-panel/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <Eyebrow>The method</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Three steps from practice to a plan
          </h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
                <StepVisual index={i} />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <span className="font-report text-2xl font-medium text-ink-tertiary">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat value={<CountUp end={10000} suffix="+" />} label="Questions in the bank" />
        <Stat value={<CountUp end={100} />} label="Questions per full mock" />
        <Stat value="4" label="Sections, 60-minute timer" />
        <Stat value={<>+2 / <span className="text-danger">−0.5</span></>} label="Real SSC marking scheme" />
      </div>
      <Reveal>
        <p className="mt-6 text-center text-xs text-ink-tertiary">
          Real numbers only — no invented user counts, no fabricated reviews.
        </p>
      </Reveal>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="border-t border-hairline bg-panel/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Pay once for your exam cycle
          </h2>
          <p className="mt-3 text-base text-ink-secondary">
            The only thing that changes between paid tiers is the Mentor.
          </p>
        </Reveal>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <PriceCard
            name="Sample"
            price="₹0"
            priceNote="one-time"
            cta="Start free"
            href="/sample"
            features={["20 questions", "Real CBT interface", "One attempt · your net score"]}
            muted={["No performance report", "No AI Mentor"]}
          />
          <PriceCard
            name="Practice"
            price="₹19"
            priceNote="Season pass — SSC CGL cycle"
            cta="Get Practice"
            href="/sample"
            features={[
              "10,000+ questions",
              "Real CBT · unlimited attempts",
              "Full report: accuracy, timing, section breakdown",
            ]}
            muted={["No AI Mentor"]}
          />
          <PriceCard
            name="Mentor"
            price="₹49"
            priceNote="Season pass — SSC CGL cycle"
            cta="Unlock AI Mentor"
            href="/sample"
            gold
            badge="Most complete"
            features={[
              "Everything in Practice",
              "Proprietary AI Strategy Mentor",
              "Exact skip strategy · guess under negative marking",
              "Score-maximisation plan · improvement tracking",
            ]}
          />
        </div>

        <Reveal>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-ink-tertiary">
            <Check className="h-3.5 w-3.5 text-accent" />
            No subscriptions, no clutter — pay once for your exam cycle.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 sm:py-28">
      <Reveal className="mb-10 text-center">
        <Eyebrow>Questions</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Straight answers
        </h2>
      </Reveal>
      <Reveal delay={80}>
        <Faq />
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl px-6 py-24 text-center ring-1 ring-white/10 sm:px-10 sm:py-32">
          <GhostImage
            src="/images/goal-india-gate.jpg"
            sizes="(max-width: 1152px) 100vw, 1152px"
            overlay="strong"
            position="center"
          />
          <div className="relative">
            <h2 className="font-report text-4xl font-medium tracking-tight text-white sm:text-5xl">
              Your last mile starts here.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/75">
              Take the free 20-question mock and see exactly where your marks are hiding.
            </p>
            <div className="mt-8 flex justify-center">
              <ButtonLink href="/sample" variant="primary" size="lg">
                Start free
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-secondary">
          <Link href="/terms" className="transition-premium hover:text-ink">Terms</Link>
          <Link href="/privacy-policy" className="transition-premium hover:text-ink">Privacy</Link>
          <Link href="/refund-policy" className="transition-premium hover:text-ink">Refund</Link>
          <Link href="/contact-us" className="transition-premium hover:text-ink">Contact</Link>
        </nav>
        <p className="text-xs text-ink-tertiary">© {new Date().getFullYear()} LastMilePrep</p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
        LM
      </span>
      <span>
        LastMile<span className="text-accent">Prep</span>
      </span>
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
      {children}
    </p>
  );
}

function FeatureRow({
  n,
  icon: Icon,
  title,
  body,
  visual,
  reverse = false,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <Reveal className={cn(reverse && "lg:order-2")}>
        <div className="flex items-center gap-3">
          <span className="font-report text-3xl font-medium text-ink-tertiary tabular">{n}</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h3>
        <p className="mt-3 max-w-md text-base leading-relaxed text-ink-secondary">{body}</p>
      </Reveal>
      <Reveal delay={120} className={cn(reverse && "lg:order-1")}>
        {visual}
      </Reveal>
    </div>
  );
}

function MentorFeatureVisual() {
  const ITEMS = [
    "You should've skipped 6 questions → +5 marks",
    "Guess only when your odds beat the −0.5 penalty",
    "Your optimal-score plan for the next mock",
  ];
  return (
    <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-6 shadow-soft">
      {ITEMS.map((t, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-hairline bg-panel px-4 py-3">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">
            {i + 1}
          </span>
          <span className="text-sm text-ink">{t}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-xl bg-panel-dark px-4 py-3 text-sm text-white/80">
        <Lock className="h-4 w-4 flex-shrink-0 text-gold-bright" />
        Your personalised guess-or-skip rule — inside the Mentor.
      </div>
    </div>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 1) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center border-b border-hairline bg-panel p-5">
        <div className="w-full max-w-[240px]">
          <CalibrationPreview />
        </div>
      </div>
    );
  }
  const cfg =
    index === 0
      ? { src: "/images/how-sit-test.jpg", alt: "A student sitting a computer-based mock test", pos: "center" }
      : { src: "/images/how-know-fix.jpg", alt: "A student reviewing what to fix next", pos: "center 30%" };
  return (
    <div className="relative aspect-[16/10] border-b border-hairline bg-panel">
      <Image
        src={cfg.src}
        alt={cfg.alt}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        loading="lazy"
        className="object-cover"
        style={{ objectPosition: cfg.pos }}
      />
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <Reveal className="text-center">
      <p className="font-report text-4xl font-semibold tracking-tight text-ink tabular sm:text-5xl">{value}</p>
      <p className="mt-2 text-sm text-ink-secondary">{label}</p>
    </Reveal>
  );
}

function PriceCard({
  name,
  price,
  priceNote,
  cta,
  href,
  features,
  muted = [],
  gold = false,
  badge,
}: {
  name: string;
  price: string;
  priceNote: string;
  cta: string;
  href: string;
  features: string[];
  muted?: string[];
  gold?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl p-6",
        gold
          ? "bg-panel-dark text-white ring-1 ring-gold-bright/40 shadow-lift"
          : "border border-hairline bg-surface shadow-soft"
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className={cn("text-base font-semibold", gold ? "text-white" : "text-ink")}>{name}</h3>
        {badge && (
          <span className="rounded-md bg-gold-bright/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className={cn("text-3xl font-semibold tracking-tight tabular", gold ? "text-white" : "text-ink")}>
          {price}
        </span>
        <span className={cn("text-xs font-medium", gold ? "text-white/50" : "text-ink-tertiary")}>{priceNote}</span>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className={cn("flex gap-2.5 text-sm", gold ? "text-white/80" : "text-ink-secondary")}>
            <Check className={cn("mt-0.5 h-4 w-4 flex-shrink-0", gold ? "text-gold-bright" : "text-accent")} />
            <span>{f}</span>
          </li>
        ))}
        {muted.map((f) => (
          <li key={f} className={cn("flex gap-2.5 text-sm", gold ? "text-white/40" : "text-ink-tertiary")}>
            <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-center">–</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {gold ? (
        <Link
          href={href}
          className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gold-bright px-4 py-2 text-sm font-semibold text-white transition-premium hover:bg-gold"
        >
          <Sparkles className="h-4 w-4" />
          {cta}
        </Link>
      ) : (
        <ButtonLink href={href} variant="secondary" size="md" className="mt-6 w-full">
          {cta}
        </ButtonLink>
      )}
    </div>
  );
}
