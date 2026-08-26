"use client";

import React from "react";
import { SmoothScrollProvider } from "./_components/SmoothScrollProvider";
import { Navbar } from "./_components/Navbar";
import { CinematicScrollCanvas } from "./_components/CinematicScrollCanvas";
import { CapabilitiesSection } from "./_components/CapabilitiesSection";
import { SecuritySection } from "./_components/SecuritySection";
import { FaqSection } from "./_components/FaqSection";
import { Footer } from "./_components/Footer";
import { MedicalHeroDashboardPreview } from "./_components/MedicalHeroDashboardPreview";
import { ProductWorkspaceShell } from "./_components/ProductWorkspaceShell";
import { Mic, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <SmoothScrollProvider>
      <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white overflow-x-clip">
        <div>
          <Navbar />

          {/* CONTINUOUS 3D GSAP CAMERA SCROLL JOURNEY (SCENES 01 -> 07) */}
          <CinematicScrollCanvas />

          {/* PLATFORM CAPABILITIES */}
          <CapabilitiesSection />

          {/* SECURITY & HIPAA TECHNICAL SAFEGUARDS */}
          <SecuritySection />

          {/* INTERACTIVE WORKSTATION PREVIEW */}
          <section className="py-20 bg-white border-t border-slate-200/80">
            <div className="max-w-3xl mx-auto px-6 text-center space-y-6 mb-12">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
                EXPERIENCE MEDVOICE
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                Try AI-Powered Voice Triage Live
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
                Test real-time speech intake, ICD-10 symptom mining, triage urgency scoring, and care facility dispatch in our interactive playground.
              </p>
            </div>

            <div className="max-w-5xl mx-auto px-6">
              <ProductWorkspaceShell>
                <MedicalHeroDashboardPreview />
              </ProductWorkspaceShell>
            </div>

            <div className="text-center mt-10">
              <a
                href="/demo"
                className="inline-flex items-center gap-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white px-7 py-3.5 text-sm font-bold shadow-lg transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4 text-cyan-400" />
                <span>Launch Interactive Demo</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>
          </section>

          {/* FAQ SECTION */}
          <FaqSection />
        </div>

        {/* FOOTER */}
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
}
