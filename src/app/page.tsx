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
  Gauge,
  SkipForward,
  Scale,
  TrendingUp,
  Clock,
  ListFilter,
  Repeat,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { AuthNav } from "@/components/auth/auth-nav";
import { Reveal, CountUp } from "@/components/landing/motion";
import { HeroVisual } from "@/components/landing/hero-visual";
import { ExamMarquee, Faq } from "@/components/landing/interactive";
import { MentorSilhouette } from "@/components/landing/mentor-silhouette";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
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
    "Real CBT mocks for SSC CGL, 10,000+ questions, and the LastMilePrep Mentor Engine — a proprietary method that reads your confidence and tells you exactly how to score more. No sign-up to try.",
};

/* The full Mentor Engine benefit set — every item is something the deterministic
   analysis already computes. Honest by construction (no invented capabilities). */
const MENTOR_BENEFITS = [
  {
    icon: Gauge,
    title: "Confidence calibration",
    body: "Where you were sure but wrong (overconfidence) and unsure but right — the marks you left on the table.",
  },
  {
    icon: SkipForward,
    title: "Exact skip strategy",
    body: "The specific questions you should have skipped under negative marking. Named, not generic advice.",
  },
  {
    icon: Scale,
    title: "Your personal guess rule",
    body: "Your own break-even — guess only when your odds beat the −0.5 penalty, computed for you, not a rule of thumb.",
  },
  {
    icon: TrendingUp,
    title: "Optimal-score gap",
    body: "Same knowledge, smarter decisions → the exact “+X marks” you could have scored this attempt.",
  },
  {
    icon: Clock,
    title: "Pacing & attempt order",
    body: "Where you burned time and where you rushed into errors, so the clock stops quietly costing you marks.",
  },
  {
    icon: ListFilter,
    title: "Weakness ranking",
    body: "Section and topic weaknesses ranked — you always know exactly what to revise next.",
  },
  {
    icon: Repeat,
    title: "Improvement tracking",
    body: "Every decision, every attempt, tracked over time — watch the gap close mock after mock.",
  },
];

const EXAMS_SOON = ["NEET", "JEE", "NEET PG", "UPSC"];

const STEPS = [
  { n: "01", icon: Timer, title: "Sit a real CBT mock", body: "The exact interface — five-state palette, live timer, free navigation. No training wheels." },
  { n: "02", icon: Compass, title: "Get your confidence-calibrated analysis", body: "We capture how sure you were on every question, then read it back against how you actually did." },
  { n: "03", icon: Target, title: "Know exactly what to fix", body: "Which questions to skip, how to guess under negative marking, and the marks each decision was worth." },
];

/* Shared pricing feature stacks (re-used across cards so lower tiers can SEE
   exactly what's locked). */
