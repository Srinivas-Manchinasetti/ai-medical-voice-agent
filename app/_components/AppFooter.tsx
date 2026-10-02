"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, HeartPulse, PhoneCall } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full mt-auto text-slate-400 text-xs overflow-hidden">
      {/* 1. SOFT ATMOSPHERIC TRANSITION: Smoothly fades light Aurora into deep slate */}
      <div className="w-full h-16 sm:h-20 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950 pointer-events-none" />

      {/* 2. MAIN FOOTER BODY */}
      <div className="w-full bg-slate-950 border-t border-slate-800/80 px-4 sm:px-8 pt-10 pb-8">
        <div className="mx-auto max-w-6xl flex flex-col gap-10">
          
          {/* Main Content Grid: 1 Brand Info Column + 4 Clean Link Columns */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8 lg:gap-10">
            {/* Brand Column (Col span: 2) */}
            <div className="col-span-2 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse" />
                <span className="font-extrabold text-white tracking-wider text-sm">MEDVOICE AI</span>
                <span className="text-[10px] font-mono text-cyan-400/90 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50">
                  Clinical
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Investigational clinical decision support and voice triage architecture. Deterministic safety arbitration, live acoustic speech telemetry, and FHIR documentation.
              </p>

              {/* Direct Emergency Pill */}
              <div className="flex items-center gap-2 mt-1">
                <a
                  href="tel:108"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3 h-3 text-rose-400" />
                  <span>Ambulance: 108</span>
                </a>
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <span>National: 112</span>
                </a>
              </div>
            </div>

            {/* Column 1: Clinical Platform */}
            <div className="col-span-1 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-white tracking-wide">
                Clinical
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/consult" className="hover:text-cyan-400 transition-colors">
                    Voice Consult
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
                    SOAP Records
                  </Link>
                </li>
                <li>
                  <Link href="/care" className="hover:text-cyan-400 transition-colors">
                    Care Network
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    Safety Arbiter
                  </Link>
                </li>
                <li>
                  <Link href="/consult" className="hover:text-cyan-400 transition-colors">
                    Specialist Board
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="hover:text-cyan-400 transition-colors">
                    Admin Analytics
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Protocols */}
            <div className="col-span-1 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-white tracking-wide">
                Protocols
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    ESI v4 Invariant
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    BE-FAST Stroke
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    TIMI Cardiac Risk
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    Centor Pharyngitis
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    PEWS Pediatric
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    Acoustic DSP
                  </span>
                </li>
              </ul>
            </div>

            {/* Column 3: Architecture */}
            <div className="col-span-1 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-white tracking-wide">
                Architecture
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    Whisper STT
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    Kokoro-82M TTS
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    HL7® FHIR® R4
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    Zero Audio Spool
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    SHA-256 Ledger
                  </span>
                </li>
                <li>
                  <span className="text-slate-300 hover:text-cyan-400 transition-colors cursor-default">
                    OSRM Road Router
                  </span>
                </li>
              </ul>
            </div>

            {/* Column 4: Governance & Legal */}
            <div className="col-span-1 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-white tracking-wide">
                Legal & Safety
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    HIPAA Safeguards
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    Data Sovereignty
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    Terms of Clinical Use
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
                    Security Architecture
                  </Link>
                </li>
                <li>
                  <a href="tel:108" className="text-rose-400 hover:text-rose-300 transition-colors font-medium">
                    Emergency Helpline
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Divider */}
          <div className="w-full h-px bg-slate-800/80" />

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-slate-500">
            <div className="flex items-center gap-2">
              <span>© {currentYear} MedVoice AI Clinical Technologies. All rights reserved.</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                Investigational Decision Support
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-amber-400/90 font-medium font-sans text-xs">
                In acute emergency dial 108 / 112
              </span>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
