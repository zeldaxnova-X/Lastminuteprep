import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Timer,
  Compass,
  Target,
  Layers,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { AuthNav } from "@/components/auth/auth-nav";
import { Reveal, CountUp } from "@/components/landing/motion";
import { LiveQuestionCount } from "@/components/landing/live-stat";
import { MarksenseReveal } from "@/components/landing/marksense-reveal";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { getQuestionCount } from "@/lib/stats";
import { HeroVisual } from "@/components/landing/hero-visual";
import { ExamMarquee, Faq } from "@/components/landing/interactive";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
import { AspirationBand, GoalMontage } from "@/components/landing/bands";
import { Framed } from "@/components/landing/photo";
import { PalettePreview, CalibrationPreview } from "@/components/landing/previews";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "LastMilePrep: The last mile is where exams are won",
  description:
    "Real CBT mocks for SSC CGL, thousands of genuine exam questions, and MarksenseAI, a proprietary engine that reads your confidence and tells you exactly how to score more. No sign-up to try.",
};

/* Exam line-up shown on the landing page. SSC CGL is live; the rest render as
   greyed-out "Coming soon" placeholders (IBPS Clerk and SBI Clerk are next). */
const EXAMS: {
  id: string;
  name: string;
  sub: string;
  logo: string;
  status: "live" | "soon";
  href?: string;
}[] = [
  { id: "ssc-cgl", name: "SSC CGL", sub: "Tier 1 · full CBT + MarksenseAI", logo: "/images/exams/ssc-cgl.png", status: "live", href: "/sample" },
  { id: "ibps-clerk", name: "IBPS Clerk", sub: "Prelims + Mains", logo: "/images/exams/ibps-clerk.png", status: "soon" },
  { id: "sbi-clerk", name: "SBI Clerk", sub: "Prelims + Mains", logo: "/images/exams/sbi.svg", status: "soon" },
  { id: "jee-main", name: "JEE Main", sub: "Engineering entrance", logo: "/images/exams/jee-main.webp", status: "soon" },
  { id: "neet-ug", name: "NEET UG", sub: "Medical entrance", logo: "/images/exams/neet-ug.webp", status: "soon" },
];

const STEPS = [
  { n: "01", icon: Timer, title: "Sit a real CBT mock", body: "The exact interface, five-state palette, live timer, free navigation. No training wheels." },
  { n: "02", icon: Compass, title: "Get your confidence-calibrated analysis", body: "We capture how sure you were on every question, then read it back against how you actually did." },
  { n: "03", icon: Target, title: "Know exactly what to fix", body: "Which questions to skip, how to guess under negative marking, and the marks each decision was worth." },
];

