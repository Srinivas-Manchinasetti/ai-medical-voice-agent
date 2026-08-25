"use client";

import React from "react";
import { motion } from "framer-motion";
import { Activity, ShieldCheck, Zap, ArrowUpRight, Lock, CheckCircle2 } from "lucide-react";

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="w-full py-20 sm:py-28 bg-[#FAF9F6] text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        
        {/* SECTION HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between pb-12 border-b border-slate-300/80 gap-6">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 block">
              CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 max-w-xl">
              Clinical intelligence, without the clinical busywork.
            </h2>
          </div>
          <p className="text-sm text-slate-600 max-w-md leading-relaxed font-sans font-medium">
            MedVoice runs silently alongside patient care — automating intake, symptom mining, triage routing, and EHR charting in real time.
          </p>
        </div>

        {/* ASYMMETRIC EDITORIAL CAPABILITIES LIST */}
        <div className="divide-y divide-slate-200/90">
          
          {/* CAPABILITY 01 */}
          <div className="py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="font-mono text-sm font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-md inline-block">
                01 / REAL-TIME VOICE
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-slate-950">
                Listen to patient conversations as they happen.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Stream 16kHz audio with sub-150ms latency. MedVoice filters background clinical noise and recognizes medical terminology across multi-turn intake calls.
              </p>
            </div>
            
            <div className="lg:col-span-7 bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-emerald-400 font-bold">16kHz STREAM ACTIVE</span>
                </div>
                <span className="text-slate-500">LATENCY: 118ms</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 text-slate-300 font-sans">
                <p className="italic text-slate-400 font-mono text-[11px]">"I've had severe crushing chest pain since 6 AM radiating to my left arm..."</p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
                  <span className="text-cyan-400 font-semibold">SPEAKER: Patient (P-1002)</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400">ACOUSTIC NOISE CANCELLED</span>
                </div>
              </div>
            </div>
          </div>

          {/* CAPABILITY 02 */}
          <div className="py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 order-2 lg:order-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 font-sans text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-mono font-bold text-slate-400 text-[11px] uppercase">EHR SOAP Generator</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[11px] font-semibold border border-emerald-200">
                  Epic / Cerner FHIR Ready
                </span>
              </div>
              <div className="space-y-2 text-slate-700">
                <p><strong className="text-slate-900 font-mono">SUBJECTIVE:</strong> 58yo male presents with acute onset substernal chest pressure, diaphoresis, and left arm radiation.</p>
                <p><strong className="text-slate-900 font-mono">ASSESSMENT:</strong> High-risk acute coronary syndrome (ICD-10 I20.9).</p>
                <p><strong className="text-slate-900 font-mono">PLAN:</strong> Immediate 911 EMS dispatch & transfer to nearest PCI-capable cardiology center.</p>
              </div>
            </div>

            <div className="lg:col-span-5 order-1 lg:order-2 space-y-4">
              <span className="font-mono text-sm font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-md inline-block">
                02 / CLINICAL UNDERSTANDING
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-slate-950">
                Turn natural conversation into structured clinical data.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Our clinical NLP engine maps spoken symptoms directly to ICD-10 codes, flags high-risk triage indicators, and generates structured SOAP notes ready for EHR export.
              </p>
            </div>
          </div>

          {/* CAPABILITY 03 */}
          <div className="py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <span className="font-mono text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-md inline-block">
                03 / CARE ROUTING
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-slate-950">
                Move from assessment to appropriate action.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                MedVoice evaluates severity in real time, routing emergency cases to 24/7 cardiac ERs while directing routine inquiries to telehealth or appointment booking.
              </p>
            </div>

            <div className="lg:col-span-7 bg-slate-50 border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono font-bold">
                  TRIAGE: EMERGENCY (LEVEL 1)
                </span>
                <span className="text-xs font-mono text-slate-500">DISPATCH DELAY: &lt; 2.4s</span>
              </div>
              <div className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">KIMS Hospitals — Emergency Cardiac Unit</h4>
                  <p className="text-xs text-slate-500 font-mono">2.4 km away · Secunderabad</p>
                </div>
                <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shrink-0">
                  Routed ✓
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
