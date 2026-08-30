"use client";

import { SignIn, useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, Activity, CheckCircle, LogOut, ExternalLink } from "lucide-react";

export default function SignInPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();

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
          <div className="relative flex items-center justify-center w-7 h-7 overflow-hidden rounded-lg border border-sky-200 bg-white shadow-sm">
            <img src="/images/medvoice-logo.png" alt="MedVoice AI" className="h-full w-full object-cover scale-110" />
          </div>
          <span>MedVoice <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">AI</span></span>
        </div>
      </div>

      {isLoaded && isSignedIn && user ? (
        <div className="relative z-10 w-full max-w-md bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xl shadow-slate-900/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-slate-950 font-extrabold text-lg">Active Clinical Session</h2>
              <p className="text-slate-500 text-xs font-medium">You are currently authenticated in MedVoice</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt={user.fullName || "User"} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-950 text-white font-bold flex items-center justify-center text-sm">
                  {user?.firstName?.[0] || user?.fullName?.[0] || "U"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-slate-900 text-sm truncate">{user?.fullName || user?.firstName || "Clinical User"}</div>
                <div className="text-slate-500 text-xs truncate">{user?.primaryEmailAddress?.emailAddress}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/demo"
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs rounded-xl py-3 shadow-md transition-all"
            >
              <span>Launch Clinical Triage Demo</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="w-full inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl py-3 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of MedVoice</span>
            </button>
          </div>
        </div>
      ) : (
        /* Clean Clerk Sign-In Component */
        <div className="relative z-10 w-full flex justify-center">
          <SignIn
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
      )}
    </main>
  );
}