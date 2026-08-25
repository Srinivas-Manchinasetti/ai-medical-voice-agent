"use client";

import React from "react";
import { Navbar } from "./_components/Navbar";
import { LivingHeroSection } from "./_components/LivingHeroSection";
import { WorkflowSection } from "./_components/WorkflowSection";
import { CapabilitiesSection } from "./_components/CapabilitiesSection";
import { SecuritySection } from "./_components/SecuritySection";
import { Footer } from "./_components/Footer";
import { Mic, ArrowRight, Activity, PhoneCall } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white overflow-x-hidden">
      <div>
        <Navbar />

        {/* HERO PRODUCT VISUALIZATION */}
        <LivingHeroSection />

        {/* LISTEN -> UNDERSTAND -> ACT EDITORIAL STORYTELLING */}
        <div className="relative z-10">
          <WorkflowSection />
        </div>

        {/* PLATFORM CAPABILITIES */}
        <CapabilitiesSection />

        {/* SECURITY & HIPAA TECHNICAL SAFEGUARDS */}
        <SecuritySection />

        {/* SMALL INTERACTIVE TASTE TEASER */}
        <section className="py-20 bg-white border-t border-slate-200/80 text-center">
          <div className="max-w-3xl mx-auto px-6 space-y-6">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
              EXPERIENCE MEDVOICE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Try AI-Powered Voice Triage Live
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
              Test real-time speech intake, ICD-10 symptom mining, triage urgency scoring, and care facility dispatch in our interactive playground.
            </p>
            <div>
              <a
                href="/demo"
                className="inline-flex items-center gap-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white px-7 py-3.5 text-sm font-bold shadow-lg transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4 text-cyan-400" />
                <span>Launch Interactive Demo</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* FINAL PAYOFF BANNER & FOOTER */}
      <Footer />
    </div>
  );
}






