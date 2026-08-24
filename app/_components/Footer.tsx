"use client";

import React from "react";
import { Activity, ShieldCheck, CheckCircle2, ArrowUpRight, Lock, Radio } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      {/* FINAL LANDING PAGE PAYOFF CTA BANNER */}
      <div className="border-b border-slate-800 bg-slate-900/50 py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
            LISTEN · UNDERSTAND · ACT
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Give every patient conversation a next step.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#playground"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 text-sm font-bold shadow-md transition-all cursor-pointer"
            >
              <span>See MedVoice in Action →</span>
            </a>
            <a
              href="#playground"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-3 text-sm font-bold border border-slate-700 transition-all cursor-pointer"
            >
              <span>Book a Demo</span>
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 pt-14 pb-10">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-800/80">
          {/* Brand Column (6 cols) */}
          <div className="md:col-span-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-white shadow-sm">
                <Activity className="h-5 w-5 text-teal-400" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                MedVoice
                <span className="font-mono text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
                  AI
                </span>
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-md font-sans">
              Deliver instant, empathetic medical assistance through natural voice conversations. Automating symptom triage, appointment scheduling, and EHR SOAP charting 24/7.
            </p>

            {/* Live System Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px] text-emerald-400 font-bold tracking-tight">
                FASTAPI & VOICE ENGINE OPERATIONAL
              </span>
            </div>
          </div>

          {/* Platform & Navigation Links (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-bold text-white text-xs block uppercase tracking-wider font-mono">
              Platform Features
            </span>
            <ul className="space-y-2 text-slate-400 font-medium">
              <li>
                <a href="#playground" className="hover:text-white transition-colors flex items-center gap-1">
                  Voice Simulator Playground <ArrowUpRight className="h-3 w-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-white transition-colors">
                  Real-Time Voice Triage
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-white transition-colors">
                  ICD-10 NLP Symptom Mining
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-white transition-colors">
                  Automated SOAP Note Generator
                </a>
              </li>
            </ul>
          </div>

          {/* Architecture & Security Links (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <span className="font-bold text-white text-xs block uppercase tracking-wider font-mono">
              Architecture & Security
            </span>
            <ul className="space-y-2 text-slate-400 font-medium">
              <li>
                <a href="#workflow" className="hover:text-white transition-colors">
                  5-Step Clinical Workflow
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400" /> HIPAA Architecture
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-blue-400" /> TLS 1.3 & Zero-Retention
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Epic / Cerner Integration
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Clinical Disclaimer */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-[11px] font-sans">
          <p>© {new Date().getFullYear()} MedVoice AI. All rights reserved.</p>
          <p className="text-slate-400 max-w-xl text-center sm:text-right italic">
            Notice: MedVoice AI is designed as a clinical decision support and triage assistant. In the event of a medical emergency, patients should always contact 911 immediately.
          </p>
        </div>
      </div>
    </footer>
  );
}
