"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, MotionValue, useTransform } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  CheckCircle2,
  User,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  Activity,
  HeartPulse,
  Database,
  Lock,
  Globe
} from "lucide-react";

interface CallScenario {
  id: string;
  title: string;
  patientName: string;
  patientDetails: string;
  badge: string;
  badgeStyle: string;
  duration: string;
  waveformColor: string;
  dialogue: {
    speaker: "Patient" | "MediVoice";
    text: string;
    time: string;
  }[];
  outcomes: string[];
}

const CALL_SCENARIOS: CallScenario[] = [
  {
    id: "pediatric",
    title: "Same-Day Pediatric Triage",
    patientName: "Sarah Vance (for Leo, 4yo)",
    patientDetails: "Patient MRN #394012 • Pediatric Intake",
    badge: "Priority Care",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80 font-semibold",
    duration: "01:14",
    waveformColor: "from-teal-500 via-cyan-400 to-blue-500",
    dialogue: [
      {
        speaker: "Patient",
        text: "Hi, my 4-year-old son Leo has a fever of 102.4°F and a persistent cough. He's quite lethargic, but he's drinking water.",
        time: "00:12",
      },
      {
        speaker: "MediVoice",
        text: "I understand your concern, Sarah. Since Leo is responsive and drinking fluids, I can book an urgent same-day appointment with Dr. Vance today at 2:30 PM. Would that work for you?",
        time: "00:28",
      },
      {
        speaker: "Patient",
        text: "Yes, 2:30 PM works great. Thank you so much!",
        time: "00:36",
      },
      {
        speaker: "MediVoice",
        text: "You're all set! I've confirmed the 2:30 PM appointment and sent pediatric fever management guidance to your phone via SMS.",
        time: "00:45",
      },
    ],
    outcomes: [
      "Booked Same-Day Telehealth (2:30 PM)",
      "Pediatric Care Instructions Sent via SMS",
      "SOAP Note Pushed to Epic EHR",
    ],
  },
  {
    id: "cardiac",
    title: "Urgent ER Escalation",
    patientName: "Robert Miller (58yo M)",
    patientDetails: "Patient MRN #884920 • Acute Cardiac Triage",
    badge: "Emergency ER",
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-200/80 font-bold animate-pulse",
    duration: "00:48",
    waveformColor: "from-rose-500 via-red-400 to-amber-400",
    dialogue: [
      {
        speaker: "Patient",
        text: "I'm having a heavy, crushing chest pressure radiating to my left arm... I'm sweating heavily and feeling short of breath...",
        time: "00:08",
      },
      {
        speaker: "MediVoice",
        text: "Robert, based on your symptoms, this requires emergency medical evaluation. I am immediately alerting 911 EMS and patching you to our on-call ER triage nurse.",
        time: "00:22",
      },
    ],
    outcomes: [
      "Immediate 911 Emergency Dispatch Triggered",
      "Direct Warm Transfer to ER Nurse Line",
      "Pre-Arrival Cardiac Alert Sent to ER",
    ],
  },
  {
    id: "refill",
    title: "Automated Rx Refill",
    patientName: "Elena Rostova (34yo F)",
    patientDetails: "Patient MRN #552109 • Post-Op Dental Care",
    badge: "Routine Refill",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/80 font-semibold",
    duration: "00:52",
    waveformColor: "from-emerald-500 via-teal-400 to-cyan-400",
    dialogue: [
      {
        speaker: "Patient",
        text: "Hi, I had wisdom tooth surgery 3 days ago with Dr. Aris and need a refill on my post-op pain medication.",
        time: "00:10",
      },
      {
        speaker: "MediVoice",
        text: "I've verified your procedure history and allergy profile—no contraindications found. I'm submitting the refill request to CVS Pharmacy for provider sign-off.",
        time: "00:26",
      },
    ],
    outcomes: [
      "Allergy & Contraindication Check Cleared",
      "Refill Order Queued for Provider E-Sign",
      "Automated Follow-Up Call Scheduled",
    ],
  },
];

