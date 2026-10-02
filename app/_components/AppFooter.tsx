"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Phone,
  Activity,
  FileText,
  Navigation,
  AlertTriangle,
  HeartPulse,
  Brain,
  Radio,
  CheckCircle2,
  ExternalLink,
  Building2,
  Sparkles,
} from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full mt-auto text-slate-400 text-xs overflow-hidden border-t border-slate-800/80 bg-slate-950">
      {/* 1. URGENT MEDICAL EMERGENCY CALLOUT BANNER */}
      <div className="w-full bg-rose-950/40 border-b border-rose-900/40 px-4 sm:px-8 py-3.5">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-rose-200">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1 rounded-md bg-rose-500/20 text-rose-400 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            <p className="text-xs font-medium leading-relaxed">
              <span className="font-bold text-rose-300 uppercase tracking-wide">
                Critical Medical Emergency Notice:
              </span>{" "}
              If you or someone nearby is experiencing chest pain, sudden weakness, difficulty breathing, or severe trauma,{" "}
              <span className="text-white font-semibold">do not delay care for an AI consultation</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="tel:108"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/40 transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Ambulance: 108</span>
            </a>
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
            >
              <span>National: 112</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. MAIN 4-COLUMN CLINICAL INTELLIGENCE BODY */}
      <div className="w-full px-4 sm:px-8 py-10 sm:py-12">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* COLUMN 1: BRAND, ARCHITECTURE & TELEMETRY (Col span: 4) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
                <HeartPulse className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-extrabold text-sm tracking-wider text-white">
                    MEDVOICE AI
                  </span>
                </div>
                <div className="text-[10px] font-semibold tracking-wider uppercase text-cyan-400">
                  Clinical Intelligence Platform
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              An investigational multi-specialist clinical decision architecture integrating deterministic safety arbitration, live acoustic speech telemetry, tamper-evident provenance logging, and accredited emergency hospital routing.
            </p>

            {/* Live System Operational Card */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span>Clinical Engine Operational</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400/90 font-medium">99.98% SLA</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 leading-tight">
                Deterministic Arbiter · Whisper ASR · Kokoro-82M TTS · ESI v4 Invariants
              </div>
            </div>

            {/* Compliance & Standards Badges */}
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-400">
              <span className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                HIPAA 45 CFR § 164.312
              </span>
              <span className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-emerald-400" />
                HL7® FHIR® R4
              </span>
              <span className="px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-400" />
                Zero Disk Audio
              </span>
            </div>
          </div>

          {/* COLUMN 2: CLINICAL SYSTEMS & WORKFLOWS (Col span: 3) */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Clinical Systems</span>
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/consult"
                  className="hover:text-cyan-400 text-slate-300 transition-colors flex items-center justify-between group"
                >
                  <span>Voice Triage Consultation</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-500 transition-colors font-mono">Live Turn</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="hover:text-cyan-400 text-slate-300 transition-colors flex items-center justify-between group"
                >
                  <span>FHIR SOAP Clinical Documentation</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-500 transition-colors font-mono">R4 Bundle</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/care"
                  className="hover:text-cyan-400 text-slate-300 transition-colors flex items-center justify-between group"
                >
                  <span>Emergency Care Network</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-500 transition-colors font-mono">OSRM Route</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-cyan-400 text-slate-300 transition-colors flex items-center justify-between group"
                >
                  <span>Deterministic Safety Arbiter</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-500 transition-colors font-mono">ESI Invariant</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-cyan-400 text-slate-300 transition-colors flex items-center justify-between group"
                >
                  <span>Tamper-Evident Audit Ledger</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-500 transition-colors font-mono">SHA-256</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/consult"
                  className="hover:text-cyan-400 text-slate-300 transition-colors flex items-center justify-between group"
                >
                  <span>Multi-Agent Board Deliberation</span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-500 transition-colors font-mono">Consensus</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: CLINICAL DECISION INSTRUMENTS (Col span: 3) */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span>Decision Protocols</span>
            </h3>
            <ul className="space-y-2 text-xs">
              <li className="flex flex-col">
                <span className="font-semibold text-slate-200">Emergency Severity Index (ESI v4)</span>
                <span className="text-[11px] text-slate-500">5-tier algorithmic acuity & resource stratification</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-200">BE-FAST Stroke Protocol</span>
                <span className="text-[11px] text-slate-500">Acute cerebrovascular ischemia & LVO red-flag screening</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-200">TIMI Risk Stratification</span>
                <span className="text-[11px] text-slate-500">Ischemic chest pain & unstable coronary evaluation</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-200">Centor / McIsaac Pharyngitis</span>
                <span className="text-[11px] text-slate-500">Group A Strep probability & antibiotic governance</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-200">Pediatric Early Warning Score</span>
                <span className="text-[11px] text-slate-500">PEWS physiological decompensation safeguards</span>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: EMERGENCY HELPLINES & ACCREDITATION (Col span: 2) */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-rose-400" />
              <span>Emergency Lines</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Ambulance & Trauma</div>
                <a href="tel:108" className="text-sm font-bold text-rose-400 hover:text-rose-300 transition-colors">
                  108 <span className="text-[10px] text-slate-500 font-normal">(24x7 Free)</span>
                </a>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">National Emergency</div>
                <a href="tel:112" className="text-sm font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
                  112 <span className="text-[10px] text-slate-500 font-normal">(Police/Med)</span>
                </a>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Tele-MANAS Mental Health</div>
                <a href="tel:14416" className="text-xs font-bold text-slate-200 hover:text-white transition-colors">
                  14416 <span className="text-[10px] text-slate-500 font-normal">(Toll Free)</span>
                </a>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Women&apos;s Safety Helpline</div>
                <a href="tel:1091" className="text-xs font-bold text-slate-200 hover:text-white transition-colors">
                  1091
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* 3. CLINICAL GOVERNANCE & REGULATORY NOTICE */}
        <div className="mt-10 pt-6 border-t border-slate-800/80">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-300 uppercase tracking-wider block mb-1">
              Clinical Governance & Investigational Software Disclaimer:
            </span>
            MedVoice AI is an investigational clinical decision support system designed to assist healthcare personnel with conversational triage documentation, structured clinical note generation, and geographic facility routing. MedVoice AI does not provide definitive medical diagnoses, dispense prescription pharmaceuticals, or substitute for the independent clinical judgment of a licensed attending physician. All algorithmic assessments, triage recommendations, and generated FHIR resources must be independently verified by qualified medical practitioners prior to taking clinical action.
          </div>
        </div>

        {/* 4. BOTTOM COPYRIGHT & LEGAL ROW */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span>© {currentYear} MedVoice AI Clinical Technologies.</span>
            <span className="text-slate-700 hidden sm:inline">·</span>
            <span className="text-slate-400 hidden sm:inline">All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400 font-sans text-xs">
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
              Privacy Architecture
            </Link>
            <span className="text-slate-700">·</span>
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
              Data Sovereignty
            </Link>
            <span className="text-slate-700">·</span>
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors">
              Security Safeguards (45 CFR § 164.312)
            </Link>
            <span className="text-slate-700">·</span>
            <Link href="/dashboard" className="hover:text-cyan-400 transition-colors">
              FHIR R4 Schema
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-slate-400">Release: v0.1.0-clinical</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
