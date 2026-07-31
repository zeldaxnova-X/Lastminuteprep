import Link from "next/link";
import { Zap, ShieldCheck, Cpu, BarChart3, ArrowRight, Award, Clock, FileText, Sparkles, Layers, Sliders, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-500 px-4 py-2 text-center text-xs sm:text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-sm">
        <Sparkles className="w-4 h-4 animate-pulse" />
        <span>LastMilePrep Dataset v1.2.1 Certified — 10,614 Verified Questions & 138 Canonical Papers Live</span>
      </div>

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-black text-xl tracking-tight text-white group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span>LastMile<span className="text-blue-400">Prep</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link href="/dashboard" className="hover:text-blue-400 transition-colors">Dashboard</Link>
            <Link href="/test/create" className="hover:text-blue-400 transition-colors">Test Builder</Link>
            <Link href="/analytics" className="hover:text-blue-400 transition-colors">Virtual Mentor</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md shadow-blue-600/30 hover:shadow-blue-600/50 transition-all flex items-center gap-1.5"
            >
              <span>Enter CBT Platform</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-blue-400 text-xs font-semibold uppercase tracking-wider shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authentic SSC CGL Computer Based Test & Strategy Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
            Crack SSC CGL with Your Personal <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">Virtual Mentor</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            138 Official Canonical Shift Papers • Authentic TCS iON CBT Engine • Live Decision Quality Scoring & Dynamic Smart Strategy Analytics.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Launch CBT Dashboard</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              href="/test/create"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-base transition-colors flex items-center justify-center gap-2"
            >
              <Sliders className="w-5 h-5 text-blue-400" />
              <span>Configure Custom Mock Test</span>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="pt-12 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-left sm:text-center">
            <div>
              <p className="text-3xl font-extrabold text-white">10,614</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Verified Questions</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-blue-400">138</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Canonical Shift Papers</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-emerald-400">4,426</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">High-Res Images</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-amber-400">100%</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">TCS iON CBT Replica</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Beyond Scorecards: Intelligent Strategy Engineering
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">
              Most platforms only give you marks. LastMilePrep analyzes your examination decision quality, time sinks, guessing penalties, and late-exam fatigue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Authentic CBT Environment</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Experience the exact layout, section navigation, palette color coding, and live metrics used in official Staff Selection Commission exams.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 hover:border-amber-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Virtual Mentor Engine</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Calculates your Decision Quality Score (0-100), isolates negative mark hazards, flags time sinks, and delivers custom ssc coach recommendations.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 hover:border-emerald-500/50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Personalized Next Test Strategy</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Generates a custom execution strategy for your next test: optimal subject attempt order, time thresholds, and target skip rules.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 text-slate-400 py-10 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 space-y-2">
          <p>© {new Date().getFullYear()} LastMilePrep SSC CGL Exam Engine. Dataset Version 1.2.1 Certified.</p>
        </div>
      </footer>
    </div>
  );
}
