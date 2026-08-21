"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Send,
  Sparkles,
  Activity,
  HeartPulse,
  CheckCircle2,
  FileText,
  AlertTriangle,
  BrainCircuit,
  Zap,
  Terminal
} from "lucide-react";

interface TriageResult {
  triage_level: "emergency" | "priority" | "routine";
  detected_symptoms: string[];
  recommended_action: string;
  soap_summary: string;
}

const SAMPLE_PROMPTS = [
  "58yo male with severe crushing chest pain radiating to left arm and cold sweats",
  "4yo child with 102.8°F fever, lethargy, coughing, drinking fluids",
  "34yo post-op dental patient requesting routine pain medication refill",
  "22yo athlete with sudden right lower quadrant abdominal pain and nausea",
];

export function VoiceCallSimulator() {
  const [customInput, setCustomInput] = useState<string>(SAMPLE_PROMPTS[0]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [liveTriage, setLiveTriage] = useState<TriageResult | null>({
    triage_level: "emergency",
    detected_symptoms: ["Substernal Chest Pain", "Left Arm Radiation", "Diaphoresis", "Dyspnea"],
    recommended_action: "Direct 911 EMS Dispatch & Warm Transfer to ER Nurse Triage",
    soap_summary: "S: 58yo M presenting with acute onset crushing chest pressure (9/10), diaphoresis & radiation. P: Trigger emergency cardiology pathway.",
  });

  const handleRunTriage = async (textToTriage: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: textToTriage,
          patient_id: "P-1002",
          patient_name: "Live Test Patient",
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

  const handlePromptClick = (promptText: string) => {
    setCustomInput(promptText);
    handleRunTriage(promptText);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleRunTriage(customInput);
  };

  const getUrgencyBadge = (level: string) => {
    if (level === "emergency") {
      return "bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse";
    }
    if (level === "priority") {
      return "bg-amber-50 text-amber-700 border-amber-200 font-semibold";
    }
    return "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold";
  };

  return (
    <section id="playground" className="w-full py-16 bg-white border-y border-slate-200/80">
      <div className="mx-auto max-w-5xl px-4">
        {/* SECTION HEADER */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200/80 px-3.5 py-1 text-xs font-semibold text-blue-700 mb-3">
            <Terminal className="w-3.5 h-3.5 text-blue-600" />
            <span>Interactive API Playground</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Test Live Voice Triage & NLP Mining
          </h2>
          <p className="mt-2 text-base text-slate-500 font-normal">
            Type any custom patient complaint below to execute MedVoice AI's live FastAPI speech recognition, symptom mining, and SOAP note generation engine.
          </p>
        </div>

        {/* QUICK SAMPLE PROMPT CHIPS */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6 max-w-4xl mx-auto">
          <span className="text-xs font-semibold text-slate-500 mr-1">Quick Prompts:</span>
          {SAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handlePromptClick(prompt)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 transition-all cursor-pointer truncate max-w-xs"
            >
              {prompt.slice(0, 42)}...
            </button>
          ))}
        </div>

        {/* CUSTOM INPUT FORM */}
        <form onSubmit={handleSubmit} className="mb-8 max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type any patient symptom complaint..."
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs font-sans"
          />
          <button
            type="submit"
            disabled={isProcessing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <span>Analyzing...</span>
            ) : (
              <>
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Run Live API Triage</span>
              </>
            )}
          </button>
        </form>

        {/* LIVE TRIAGE API OUTPUT SHOWCASE CARD */}
        {liveTriage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 shadow-xl max-w-4xl mx-auto"
          >
            {/* Header Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 mb-6">
              <div className="flex items-center gap-2.5">
                <BrainCircuit className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-sm text-slate-900">
                  FastAPI Triage Model Output
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  STATUS 200 OK
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Triage Level:</span>
                <span className={`px-3 py-1 text-xs font-mono font-bold rounded-full border ${getUrgencyBadge(liveTriage.triage_level)}`}>
                  {liveTriage.triage_level.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Symptoms & Action */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono block mb-2">
                    Extracted Symptoms (ICD-10 NLP)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {liveTriage.detected_symptoms.map((symptom, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs"
                      >
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono block mb-1">
                    Recommended Triage Action
                  </label>
                  <p className="text-xs font-semibold text-slate-900 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                    {liveTriage.recommended_action}
                  </p>
                </div>
              </div>

              {/* Right Column: SOAP Note Summary */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono block mb-2">
                  Generated SOAP Chart Note
                </label>
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 leading-relaxed shadow-2xs">
                  {liveTriage.soap_summary}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
