"use client";

import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

const FAQS = [
  {
    q: "Is MedVoice a replacement for a doctor?",
    a: "No. MedVoice is a clinical decision-support and triage assistant. It helps route patients to the right level of care faster — it does not diagnose or replace a licensed clinician. In a medical emergency, patients should always contact 911 immediately.",
  },
  {
    q: "What happens to the call audio afterward?",
    a: "MedVoice is built around a zero voice-retention policy: audio is processed to extract the clinical transcript and structured note, and the raw recording is not kept in long-term storage.",
  },
  {
    q: "Can this connect to our existing EHR?",
    a: "MedVoice generates structured SOAP notes designed to be FHIR-compatible so they can be reviewed and imported into systems like Epic or Cerner. A direct, certified integration with a specific EHR vendor should be confirmed with your IT/compliance team before go-live.",
  },
  {
    q: "How is the nearest hospital chosen?",
    a: "The care-routing engine filters facilities by required capability (for example, 24/7 emergency or cardiology), then ranks eligible options by estimated travel time — with the reasoning shown alongside the recommendation, not just a score.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="w-full py-20 sm:py-28 bg-[#FAF9F6] border-t border-slate-200/80">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="mb-12 space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 block">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Your questions, answered.
          </h2>
        </div>

        <div className="divide-y divide-slate-200/90 border-t border-b border-slate-200/90">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className="py-6">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-6 text-left cursor-pointer group"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-start gap-4">
                    <span className="font-mono text-xs font-bold text-slate-300 pt-1 tracking-widest shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-700 transition-colors">
                      {item.q}
                    </span>
                  </span>
                  <span className="shrink-0 pt-1 text-slate-400">
                    {isOpen ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </span>
                </button>
                {isOpen && (
                  <p className="mt-3 ml-9 text-sm text-slate-600 leading-relaxed max-w-xl">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
