"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp, ChevronDown, Check, Sparkles } from "lucide-react";

export interface OptionWheelItem {
  id: string;
  label: string;
  category: string;
  badge: string;
  badgeStyle: string;
  icon?: React.ReactNode;
}

export interface OptionWheelProps {
  options: OptionWheelItem[];
  selectedId: string;
  onChange: (option: OptionWheelItem) => void;
  className?: string;
}

export function OptionWheel({
  options,
  selectedId,
  onChange,
  className = "",
}: OptionWheelProps) {
  const currentIndex = options.findIndex((opt) => opt.id === selectedId);
  const activeIdx = currentIndex >= 0 ? currentIndex : 0;

  const handlePrev = () => {
    const nextIdx = (activeIdx - 1 + options.length) % options.length;
    onChange(options[nextIdx]);
  };

  const handleNext = () => {
    const nextIdx = (activeIdx + 1) % options.length;
    onChange(options[nextIdx]);
  };

  return (
    <div
      className={`relative inline-flex flex-col items-center bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-3 shadow-[0_12px_36px_-8px_rgba(15,23,42,0.08)] ${className}`}
    >
      {/* Up Button */}
      <button
        onClick={handlePrev}
        aria-label="Previous clinical scenario"
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      {/* Wheel Slots (Visible 3 at a time) */}
      <div className="flex flex-col gap-1.5 py-1 w-full max-w-[280px]">
        {options.map((opt, idx) => {
          const isSelected = idx === activeIdx;
          const isAdjacent = Math.abs(idx - activeIdx) === 1 || (activeIdx === 0 && idx === options.length - 1) || (activeIdx === options.length - 1 && idx === 0);

          return (
            <motion.button
              key={opt.id}
              onClick={() => onChange(opt)}
              layout
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={`relative w-full text-left px-4 py-2.5 rounded-2xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                isSelected
                  ? "bg-cyan-50/90 border border-cyan-500/30 text-cyan-950 shadow-xs"
                  : isAdjacent
                  ? "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 opacity-75 border border-transparent"
                  : "hidden"
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-[9px] font-mono uppercase tracking-wider ${
                    isSelected ? "text-cyan-700 font-bold" : "text-slate-400"
                  }`}
                >
                  {opt.category}
                </span>
                <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? "text-cyan-950" : "text-slate-800"}`}>
                  {opt.label}
                </span>
              </div>

              {isSelected ? (
                <motion.span
                  layoutId="wheelSelectedDot"
                  className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)] flex-shrink-0"
                />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Down Button */}
      <button
        onClick={handleNext}
        aria-label="Next clinical scenario"
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

export default OptionWheel;
