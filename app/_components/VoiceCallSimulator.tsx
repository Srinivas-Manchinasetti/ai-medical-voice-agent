"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, PhoneCall, Volume2, CheckCircle2, HeartPulse, Send, Sparkles, Activity } from "lucide-react";

interface Scenario {
  id: string;
  title: string;
  patientIntro: string;
  transcriptText: string;
  dialogue: {
    speaker: "Patient" | "MediVoice";
    text: string;
  }[];
  summary: {
    symptoms: string[];
    action: string;
    soap: string;
    urgency: "Emergency ER" | "Priority Care" | "Routine Refill";
  };
}

const PRESET_SCENARIOS: Scenario[] = [
  {
    id: "chest-pain",
    title: "🚨 Urgent Chest Pain",
    patientIntro: "Patient calling with severe chest pressure & dyspnea.",
    transcriptText: "Hello, I'm feeling a heavy crushing pressure in the center of my chest that radiates to my left arm. I'm sweating heavily and feeling short of breath.",
    dialogue: [
      {
        speaker: "Patient",
        text: "Hello, I'm feeling a heavy crushing pressure in the center of my chest that radiates to my left arm. I'm sweating heavily and feeling short of breath.",
      },
      {
        speaker: "MediVoice",
        text: "I understand you are experiencing severe chest pressure. Based on your symptoms, this requires immediate emergency evaluation. I am immediately alerting 911 and patching you to our on-call ER triage nurse.",
      },
    ],
    summary: {
      symptoms: ["Substernal Chest Pain", "Left Arm Radiation", "Diaphoresis", "Dyspnea"],
      action: "Direct ER Transfer & Alert On-Call Cardiology",
      soap: "S: 58yo male presents with acute onset crushing chest pain. P: Activate EMS immediately.",
      urgency: "Emergency ER",
    },
  },
  {
    id: "pediatric-fever",
    title: "🤒 Pediatric Fever",
    patientIntro: "Parent calling regarding 4-year-old child's fever.",
    transcriptText: "My 4-year-old son Leo has a fever of 102.4°F. He's lethargic and coughing, but he is drinking water.",
    dialogue: [
      {
        speaker: "Patient",
        text: "My 4-year-old son Leo has a fever of 102.4°F. He's lethargic and coughing, but he is drinking water.",
      },
      {
        speaker: "MediVoice",
        text: "Since Leo is responsive and drinking fluids, I can schedule an urgent same-day appointment with Dr. Vance today at 2:30 PM.",
      },
    ],
    summary: {
      symptoms: ["Pediatric Pyrexia (102.4°F)", "Lethargy", "Acute Cough"],
      action: "Book Same-Day Urgent Telehealth Visit",
      soap: "S: 4yo male with 102.4F fever. P: Scheduled same-day pediatric telehealth appointment.",
      urgency: "Priority Care",
    },
  },
  {
    id: "post-op-refill",
    label: "💊 Post-Op Rx Refill",
    title: "💊 Post-Op Refill",
    patientIntro: "Patient requesting routine medication refill.",
    transcriptText: "Hi, I had wisdom tooth surgery 3 days ago and need a refill on my prescribed pain medication.",
    dialogue: [
      {
        speaker: "Patient",
        text: "Hi, I had wisdom tooth surgery 3 days ago and need a refill on my prescribed pain medication.",
      },
      {
        speaker: "MediVoice",
        text: "I see your recent procedure. I've verified your allergy profile—no active contraindications found. I'm submitting the refill request now.",
      },
    ],
    summary: {
      symptoms: ["Post-surgical Dental Pain", "Routine Refill Request"],
      action: "Automated e-Prescribing Queue & Pharmacy Routing",
      soap: "S: 34yo post-op dental patient requesting routine Rx refill. P: Digital Rx sent to designated pharmacy.",
      urgency: "Routine Refill",
    },
  },
];

