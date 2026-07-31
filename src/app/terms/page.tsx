import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12">
        <Link href="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-semibold mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="text-3xl font-extrabold text-white mb-4">Terms & Conditions</h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: July 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Educational Purpose Only</h2>
            <p>Last Min Prep provides mock test simulations, diagnostic scoring tools, and educational material intended solely for competitive exam practice. All test interfaces reproduce publicly standard computer-based test formats for educational familiarization.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Non-Affiliation Disclaimer</h2>
            <p>Last Min Prep is an independent educational platform and is not affiliated with, authorized by, or endorsed by the Staff Selection Commission (SSC), National Testing Agency (NTA), UPSC, IBPS, or any government organ.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. User Conduct</h2>
            <p>Users are expected to utilize mock tests for personal preparation. Commercial redistribution or scraping of questions and LaTeX solutions is strictly prohibited.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
