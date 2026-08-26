"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, PhoneCall, ShieldCheck, Zap, Lock, Radio, Activity, Sparkles, ArrowUpRight } from "lucide-react";
import { CALL_SCENARIOS, CallScenario } from "../_data/call-scenarios";

const CARD_THEMES: Record<string, { gradient: string; accent: string; subText: string; imageTag: string }> = {
  pediatric: {
    gradient: "from-[#0F172A] via-[#1E293B] to-[#0F172A]",
    accent: "bg-amber-400/20 text-amber-300 border-amber-500/30",
    subText: "Pediatric Intake & Same-Day Telehealth Booking",
    imageTag: "PEDIATRIC TRIAGE ENGINE",
  },
  cardiac: {
    gradient: "from-[#111827] via-[#1F2937] to-[#111827]",
    accent: "bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold animate-pulse",
    subText: "Acute Cardiac Pressure • Instant 911 ER Dispatch",
    imageTag: "CRITICAL ER ESCALATION",
  },
  refill: {
    gradient: "from-[#064E3B] via-[#047857] to-[#065F46]",
    accent: "bg-emerald-400/20 text-emerald-300 border-emerald-500/30",
    subText: "Post-Op Rx Refill • Automated Allergy Verification",
    imageTag: "RX REFILL AUTOMATION",
  },
};

