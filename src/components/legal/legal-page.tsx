import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_VERSION, LEGAL_EFFECTIVE, CONTACT_EMAIL } from "@/lib/legal";

const POLICIES = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Cancellation & Refund" },
  { href: "/ethical-ai-policy", label: "Ethical AI Policy" },
];

/** Shared chrome for the legal pages: header, title + version/date, footer with
 *  cross-links and contact. Server-rendered so all text is in the HTML. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <Link href="/" className="text-sm text-ink-secondary transition-premium hover:text-ink">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="font-report text-3xl font-medium tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink-tertiary">
          Last updated {LEGAL_EFFECTIVE} · Version {LEGAL_VERSION}
        </p>
        {intro && <p className="mt-4 text-base leading-relaxed text-ink-secondary">{intro}</p>}

        <article className="mt-8 space-y-7 text-sm leading-relaxed text-ink-secondary">
          {children}
        </article>

        {/* Cross-links + contact */}
        <div className="mt-12 border-t border-hairline pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">Our policies</p>
          <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {POLICIES.map((p) => (
              <Link key={p.href} href={p.href} className="text-accent transition-premium hover:underline">
                {p.label}
              </Link>
            ))}
            <Link href="/contact-us" className="text-accent transition-premium hover:underline">
              Contact
            </Link>
          </nav>
          <p className="mt-4 text-sm text-ink-secondary">
            Questions?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}

/** A titled section. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** A bulleted list from string/JSX items. */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="ml-4 list-disc space-y-1.5 marker:text-ink-tertiary">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
