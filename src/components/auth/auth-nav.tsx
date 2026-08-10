"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, LogOut, ChevronDown, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plan = "free" | "pro" | "mentor";
interface Viewer {
  authenticated: boolean;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  plan: Plan;
}

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", mentor: "AI Mentor" };
const PLAN_BADGE: Record<Plan, string> = {
  free: "bg-panel text-ink-secondary ring-1 ring-hairline",
  pro: "bg-accent-soft text-accent ring-1 ring-accent/20",
  mentor: "bg-gold-soft text-gold ring-1 ring-gold-bright/30",
};

/**
 * Auth-aware nav control. Fetches the viewer client-side (/api/auth/me) so it
 * can live in both the server landing nav and the client app nav. Signed-out →
 * Sign in + Try free; signed-in → avatar menu with plan badge, dashboard, sign
 * out.
 */
export function AuthNav({ variant = "landing" }: { variant?: "landing" | "app" }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: Viewer) => alive && setViewer(d))
      .catch(() => alive && setViewer(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign(variant === "app" ? "/" : window.location.pathname);
  }

  if (loading) {
    return <div className="h-9 w-24 animate-pulse rounded-lg bg-panel" aria-hidden />;
  }

  if (!viewer?.authenticated) {
    if (variant === "app") {
      return (
        <Link href="/login" className={buttonClasses("secondary", "sm")}>
          Sign in
        </Link>
      );
    }
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sign up — secondary CTA, opens the auth page in sign-up mode. From
            there, the "Already have an account? Sign in" toggle handles sign-in,
            so no separate sign-in link is needed in the landing header. */}
        <Link href="/login?mode=signup" className={buttonClasses("secondary", "sm")}>
          Sign up
        </Link>
        {/* Try free — primary CTA, launches the anonymous sample. */}
        <Link href="/sample" className={buttonClasses("primary", "sm")}>
          Try free
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const plan = viewer.plan;
  const label = viewer.fullName || viewer.email || "Account";
  const initial = (viewer.fullName || viewer.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-2.5 text-sm transition-premium hover:bg-panel"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar url={viewer.avatarUrl} initial={initial} />
        <span className={cn("hidden rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline", PLAN_BADGE[plan])}>
          {PLAN_LABEL[plan]}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-ink-tertiary transition-premium", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-hairline bg-surface shadow-lift"
        >
          <div className="border-b border-hairline px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{label}</p>
            {viewer.email && viewer.fullName && (
              <p className="truncate text-xs text-ink-tertiary">{viewer.email}</p>
            )}
            <span className={cn("mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", PLAN_BADGE[plan])}>
              {plan === "mentor" && <Sparkles className="h-3 w-3" />}
              {PLAN_LABEL[plan]} plan
            </span>
          </div>
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-premium hover:bg-panel"
            role="menuitem"
          >
            <LayoutDashboard className="h-4 w-4 text-ink-tertiary" />
            Dashboard
          </Link>
          {plan === "free" && (
            <Link
              href="/#pricing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink transition-premium hover:bg-panel"
              role="menuitem"
            >
              <Sparkles className="h-4 w-4 text-gold-bright" />
              Upgrade
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 border-t border-hairline px-4 py-2.5 text-left text-sm text-ink transition-premium hover:bg-panel"
            role="menuitem"
          >
            <LogOut className="h-4 w-4 text-ink-tertiary" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ url, initial }: { url: string | null; initial: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
      {initial}
    </span>
  );
}
