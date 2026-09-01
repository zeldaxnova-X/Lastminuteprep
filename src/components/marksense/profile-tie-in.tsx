"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileResponse } from "./learner-profile";

/**
 * Compact result-screen tie-in: connects the mock the user just finished to
 * their evolving MarksenseAI profile. Self-gating (renders nothing unless the
 * viewer is on MarksenseAI and has a profile), so it is safe to drop on any
 * result page. Fetching a stale profile here triggers the post-mock refresh.
 */
export function ProfileTieIn() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/marksense/profile")
      .then((r) => r.json())
      .then((d: ProfileResponse) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Not a MarksenseAI viewer, or nothing to show: stay invisible.
  if (!loading && (!data || data.locked || !data.hasProfile)) return null;

  const weak = data?.profile?.weakpoints?.slice(0, 3) ?? [];
  const drillHref = (subject: string | null) =>
    subject ? `/test/create?mode=subject_test&subject=${encodeURIComponent(subject)}` : "/test/create?mode=subject_test";

  return (
    <section className="overflow-hidden rounded-2xl border border-gold-bright/30 bg-gradient-to-br from-gold-soft/50 to-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-bright/20 px-5 py-3.5">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <Sparkles className="h-4 w-4 text-gold" />
          This mock updated your MarksenseAI profile
        </p>
        <Link href="/marksense/profile" className="flex items-center gap-1 text-xs font-semibold text-gold">
          See full profile <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Folding this attempt into your profile…
          </div>
        ) : weak.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            Analysed {data?.attemptsAnalyzed ?? 0} mocks so far. A few more and your recurring patterns sharpen.
          </p>
        ) : (
          <>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Your chronic weakpoints across {data?.attemptsAnalyzed} mocks
            </p>
            <ul className="space-y-2">
              {weak.map((w, i) => (
                <li key={`${w.area}-${i}`} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex-shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      w.severity === "critical"
                        ? "bg-danger/12 text-danger"
                        : w.severity === "high"
                          ? "bg-gold-soft text-gold"
                          : "bg-panel text-ink-secondary"
                    )}
                  >
                    {w.severity}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{w.area}</span>
                  <Link
                    href={drillHref(w.drillSubject)}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-gold-bright/10 px-2.5 py-1 text-xs font-semibold text-gold transition-premium hover:bg-gold-bright/20"
                  >
                    <Target className="h-3.5 w-3.5" /> Drill
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
