"use client";

import Link from "next/link";
import { ArrowRight, Lock, TrendingUp, MessageSquare, Target } from "lucide-react";
import { MarksenseWordmark } from "./wordmark";

/**
 * The single branded entry point to MarksenseAI from the dashboard. Active for
 * mentor (opens the intelligence report), a locked upsell otherwise. Uses the
 * canonical wordmark so the brand reads identically to the landing page.
 */
export function MarksenseEntry({
  plan,
  onUnlock,
}: {
  plan: "free" | "pro" | "mentor";
  onUnlock?: () => void;
}) {
  const active = plan === "mentor";

  return (
    <section className="relative overflow-hidden rounded-2xl bg-panel-dark shadow-lift">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 130% at 12% 0%, rgba(129,140,248,0.30), transparent 55%), radial-gradient(50% 120% at 95% 100%, rgba(240,171,252,0.18), transparent 55%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="max-w-xl space-y-2.5">
          <MarksenseWordmark as="h2" tone="white" className="text-2xl sm:text-3xl" />
          <p className="text-sm leading-relaxed text-white/70">
            {active
              ? "Your intelligence report reads every mock together: section trends, recurring weakpoints, a study coach, and your plan to score more."
              : "The intelligence layer that reads every mock together, finds your recurring weakpoints, and coaches you to the marks you are leaving on the table."}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            <Feature icon={TrendingUp} label="Progress trends" />
            <Feature icon={Target} label="Weakpoint drills" />
            <Feature icon={MessageSquare} label="Study coach" />
          </div>
        </div>

        <div className="flex-shrink-0">
          {active ? (
            <Link
              href="/marksense/profile"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-panel-dark transition-premium hover:bg-white/90"
            >
              Open MarksenseAI <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              onClick={onUnlock}
              className="inline-flex items-center gap-2 rounded-xl bg-gold-bright px-5 py-3 text-sm font-bold text-white transition-premium hover:bg-gold"
            >
              <Lock className="h-4 w-4" /> Unlock MarksenseAI, ₹99
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Feature({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60">
      <Icon className="h-3.5 w-3.5 text-[#c084fc]" /> {label}
    </span>
  );
}
