"use client";

import React from "react";
import { Mic, BrainCircuit, Activity, PhoneCall, ExternalLink, ArrowRight } from "lucide-react";

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="w-full py-20 md:py-28 bg-white border-y border-slate-200/80">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-20">
        {/* SECTION HEADER */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-700">
            HOW MEDVOICE WORKS
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950">
            Listen · Understand · Act
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            From patient phone conversation to structured clinical action in real time.
          </p>
        </div>

        {/* PILLAR 01: LISTEN */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-slate-100 pb-16">
          <div className="md:col-span-5 space-y-3">
            <span className="text-xs font-mono font-bold text-cyan-700 uppercase tracking-widest block">
              01 / LISTEN
            </span>
            <h3 className="text-2xl font-bold text-slate-900 leading-snug">
              Every patient has a story.
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              MedVoice listens to spoken intake calls with real-time speech recognition, capturing human nuance without interruption.
            </p>
          </div>

          <div className="md:col-span-7 bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs font-mono">
              <span className="text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Audio Stream Active
              </span>
              <span className="text-slate-500">Latency: 140ms</span>
            </div>
            <p className="font-mono text-xs text-slate-300 italic leading-relaxed bg-slate-900 p-3.5 rounded-xl border border-slate-800">
              "My 4-year-old son Leo has had a fever of 102.4°F since yesterday and a persistent cough..."
            </p>
          </div>
        </div>

        {/* PILLAR 02: UNDERSTAND */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-slate-100 pb-16">
          <div className="md:col-span-5 md:order-2 space-y-3">
            <span className="text-xs font-mono font-bold text-cyan-700 uppercase tracking-widest block">
              02 / UNDERSTAND
            </span>
            <h3 className="text-2xl font-bold text-slate-900 leading-snug">
              MedVoice turns conversation into clinical structure.
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              FastAPI symptom mining extracts ICD-10 medical entities and formats an authentic EHR SOAP chart note instantly.
            </p>
          </div>

          <div className="md:col-span-7 md:order-1 bg-slate-50 border border-slate-200/90 p-6 rounded-2xl space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase">ICD-10 NLP Entities Extracted:</span>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs">Fever · R50.9</span>
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs">Cough · R05.9</span>
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs">Lethargy · R53.83</span>
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs font-sans space-y-1">
              <span className="font-bold text-slate-900 block">Structured SOAP Note:</span>
              <p className="text-slate-600 leading-relaxed">Subjective: 4yo pediatric intake presenting with acute fever & persistent cough.</p>
            </div>
          </div>
        </div>

        {/* PILLAR 03: ACT */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 space-y-3">
            <span className="text-xs font-mono font-bold text-cyan-700 uppercase tracking-widest block">
              03 / ACT
            </span>
            <h3 className="text-2xl font-bold text-slate-900 leading-snug">
              And turns understanding into the next step.
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Determines urgency, advises care pathways, and connects patients directly to the nearest specialized medical facility.
            </p>
          </div>

          <div className="md:col-span-7 bg-white border border-slate-200/90 p-6 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-mono font-bold text-slate-500">Triage Outcome</span>
              <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                PRIORITY CARE
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
              <div>
                <h4 className="font-bold text-sm text-slate-900">KIMS Hospitals</h4>
                <p className="text-xs text-slate-500">2.4 km · Emergency & Pediatrics</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs">Call</span>
                <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs">Directions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