function LaunchFolioCardSurface({ scenario }: { scenario: CallScenario }) {
  const theme = CARD_THEMES[scenario.id];

  return (
    <div className={`w-full h-full rounded-2xl bg-gradient-to-br ${theme.gradient} border border-slate-700/80 p-5 sm:p-6 flex flex-col justify-between text-white shadow-2xl overflow-hidden relative group`}>
      {/* Subtle Glow Overlay */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center text-cyan-400 border border-white/10">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-mono text-xs font-bold tracking-widest text-slate-300">
            MEDVOICE AI
          </span>
        </div>
        <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border backdrop-blur-md ${theme.accent}`}>
          {scenario.badge}
        </span>
      </div>

      {/* Center Showcase Title & Visual Mock */}
      <div className="z-10 space-y-2 py-3">
        <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-0.5 rounded-md inline-block">
          {theme.imageTag}
        </span>
        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-snug">
          {scenario.title}
        </h3>
        <p className="text-xs text-slate-300 font-medium leading-relaxed">
          {theme.subText}
        </p>
      </div>

      {/* Bottom Dialogue Box Preview */}
      <div className="z-10 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-[11px]">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="truncate">{scenario.outcomes[0]}</span>
        </div>
        <span className="font-mono text-slate-400 text-[11px]">{scenario.duration}</span>
      </div>
    </div>
  );
}

export function LivingHeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Hero Left Column Text Fade & Glide
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -60]);

  // Overall Stack Container Position: From Right Column (300px) -> Center Page (0px)
  const stackContainerX = useTransform(scrollYProgress, [0, 0.55], [300, 0]);

  // Target Grid Headline Fade-In (STRICTLY 0 until scroll exceeds 0.35)
  const gridHeaderOpacity = useTransform(scrollYProgress, [0.35, 0.55], [0, 1]);
  const gridHeaderY = useTransform(scrollYProgress, [0.35, 0.55], [30, 0]);

  // Morph Transforms for Individual Cards: From Right Stack -> Glides DOWN (340px) & OUTWARDS
  // Slot 1 (Pediatric): Left (-360px), Down (340px)
  const c1Rotate = useTransform(scrollYProgress, [0, 0.55], [-6, 0]);
  const c1X = useTransform(scrollYProgress, [0, 0.55], [0, -360]);
  const c1Y = useTransform(scrollYProgress, [0, 0.55], [0, 340]);
  const c1Scale = useTransform(scrollYProgress, [0, 0.55], [0.95, 1]);

  // Slot 2 (Cardiac): Center (0px), Down (340px)
  const c2Rotate = useTransform(scrollYProgress, [0, 0.55], [5, 0]);
  const c2X = useTransform(scrollYProgress, [0, 0.55], [20, 0]);
  const c2Y = useTransform(scrollYProgress, [0, 0.55], [15, 340]);
  const c2Scale = useTransform(scrollYProgress, [0, 0.55], [0.92, 1]);

  // Slot 3 (Rx Refill): Right (+360px), Down (340px)
  const c3Rotate = useTransform(scrollYProgress, [0, 0.55], [-3, 0]);
  const c3X = useTransform(scrollYProgress, [0, 0.55], [40, 360]);
  const c3Y = useTransform(scrollYProgress, [0, 0.55], [30, 340]);
  const c3Scale = useTransform(scrollYProgress, [0, 0.55], [0.88, 1]);

  // Sub-labels fade in under landed cards
  const labelsOpacity = useTransform(scrollYProgress, [0.55, 0.75], [0, 1]);
  const labelsY = useTransform(scrollYProgress, [0.55, 0.75], [20, 0]);

  return (
    <div ref={containerRef} className="relative h-[220vh] bg-[#FAF9F6]">
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-between pt-14 pb-8 px-6 lg:px-12">
        
        {/* TOP HERO CONTAINER (Hero Copy on Left) */}
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4">
          
          {/* HERO LEFT COLUMN: Copy, Headline & CTAs */}
          <motion.div
            style={{ opacity: heroOpacity, y: heroY }}
            className="lg:col-span-6 space-y-6 text-left"
          >
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200/90 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
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

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] text-slate-950 leading-[0.98]">
              Voice triage
              <br />
              that feels human.
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-md">
              MedVoice handles patient calls 24/7 — evaluating symptoms, escalating emergencies, and generating structured EHR notes.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <a
                href="/demo"
                className="inline-flex items-center gap-2.5 rounded-full bg-slate-950 px-7 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Simulate a Voice Call</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500 pt-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> HIPAA Safeguards
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> FHIR Standard
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-cyan-600" /> Zero Retention
              </span>
            </div>
          </motion.div>
        </div>

        {/* PAGE-CENTERED TARGET GRID HEADER (STRICTLY OPACITY 0 UNTIL HERO TEXT IS GONE) */}
        <motion.div
          style={{ opacity: gridHeaderOpacity, y: gridHeaderY }}
          className="absolute top-16 left-1/2 -translate-x-1/2 text-center space-y-2 max-w-3xl mx-auto w-full z-0 px-6 pointer-events-none"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-800 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            LIVE CLINICAL SCENARIOS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Concurrent Intake Capabilities
          </h2>
        </motion.div>

        {/* MORPHING CARD CONTAINER (Glides from Right Side -> Center & Down) */}
        <motion.div
          style={{ x: stackContainerX }}
          className="absolute top-24 sm:top-28 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] sm:h-[340px] flex items-center justify-center pointer-events-none z-10"
        >
          {/* Card 1: Pediatric (Top) */}
          <motion.div
            style={{
              x: c1X,
              y: c1Y,
              rotate: c1Rotate,
              scale: c1Scale,
              zIndex: 3,
            }}
            className="absolute w-[290px] sm:w-[330px] aspect-[4/3.2] shadow-2xl rounded-2xl pointer-events-auto"
          >
            <LaunchFolioCardSurface scenario={CALL_SCENARIOS[0]} />
          </motion.div>

          {/* Card 2: Cardiac (Middle) */}
          <motion.div
            style={{
              x: c2X,
              y: c2Y,
              rotate: c2Rotate,
              scale: c2Scale,
              zIndex: 2,
            }}
            className="absolute w-[290px] sm:w-[330px] aspect-[4/3.2] shadow-2xl rounded-2xl pointer-events-auto"
          >
            <LaunchFolioCardSurface scenario={CALL_SCENARIOS[1]} />
          </motion.div>

          {/* Card 3: Rx Refill (Bottom) */}
          <motion.div
            style={{
              x: c3X,
              y: c3Y,
              rotate: c3Rotate,
              scale: c3Scale,
              zIndex: 1,
            }}
            className="absolute w-[290px] sm:w-[330px] aspect-[4/3.2] shadow-2xl rounded-2xl pointer-events-auto"
          >
            <LaunchFolioCardSurface scenario={CALL_SCENARIOS[2]} />
          </motion.div>
        </motion.div>

        {/* PAGE-CENTERED METADATA LABELS (Appears cleanly below landed cards) */}
        <div className="max-w-7xl mx-auto w-full z-20 pb-4">
          <motion.div
            style={{ opacity: labelsOpacity, y: labelsY }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4"
          >
            {CALL_SCENARIOS.map((sc) => (
              <div key={sc.id} className="flex items-center justify-between border-t border-slate-200/90 pt-3 px-2">
                <div>
                  <p className="text-base font-extrabold text-slate-950">{sc.title}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{sc.patientDetails}</p>
                </div>
                <a
                  href="/demo"
                  className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900 transition-colors cursor-pointer"
                >
                  <span>Simulate Call</span> <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
