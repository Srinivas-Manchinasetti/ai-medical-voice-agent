"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, PhoneCall } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full mt-auto text-slate-400 text-xs overflow-hidden">
      {/* 1. SOFT ATMOSPHERIC TRANSITION: Smoothly fades light Aurora into deep slate */}
      <div className="w-full h-16 sm:h-20 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950 pointer-events-none" />

      {/* 2. BALANCED CLINICAL FOOTER BODY */}
      <div className="w-full bg-slate-950 border-t border-slate-800/80 px-4 sm:px-8 py-6 sm:py-7">
        <div className="mx-auto max-w-6xl flex flex-col gap-3.5">
          
          {/* Row 1: Brand & Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Brand & Subtitle with Capabilities */}
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse" />
                <span className="font-black text-white tracking-wider text-xs">MEDVOICE AI</span>
                <span className="text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-800/40">
                  Clinical Intelligence
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium pl-4">
                Voice Triage · Multi-Specialist Reasoning · FHIR R4 Documentation
              </p>
            </div>

            {/* Navigation Links with Emergency Badge */}
            <nav className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs font-semibold text-slate-300">
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
              <a
                href="tel:108"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-md transition-colors"
              >
                <PhoneCall className="w-3 h-3 text-rose-400" />
                <span>108 / 112 ER</span>
              </a>
            </nav>
          </div>

          {/* Micro Clinical Governance Notice */}
          <div className="text-[10.5px] text-slate-500 leading-relaxed font-sans border-t border-slate-900 pt-2.5">
            <span className="text-slate-400 font-medium">Investigational Clinical Decision Support:</span> MedVoice AI provides preliminary conversational triage, protocol scoring (ESI v4 / BE-FAST), and geographic facility routing. It does not replace clinical evaluation by an attending physician. In acute emergencies, immediately contact emergency services.
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-slate-850 border-t border-slate-800/80" />

          {/* Row 2: Security/Privacy & Regulatory/Emergency Disclaimer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[11px] font-mono text-slate-500">
            <div className="flex flex-wrap items-center gap-2 text-slate-400">
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Zero Audio Retention</span>
              <span className="text-slate-700">·</span>
              <span>HIPAA 45 CFR § 164.312</span>
              <span className="text-slate-700">·</span>
              <span>HL7® FHIR® R4</span>
            </div>

            <div className="flex items-center gap-3">
              <span>© {currentYear} MedVoice AI</span>
              <span className="text-slate-700">·</span>
              <span className="text-amber-400/90 font-medium">
                Emergency: 108 (Ambulance) / 112 (National)
              </span>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
