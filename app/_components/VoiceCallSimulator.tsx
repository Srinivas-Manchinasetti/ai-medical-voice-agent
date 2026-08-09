"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, CheckCircle2, AlertCircle, Activity, Sparkles, RefreshCw } from "lucide-react";

interface Scenario {
  id: string;
  label: string;
  patientName: string;
  chiefComplaint: string;
  urgency: "Emergency ER" | "Priority Care" | "Routine Refill";
  dialogue: {
    sender: "patient" | "agent";
    text: string;
    timestamp: string;
  }[];
  summary: {
    symptoms: string[];
    action: string;
    soap: string;
  };
}

const SCENARIOS: Scenario[] = [
  {
    id: "chest-pain",
    label: "🚨 Urgent Chest Pain",
    patientName: "Robert Miller (Age 58)",
    chiefComplaint: "Substernal chest pressure & shortness of breath for 25 mins",
    urgency: "Emergency ER",
    dialogue: [
      {
        sender: "patient",
        text: "Hello, I'm feeling a heavy crushing pressure in the center of my chest that radiates to my left arm. I'm sweating heavily and feeling short of breath.",
        timestamp: "00:02",
      },
      {
        sender: "agent",
        text: "Robert, I understand you are experiencing severe chest pressure. Based on your symptoms, this requires immediate emergency evaluation. I am immediately alerting 911 and patching you to our on-call ER triage nurse.",
        timestamp: "00:06",
      },
    ],
    summary: {
      symptoms: ["Substernal Chest Pain", "Left Arm Radiation", "Diaphoresis", "Dyspnea"],
      action: "Direct ER Transfer & Alert On-Call Cardiology",
      soap: "S: 58yo male presents with acute onset crushing chest pain radiating to left arm. P: Activate EMS immediately.",
    },
  },
  {
    id: "pediatric-fever",
    label: "🤒 Pediatric Fever",
    patientName: "Sarah Jenkins (Parent of Leo, Age 4)",
    chiefComplaint: "High fever (102.4°F) & persistent cough",
    urgency: "Priority Care",
    dialogue: [
      {
        sender: "patient",
        text: "Hi! My 4-year-old son Leo has a fever of 102.4°F. He's lethargic and coughing, but he is drinking water.",
        timestamp: "00:03",
      },
      {
        sender: "agent",
        text: "Thank you for calling, Sarah. Since Leo is responsive and drinking fluids, I can schedule an urgent same-day appointment with Dr. Vance today at 2:30 PM.",
        timestamp: "00:07",
      },
    ],
    summary: {
      symptoms: ["Pediatric Pyrexia (102.4°F)", "Lethargy", "Acute Cough"],
      action: "Book Same-Day Urgent Telehealth Visit",
      soap: "S: 4yo male with 102.4F fever, non-toxic appearance. P: Scheduled same-day pediatric telehealth appointment.",
    },
  },
  {
    id: "post-op-refill",
    label: "💊 Post-Op Rx Refill",
    patientName: "David Chen (Age 34)",
    chiefComplaint: "Post-dental surgery pain management & refill check",
    urgency: "Routine Refill",
    dialogue: [
      {
        sender: "patient",
        text: "Hi, I had wisdom tooth surgery 3 days ago and need a refill on my prescribed pain medication.",
        timestamp: "00:02",
      },
      {
        sender: "agent",
        text: "Hello David! I see your recent procedure. I've verified your allergy profile—no active contraindications found. I'm submitting the refill request now.",
        timestamp: "00:06",
      },
    ],
    summary: {
      symptoms: ["Post-surgical Dental Pain", "Routine Refill Request"],
      action: "Automated e-Prescribing Queue & Pharmacy Routing",
      soap: "S: 34yo post-op dental patient requesting routine Rx refill. P: Digital Rx sent to designated pharmacy.",
    },
  },
];

export function VoiceCallSimulator() {
  const [activeId, setActiveId] = useState<string>("chest-pain");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const scenario = SCENARIOS.find((s) => s.id === activeId) || SCENARIOS[0];

  return (
    <div id="playground" className="w-full py-6">
      <div className="mx-auto max-w-5xl px-4">
        {/* Scenario Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeId === s.id
                  ? "bg-black text-white shadow-md scale-105"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Main Preview Container */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                🎙️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">{scenario.patientName}</h3>
                <p className="text-xs text-slate-500">{scenario.chiefComplaint}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3 sm:mt-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  scenario.urgency === "Emergency ER"
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : scenario.urgency === "Priority Care"
                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                }`}
              >
                {scenario.urgency}
              </span>
            </div>
          </div>

          {/* Dialogue & Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Dialogue (7 cols) */}
            <div className="md:col-span-7 space-y-4 border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Live Voice Stream
              </span>

              {scenario.dialogue.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {item.sender === "patient" ? scenario.patientName : "Dr. Maya (AI Voice Assistant)"}
                  </span>
                  <div
                    className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      item.sender === "agent"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-800 border border-slate-200"
                    }`}
                  >
                    {item.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Structured Insights (5 cols) */}
            <div className="md:col-span-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Automated Clinical Summary
              </span>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-600 block">Detected Symptoms:</span>
                <div className="flex flex-wrap gap-1.5">
                  {scenario.summary.symptoms.map((sym, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700"
                    >
                      {sym}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block">Protocol Action:</span>
                <p className="text-slate-600">{scenario.summary.action}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 font-mono text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-700 block font-sans">EHR SOAP Summary:</span>
                <p>{scenario.summary.soap}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
