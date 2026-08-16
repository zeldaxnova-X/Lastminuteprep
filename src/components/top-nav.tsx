"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw, Bookmark, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { AuthNav } from "@/components/auth/auth-nav";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/revision", label: "Revision", icon: RotateCcw },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
];

export function TopNav() {
  const pathname = usePathname();

  // Gate the primary CTA by plan. Default to the free-safe target until the plan
  // loads, so the full mode picker (/test/create) is never exposed to a free
  // user, even briefly. PRO/MENTOR get the real "Start Test" entry.
  const [canPractice, setCanPractice] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((v) => alive && setCanPractice(v?.plan === "pro" || v?.plan === "mentor"))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandLogo href="/dashboard" priority />

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-premium",
                  active
                    ? "bg-panel text-ink"
                    : "text-ink-secondary hover:bg-panel hover:text-ink"
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span className={Icon ? "hidden sm:inline" : undefined}>
                  {label}
                </span>
              </Link>
            );
          })}

          {canPractice ? (
            <Link
              href="/test/create"
              className={cn(buttonClasses("primary", "sm"), "ml-1")}
            >
              <span>Start Test</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href="/dashboard#upgrade"
              className={cn(buttonClasses("primary", "sm"), "ml-1")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Unlock tests</span>
            </Link>
          )}
          <AuthNav variant="app" />
        </nav>
      </div>
    </header>
  );
}
