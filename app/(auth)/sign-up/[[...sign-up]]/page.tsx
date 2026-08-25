import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] text-slate-900 flex flex-col items-center justify-center p-6 selection:bg-cyan-500 selection:text-white relative">
      {/* Editorial Header Bar */}
      <div className="mb-6 flex items-center justify-between w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to MedVoice</span>
        </Link>
        <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
          <div className="w-7 h-7 rounded-xl bg-slate-950 flex items-center justify-center text-teal-400 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <span>MedVoice <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">AI</span></span>
        </div>
      </div>

      {/* Clean Clerk Sign-Up Component */}
      <div className="relative z-10 w-full flex justify-center">
        <SignUp
          appearance={{
            elements: {
              card: "shadow-xl shadow-slate-900/5 border border-slate-200/90 rounded-2xl bg-white p-2",
              headerTitle: "text-slate-950 font-extrabold text-xl",
              headerSubtitle: "text-slate-500 font-medium text-xs",
              socialButtonsBlockButton: "border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl py-2.5",
              formButtonPrimary: "bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl py-3 shadow-md",
              formFieldInput: "bg-slate-50/70 border border-slate-200 focus:border-slate-400 rounded-xl text-slate-900 text-sm font-sans",
              footerActionLink: "text-cyan-700 hover:text-cyan-900 font-bold",
              footer: "border-t border-slate-100 bg-slate-50/50 rounded-b-2xl py-3",
            },
          }}
        />
      </div>
    </main>
  );
}
