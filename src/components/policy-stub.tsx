import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Minimal premium-white placeholder for policy/legal routes. Real copy lands
 * later; this keeps the footer links valid and on-brand in the meantime.
 */
export function PolicyStub({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-ink">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
              LM
            </span>
            LastMile<span className="-ml-1.5 text-accent">Prep</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-ink-secondary transition-premium hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16 sm:px-6">
        <Card className="w-full space-y-3 p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Coming soon
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="text-sm leading-relaxed text-ink-secondary">{blurb}</p>
          <p className="pt-2 text-sm text-ink-secondary">
            Questions in the meantime?{" "}
            <Link href="/contact-us" className="font-medium text-accent">
              Contact us
            </Link>
            .
          </p>
        </Card>
      </main>
    </div>
  );
}
