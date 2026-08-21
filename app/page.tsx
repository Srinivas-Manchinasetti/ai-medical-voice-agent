"use client";

import React from "react";
import { Navbar } from "./_components/Navbar";
import { LivingHeroSection } from "./_components/LivingHeroSection";
import { VoiceCallSimulator } from "./_components/VoiceCallSimulator";
import { FeatureBentoGrid } from "./_components/FeatureBentoGrid";
import { WorkflowSection } from "./_components/WorkflowSection";
import { SecuritySection } from "./_components/SecuritySection";
import { Footer } from "./_components/Footer";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* LIVING PRODUCT DEMO HERO SECTION */}
        <LivingHeroSection />

        {/* INTERACTIVE VOICE CALL SIMULATOR PLAYGROUND */}
        <div id="demo" className="relative z-10 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <VoiceCallSimulator />
        </div>

        {/* CLINICAL CAPABILITIES BENTO GRID */}
        <div id="capabilities" className="relative z-10">
          <FeatureBentoGrid />
        </div>

        {/* SIMPLE WORKFLOW: CONVERSATION TO CARE */}
        <div id="workflow" className="relative z-10">
          <WorkflowSection />
        </div>

        {/* SECURITY & HIPAA SAFEGUARDS */}
        <div id="security" className="relative z-10">
          <SecuritySection />
        </div>
      </div>

      <Footer />
    </div>
  );
}
