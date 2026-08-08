"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw, Bookmark, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/revision", label: "Revision", icon: RotateCcw },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
            LM
          </span>
          <span>
            LastMile<span className="text-accent">Prep</span>
          </span>
        </Link>

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

          <Link
            href="/test/create"
            className={cn(buttonClasses("primary", "sm"), "ml-1")}
          >
            <span>Start Test</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
