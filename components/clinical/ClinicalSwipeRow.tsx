"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, ChevronLeft, ChevronRight, Activity, Stethoscope, CheckCircle2 } from "lucide-react";

export interface SoapSection {
  id: "subjective" | "objective" | "assessment" | "plan";
  letter: string;
  name: string;
  subtitle: string;
  content: string;
  tags?: string[];
}

export interface ClinicalSwipeRowProps {
  sections: SoapSection[];
  activeId?: "subjective" | "objective" | "assessment" | "plan";
  onChange?: (id: SoapSection["id"]) => void;
  className?: string;
}

export function ClinicalSwipeRow({
  sections,
  activeId = "subjective",
  onChange,
  className = "",
}: ClinicalSwipeRowProps) {
  const [selectedId, setSelectedId] = useState<SoapSection["id"]>(activeId);

  const activeIndex = sections.findIndex((s) => s.id === selectedId);
  const currentSection = sections[activeIndex >= 0 ? activeIndex : 0];

  const handleSelect = (id: SoapSection["id"]) => {
    setSelectedId(id);
    onChange?.(id);
  };

  const handleNext = () => {
    const nextIdx = (activeIndex + 1) % sections.length;
    handleSelect(sections[nextIdx].id);
  };

  const handlePrev = () => {
    const prevIdx = (activeIndex - 1 + sections.length) % sections.length;
    handleSelect(sections[prevIdx].id);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Horizontal Nav Bar with Sliding Pill */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto pb-0.5">
          {sections.map((section) => {
            const isActive = section.id === selectedId;
            return (
              <button
                key={section.id}
                onClick={() => handleSelect(section.id)}
                className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeSoapPill"
                    className="absolute inset-0 rounded-xl bg-slate-950 -z-10 shadow-xs"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold ${
                    isActive ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {section.letter}
                </span>
                <span className="uppercase tracking-wider font-mono text-[11px]">
                  {section.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Prev / Next triggers */}
        <div className="flex items-center gap-1 pr-1">
          <button
            onClick={handlePrev}
            aria-label="Previous SOAP section"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            aria-label="Next SOAP section"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Swipe Content Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
          className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md">
                SECTION {currentSection.letter}
              </span>
              <h3 className="text-lg font-bold text-slate-950 mt-1">
                {currentSection.name} Notes
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {currentSection.subtitle}
            </span>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-line font-medium">
            {currentSection.content || "No clinical observations recorded for this section."}
          </p>

          {currentSection.tags && currentSection.tags.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100">
              <span className="font-mono text-[10px] font-bold text-slate-400 mr-1 uppercase">
                Extracted Entities:
              </span>
              {currentSection.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default ClinicalSwipeRow;
