import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  Timer,
  Compass,
  Target,
  Sparkles,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { AuthNav } from "@/components/auth/auth-nav";
import { Reveal, CountUp } from "@/components/landing/motion";
import { LiveQuestionCount } from "@/components/landing/live-stat";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { MarksenseProof } from "@/components/landing/marksense-proof";
import { getQuestionCount } from "@/lib/stats";
import {
  allAccessPriceInr,
  isLaunchOffer,
  ALL_ACCESS_REGULAR_PRICE_INR,
  ALL_ACCESS_OFFER_END_LABEL,
} from "@/lib/payments/pricing";
import { Faq } from "@/components/landing/faq";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
import { PalettePreview, CalibrationPreview } from "@/components/landing/previews";
import { cn } from "@/lib/utils";

const HOME_OG = "/api/og?title=" + encodeURIComponent("Four 15-minute locks. That's the exam now.");

export const metadata = {
  title: "LastMilePrep: The last mile is where exams are won",
  description:
    "Real CBT mocks for SSC CGL with the current four 15-minute sectional locks, plus MarksenseAI, our own engine that reads your confidence and shows you exactly how to score more. No sign-up to try.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "LastMilePrep, SSC CGL Tier 1 CBT with the real sectional locks",
    description:
      "Take a real four-section timed mock, then MarksenseAI turns your attempt into the decisions worth the most marks.",
    url: "https://lastmileprep.in/",
    images: [{ url: HOME_OG, width: 1200, height: 630, alt: "LastMilePrep" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LastMilePrep, SSC CGL Tier 1 CBT with the real sectional locks",
    description:
      "Take a real four-section timed mock, then MarksenseAI turns your attempt into the decisions worth the most marks.",
    images: [HOME_OG],
  },
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
  { n: "01", icon: Timer, title: "Sit a real CBT mock", body: "The exact interface, five-state palette, and four 15-minute sectional locks. No training wheels." },
  { n: "02", icon: Compass, title: "Get your confidence-calibrated analysis", body: "We capture how sure you were on every question, then read it back against how you actually did." },
  { n: "03", icon: Target, title: "Know exactly what to fix", body: "Which questions to skip, how to guess under negative marking, and the marks each decision was worth." },
];

export default async function LandingPage() {
  const questionCount = await getQuestionCount();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <LaunchBanner />
      <Nav />
      <main>
        <Hero />
        <MarksenseProof />
        <Tension />
        <CbtRealism />
        <HowItWorks />
        <Stats questionCount={questionCount} />
        <Pricing questionCount={questionCount} />
        <FounderNote />
        <FaqSection />
        <ExamBreadth />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* Prominent launch-offer bar: ₹49 All-Access, shown site-top while the launch
   price is live (auto-hides after the offer end date via pricing.ts). */
function LaunchBanner() {
  if (!isLaunchOffer()) return null;
  const price = allAccessPriceInr();
  return (
    <Link
      href="#pricing"
      className="group block bg-gradient-to-r from-accent to-violet text-white transition-opacity hover:opacity-95"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] font-medium sm:text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-semibold">Launch offer</span>
        </span>
        <span>
          <span className="font-bold tabular">₹{price}</span> one-time, all exams{" "}
          <span className="font-semibold">+ MarksenseAI</span> until {ALL_ACCESS_OFFER_END_LABEL}
        </span>
        <span className="hidden text-white/70 sm:inline">·</span>
        <span className="text-white/85">then ₹{ALL_ACCESS_REGULAR_PRICE_INR}/mo</span>
        <span className="inline-flex items-center gap-0.5 font-semibold underline-offset-2 group-hover:underline">
          Get it <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

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

      <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
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
              {isLaunchOffer() ? (
                <>
                  <span className="font-semibold text-ink">₹{allAccessPriceInr()} one-time</span>
                  , every exam + MarksenseAI until {ALL_ACCESS_OFFER_END_LABEL}. Then ₹{ALL_ACCESS_REGULAR_PRICE_INR}/month.
                </>
              ) : (
                <>₹{allAccessPriceInr()}/month, every exam + MarksenseAI. No separate purchases.</>
              )}
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink-secondary">
              {["No sign-up to try", "Real CBT interface", "Full mock, free"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
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


function ExamBreadth() {
  return (
    <section id="exams" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <Reveal className="mx-auto mb-10 max-w-2xl text-center">
        <Eyebrow>One pass, every exam</Eyebrow>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          One engine, every major exam
        </h2>
        <p className="mt-3 text-base text-ink-secondary">
          SSC CGL Tier 1 is live today; IBPS Clerk, SBI Clerk, JEE Main and NEET UG
          are on the way, each included the day it launches.
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
                Four 15-minute locks. That&apos;s the exam now.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-white/70">
                SSC CGL Tier 1 2026 gives you fifteen minutes per section. When the
                timer hits zero, that section closes, no carrying time forward, no
                coming back. Twenty-five questions, thirty-six seconds each. If you&apos;re
                still practising on a single 60-minute clock, you&apos;re training a
                reflex the exam no longer rewards.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "Four separate 15-minute timers, each one locks on its own",
                  "No carry-over, no returning to a section you've closed",
                  "Five-state palette, Save & Next, Mark for Review, unchanged",
                  "Survives a refresh; the clock keeps running, exactly like the hall",
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
        <Stat value="4" label="Sections · 15 min each" />
        <Stat value={<>+2 / <span className="text-danger">−0.5</span></>} label="SSC CGL marking, live now" />
      </div>
    </section>
  );
}

/* Founder note in place of manufactured social proof. Name is a placeholder for
   the founder to fill; the sentence is written from the founder's stated intent. */
function FounderNote() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-16">
      <Reveal>
        <figure className="rounded-2xl border border-hairline bg-surface p-6 text-center shadow-soft sm:p-8">
          <blockquote className="font-report text-lg leading-relaxed text-ink sm:text-xl">
            &ldquo;I&apos;ve lost marks I should have had, questions I knew, given away to
            decisions under the clock. I built LastMilePrep to be the best CBT practice an
            SSC aspirant can sit in front of, one that turns your own performance into the
            few decisions that win you the most marks on exam day.&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-sm text-ink-secondary">
            <span className="font-semibold text-ink">Founder</span>, a fellow aspirant ·{" "}
            <a href="mailto:hello@lastmileprep.in" className="font-medium text-accent hover:underline">
              hello@lastmileprep.in
            </a>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  );
}

function Pricing({ questionCount }: { questionCount: number }) {
  return (
    <section id="pricing" className="border-t border-hairline bg-panel/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <Eyebrow>One pass. Every exam.</Eyebrow>
          <h2 className="mt-3 font-report text-4xl font-medium tracking-tight text-ink sm:text-5xl">
            One price. Everything unlocked.
          </h2>
          <p className="mt-4 text-base text-ink-secondary">
            Start free, then{" "}
            {isLaunchOffer() ? (
              <>
                a one-time{" "}
                <span className="font-semibold text-ink">₹{allAccessPriceInr()}</span>{" "}
                pass unlocks every exam, unlimited mocks, full reports, and the
                MarksenseAI engine, with full access until {ALL_ACCESS_OFFER_END_LABEL}.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">₹{allAccessPriceInr()}/month</span>{" "}
                unlocks every exam, unlimited mocks, full reports, and the
                MarksenseAI engine, no separate purchases.
              </>
            )}
          </p>
        </Reveal>

        <Reveal>
          <PricingPlans questionCount={questionCount} />
        </Reveal>

        <Reveal>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-tertiary">
            <Check className="h-3.5 w-3.5 text-success" />
            {isLaunchOffer()
              ? `₹${allAccessPriceInr()} is a one-time early-access pass, full access until ${ALL_ACCESS_OFFER_END_LABEL}. After that, All-Access is ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month.`
              : `All-Access is ₹${allAccessPriceInr()}/month. Every exam included.`}
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
              Take a full mock free, no sign-up, and see exactly where your marks
              are hiding.
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
              A full free mock · real CBT interface.
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
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:px-6">
        <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
          <BrandLogo />
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-secondary">
            <Link href="/terms" className="transition-premium hover:text-ink">Terms</Link>
            <Link href="/privacy-policy" className="transition-premium hover:text-ink">Privacy</Link>
            <Link href="/refund-policy" className="transition-premium hover:text-ink">Refund</Link>
            <Link href="/ethical-ai-policy" className="transition-premium hover:text-ink">Ethical AI</Link>
            <Link href="/contact-us" className="transition-premium hover:text-ink">Contact</Link>
          </nav>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-ink-tertiary">
          <a href="mailto:hello@lastmileprep.in" className="hover:text-ink">hello@lastmileprep.in</a>
          <br />© {new Date().getFullYear()} LastMilePrep. Not affiliated with SSC, IBPS, SBI, NTA, NBE or UPSC.
        </p>
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
