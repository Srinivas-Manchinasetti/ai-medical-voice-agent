"use client";

import React from "react";
import { motion } from "framer-motion";
import { Navbar } from "./_components/Navbar";
import { FeatureBentoGrid } from "./_components/FeatureBentoGrid";
import { VoiceCallSimulator } from "./_components/VoiceCallSimulator";
import { WorkflowSection } from "./_components/WorkflowSection";
import { UseCasesSection } from "./_components/UseCasesSection";
import { CareTeamSection } from "./_components/CareTeamSection";
import { MultilingualSection } from "./_components/MultilingualSection";
import { SecuritySection } from "./_components/SecuritySection";
import { Footer } from "./_components/Footer";
import { HeartPulse, CheckCircle2, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[#FAFAFA] text-slate-900 font-sans flex flex-col justify-between selection:bg-slate-900 selection:text-white">
      <div>
        {/* Floating Navbar */}
        <Navbar />

        {/* Hero Section */}
        <section className="relative my-6 flex flex-col items-center justify-center px-4 py-10 md:py-16">
          {/* Decorative Grid Lines */}
          <div className="absolute inset-y-0 left-0 h-full w-px bg-slate-200/80">
            <div className="absolute top-0 h-40 w-px bg-gradient-to-b from-transparent via-blue-500 to-transparent" />
          </div>
          <div className="absolute inset-y-0 right-0 h-full w-px bg-slate-200/80">
            <div className="absolute h-40 w-px bg-gradient-to-b from-transparent via-blue-500 to-transparent" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px w-full bg-slate-200/80">
            <div className="absolute mx-auto h-px w-40 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          </div>

          <div className="w-full max-w-5xl text-center">
            {/* Pill Tag */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-50 px-4 py-1.5 text-xs font-semibold text-teal-700 shadow-sm mb-6"
            >
              <HeartPulse className="h-4 w-4 text-teal-600" />
              <span>Next-Gen Medical Voice Triage & Assistant</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="relative z-10 mx-auto max-w-4xl text-center text-3xl font-extrabold text-slate-900 md:text-5xl lg:text-6xl tracking-tight leading-[1.15]"
            >
              🩺 Revolutionize Patient Care with AI Voice Agents
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="relative z-10 mx-auto max-w-2xl py-6 text-center text-base sm:text-lg font-normal text-slate-600 leading-relaxed"
            >
              Deliver instant, accurate medical assistance through natural voice conversations. Automate appointment scheduling, symptom triage, and follow-up care—24/7.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="relative z-10 flex flex-wrap items-center justify-center gap-4"
            >
              <a
                href="#playground"
                className="w-56 transform rounded-xl bg-black px-6 py-3.5 text-center text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 shadow-md cursor-pointer"
              >
                Explore Voice Simulator
              </a>
              <a
                href="#capabilities"
                className="w-56 transform rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-center text-sm font-semibold text-slate-800 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-100 shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>View Capabilities</span>
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </a>
            </motion.div>

            {/* Live Interactive Voice Call Simulator Container Object */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="relative z-10 mt-16 rounded-3xl border border-slate-200 bg-slate-100 p-4 shadow-md"
            >
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <VoiceCallSimulator />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Workflow Section */}
        <WorkflowSection />

        {/* Solution Use Cases */}
        <UseCasesSection />

        {/* Care Teams & Safety */}
        <CareTeamSection />

        {/* Multilingual Patient Support */}
        <MultilingualSection />

        {/* Feature Bento Grid */}
        <FeatureBentoGrid />

        {/* Security & Compliance */}
        <SecuritySection />
      </div>

      {/* Modern High-End Dark Footer */}
      <Footer />
    </div>
  );
}
