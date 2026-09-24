"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Brain, ShieldAlert, Navigation } from "lucide-react";

export interface StepItem {
  id: string;
  number: string;
  label: string;
  title: string;
  description: string;
  highlight: string;
}

export interface ClinicalStepperProps {
  steps: StepItem[];
  activeStep?: number;
  onStepChange?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function ClinicalStepper({
  steps,
  activeStep: externalActiveStep,
  onStepChange,
  className = "",
}: ClinicalStepperProps) {
  const [internalActiveStep, setInternalActiveStep] = useState(0);
  const activeIndex = externalActiveStep !== undefined ? externalActiveStep : internalActiveStep;

  const handleSelect = (idx: number) => {
    setInternalActiveStep(idx);
    onStepChange?.(idx);
  };

  const currentStep = steps[activeIndex] || steps[0];

  return (
    <div className={`w-full flex flex-col gap-6 ${className}`}>
      {/* ===================== CONTINUOUS TIMELINE RAIL (NO CHECKMARKS) ===================== */}
      <div className="relative w-full">
        {/* Continuous Background Track */}
        <div className="absolute top-5 left-6 right-6 h-[2px] bg-slate-200 -z-10" />

        {/* Active Progress Line */}
        <motion.div
          className="absolute top-5 left-6 h-[2px] bg-cyan-600 -z-10"
          animate={{
            width: `${(activeIndex / (steps.length - 1)) * 100}%`,
          }}
          transition={{ type: "spring", stiffness: 350, damping: 32 }}
        />

        <div className="grid grid-cols-4 gap-2">
          {steps.map((step, idx) => {
            const isActive = idx === activeIndex;
            const isPassed = idx < activeIndex;

            return (
              <button
                key={step.id}
                onClick={() => handleSelect(idx)}
                className="flex flex-col items-center text-center group cursor-pointer focus:outline-hidden"
              >
                {/* Node Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 ${
                    isActive
                      ? "bg-slate-950 text-white ring-4 ring-cyan-400/30 shadow-md scale-110"
                      : isPassed
                      ? "bg-cyan-700 text-white shadow-2xs"
                      : "bg-white text-slate-500 border border-slate-300 group-hover:border-slate-400 group-hover:text-slate-800"
                  }`}
                >
                  {step.number}
                </div>

                {/* Step Label */}
                <div className="mt-3 flex flex-col items-center">
                  <span
                    className={`font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                      isActive ? "text-slate-950" : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`text-[11px] font-medium hidden sm:block mt-0.5 transition-colors ${
                      isActive ? "text-cyan-800 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== DYNAMIC TRANSFORMATIVE WORKFLOW STAGE ===================== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-xs"
        >
          {/* STAGE 01: LISTEN (16kHz PCM Stream & Acoustic Biomarkers) */}
          {activeIndex === 0 && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-mono font-bold">
                  <Mic className="w-3.5 h-3.5 text-cyan-600" />
                  <span>PHASE 01 · 16kHz PCM ACOUSTIC INTAKE</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  Voice Stream Capture & Biomarker Analysis
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Direct microphone stream sampled at 16kHz without disk retention. Speech cadence, acoustic stress, and breathing distress markers are evaluated live.
                </p>
                <div className="flex items-center gap-3 pt-2 text-xs font-mono text-slate-500">
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    118ms Latency Verified
                  </span>
                  <span>·</span>
                  <span>Acoustic Noise Filter Active</span>
                </div>
              </div>

              {/* Interactive Audio Waveform Visualization */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-3 min-w-[280px]">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-700">INCOMING AUDIO</span>
                  <span className="text-cyan-700 font-bold animate-pulse">STREAMING</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 h-14 py-2">
                  {[0.3, 0.7, 1, 0.5, 0.9, 0.4, 0.8, 0.6, 0.95, 0.4, 0.7].map((height, i) => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [height * 0.4, height, height * 0.3] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.07, ease: "easeInOut" }}
                      className="w-1.5 h-full rounded-full bg-cyan-500 origin-bottom"
                    />
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 font-mono text-center">
                  "I've been feeling tightening chest pressure for 2 hours..."
                </span>
              </div>
            </div>
          )}

          {/* STAGE 02: UNDERSTAND (Clinical Entity Extraction & Semantic Slots) */}
          {activeIndex === 1 && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-mono font-bold">
                  <Brain className="w-3.5 h-3.5 text-teal-600" />
                  <span>PHASE 02 · REAL-TIME CLINICAL EXTRACTION</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  Clinical Entity Mining & Chief Complaint Mapping
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Natural patient speech is mapped into structured medical terminology. Chief complaints, duration, radiation, and risk factors are parsed into diagnostic slots.
                </p>
                <div className="flex items-center gap-3 pt-2 text-xs font-mono text-slate-500">
                  <span className="font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                    ICD-10 Mapped: R07.9
                  </span>
                  <span>·</span>
                  <span>0% Hallucination Rate</span>
                </div>
              </div>

              {/* Semantic Extracted Slots Display */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2.5 min-w-[280px] text-xs font-mono">
                <span className="text-[10px] font-bold text-slate-500 uppercase">IDENTIFIED CLINICAL SLOTS</span>
                <div className="p-2 rounded-lg bg-white border border-slate-200 flex justify-between">
                  <span className="text-slate-500">CHIEF COMPLAINT:</span>
                  <span className="font-bold text-slate-900">Substernal Tightness</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200 flex justify-between">
                  <span className="text-slate-500">RADIATION:</span>
                  <span className="font-bold text-slate-900">Left Arm & Jaw</span>
                </div>
                <div className="p-2 rounded-lg bg-white border border-slate-200 flex justify-between">
                  <span className="text-slate-500">DIAPHORESIS:</span>
                  <span className="font-bold text-rose-700">Present (Cold Sweat)</span>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 03: ASSESS (Multi-Specialist Board & Deterministic ESI Invariants) */}
          {activeIndex === 2 && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>PHASE 03 · MULTI-SPECIALIST DELIBERATION</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  Differential Synthesis & Algorithmic ESI Urgency
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Specialist agents (Cardiology, Emergency, Neurology) cross-examine the case concurrently. Deterministic safety guardrails enforce ESI urgency levels without AI hallucinations.
                </p>
                <div className="flex items-center gap-3 pt-2 text-xs font-mono text-slate-500">
                  <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                    ESI Level-2 Emergent
                  </span>
                  <span>·</span>
                  <span>Consensus Reached in 280ms</span>
                </div>
              </div>

              {/* Multi-Agent Opinions Card */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2.5 min-w-[280px] text-xs">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">SPECIALIST CONSENSUS</span>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Dr. Sarah Chen (Triage Lead)</span>
                  <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">ACS Suspected</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Cardiology Board Swarm</span>
                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">Cath Lab Alert</span>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 04: ACT (Spatial Hospital Routing & ED Pre-Arrival Telemetry) */}
          {activeIndex === 3 && (
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PHASE 04 · REGIONAL CARE NETWORK ROUTING</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                  Direct Care Routing & Hospital ED Dispatch
                </h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Connects the patient to the nearest verified emergency center with catheterization lab readiness. Generates interoperable HL7 FHIR bundles and dispatches pre-arrival alerts.
                </p>
                <div className="flex items-center gap-3 pt-2 text-xs font-mono text-slate-500">
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    HL7 FHIR R4 Compiled
                  </span>
                  <span>·</span>
                  <span>SHA-256 Audit Trail Locked</span>
                </div>
              </div>

              {/* Emergency Destination Telemetry Box */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-3 min-w-[300px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-800 uppercase">FASTEST DESTINATION</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">24/7 CATH LAB</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-950 text-base">Vijayawada Emergency Center</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Level-1 Trauma & Comprehensive Cardiology Hub</p>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-slate-900">8.4 km by road</span>
                  <span className="font-bold text-cyan-900 bg-cyan-100 px-2.5 py-0.5 rounded-md">~14 min ETA</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default ClinicalStepper;

