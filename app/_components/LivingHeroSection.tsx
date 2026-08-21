"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Radio,
  PhoneCall,
  ChevronDown,
  Sparkles,
  Zap,
  Lock
} from "lucide-react";
import { MedicalHeroDashboardPreview } from "./MedicalHeroDashboardPreview";

export function LivingHeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Direct 1:1 scroll position tracking (Instant real-time sync)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Header Recede & Opacity Transforms (Directly synced with scroll)
  const headerOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const headerScale = useTransform(scrollYProgress, [0, 0.35], [1, 0.95]);
  const headerY = useTransform(scrollYProgress, [0, 0.35], [0, -50]);

  // Main Workstation Container Transforms (Instant 1:1 response)
  const rotateX = useTransform(scrollYProgress, [0, 0.45], [7, 0]);
  const previewScale = useTransform(scrollYProgress, [0, 0.45], [0.93, 1.04]);
  const previewY = useTransform(scrollYProgress, [0, 0.45], [25, -15]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen w-full bg-[#FAF9F6] text-slate-950 pt-20 md:pt-28 pb-20 overflow-hidden select-none"
      style={{ perspective: "1200px" }}
    >
      {/* Background Soft Ambient Lighting Mesh Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(14,165,233,0.09),rgba(255,255,255,0))] pointer-events-none" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
        {/* HERO TOP HEADER & TEXT CONTENT */}
        <motion.div
          style={{ opacity: headerOpacity, scale: headerScale, y: headerY }}
          className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-6 mb-12"
        >
          {/* Eyebrow Pill Label */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 border border-slate-200/90 px-4 py-1.5 text-[12px] font-medium tracking-tight text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-slate-500 uppercase tracking-wider text-[11px]">
              24/7 Clinical Voice Engine
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-600 font-medium flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" /> Live Telemetry
            </span>
          </div>

          {/* Main Display Headline (Vibrant / Mobbin Typography) */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.035em] text-slate-950 leading-[1.06] max-w-4xl">
            AI Medical Voice Triage That Feels Human
          </h1>

          {/* Short Supporting Description */}
          <p className="text-base sm:text-lg font-normal text-slate-500 tracking-tight leading-relaxed max-w-xl">
            MedVoice AI handles patient phone calls 24/7—evaluating symptoms, escalating emergencies, booking appointments, and auto-generating EHR chart notes.
          </p>

          {/* Compact Pill Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
            <a
              href="#demo"
              className="inline-flex items-center gap-2.5 rounded-full bg-slate-950 px-7 py-3.5 text-sm font-medium text-white shadow-[0_4px_16px_rgba(15,23,42,0.15)] transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Simulate Voice Call</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>

            <a
              href="#capabilities"
              className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200/90 px-6 py-3.5 text-sm font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-950 hover:border-slate-300 cursor-pointer"
            >
              <span>Explore Capabilities</span>
            </a>
          </div>

          {/* Feature Micro Pills */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-1 text-xs font-medium text-slate-500 tracking-tight">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> HIPAA Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> Instant EHR Sync
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-600" /> Zero Voice Retention
            </span>
          </div>

          {/* Scroll Prompt Hint */}
          <div className="pt-1 flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Scroll to expand product</span>
            <ChevronDown className="w-3.5 h-3.5 animate-bounce text-slate-400" />
          </div>
        </motion.div>

        {/* LIVING PRODUCT PREVIEW SHOWCASE */}
        <div className="relative max-w-5xl mx-auto">
          <motion.div
            style={{
              rotateX: rotateX,
              scale: previewScale,
              y: previewY,
              transformStyle: "preserve-3d",
            }}
            className="relative z-20 rounded-3xl border border-slate-200/80 bg-white p-2.5 md:p-3.5 shadow-[0_30px_100px_-20px_rgba(15,23,42,0.12)] transition-all duration-300"
          >
            <MedicalHeroDashboardPreview scrollProgress={scrollYProgress} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
