"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, Loader2, Sparkles, Brain, ShieldCheck } from "lucide-react";

export interface ThoughtStep {
  id: string;
  label: string;
  detail?: string;
  status: "pending" | "running" | "completed";
}

export interface ThoughtLineProps {
  steps?: ThoughtStep[];
  activeStepId?: string;
  className?: string;
  isComplete?: boolean;
}

const DEFAULT_STEPS: ThoughtStep[] = [
  { id: "1", label: "Voice stream captured (16kHz PCM audio)", detail: "118ms latency verified", status: "completed" },
  { id: "2", label: "Speech transcribed & acoustic noise filtered", detail: "Confidence 98.4%", status: "completed" },
  { id: "3", label: "Clinical entities & chief complaint mined", detail: "ICD-10 mapped to R07.9 (Chest pain)", status: "completed" },
  { id: "4", label: "Multi-agent doctor deliberation & guideline query", detail: "Cardiology & Emergency board convened", status: "running" },
  { id: "5", label: "ESI triage urgency evaluated", detail: "Assigned Level-2 Priority Escalation", status: "pending" },
  { id: "6", label: "Consensus clinical guidance synthesized", detail: "SOAP Encounter note compiled", status: "pending" },
];

export function ThoughtLine({
  steps = DEFAULT_STEPS,
  activeStepId,
  className = "",
  isComplete = false,
}: ThoughtLineProps) {
  return (
    <div
      className={`rounded-2xl bg-white/95 border border-slate-200/90 p-5 shadow-xs font-mono text-xs ${className}`}
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
            <Brain className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">
            Clinical Deliberation Pipeline
          </span>
        </div>
        <span className="font-bold text-[10px] text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full">
          {isComplete ? "Consensus Reached" : "Observable Processing"}
        </span>
      </div>

      {/* Tree Visualization */}
      <div className="space-y-2.5">
        {steps.map((step, idx) => {
          const isRunning = step.status === "running";
          const isDone = step.status === "completed";
          const isLast = idx === steps.length - 1;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="flex items-start gap-2.5 font-sans"
            >
              {/* Connector Prefix */}
              <span className="font-mono text-slate-300 text-xs select-none">
                {idx === 0 ? "●" : isLast ? "└──" : "├──"}
              </span>

              {/* Status Dot / Spinner */}
              <div className="pt-0.5">
                {isDone ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                ) : isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-200" />
                )}
              </div>

              {/* Step Copy */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-semibold ${
                    isRunning
                      ? "text-cyan-900 font-bold"
                      : isDone
                      ? "text-slate-800"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="block font-mono text-[10px] text-slate-400">
                    {step.detail}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default ThoughtLine;