const PRO_ROWS = [
  "10,000+ real questions",
  "Full 100-Q mocks & section drills",
  "Unlimited attempts · exact CBT interface",
  "Full report: accuracy, timing, sections",
  "Confidence capture on every question",
];
const MENTOR_ROWS = [
  "Confidence calibration (sure-but-wrong)",
  "Exact skip strategy under −0.5",
  "Your personal break-even guess rule",
  "Optimal-score gap: same knowledge, +X marks",
  "Pacing & attempt-order analysis",
  "Section & topic weakness ranking",
  "Improvement tracking across attempts",
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
        <BrandLogo priority />
        <nav className="hidden items-center gap-7 text-sm text-ink-secondary md:flex">
          <a href="#how" className="transition-premium hover:text-ink">The Method</a>
          <a href="#exams" className="transition-premium hover:text-ink">Exams</a>
          <a href="#mentor" className="transition-premium hover:text-ink">AI Mentor</a>
          <a href="#pricing" className="transition-premium hover:text-ink">Pricing</a>
        </nav>
        <AuthNav />
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
              <span className="bg-gradient-to-r from-accent to-violet bg-clip-text text-transparent">
                won.
              </span>
            </Reveal>
          </h1>

          <Reveal delay={300}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-secondary">
              Exact CBT mocks, 10,000+ real questions, and the LastMilePrep
              Mentor Engine — a proprietary method that reads your confidence on
              every question and tells you exactly how to score more.
            </p>
          </Reveal>

          <Reveal delay={380}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sample" variant="primary" size="lg">
                Try free now
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/login?mode=signup" variant="secondary" size="lg">
                Sign up
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={440}>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink-secondary">
              {["No sign-up to try", "Real CBT interface", "One-time free sample"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  {t}
                </li>
              ))}
            </ul>
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
              alt="An aspirant deep in concentration during a mock test"
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
            decision — attempt or skip — is where the Mentor Engine lives.
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
        <Eyebrow>SSC CGL now · more later</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Built for SSC CGL first — the rest is an honest roadmap
        </h2>
        <p className="mt-3 text-base text-ink-secondary">
          SSC CGL Tier 1 is fully live today. The engine is config-driven, so
          more exams arrive without compromise — but only when they&apos;re real.
        </p>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* SSC CGL — the dominant, full-colour LIVE hero card */}
        <Reveal className="lg:col-span-2">
          <div className="group relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-3xl p-6 ring-1 ring-hairline sm:p-8">
            <Image
              src="/images/goal-secretariat.jpg"
              alt="A government secretariat building — the goal SSC CGL leads to"
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              loading="lazy"
              className="object-cover"
              style={{ objectPosition: "center" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.92),rgba(10,10,10,0.35))]" />

            <div className="relative flex items-center gap-2 self-start rounded-full bg-success px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Live now
            </div>

            <div className="relative">
              <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                SSC CGL
              </p>
              <p className="mt-1 text-sm text-white/75">
                Tier 1 · 100 questions · 4 sections · full CBT + AI Mentor
              </p>
              <div className="mt-5">
                <ButtonLink
                  href="/sample"
                  size="md"
                  className="bg-white text-ink hover:bg-white/90"
                >
                  Start a free mock
                  <ArrowRight className="h-4 w-4" />
                </ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Coming soon — clearly subordinate chips */}
        <Reveal delay={80}>
          <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-1">
            {EXAMS_SOON.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-2xl border border-dashed border-hairline-strong bg-panel/60 px-4 py-4 lg:flex-1"
              >
                <span className="text-sm font-semibold text-ink-secondary">{name}</span>
                <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary ring-1 ring-hairline">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </Reveal>
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
            style={{ background: "radial-gradient(60% 60% at 15% 0%, rgba(79,70,229,0.20), transparent 60%)" }}
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
              alt="A student working through practice questions on a laptop"
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
        title="The Mentor Engine in your corner"
        body="Your exact skip strategy, your own break-even guess rule under negative marking, a score-maximisation plan, and improvement tracking across every attempt. Not a scorecard — a plan."
        visual={<MentorFeatureVisual />}
      />
    </section>
  );
}

