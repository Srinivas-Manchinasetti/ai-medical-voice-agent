"use client";

import React, { useState } from "react";
import { Globe2, CheckCircle2 } from "lucide-react";

export function MultilingualSection() {
  const [selectedLang, setSelectedLang] = useState<string>("hi");

  const EXAMPLES = [
    {
      code: "en",
      label: "English",
      speech: "I've been feeling dizzy since yesterday morning.",
      meaning: "Patient reports 24-hour onset of dizziness without fainting.",
    },
    {
      code: "hi",
      label: "हिन्दी (Hindi)",
      speech: "मुझे कल सुबह से चक्कर आ रहे हैं।",
      meaning: "Patient reports 24-hour onset of dizziness without fainting.",
    },
    {
      code: "te",
      label: "తెలుగు (Telugu)",
      speech: "నాకు నిన్నటి నుంచి తల తిరుగుతోంది.",
      meaning: "Patient reports 24-hour onset of dizziness without fainting.",
    },
    {
      code: "es",
      label: "Español (Spanish)",
      speech: "Me he sentido mareado desde ayer por la mañana.",
      meaning: "Patient reports 24-hour onset of dizziness without fainting.",
    },
  ];

  const current = EXAMPLES.find((e) => e.code === selectedLang) || EXAMPLES[0];

  return (
    <section className="w-full py-20 bg-[#F7FAF9]">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F9F8F] bg-[#E8F6F3] px-3.5 py-1 rounded-full">
              Inclusive Healthcare
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-[#16302B]">
              Patients Can Speak Naturally in Their Preferred Language
            </h2>
            <p className="text-sm text-[#60716D] leading-relaxed">
              Remove language barriers for non-English speaking patients. MediVoice understands diverse spoken languages and translates the conversation into clear clinical context for your care team.
            </p>
          </div>

          <div className="lg:col-span-7 warm-card rounded-3xl p-6 md:p-8">
            <div className="flex flex-wrap gap-2 mb-6 border-b border-[#16302B]/5 pb-4">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.code}
                  onClick={() => setSelectedLang(ex.code)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedLang === ex.code
                      ? "bg-[#0F9F8F] text-white shadow-sm"
                      : "bg-[#F0F5F3] text-[#16302B] hover:bg-[#E2ECE9]"
                  }`}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F0F5F3] text-xs sm:text-sm text-[#16302B] font-medium">
                <span className="text-[10px] uppercase font-bold text-[#60716D] block mb-1">
                  Spoken Patient Input ({current.label})
                </span>
                "{current.speech}"
              </div>

              <div className="p-4 rounded-2xl bg-[#E8F6F3] text-xs text-[#0F9F8F] border border-[#0F9F8F]/20">
                <span className="text-[10px] uppercase font-bold text-[#0F9F8F] flex items-center gap-1 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Structured Clinical Understanding
                </span>
                <p className="text-xs font-semibold text-[#16302B]">{current.meaning}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
