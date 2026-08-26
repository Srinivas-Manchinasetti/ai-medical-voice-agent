"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import { ArrowUpRight, Activity, ShieldCheck, PhoneCall, Sparkles } from "lucide-react";
import { CALL_SCENARIOS, CallScenario } from "../_data/call-scenarios";

const CARD_STYLES: Record<string, { bg: string; accent: string; blurb: string }> = {
  pediatric: {
    bg: "bg-white border-teal-200/90 shadow-xl shadow-teal-950/5",
    accent: "text-teal-700 bg-teal-50 border-teal-200",
    blurb: "Pediatric fever intake • Booked same-day telehealth appointment",
  },
  cardiac: {
    bg: "bg-white border-rose-200/90 shadow-xl shadow-rose-950/5",
    accent: "text-rose-700 bg-rose-50 border-rose-200 font-bold animate-pulse",
    blurb: "Chest pain & shortness of breath • Escalated to 911 ER dispatch",
  },
  refill: {
    bg: "bg-white border-emerald-200/90 shadow-xl shadow-emerald-950/5",
    accent: "text-emerald-700 bg-emerald-50 border-emerald-200",
    blurb: "Post-op medication refill • Verified allergies & queued for sign-off",
  },
};

function ScenarioCardFace({ scenario }: { scenario: CallScenario }) {
  const style = CARD_STYLES[scenario.id];

  return (
    <div className={`w-full h-full rounded-2xl border ${style.bg} p-6 flex flex-col justify-between select-none relative overflow-hidden transition-all duration-300 hover:border-slate-300`}>
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-slate-950 flex items-center justify-center text-teal-400">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-bold text-slate-800 tracking-tight">
            MEDVOICE INTAKE
          </span>
        </div>
        <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${scenario.badgeStyle}`}>
          {scenario.badge}
        </span>
      </div>

      {/* Center Body & Patient Details */}
      <div className="space-y-3 py-2">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight leading-snug">
            {scenario.title}
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-1">
            {scenario.patientDetails}
          </p>
        </div>

        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">
          "{scenario.dialogue[0]?.text.slice(0, 110)}..."
        </p>
      </div>

      {/* Footer Outcome Badge */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span className="truncate">{scenario.outcomes[0]}</span>
        </span>
        <span className="font-mono text-[11px] text-slate-400 shrink-0">
          {scenario.duration}
        </span>
      </div>
    </div>
  );
}

interface CardPose {
  rotateFrom: number;
  rotateTo: number;
  xFrom: number;
  xTo: number;
  yFrom: number;
  scaleFrom: number;
  zIndexHero: number;
}

const POSES: Record<string, CardPose> = {
  refill: { rotateFrom: 7, rotateTo: 0, xFrom: 80, xTo: -370, yFrom: 30, scaleFrom: 0.92, zIndexHero: 1 },
  cardiac: { rotateFrom: -6, rotateTo: 0, xFrom: -40, xTo: 0, yFrom: 12, scaleFrom: 0.96, zIndexHero: 2 },
  pediatric: { rotateFrom: 4, rotateTo: 0, xFrom: 0, xTo: 370, yFrom: 0, scaleFrom: 1, zIndexHero: 3 },
};

function TransitionCard({
  scenarioId,
  progress,
}: {
  scenarioId: string;
  progress: MotionValue<number>;
}) {
  const scenario = CALL_SCENARIOS.find((s) => s.id === scenarioId)!;
  const pose = POSES[scenarioId];

  const rotate = useTransform(progress, [0, 0.55], [pose.rotateFrom, pose.rotateTo]);
  const x = useTransform(progress, [0, 0.55], [pose.xFrom, pose.xTo]);
  const y = useTransform(progress, [0, 0.55], [pose.yFrom, 0]);
  const scale = useTransform(progress, [0, 0.55], [pose.scaleFrom, 1]);

  return (
    <motion.div
      className="absolute top-0 left-1/2 w-[310px] sm:w-[350px] aspect-[4/3.2]"
      style={{
        x,
        y,
        rotate,
        scale,
        marginLeft: "-175px",
        zIndex: pose.zIndexHero,
      }}
    >
      <ScenarioCardFace scenario={scenario} />
    </motion.div>
  );
}

export function ScrollScenarioTransition() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const labelsOpacity = useTransform(scrollYProgress, [0.4, 0.65], [0, 1]);
  const labelsY = useTransform(scrollYProgress, [0.4, 0.65], [20, 0]);
  const headingOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);

  return (
    <div ref={sectionRef} className="relative h-[180vh] bg-[#FAF9F6] border-b border-slate-200/80">
      <div className="sticky top-12 h-[85vh] w-full overflow-hidden flex flex-col items-center justify-center">
        {/* Section Headline */}
        <motion.div
          style={{ opacity: headingOpacity }}
          className="absolute top-8 sm:top-12 text-center space-y-1 z-20"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-800 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            CONCURRENT INTAKE CAPABILITY
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
            Handling Multiple Patient Calls Simultaneously
          </p>
        </motion.div>

        {/* Card stack / gallery row */}
        <div className="relative w-full max-w-7xl h-[300px] sm:h-[320px] mt-12">
          {CALL_SCENARIOS.map((s) => (
            <TransitionCard key={s.id} scenarioId={s.id} progress={scrollYProgress} />
          ))}
        </div>

        {/* Action Row beneath cards */}
        <motion.div
          style={{ opacity: labelsOpacity, y: labelsY }}
          className="w-full max-w-4xl px-6 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center"
        >
          {CALL_SCENARIOS.map((scenario) => (
            <div key={scenario.id} className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-sm space-y-1">
              <p className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">{scenario.badge}</p>
              <p className="text-sm font-extrabold text-slate-950 truncate">{scenario.title}</p>
              <a
                href="/demo"
                className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900 transition-colors cursor-pointer pt-1"
              >
                <span>Simulate Call</span> <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