function MentorSection() {
  return (
    <section id="mentor" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-panel-dark p-6 ring-1 ring-white/10 sm:p-10 lg:p-14">
          <Duotone src="/images/ai-mentor.jpg" opacity={0.32} position="center 18%" />

          <div className="relative">
            {/* Header + the approved locked-report anchor (ss9) */}
            <div className="grid items-start gap-10 lg:grid-cols-[1fr_0.82fr] lg:gap-14">
              <div>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-bright/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold-bright ring-1 ring-gold-bright/25">
                  <Sparkles className="h-3.5 w-3.5" /> The LastMilePrep Mentor Engine&trade;
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  A proprietary engine that turns your attempt into a scoring plan
                </h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
                  It reads how sure you were on every question against how you
                  actually did, then tells you which questions to skip, when a
                  guess beats the penalty, and exactly how many marks smarter
                  decisions were worth. You see the shape of your report here — the
                  numbers are yours the moment you unlock it.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/sample"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-gold-bright px-6 py-3 text-base font-semibold text-white transition-premium hover:bg-gold"
                  >
                    <Sparkles className="h-4 w-4" />
                    Unlock the Mentor — ₹79
                  </Link>
                  <span className="text-xs text-white/45">
                    ₹79/mo · founding price
                  </span>
                </div>
              </div>

              <MentorSilhouette />
            </div>

            {/* The full benefit set — marketed as distinct value props */}
            <div className="mt-12 border-t border-white/10 pt-10">
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-gold-bright/80">
                Everything inside the engine
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {MENTOR_BENEFITS.map((b, i) => (
                  <div
                    key={b.title}
                    className={cn(
                      "flex gap-3.5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 sm:p-5",
                      i === MENTOR_BENEFITS.length - 1 && "sm:col-span-2"
                    )}
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-bright/12 text-gold-bright ring-1 ring-gold-bright/20">
                      <b.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{b.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-white/60">{b.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>SSC CGL Tier 1 — the real exam</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Built to SSC CGL&apos;s exact shape
        </h2>
        <p className="mt-3 text-base text-ink-secondary">
          Every number below is SSC CGL Tier 1&apos;s own — including the +2 / −0.5
          marking scheme the whole platform is scored against.
        </p>
      </Reveal>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat value={<CountUp end={10000} suffix="+" />} label="Questions in the bank" />
        <Stat value={<CountUp end={100} />} label="Questions per full mock" />
        <Stat value="4" label="Sections · 60-minute timer" />
        <Stat value={<>+2 / <span className="text-danger">−0.5</span></>} label="SSC CGL marking scheme" />
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
          <h2 className="mt-3 font-report text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            Simple monthly pricing
          </h2>
          <p className="mt-4 text-base text-ink-secondary">
            Founding prices while we&apos;re young — the only thing that changes
            between paid tiers is the Mentor Engine.
          </p>
        </Reveal>

        {/* Warm human band — imagery only, no fabricated quotes */}
        <Reveal className="mx-auto mb-12 grid max-w-3xl gap-4 sm:grid-cols-2">
          <Framed
            src="/images/add1.jpg"
            alt="Two aspirants preparing together at a laptop"
            aspect="16 / 10"
            position="center"
          />
          <Framed
            src="/images/add2.jpg"
            alt="A young aspirant on a college campus"
            aspect="16 / 10"
            position="center 30%"
          />
        </Reveal>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <PriceCard
            name="Free"
            price="₹0"
            priceNote="one-time"
            cta="Start free"
            href="/sample"
            groups={[
              {
                heading: "Included",
                rows: [
                  { label: "20-question sample" },
                  { label: "Exact CBT interface" },
                  { label: "Your net score at the end" },
                ],
              },
              {
                heading: "Full report — locked",
                rows: [
                  { label: "Accuracy, timing & section breakdown", locked: true },
                  { label: "10,000+ questions · unlimited attempts", locked: true },
                ],
              },
              {
                heading: "AI Mentor — locked",
                rows: MENTOR_ROWS.map((label) => ({ label, locked: true })),
              },
            ]}
          />

          <PriceCard
            name="Pro"
            price="₹19/mo"
            subNote="Founding price."
            cta="Get Pro"
            href="/sample"
            groups={[
              {
                heading: "Everything you get",
                rows: PRO_ROWS.map((label) => ({ label })),
              },
              {
                heading: "AI Mentor — locked",
                rows: MENTOR_ROWS.map((label) => ({ label, locked: true })),
              },
            ]}
          />

          <PriceCard
            name="AI Mentor"
            price="₹79/mo"
            subNote="Founding price."
            cta="Unlock AI Mentor"
            href="/sample"
            gold
            badges={["Proprietary engine", "Most complete"]}
            groups={[
              {
                heading: "Everything in Pro",
                rows: PRO_ROWS.map((label) => ({ label })),
              },
              {
                heading: "The Mentor Engine™",
                rows: MENTOR_ROWS.map((label) => ({ label })),
              },
            ]}
          />
        </div>

        <Reveal>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-ink-tertiary">
            <Check className="h-3.5 w-3.5 text-success" />
            Honest founding prices — no fake discounts. What you see is the real
            price today. Cancel anytime.
          </p>
          <RazorpayBadge className="mt-4" />
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
        <div className="relative grid overflow-hidden rounded-3xl bg-panel-dark ring-1 ring-white/10 lg:grid-cols-2">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: "radial-gradient(70% 80% at 0% 0%, rgba(79,70,229,0.22), transparent 60%)" }}
            aria-hidden
          />
          <div className="relative flex flex-col justify-center p-8 sm:p-12 lg:p-14">
            <h2 className="font-report text-4xl font-medium tracking-tight text-white sm:text-5xl">
              Your last mile starts here.
            </h2>
            <p className="mt-4 max-w-md text-base text-white/75">
              Take the free 20-question mock — no sign-up — and see exactly where
              your marks are hiding.
            </p>
            <div className="mt-8">
              <Link
                href="/sample"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-ink transition-premium hover:bg-white/90"
              >
                Start free — no sign-up
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/45">
              One-time free sample · real CBT interface.
            </p>
          </div>

          <div className="relative min-h-[240px] lg:min-h-full">
            <Image
              src="/images/cheerful-attractive-young-woman-with-black-hair-walking.jpg"
              alt="A cheerful aspirant walking with her phone"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              loading="lazy"
              className="object-cover"
              style={{ objectPosition: "center 25%" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(11,11,12,0.85),transparent_45%)] lg:bg-[linear-gradient(to_right,rgba(11,11,12,0.95),transparent_55%)]" />
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
        <BrandLogo />
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

type PriceRow = { label: string; locked?: boolean };
type PriceGroup = { heading?: string; rows: PriceRow[] };

function PriceCard({
  name,
  price,
  priceNote,
  strike,
  subNote,
  cta,
  href,
  groups,
  gold = false,
  badges = [],
}: {
  name: string;
  price: string;
  priceNote?: string;
  strike?: string;
  subNote?: string;
  cta: string;
  href: string;
  groups: PriceGroup[];
  gold?: boolean;
  badges?: string[];
}) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl p-6 sm:p-7",
        gold
          ? "bg-panel-dark text-white ring-1 ring-gold-bright/40 shadow-lift lg:-mt-4 lg:mb-4"
          : "border border-hairline bg-surface shadow-soft"
      )}
    >
      {gold && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
          style={{ background: "radial-gradient(80% 55% at 85% 0%, rgba(217,119,6,0.16), transparent 60%)" }}
          aria-hidden
        />
      )}

      <div className="relative flex flex-1 flex-col">
        {badges.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-md bg-gold-bright/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <h3 className={cn("text-base font-semibold", gold ? "text-white" : "text-ink")}>{name}</h3>

        <div className="mt-3 flex items-baseline gap-2">
          <span className={cn("text-4xl font-semibold tracking-tight tabular", gold ? "text-white" : "text-ink")}>
            {price}
          </span>
          {strike && (
            <span
              className={cn(
                "text-base font-medium tabular line-through",
                gold ? "text-white/40" : "text-ink-tertiary"
              )}
            >
              {strike}
            </span>
          )}
          {priceNote && (
            <span className={cn("text-xs font-medium", gold ? "text-white/50" : "text-ink-tertiary")}>{priceNote}</span>
          )}
        </div>
        {subNote && (
          <p className={cn("mt-1 text-xs font-semibold", gold ? "text-gold-bright" : "text-ink-tertiary")}>{subNote}</p>
        )}

        <div className="mt-5 flex-1 space-y-4">
          {groups.map((g, gi) => (
            <div key={gi} className="space-y-2">
              {g.heading && (
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    gold ? "text-gold-bright/80" : "text-ink-tertiary"
                  )}
                >
                  {g.heading}
                </p>
              )}
              {g.rows.map((r) => (
                <div
                  key={r.label}
                  className={cn(
                    "flex gap-2.5 text-sm",
                    r.locked
                      ? gold
                        ? "text-white/35"
                        : "text-ink-tertiary"
                      : gold
                        ? "text-white/85"
                        : "text-ink-secondary"
                  )}
                >
                  {r.locked ? (
                    <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 opacity-70" />
                  ) : (
                    <Check className={cn("mt-0.5 h-4 w-4 flex-shrink-0", gold ? "text-gold-bright" : "text-success")} />
                  )}
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

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
    </div>
  );
}