export default async function LandingPage() {
  const questionCount = await getQuestionCount();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Nav />
      <main>
        <Hero />
        <Tension />
        <MarksenseTeaser />
        <CbtRealism />
        <Features questionCount={questionCount} />
        <MultiExam />
        <HowItWorks />
        <AspirationBand />
        <Stats questionCount={questionCount} />
        <Pricing questionCount={questionCount} />
        <FaqSection />
        <ExamMarquee />
        <ExamBreadth />
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
          <a href="#marksense" className="transition-premium hover:text-ink">MarksenseAI</a>
          <a href="#exams" className="transition-premium hover:text-ink">Exams</a>
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
          <h1 className="font-report text-[2.4rem] font-medium leading-[1.06] tracking-tight text-ink sm:text-[3.25rem] lg:text-[3.7rem]">
            <Reveal>You already know more</Reveal>
            <Reveal delay={110}>
              than your{" "}
              <span className="bg-gradient-to-r from-accent to-violet bg-clip-text text-transparent">
                last score shows.
              </span>
            </Reveal>
          </h1>

          <Reveal delay={300}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-secondary">
              Take a real CBT mock. MarksenseAI finds the marks you lost to
              decisions, not knowledge, and shows you exactly how to win them
              back.
            </p>
          </Reveal>

          <Reveal delay={380}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/sample" variant="primary" size="lg">
                Try free
                <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="#pricing" variant="secondary" size="lg">
                View plans
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={440}>
            <p className="mt-5 text-sm font-medium text-ink-secondary">
              One subscription. Every exam. No separate purchases.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink-secondary">
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
            You&apos;re not losing marks on what you don&apos;t know, you&apos;re losing them on questions you{" "}
            <span className="text-accent">should have skipped.</span>
          </p>
          <p className="mt-6 max-w-xl text-base text-ink-secondary lg:mx-0">
            Under negative marking, a wrong guess costs you twice. That single
            decision, attempt or skip, is where MarksenseAI lives.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* Compact MarksenseAI teaser. Its whole job is to earn the click through to the
   /marksenseai page, where the full cinematic sequence lives. MarksenseReveal
   plays the half-moon arc + wordmark pop once on scroll-in; nothing scroll-linked. */
function MarksenseTeaser() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-14">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-panel-dark px-8 pb-7 pt-9 text-center ring-1 ring-white/10 sm:px-12">
          <MarksenseReveal />
          <div className="relative mt-7">
            <Link
              href="/marksenseai"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2 text-sm font-medium text-white/85 backdrop-blur transition-premium hover:border-white/35 hover:bg-white/10 hover:text-white"
            >
              See how it works
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* Multi-exam access as a structural product advantage, not a footnote. */
function MultiExam() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
      <Reveal>
        <div className="rounded-3xl border border-hairline bg-surface p-8 text-center shadow-soft sm:p-10">
          <Eyebrow>One subscription. Every exam.</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Built once. Works everywhere.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-ink-secondary">
            Your plan covers SSC CGL today, and unlocks IBPS Clerk, SBI Clerk,
            NEET, JEE, and UPSC the moment each goes live. No repurchase, no
            separate accounts.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function ExamBreadth() {
  return (
    <section id="exams" className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>Every exam, one plan</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          One engine, every major exam
        </h2>
        <p className="mt-3 text-base text-ink-secondary">
          SSC CGL Tier 1 is live today. IBPS Clerk and SBI Clerk are next, with
          JEE Main and NEET UG on the way, every one included in your
          subscription the day it launches. No repurchase, no separate accounts.
        </p>
      </Reveal>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {EXAMS.map((exam, i) => (
          <Reveal key={exam.id} delay={i * 70}>
            <ExamCard exam={exam} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ExamCard({ exam }: { exam: (typeof EXAMS)[number] }) {
  const live = exam.status === "live";

  const inner = (
    <div
      className={cn(
        "group relative flex h-full flex-col items-center rounded-2xl border p-5 text-center transition-all",
        live
          ? "border-transparent bg-surface shadow-soft ring-2 ring-success/60 hover:-translate-y-0.5 hover:shadow-lg"
          : "border-dashed border-hairline-strong bg-panel/50"
      )}
    >
      {/* status badge, inclusion language, not passive "soon" */}
      <span
        className={cn(
          "absolute right-2.5 top-2.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
          live
            ? "bg-success text-white"
            : "bg-surface text-ink-tertiary ring-1 ring-hairline"
        )}
      >
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
        {live ? "Live now" : "Included at launch"}
      </span>

      {/* logo */}
      <div className="mt-4 flex h-16 w-full items-center justify-center">
        <div className="relative h-14 w-full">
          <Image
            src={exam.logo}
            alt={`${exam.name} logo`}
            fill
            unoptimized
            sizes="120px"
            className={cn(
              "object-contain transition",
              live ? "" : "opacity-40 grayscale group-hover:opacity-60"
            )}
          />
        </div>
      </div>

      <p className={cn("mt-4 text-sm font-bold", live ? "text-ink" : "text-ink-secondary")}>
        {exam.name}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-tertiary">{exam.sub}</p>

      {live && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent">
          Start a free mock
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </div>
  );

  return live && exam.href ? (
    <Link href={exam.href} className="block h-full">
      {inner}
    </Link>
  ) : (
    <div className="h-full" aria-disabled>
      {inner}
    </div>
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
                The exact CBT interface, down to the muscle memory
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70">
                Same timer, same five-state palette, same navigator. It faithfully
                replicates the real computer-based test experience, so by exam day
                it feels like your 40th test, not your first.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Five-state palette: answered, not answered, marked, both, unvisited",
                  "Single 60-minute timer that auto-submits, and survives a refresh",
                  "Save & Next, Mark for Review, Clear, exactly as they behave in the hall",
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

function Features({ questionCount }: { questionCount: number }) {
  const formatted = questionCount.toLocaleString("en-IN");
  return (
    <section id="features" className="mx-auto w-full max-w-6xl space-y-16 px-4 py-24 sm:space-y-24 sm:px-6 sm:py-28">
      <FeatureRow
        n="01"
        icon={Layers}
        title={`${formatted}+ real questions`}
        body="A deep bank of genuine exam-standard questions, no filler, no padding. Practise full 100-question mocks or drill a single section, as many times as your cycle needs."
        visual={
          <div className="relative">
            <Framed
              src="/images/feature-questions.jpg"
              alt="A student working through practice questions on a laptop"
              aspect="4 / 3"
              position="center"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-panel-dark/85 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className="tabular text-accent">{formatted}+</span> questions
            </span>
          </div>
        }
      />
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

function Stats({ questionCount }: { questionCount: number }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
      <Reveal className="mx-auto mb-12 max-w-2xl text-center">
        <Eyebrow>Real exams, real marking</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Built to each exam&apos;s exact shape
        </h2>
        <p className="mt-3 text-base text-ink-secondary">
          Every exam gets its real pattern and its real negative marking, never a
          generic quiz. SSC CGL Tier 1 is live now, scored on its own +2 / −0.5.
          IBPS Clerk, SBI Clerk and more follow with their own schemes.
        </p>
      </Reveal>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat value={<LiveQuestionCount initial={questionCount} />} label="Questions in the bank" />
        <Stat value={<CountUp end={100} />} label="Questions per full mock" />
        <Stat value="4" label="Sections · 60-minute timer" />
        <Stat value={<>+2 / <span className="text-danger">−0.5</span></>} label="SSC CGL marking, live now" />
      </div>
      <Reveal>
        <p className="mt-6 text-center text-xs text-ink-tertiary">
          Real numbers only, no invented user counts, no fabricated reviews.
        </p>
      </Reveal>
    </section>
  );
}

function Pricing({ questionCount }: { questionCount: number }) {
  return (
    <section id="pricing" className="border-t border-hairline bg-panel/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <Eyebrow>One subscription. Every exam.</Eyebrow>
          <h2 className="mt-3 font-report text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            Simple, honest pricing
          </h2>
          <p className="mt-4 text-base text-ink-secondary">
            Start free. Go Pro for unlimited exams and full reports, or unlock
            MarksenseAI for the decision engine on top. Every paid plan covers
            every exam, current and upcoming.
          </p>
        </Reveal>

        <Reveal>
          <PricingPlans questionCount={questionCount} />
        </Reveal>

        <Reveal>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-tertiary">
            <Check className="h-3.5 w-3.5 text-success" />
            These are launch prices, locked in while you stay subscribed. The
            struck-through figure is the real rate they rise to. Cancel anytime.
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
              Take the free 20-question mock, no sign-up, and see exactly where
              your marks are hiding.
            </p>
            <div className="mt-8">
              <Link
                href="/sample"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-ink transition-premium hover:bg-white/90"
              >
                Start free, no sign-up
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