interface Props {
  scrollProgress?: MotionValue<number>;
}

export function MedicalHeroDashboardPreview({ scrollProgress }: Props) {
  const [activeScenarioId, setActiveScenarioId] = useState<string>("pediatric");
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const scenario =
    CALL_SCENARIOS.find((s) => s.id === activeScenarioId) ||
    CALL_SCENARIOS[0];

  const dialogueOpacity = scrollProgress
    ? useTransform(scrollProgress, [0, 0.2, 0.45], [0.88, 0.96, 1])
    : undefined;

  return (
    <div className="w-full bg-white text-slate-900 font-sans rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden flex flex-col">
      {/* MAC OS BROWSER APP SHOWCASE HEADER (Vibrant / OnAssemble Signature) */}
      <div className="bg-slate-50/90 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap">
        {/* Left: Window Controls + URL Bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
          </div>
          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1.5 bg-white border border-slate-200/90 px-3 py-1 rounded-lg shadow-2xs font-mono text-[11px] text-slate-500">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>medvoice.ai/app/live-triage</span>
          </div>
        </div>

        {/* Right: Interactive Scenario Selectors */}
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
          {CALL_SCENARIOS.map((s) => {
            const isActive = s.id === activeScenarioId;
            return (
              <button
                key={s.id}
                onClick={() => setActiveScenarioId(s.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "bg-white text-slate-900 font-bold shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.title.split(" ")[0]} {s.title.split(" ")[1]}
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN CALL CONTENT AREA */}
      <div className="p-6 md:p-8 flex flex-col gap-6 bg-gradient-to-b from-white via-slate-50/30 to-slate-50/70">
        {/* CALLER PROFILE & STATUS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-slate-900/10">
              <User className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 tracking-tight">{scenario.patientName}</h3>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${scenario.badgeStyle}`}>
                  {scenario.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{scenario.patientDetails}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isMuted
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/60"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-sm">
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Voice Stream Active ({scenario.duration})</span>
            </div>
          </div>
        </div>

        {/* AI VOICE WAVEFORM VISUALIZER ORB */}
        <div className="relative py-6 bg-slate-900 rounded-2xl p-6 shadow-inner flex flex-col items-center justify-center gap-4 overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.18),transparent_70%)] pointer-events-none" />

          {/* Dynamic Audio Waveform Bars */}
          <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-md px-4">
            {[40, 75, 95, 60, 85, 100, 70, 90, 50, 80, 65, 95, 45, 80, 55, 90, 35].map((h, i) => (
              <motion.div
                key={i}
                animate={{
                  height: isMuted
                    ? "8px"
                    : [`${Math.max(15, h * 0.35)}%`, `${h}%`, `${Math.max(20, h * 0.55)}%`],
                }}
                transition={{
                  duration: 0.6 + (i % 4) * 0.1,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className={`w-2 rounded-full bg-gradient-to-t ${scenario.waveformColor}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Real-Time Speech Recognition • Low Latency (140ms)</span>
          </div>
        </div>

        {/* NATURAL SPEECH TRANSCRIPT */}
        <motion.div style={{ opacity: dialogueOpacity }} className="flex flex-col gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
            Live Speech Transcript
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="space-y-3"
            >
              {scenario.dialogue.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  className={`p-4 rounded-xl text-sm leading-relaxed ${
                    item.speaker === "Patient"
                      ? "bg-white border border-slate-200/90 text-slate-800 shadow-2xs"
                      : "bg-blue-50/80 border border-blue-200/80 text-slate-900 font-medium"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold flex items-center gap-1.5 ${
                        item.speaker === "Patient" ? "text-slate-700" : "text-blue-700"
                      }`}
                    >
                      {item.speaker === "Patient" ? (
                        <User className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      {item.speaker === "Patient" ? scenario.patientName.split(" ")[0] : "MediVoice AI"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{item.time}</span>
                  </div>
                  <p>{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* AUTOMATED OUTCOMES SUMMARY */}
        <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Actions Triggered:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scenario.outcomes.map((outcome, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: i * 0.1 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {outcome}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
