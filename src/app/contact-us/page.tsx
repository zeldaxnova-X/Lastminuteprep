import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, MapPin } from "lucide-react";

export default function ContactUsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 sm:p-12">
        <Link href="/" className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm font-semibold mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
        <h1 className="text-3xl font-extrabold text-white mb-4">Contact Us</h1>
        <p className="text-slate-400 text-sm mb-8">Have questions, feedback, or paper corrections? Reach out to our engineering & content team.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex items-start gap-4">
            <Mail className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-white mb-1">Email Support</h3>
              <p className="text-sm text-slate-400">support@lastminprep.in</p>
              <p className="text-xs text-slate-500 mt-1">Average response time: &lt; 2 hours</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex items-start gap-4">
            <MessageSquare className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-white mb-1">Telegram Community</h3>
              <p className="text-sm text-slate-400">t.me/lastminprep_cgl</p>
              <p className="text-xs text-slate-500 mt-1">Daily PYP discussion & speed tricks</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
