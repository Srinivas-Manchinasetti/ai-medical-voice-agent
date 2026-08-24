"use client";

import React from "react";
import { Navbar } from "./_components/Navbar";
import { LivingHeroSection } from "./_components/LivingHeroSection";
import { VoiceCallSimulator } from "./_components/VoiceCallSimulator";
import { EmergencyHospitalLocator } from "./_components/EmergencyHospitalLocator";
import { FeatureBentoGrid } from "./_components/FeatureBentoGrid";
import { WorkflowSection } from "./_components/WorkflowSection";
import { SecuritySection } from "./_components/SecuritySection";
import { Footer } from "./_components/Footer";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* HERO PRODUCT VISUALIZATION */}
        <LivingHeroSection />

        {/* LISTEN -> UNDERSTAND -> ACT EDITORIAL STORYTELLING */}
        <div className="relative z-10">
          <WorkflowSection />
        </div>

        {/* VOICE-FIRST INTERACTIVE DEMO */}
        <div id="demo" className="relative z-10">
          <VoiceCallSimulator />
        </div>

        {/* FULL INTERACTIVE GPS HOSPITAL DIRECTORY */}
        <div id="nearest-hospitals" className="relative z-10">
          <EmergencyHospitalLocator />
        </div>

        {/* CLINICAL CAPABILITIES BENTO GRID */}
        <div id="capabilities" className="relative z-10">
          <FeatureBentoGrid />
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


