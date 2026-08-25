"use client";

import React from "react";
import { Navbar } from "../_components/Navbar";
import { VoiceCallSimulator } from "../_components/VoiceCallSimulator";
import { Footer } from "../_components/Footer";

export default function DemoPage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* PAGE HEADER */}
        <section className="pt-16 pb-6 px-6 max-w-4xl mx-auto text-center space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            INTERACTIVE VOICE PLAYGROUND
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            Experience MedVoice Live
          </h1>
          <p className="text-base text-slate-600 max-w-xl mx-auto leading-relaxed font-medium">
            Test real-time speech intake, live symptom extraction, triage urgency scoring, and care facility dispatch.
          </p>
        </section>

        {/* FULL INTERACTIVE VOICE CALL SIMULATOR */}
        <div id="demo" className="relative z-10 py-6 px-4 sm:px-6 max-w-7xl mx-auto">
          <VoiceCallSimulator />
        </div>
      </div>

      <Footer />
    </div>
  );
}
