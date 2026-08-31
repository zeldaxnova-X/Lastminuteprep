import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
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

      {/* Right, warm brand panel (desktop only) */}
      <div className="relative hidden lg:block lg:w-1/2">
        <Image
          src="/images/band-aspirants.jpg"
          alt=""
          fill
          sizes="50vw"
          priority
          className="object-cover"
          style={{ objectPosition: "center 25%" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(10,10,10,0.92),rgba(49,46,129,0.55))]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ background: "radial-gradient(60% 50% at 15% 10%, rgba(79,70,229,0.35), transparent 60%)" }}
          aria-hidden
        />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="inline-flex w-fit rounded-xl bg-white/95 px-3 py-2 shadow-lift">
            <BrandLogo />
          </div>
          <div>
            <p className="font-report text-4xl font-medium leading-tight tracking-tight text-white xl:text-5xl">
              Know exactly how to
              <br />
              <span className="bg-gradient-to-r from-white to-violet bg-clip-text text-transparent">
                score more.
              </span>
            </p>
            <p className="mt-4 max-w-md text-base text-white/70">
              Real SSC CGL CBT mocks and a proprietary MarksenseAI that reads
              your confidence and turns every attempt into a scoring plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
