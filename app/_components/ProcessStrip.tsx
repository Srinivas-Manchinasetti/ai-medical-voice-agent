"use client";

import React from "react";
import { PhoneCall, BrainCircuit, HeartPulse } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: PhoneCall,
    title: "Listen",
    desc: "Patient calls in. MedVoice picks up and streams the conversation in real time.",
  },
  {
    number: "02",
    icon: BrainCircuit,
    title: "Understand",
    desc: "Symptoms are mapped to ICD-10 codes and structured into a SOAP note.",
  },
  {
    number: "03",
    icon: HeartPulse,
    title: "Act",
    desc: "Urgency is assessed and the patient is routed to the right level of care.",
  },
];

export function ProcessStrip() {
  return (
    <section className="w-full py-20 sm:py-28 bg-white border-t border-slate-200/80">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="max-w-xl mb-14 space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 block">
            HOW IT WORKS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Three steps, every call.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`relative pt-8 space-y-4 ${
                  i > 0 ? "md:border-l md:border-slate-200/80 md:pl-8" : ""
                }`}
              >
                <span className="font-mono text-xs font-bold text-slate-300 tracking-widest">
                  {step.number}
                </span>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-md">
                  <Icon className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
