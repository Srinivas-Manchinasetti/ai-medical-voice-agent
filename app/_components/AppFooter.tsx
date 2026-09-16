"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="relative w-full mt-auto text-slate-400 text-xs overflow-hidden">
      {/* 1. SOFT ATMOSPHERIC TRANSITION: Smoothly fades light Aurora into deep slate */}
      <div className="w-full h-16 sm:h-20 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950 pointer-events-none" />

      {/* 2. BALANCED 2-ROW CLINICAL FOOTER BODY (~140–160px total) */}
      <div className="w-full bg-slate-950 border-t border-slate-800/80 px-4 sm:px-8 py-6 sm:py-7">
        <div className="mx-auto max-w-6xl flex flex-col gap-4">
          
          {/* Row 1: Brand & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Brand & Subtitle */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse" />
                <span className="font-black text-white tracking-wider text-xs">MEDVOICE AI</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium pl-4">
                Clinical Decision Support & Voice Triage
              </p>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-5 text-xs font-semibold text-slate-300">
              <Link href="/consult" className="hover:text-cyan-400 transition-colors">
                Voice Consult
              </Link>
              <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
                SOAP Notes
              </Link>
              <Link href="/care" className="hover:text-cyan-400 transition-colors">
                Care Network
              </Link>
              <Link href="/privacy" className="hover:text-emerald-400 transition-colors flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Safety & Privacy</span>
              </Link>
            </nav>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-slate-850 border-t border-slate-800/80" />

          {/* Row 2: Security/Privacy & Regulatory/Emergency Disclaimer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px] font-mono text-slate-500">
            <div className="flex items-center gap-2 text-slate-400">
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Privacy & Security</span>
              <span className="text-slate-700">·</span>
              <span>Data Protection & Patient Safety</span>
            </div>

            <div className="flex items-center gap-3">
              <span>© {new Date().getFullYear()} MedVoice AI</span>
              <span className="text-slate-700">·</span>
              <span className="text-amber-400/90 font-medium">
                In medical emergency dial 108 / 112
              </span>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
