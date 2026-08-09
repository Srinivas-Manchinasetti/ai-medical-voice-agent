"use client";

import React, { useState } from "react";
import { Activity, ShieldCheck, Globe2, AlertTriangle, FileSpreadsheet, Sparkles, CheckCircle2 } from "lucide-react";

export function FeatureBentoGrid() {
  const [activeLang, setActiveLang] = useState<string>("en");

  const LANGUAGES = [
    { code: "en", label: "English", sample: "I'm having difficulty breathing." },
    { code: "es", label: "Español", sample: "Tengo dificultad para respirar." },
    { code: "zh", label: "中文", sample: "我感觉呼吸困难。" },
    { code: "hi", label: "हिन्दी", sample: "मुझे सांस लेने में तकलीफ हो रही है।" },
  ];

  return (
    <section id="capabilities" className="w-full py-16 bg-slate-50 border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="flex flex-col items-center text-center mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Built for High-Precision Clinical Workflows
          </h2>
          <p className="mt-3 max-w-xl text-base text-slate-600">
            From emergency intake routing to multilingual patient interaction, discover the technology powering instant medical voice assistance.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="md:col-span-2 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Real-Time Symptom & Entity Extraction</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              As the patient speaks naturally, our clinical voice LLM isolates chief complaints, symptom duration, severity, and automatically tags ICD-10 medical codes.
            </p>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <span className="rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700">
                🚨 Chest Pain (R07.9)
              </span>
              <span className="rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700">
                Diaphoresis (R61)
              </span>
              <span className="rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                Shortness of Breath (R06.02)
              </span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="md:col-span-1 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <Globe2 className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Multilingual Care</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Break language barriers. The voice agent seamlessly switches dialects in real-time over 30+ languages.
              </p>

              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setActiveLang(lang.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeLang === lang.code
                        ? "bg-black text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700 border border-slate-200">
              "{LANGUAGES.find((l) => l.code === activeLang)?.sample}"
            </div>
          </div>

          {/* Card 3 */}
          <div className="md:col-span-1 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Emergency Escalation</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Critical red-flag symptoms auto-trigger direct patching to hospital ER on-call triage nurses or 911 dispatch.
            </p>
          </div>

          {/* Card 4 */}
          <div className="md:col-span-2 rounded-3xl bg-white border border-slate-200 p-8 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center font-bold">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Automated SOAP Notes & EHR Writeback</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Eliminate manual charting. Every patient voice call generates a structured Subjective, Objective, Assessment, and Plan (SOAP) note synced to Epic & Cerner.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
