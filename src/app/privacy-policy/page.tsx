import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12">
        <Link href="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-semibold mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="text-3xl font-extrabold text-white mb-4">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: July 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Data Storage</h2>
            <p>During the MVP testing phase, test states, timer status, and user answer selections are stored locally within your browser&apos;s localStorage. No personal data is transmitted to external servers.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Analytics & Performance</h2>
            <p>We may collect anonymous aggregate usage metrics to improve CBT player response speed and diagnostic error radar accuracy.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
