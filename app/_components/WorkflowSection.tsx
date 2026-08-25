"use client";

import React from "react";
import { Activity, PhoneCall, ExternalLink, ShieldCheck, CheckCircle2, ArrowRight } from "lucide-react";

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="w-full py-28 sm:py-36 bg-white border-y border-slate-200/80 text-slate-900 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 space-y-32">
        
        {/* LARGE INTRODUCTORY MOMENT */}
        <div className="max-w-4xl space-y-6">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1.5 rounded-full inline-block">
            LISTEN · UNDERSTAND · ACT
          </span>
          <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.1]">
            AI medical voice triage that feels human.
          </h2>
          <p className="text-lg sm:text-xl text-slate-600 font-medium leading-relaxed max-w-2xl">
            Dissecting patient conversation into immediate clinical intelligence without administrative friction.
          </p>
        </div>

        {/* 01 / LISTEN — ASYMMETRIC CANVAS COMPOSITION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start border-t border-slate-200/80 pt-16">
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
            <span className="font-mono text-xs font-bold text-cyan-700 uppercase tracking-widest block">
              01 / LISTEN
            </span>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Every patient has a story.
            </h3>
            <p className="text-base text-slate-600 leading-relaxed font-medium">
              MedVoice captures human intake calls with 16kHz sub-150ms audio streaming, preserving emotional context and clinical nuance.
            </p>
          </div>

          <div className="lg:col-span-7 bg-[#0B0F17] text-white p-8 sm:p-10 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 text-xs font-mono">
              <span className="text-emerald-400 font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                LIVE SPEECH STREAM ACTIVE
              </span>
              <span className="text-slate-500 font-mono">16kHz PCM · 118ms</span>
            </div>

            <div className="space-y-4">
              <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">
                Real-Time Audio Waveform & Speech Recognition:
              </span>
              <div className="bg-[#111827] p-6 rounded-2xl border border-slate-800/90 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-3">
                  <span>PATIENT: (CALL ID #9042)</span>
                  <span className="text-cyan-400 font-semibold">SIGNAL: NOISE CANCELLED</span>
                </div>
                <p className="text-slate-200 italic leading-relaxed text-base font-sans font-medium">
                  "My 58-year-old husband has been having severe crushing chest pain since 6 AM that radiates down his left arm with cold sweats..."
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 02 / UNDERSTAND — REVERSED SPATIAL GEOMETRY COMPOSITION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start border-t border-slate-200/80 pt-16">
          <div className="lg:col-span-7 lg:order-1 space-y-6">
            <div className="bg-slate-50 border border-slate-200 p-8 sm:p-10 rounded-3xl space-y-6 shadow-sm">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                  FASTAPI NLP SYMPTOM MINING (ICD-10 MAPPING)
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <span className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-900 text-xs font-bold font-mono rounded-xl shadow-2xs">
                    Substernal Chest Pain · ICD-10 I20.9
                  </span>
                  <span className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-900 text-xs font-bold font-mono rounded-xl shadow-2xs">
                    Diaphoresis · ICD-10 R61
                  </span>
                  <span className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-900 text-xs font-bold font-mono rounded-xl shadow-2xs">
                    Left Arm Radiation · ICD-10 M79.603
                  </span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-xs font-sans space-y-3 shadow-2xs">
                <span className="font-mono font-bold text-slate-900 block text-xs border-b border-slate-100 pb-3 uppercase tracking-wider">
                  AUTOMATED EHR SOAP CHART DOCUMENT
                </span>
                <p className="text-slate-700 leading-relaxed text-sm">
                  <strong className="text-slate-900 font-mono">SUBJECTIVE:</strong> 58yo male presenting with acute onset substernal crushing chest pressure radiating down left arm with cold sweats.
                </p>
                <p className="text-slate-700 leading-relaxed text-sm">
                  <strong className="text-slate-900 font-mono">ASSESSMENT:</strong> High-risk Acute Coronary Syndrome (ACS) / Myocardial Infarction indicators.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:order-2 space-y-6 lg:sticky lg:top-28">
            <span className="font-mono text-xs font-bold text-teal-700 uppercase tracking-widest block">
              02 / UNDERSTAND
            </span>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Conversation becomes clinical intelligence.
            </h3>
            <p className="text-base text-slate-600 leading-relaxed font-medium">
              Our clinical NLP engine maps spoken symptoms directly to ICD-10 codes and structures a complete EHR SOAP chart note ready for instant review.
            </p>
          </div>
        </div>

        {/* 03 / ACT — COMPACT HORIZONTAL PATHWAY DISPATCH */}
        <div className="border-t border-slate-200/80 pt-16 space-y-8">
          <div className="max-w-3xl space-y-4">
            <span className="font-mono text-xs font-bold text-rose-700 uppercase tracking-widest block">
              03 / ACT
            </span>
            <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 leading-tight">
              From understanding to the next step.
            </h3>
            <p className="text-base text-slate-600 leading-relaxed font-medium">
              Evaluates clinical urgency in real time, routes emergency cases to 24/7 cardiac ERs, and dispatches care recommendations directly to patient or care team.
            </p>
          </div>

          <div className="bg-[#FAF9F6] border border-slate-200/90 p-8 rounded-3xl space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                CLINICAL TRIAGE DISPATCH DECISION
              </span>
              <span className="px-4 py-1.5 text-xs font-mono font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse w-fit">
                EMERGENCY TRIAGE (LEVEL 1)
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <h4 className="font-bold text-lg text-slate-950">KIMS Hospitals — Emergency Cardiac Unit</h4>
                <p className="text-xs text-slate-500 font-mono">2.4 km away · Secunderabad · 24/7 PCI Emergency Facility</p>
                <p className="text-xs text-cyan-800 font-medium pt-1">
                  Recommended because this assessment requires immediate emergency cardiac evaluation.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                <a
                  href="tel:911"
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call Emergency</span>
                </a>
                <a
                  href="#demo"
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-all"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  <span>Directions</span>
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}



