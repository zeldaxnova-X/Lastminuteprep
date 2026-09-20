import { ChevronDown } from "lucide-react";

/*
 * Server-rendered FAQ. Answers live in the initial HTML via native
 * <details>/<summary> (no mount-on-click), so crawlers and no-JS users see them,
 * and FAQPage JSON-LD is emitted for rich results. No AI vendor is named.
 */

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is this the actual exam interface?",
    a: "It's a faithful replica, not official software. Same four 15-minute sectional locks, same five-state palette, same countdown, same Save and Mark-for-Review behaviour. We aren't affiliated with the Staff Selection Commission and we don't claim to be. What we can promise is that on exam day the flow won't be new to you.",
  },
  {
    q: "Is MarksenseAI just a chatbot with a different name?",
    a: "No. MarksenseAI is our own analysis engine. It doesn't read your question paper and offer generic advice, it works from your actual mock data: what you answered, how confident you said you were, how long you spent, and what type of question it was. The output is specific to your attempt pattern and it's arithmetic you can check. We use AI infrastructure as part of the system, but the scoring logic, the confidence calibration and the recommendations are ours, and they're built on your performance rather than on a language model's opinion.",
  },
  {
    q: "What exactly is the free sample?",
    a: "One full timed section, 25 questions, 15 minutes, the real sectional lock. No sign-up, no card. At the end you get your net score under +2 / −0.5 and you see the structure of your MarksenseAI report. The analysis itself unlocks with All-Access.",
  },
  {
    q: "How does the confidence rating work?",
    a: "After each question you tap one of three buttons: Guessing, Unsure, or Confident. One tap, no typing, nothing to fill in later. That single signal is what lets us separate marks you lost to gaps in knowledge from marks you lost to bad decisions, which are two completely different problems with two completely different fixes.",
  },
  {
    q: "What do I get with All-Access?",
    a: "Every exam on the platform, current and upcoming. Unlimited full mocks and section drills across 9,984 questions. The complete report, accuracy, timing, section breakdown. And the full MarksenseAI engine: your confidence calibration, your personal break-even guess rule, your optimal-score gap, and improvement tracking across attempts.",
  },
  {
    q: "How much does it cost, and what happens after?",
    a: "₹49, one time, for full access until 31 October 2026. After that date, All-Access is ₹99 per month. The ₹49 pass is an early-access price and won't renew into anything without you choosing to.",
  },
  {
    q: "Can I get a refund?",
    a: "No. At ₹49 we've made the free sample generous specifically so you can decide before paying, a full timed section, no card, no sign-up. Once All-Access is unlocked the content is delivered immediately and in full, so payments are final. The three exceptions are a duplicate charge, a payment that debited without granting access, and anything we're required to refund by law. Write to hello@lastmileprep.in and we'll sort those out.",
  },
  {
    q: "Does one pass cover every exam?",
    a: "Yes. One purchase, every exam we run now and every exam we add before your access ends. No repurchase, no separate accounts.",
  },
  {
    q: "Which exams are supported?",
    a: "SSC CGL Tier 1 is live now with the current sectional-timer pattern. IBPS Clerk and SBI Clerk are next, with JEE Main and NEET UG following.",
  },
  {
    q: "Is my data safe?",
    a: "Your mock attempts and confidence ratings are used to generate your reports and to improve the engine in aggregate. We don't sell your data, we don't run advertising, and we don't share individual performance with anyone. Full detail in our Privacy Policy and Ethical AI Policy.",
  },
];

export function Faq() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return (
    <>
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-hairline bg-surface p-5 shadow-soft [&[open]]:shadow-lift"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <ChevronDown className="h-5 w-5 flex-shrink-0 text-ink-tertiary transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{f.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </>
  );
}
