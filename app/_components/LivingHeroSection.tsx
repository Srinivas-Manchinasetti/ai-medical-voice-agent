"use client";

import React from "react";
import {
  ArrowRight,
  ShieldCheck,
  Radio,
  PhoneCall,
  ChevronDown,
  Zap,
  Lock
} from "lucide-react";
import { MedicalHeroDashboardPreview } from "./MedicalHeroDashboardPreview";
import { ProductWorkspaceShell } from "./ProductWorkspaceShell";

export function LivingHeroSection() {
  return (
    <section className="relative w-full bg-[#FAF9F6] text-slate-950 pt-10 md:pt-14 pb-8 select-none overflow-hidden border-b border-slate-200/60">
      {/* Soft Ambient Radial Backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_75%_45%_at_50%_0%,rgba(14,165,233,0.08),rgba(250,249,246,0))] pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
        {/* HERO TOP HEADER & TYPOGRAPHY HIERARCHY */}
        <div className="flex flex-col items-center text-center max-w-3xl w-full space-y-3.5 md:space-y-4 pb-8 z-10">
          {/* Eyebrow Status Pill */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-slate-200/90 px-4 py-1 text-[12px] font-medium tracking-tight text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.03)] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-slate-600 uppercase tracking-wider text-[11px]">
              Clinical Voice Engine
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-cyan-700 font-medium flex items-center gap-1.5 font-mono text-[11px]">
              <Radio className="w-3 h-3 animate-pulse" /> 24/7 Intake
            </span>
          </div>

          {/* Display Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.035em] text-slate-950 leading-[1.05] max-w-3xl">
            AI Medical Voice Triage That Feels Human
          </h1>

          {/* Supporting Body Narrative */}
          <p className="text-sm sm:text-base font-normal text-slate-600 tracking-tight leading-relaxed max-w-lg">
            MedVoice handles patient calls 24/7—evaluating symptoms, escalating critical emergencies, booking appointments, and generating structured EHR notes.
          </p>

          {/* Direct Call to Action Triggers */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <a
              href="#playground"
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-xs font-medium text-white shadow-[0_4px_16px_rgba(15,23,42,0.12)] transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Simulate Voice Call</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </a>

            <a
              href="#capabilities"
              className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200/90 px-5 py-3 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span>Explore Capabilities</span>
            </a>
          </div>

          {/* Micro Safeguard Badges */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-1 text-[11px] font-medium text-slate-500 tracking-tight">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> HIPAA Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Instant EHR Integration
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-600" /> Zero Voice Retention
            </span>
          </div>

          {/* Scroll Discovery Indicator */}
          <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Try the interactive playground below</span>
            <ChevronDown className="w-3.5 h-3.5 animate-bounce text-slate-400" />
          </div>
        </div>

        {/* WORKSTATION SURFACE SHOWCASE */}
        <div className="relative max-w-5xl mx-auto w-full z-20 flex justify-center pt-2">
          <ProductWorkspaceShell>
            <MedicalHeroDashboardPreview />
          </ProductWorkspaceShell>
        </div>
      </div>
    </section>
  );
}






