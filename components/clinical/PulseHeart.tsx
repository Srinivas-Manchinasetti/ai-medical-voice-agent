"use client";

import React from "react";
import { motion } from "motion/react";
import { Heart, Activity } from "lucide-react";

export interface PulseHeartProps {
  bpm?: number;
  rhythm?: string;
  status?: "stable" | "elevated" | "critical";
  className?: string;
}

export function PulseHeart({
  bpm = 84,
  rhythm = "Normal Sinus Rhythm",
  status = "stable",
  className = "",
}: PulseHeartProps) {
  const isCritical = status === "critical";
  const isElevated = status === "elevated";

  const pulseColor = isCritical
    ? "text-rose-600 bg-rose-50 border-rose-200"
    : isElevated
    ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-emerald-600 bg-emerald-50 border-emerald-200";

  return (
    <div
      className={`inline-flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-white border border-slate-200/90 shadow-2xs font-mono ${className}`}
    >
      {/* Pulsing Heart Animation */}
      <motion.div
        animate={{
          scale: [1, 1.25, 1, 1.15, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 60 / bpm,
          ease: "easeInOut",
        }}
        className={`w-7 h-7 rounded-xl flex items-center justify-center border ${pulseColor}`}
      >
        <Heart className="w-3.5 h-3.5 fill-current" />
      </motion.div>

      {/* BPM & ECG Waveform summary */}
      <div className="flex flex-col text-left">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-slate-900 tracking-tight font-sans">
            {bpm}
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase">BPM</span>
          <span className="text-slate-300 mx-1">·</span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              isCritical ? "text-rose-600" : isElevated ? "text-amber-600" : "text-emerald-600"
            }`}
          >
            {status}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 font-sans truncate">
          {rhythm}
        </span>
      </div>
    </div>
  );
}

export default PulseHeart;