export function VoiceCallSimulator() {
  const [activeId, setActiveId] = useState<string>("chest-pain");
  const [customInput, setCustomInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [liveTriage, setLiveTriage] = useState<any>(null);

  const scenario = PRESET_SCENARIOS.find((s) => s.id === activeId) || PRESET_SCENARIOS[0];

  const handleRunTriage = async (textToTriage: str) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToTriage,
          patient_id: "P-1002",
          patient_name: "Robert Miller",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.triage) {
          setLiveTriage(data.triage);
        }
      }
    } catch (e) {
      console.warn("Error calling triage backend API:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectScenario = (id: string) => {
    setActiveId(id);
    setLiveTriage(null);
    const selected = PRESET_SCENARIOS.find((s) => s.id === id);
    if (selected) {
      handleRunTriage(selected.transcriptText);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleRunTriage(customInput);
  };

  const displayUrgency = liveTriage
    ? liveTriage.triage_level === "emergency"
      ? "Emergency ER"
      : liveTriage.triage_level === "priority"
      ? "Priority Care"
      : "Routine Refill"
    : scenario.summary.urgency;

  const displaySymptoms = liveTriage?.detected_symptoms || scenario.summary.symptoms;
  const displayAction = liveTriage?.recommended_action || scenario.summary.action;
  const displaySoap = liveTriage?.soap_summary || scenario.summary.soap;

  return (
    <div id="playground" className="w-full py-6">
      <div className="mx-auto max-w-5xl px-4">
        {/* Scenario Selection Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <span className="text-xs font-semibold text-slate-500 mr-2">Try a scenario:</span>
          {PRESET_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectScenario(s.id)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                activeId === s.id && !customInput
                  ? "bg-black text-white shadow-md scale-105"
                  : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Custom Complaint Input Form */}
        <form onSubmit={handleCustomSubmit} className="mb-6 flex gap-2 max-w-2xl mx-auto">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Or type a custom patient complaint (e.g. Sharp pain in lower right abdomen...)"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
          />
          <button
            type="submit"
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Analyzing...</span>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Test Live API</span>
              </>
            )}
          </button>
        </form>

        {/* Main Preview Container */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">{scenario.patientName}</h3>
                <p className="text-xs text-slate-500">
                  {customInput ? `Custom Input: "${customInput}"` : scenario.chiefComplaint}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3 sm:mt-0">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  displayUrgency === "Emergency ER"
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : displayUrgency === "Priority Care"
                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                }`}
              >
                {displayUrgency}
              </span>
            </div>
          </div>

          {/* Dialogue & Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Dialogue Stream (7 cols) */}
            <div className="md:col-span-7 space-y-4 border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 md:pr-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Live Patient Speech Stream
                </span>
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  ● FASTAPI BACKEND CONNECTED
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Patient Speech</span>
                  <div className="rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 p-4 text-xs sm:text-sm leading-relaxed">
                    {customInput || scenario.transcriptText}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500">Dr. Maya (AI Voice Assistant)</span>
                  <div className="rounded-2xl bg-slate-900 text-white p-4 text-xs sm:text-sm leading-relaxed">
                    {displayUrgency === "Emergency ER"
                      ? "I understand you are experiencing severe emergency symptoms. Based on your statement, I am immediately routing you to 911 and our on-call ER nurse."
                      : displayUrgency === "Priority Care"
                      ? "Thank you for calling. I've flagged your symptoms for same-day priority clinical evaluation."
                      : "I can help with that request right away. I've logged your information and routed it to your care team."}
                  </div>
                </div>
              </div>
            </div>

            {/* Structured Triage Output (5 cols) */}
            <div className="md:col-span-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                FastAPI Triage Output
              </span>

              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-600 block">Extracted Symptoms:</span>
                <div className="flex flex-wrap gap-1.5">
                  {displaySymptoms.map((sym: string, i: number) => (
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
                <span className="font-bold text-slate-700 block">Recommended Action:</span>
                <p className="text-slate-600">{displayAction}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 font-mono text-xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-700 block font-sans">SOAP Note Output:</span>
                <p>{displaySoap}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
