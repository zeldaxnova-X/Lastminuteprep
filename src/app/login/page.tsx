import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AuthForm } from "@/components/auth/auth-form";
import { getViewer } from "@/lib/auth/plan";
import { safeNext } from "@/lib/auth/next";

export const metadata = {
  title: "Sign in, LastMilePrep",
  description: "Sign in or create your LastMilePrep account to unlock your report and MarksenseAI.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next } = await searchParams;
  const viewer = await getViewer();
  if (viewer.authenticated) redirect(safeNext(next));

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Left, the form */}
      <div className="flex w-full flex-col px-5 py-8 sm:px-8 lg:w-1/2 lg:px-16">
        <BrandLogo priority />
        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">
            <Suspense
              fallback={
                <div className="flex items-center gap-2 text-sm text-ink-tertiary">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              }
            >
              <AuthForm />
            </Suspense>
          </div>
        </div>
        <p className="text-center text-xs leading-relaxed text-ink-tertiary lg:text-left">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline transition-premium hover:text-ink">Terms</Link> and{" "}
          <Link href="/privacy-policy" className="underline transition-premium hover:text-ink">Privacy Policy</Link>.
        </p>
      </div>

      {/* Right, brand panel, built in code (desktop only) */}
      <div
        className="relative hidden overflow-hidden lg:block lg:w-1/2"
        style={{ background: "linear-gradient(160deg, #312e81 0%, #1e1b4b 42%, #0a0a0f 100%)" }}
      >
        {/* Ambient brand glows */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 12% 8%, rgba(99,102,241,0.45), transparent 60%), radial-gradient(50% 45% at 92% 92%, rgba(168,85,247,0.28), transparent 60%)",
          }}
          aria-hidden
        />
        {/* Fine grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(80% 80% at 50% 30%, #000 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(80% 80% at 50% 30%, #000 40%, transparent 100%)",
          }}
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="inline-flex w-fit items-center rounded-xl bg-white px-3.5 py-2.5 shadow-lift">
            <BrandLogo />
          </div>

          <div>
            <p className="font-report text-4xl font-medium leading-[1.1] tracking-tight text-white xl:text-5xl">
              Know exactly how to
              <br />
              <span className="bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                score more.
              </span>
            </p>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
              Real SSC CGL CBT mocks and a proprietary MarksenseAI that reads
              your confidence and turns every attempt into a scoring plan.
            </p>

            {/* What you unlock, on brand, no invented figures */}
            <ul className="mt-8 space-y-3">
              {[
                "Real previous-year papers, exact CBT interface",
                "Sectional timers that lock, just like exam day",
                "MarksenseAI turns your mocks into a scoring plan",
              ].map((line) => (
                <li key={line} className="flex items-center gap-3 text-sm text-white/80">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                    <Check className="h-3.5 w-3.5 text-violet-300" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
