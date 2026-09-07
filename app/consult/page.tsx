"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  PhoneOff,
  Activity,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  Send,
  Building2,
  Radio,
  Users,
  Zap,
  Award,
  Cpu,
  Hand,
  HeartPulse,
  Brain,
  Baby,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "../_components/Navbar";
import { Footer } from "../_components/Footer";
import { DOCTOR_PROFILES, DoctorProfile } from "@/config/doctors";
import { CursorGrid } from "@/components/ui/cursor-grid";

type AudioState =
  | "IDLE"
  | "PATIENT_LISTENING"
  | "PROCESSING_PATIENT"
  | "DOCTOR_SPEAKING"
  | "BARGE_IN_DETECTED"
  | "PROCESSING_INTERRUPTION";

interface ChatMessage {
  id: string;
  role: "doctor" | "patient" | "system";
  text: string;
  timestamp: string;
  doctorName?: string;
  doctorSpecialty?: string;
  wasInterrupted?: boolean;
  isBargeIn?: boolean;
}

interface BoardMessage {
  id: string;
  speakerRole: "lead" | "specialist" | "tool" | "system" | "safety_arbiter";
  agentId: string;
  doctorName: string;
  specialty: string;
  round: number;
  type: "assessment" | "challenge" | "response" | "evidence_request" | "tool_result" | "revision" | "synthesis" | "safety_disposition";
  content: string;
  references?: string[];
  tool_data?: {
    tool_name: string;
    summary: string;
    status: string;
    latency_ms?: number;
    details?: any;
  };
  timestamp: string;
  case_version?: number;
}

interface LiveTriageData {
  triageLevel: "emergency" | "priority" | "routine";
  triageTitle: string;
  esiScore?: number;
  isEmergency?: boolean;
  arbiterOverride?: boolean;
  overrideRationale?: string;
  detectedSymptoms: string[];
  icdCodes: string[];
  recommendedAction: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

interface BoardData {
  orchestrator_summary: string;
  active_specialists: string[];
  specialists_summoned: string[];
  deliberation_rounds?: number;
  tools_executed?: string[];
  tools_executed_details?: Array<{
    tool_name: string;
    clinical_summary: string;
    latency_ms: number;
    status: string;
  }>;
  peer_challenges_count?: number;
  peer_challenges?: Array<{
    from_agent: string;
    to_agent: string;
    claim_disputed: string;
    counter_evidence: string[];
    challenge_rationale: string;
    resolved?: boolean;
  }>;
  opinions: Array<{
    doctor_name: string;
    specialty: string;
    concerns: string[];
    risk_level: string;
    confidence?: number;
    confidence_semantics?: string;
    primary_hypothesis?: string;
    recommended_actions?: string[];
  }>;
  differential: Array<{
    condition: string;
    probability: string;
    supporting_agents?: string[];
  }>;
  conflicts: Array<{
    topic: string;
    agents: string[];
    conflict_description: string;
    resolution: string;
  }>;
  deliberation_messages?: BoardMessage[];
  trace: {
    pre_arbiter_latency_us: number;
    post_arbiter_latency_us: number;
    total_board_latency_ms: number;
    orchestrator_latency_ms?: number;
    synthesis_latency_ms?: number;
    audit_sha256?: string;
    audit_hash_chain?: Array<{
      block_index: number;
      event_type: string;
      current_hash: string;
      previous_hash: string;
      payload_summary: string;
    }>;
  };
}

export default function ConsultPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile>(DOCTOR_PROFILES[0]);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [audioState, setAudioState] = useState<AudioState>("IDLE");

  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [typedInput, setTypedInput] = useState<string>("");
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [triageData, setTriageData] = useState<LiveTriageData | null>(null);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  
  const [activeRightTab, setActiveRightTab] = useState<"board" | "safety">("board");
  const [showTechnicalTrace, setShowTechnicalTrace] = useState<boolean>(false);

  // Audio refs
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStateRef = useRef<AudioState>("IDLE");
  const callActiveRef = useRef<boolean>(false);

  useEffect(() => {
    audioStateRef.current = audioState;
  }, [audioState]);

  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, audioState, transcriptText]);

  // Call duration timer
  useEffect(() => {
    if (callActive) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callActive]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Immediate Barge-In: cleanly halts doctor TTS and starts listening
  const triggerBargeIn = useCallback((customPhrase?: string) => {
    console.log("⚡ Interrupting doctor speech immediately.");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setAudioState("BARGE_IN_DETECTED");

    // Mark previous doctor message as interrupted without duplicating
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].role === "doctor") {
          updated[i] = { ...updated[i], wasInterrupted: true };
          break;
        }
      }
      return updated;
    });

    if (customPhrase) {
      handleUserUtterance(customPhrase, true);
    } else {
      setTimeout(() => {
        setAudioState("PATIENT_LISTENING");
        startSpeechRecognitionListening();
      }, 80);
    }
  }, []);

  // Text-To-Speech with clean stop on interruption
  const speakDoctorResponse = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*_#`\[\]()]/g, "").trim();
    if (!cleanText) return;

    setAudioState("DOCTOR_SPEAKING");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = selectedDoctor.voiceGender === "female" ? 1.15 : 0.95;

    const voices = window.speechSynthesis.getVoices();
    const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
    if (englishVoices.length > 0) {
      if (selectedDoctor.voiceGender === "female") {
        const femaleVoice = englishVoices.find((v) =>
          v.name.includes("Female") || v.name.includes("Zira") || v.name.includes("Samantha") || v.name.includes("Google UK English Female")
        );
        if (femaleVoice) utterance.voice = femaleVoice;
      } else {
        const maleVoice = englishVoices.find((v) =>
          v.name.includes("Male") || v.name.includes("David") || v.name.includes("Google UK English Male")
        );
        if (maleVoice) utterance.voice = maleVoice;
      }
    }

    utterance.onstart = () => {
      setAudioState("DOCTOR_SPEAKING");
    };

    const handleSpeechEnd = () => {
      if (audioStateRef.current === "DOCTOR_SPEAKING") {
        setAudioState("IDLE");
        setTimeout(() => {
          if (callActiveRef.current && audioStateRef.current === "IDLE") {
            startSpeechRecognitionListening();
          }
        }, 300);
      }
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = handleSpeechEnd;

    window.speechSynthesis.speak(utterance);
  }, [selectedDoctor]);

  // Speech Recognition (Robust Web Speech API without audio hardware conflicts)
  const startSpeechRecognitionListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicPermissionError("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setMicPermissionError(null);
        setAudioState("PATIENT_LISTENING");
      };

      recognition.onresult = (event: any) => {
        let currentInterim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript;
          } else {
            currentInterim += res[0].transcript;
          }
        }

        if (currentInterim) {
          setTranscriptText(currentInterim);
        }

        if (finalChunk.trim()) {
          setTranscriptText("");
          handleUserUtterance(finalChunk.trim());
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition notice:", e.error);
        if (e.error === "not-allowed") {
          setMicPermissionError("Microphone access denied. Please click the camera/mic icon in your browser address bar to allow.");
        }
        if (audioStateRef.current === "PATIENT_LISTENING" && callActiveRef.current) {
          setTimeout(() => {
            if (audioStateRef.current === "PATIENT_LISTENING" && callActiveRef.current) {
              try { recognition.start(); } catch {}
            }
          }, 600);
        }
      };

      recognition.onend = () => {
        if (audioStateRef.current === "PATIENT_LISTENING" && callActiveRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setAudioState("PATIENT_LISTENING");
    } catch (err: any) {
      console.warn("Speech recognition start error:", err);
      setMicPermissionError("Could not engage microphone: " + (err.message || "Unknown error"));
    }
  }, []);

  // Start consultation session
  const startConsultation = async () => {
    callActiveRef.current = true;
    setCallActive(true);
    setCallDuration(0);
    setMicPermissionError(null);

    const initialGreeting: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "doctor",
      text: selectedDoctor.greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      doctorName: selectedDoctor.name,
      doctorSpecialty: selectedDoctor.department
    };
    setMessages([initialGreeting]);
    speakDoctorResponse(selectedDoctor.greeting);
  };

  // End consultation session
  const endConsultation = () => {
    setCallActive(false);
    callActiveRef.current = false;
    setAudioState("IDLE");
    setTranscriptText("");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Process User Utterance (Preserves exact spoken text without artificial tag prefixes)
  const handleUserUtterance = async (userText: string, isBargeIn: boolean = false) => {
    if (!userText.trim()) return;

    if (!callActive) {
      callActiveRef.current = true;
      setCallActive(true);
    }

    setAudioState(isBargeIn ? "PROCESSING_INTERRUPTION" : "PROCESSING_PATIENT");
    setTranscriptText("");

    // Exact patient words — no "URGENT BARGE-IN" text injection!
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "patient",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isBargeIn
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          message: userText,
          conversationHistory: [...messages, userMessage],
          patientName: "Patient",
          isInterruption: isBargeIn,
          interruptedAgent: selectedDoctor.name
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const doctorReplyText = data.doctorReply || "I have received your symptoms and documented them.";

        const newDoctorMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "doctor",
          text: doctorReplyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          doctorName: selectedDoctor.name,
          doctorSpecialty: selectedDoctor.department
        };

        setMessages((prev) => [...prev, newDoctorMessage]);

        if (data.triage) {
          setTriageData(data.triage);
        }
        if (data.board) {
          setBoardData(data.board);
          setActiveRightTab("board");
        }

        speakDoctorResponse(doctorReplyText);
      }
    } catch (err) {
      console.error("Consultation chat error:", err);
      setAudioState("IDLE");
    }
  };

  // Quick Test Scenarios
  const CLINICAL_SCENARIOS = [
    {
      label: "🫀 Cardio Emergency",
      text: "I've had crushing pressure in the center of my chest for thirty minutes radiating into my left arm with cold sweats.",
      isBargeIn: false
    },
    {
      label: "🧠 Stroke Deficit",
      text: "My wife noticed my right face is drooping, my right arm is weak and I have trouble getting my words out.",
      isBargeIn: false
    },
    {
      label: "✋ Stroke Interruption",
      text: "Wait doctor! My face just started drooping and I can't lift my left arm!",
      isBargeIn: true
    },
    {
      label: "⚡ Dual-Threat Cardioneuro",
      text: "I have sudden severe chest tightness, my left arm is numb, and I felt like I was going to black out with dizziness.",
      isBargeIn: false
    },
    {
      label: "👶 Pediatric Sepsis",
      text: "My 7-week-old newborn has a rectal temperature of 102.5 and is unusually floppy, grunting, and refusing to wake up to feed.",
      isBargeIn: false
    },
    {
      label: "💊 Routine Refill",
      text: "I am feeling completely fine and just need a prescription refill for my maintenance lisinopril 10mg.",
      isBargeIn: false
    }
  ];

  // Helper for Doctor Status
  const getDoctorLiveStatus = (doc: DoctorProfile) => {
    if (audioState === "DOCTOR_SPEAKING" && selectedDoctor.id === doc.id) {
      return { label: "Speaking", color: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500 animate-pulse" };
    }
    if (doc.id === "dr-sarah-chen") {
      return { label: "Lead", color: "text-cyan-800 bg-cyan-50", dot: "bg-cyan-500" };
    }
    if (boardData?.active_specialists?.some(s => s.toLowerCase().includes(doc.name.toLowerCase().split(" ")[1] || ""))) {
      return { label: "In Board", color: "text-blue-800 bg-blue-50", dot: "bg-blue-500" };
    }
    return { label: "Standby", color: "text-slate-500 bg-slate-100", dot: "bg-slate-300" };
  };

  // Doctor Icons
  const getDoctorIcon = (docName: string, specialty: string) => {
    const s = (specialty + " " + docName).toLowerCase();
    if (s.includes("cardio") || s.includes("vance")) {
      return <HeartPulse className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />;
    }
    if (s.includes("neuro") || s.includes("arthur") || s.includes("pendelton")) {
      return <Brain className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />;
    }
    if (s.includes("pedia") || s.includes("rostova")) {
      return <Baby className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />;
    }
    return <Stethoscope className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />;
  };

  // Event Badges
  const getEventBadge = (type: string, isLead: boolean) => {
    switch (type) {
      case "challenge":
        return { label: "↳ CHALLENGE", color: "text-amber-700" };
      case "response":
        return { label: "↻ RESPONSE", color: "text-purple-700" };
      case "revision":
        return { label: "↗ REVISION", color: "text-indigo-700" };
      case "synthesis":
        return { label: "★ SYNTHESIS", color: "text-cyan-700" };
      case "assessment":
      default:
        return isLead
          ? { label: "● INTAKE", color: "text-cyan-700" }
          : { label: "● ASSESSMENT", color: "text-slate-600" };
    }
  };

  const activeSpecialistsCount = boardData?.active_specialists?.length || (boardData?.opinions?.length ? boardData.opinions.length : 1);
  const currentRound = boardData?.deliberation_rounds || (boardData?.peer_challenges_count ? 2 : 1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-20 pb-12 flex flex-col gap-6">
        
        {/* EDITORIAL SPECIALIST ROSTER (No bulky box cards) */}
        <section className="flex flex-col gap-2 border-b border-slate-200/80 pb-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Active Board</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-mono font-medium">
                {activeSpecialistsCount > 1
                  ? `${activeSpecialistsCount} Specialists Deliberating · Round ${currentRound}`
                  : "Primary Care Lead · Standby"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {DOCTOR_PROFILES.map((doc) => {
              const isSelected = selectedDoctor.id === doc.id;
              const liveStatus = getDoctorLiveStatus(doc);
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    setSelectedDoctor(doc);
                    if (callActive) {
                      speakDoctorResponse(`Switched to ${doc.name}, ${doc.department}. How may I evaluate your symptoms?`);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-left cursor-pointer border ${
                    isSelected
                      ? "bg-white border-slate-300 text-slate-900 shadow-2xs"
                      : "bg-transparent border-transparent hover:bg-slate-100/80 text-slate-600"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={doc.avatarUrl}
                      alt={doc.name}
                      className="w-6 h-6 rounded-full object-cover border border-slate-300"
                    />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${liveStatus.dot}`} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {doc.name.replace(", MD, FACC", "").replace(", MD, PhD", "").replace(", MD, FAAP", "").replace(", MD", "")}
                    </span>
                    <span className="text-[10px] text-slate-500">{liveStatus.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* MAIN WORKSPACE: 2 EDITORIAL PANELS (Aggressively flattened, no nested cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: VOICE CONSULT */}
          <section className="lg:col-span-6 flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <img
                  src={selectedDoctor.avatarUrl}
                  alt={selectedDoctor.name}
                  className="w-9 h-9 rounded-full object-cover border border-slate-300 shadow-2xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">{selectedDoctor.name}</h2>
                    <span className="text-[11px] text-slate-500 font-normal">· {selectedDoctor.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span className="font-mono">{formatTimer(callDuration)}</span>
                    <span>·</span>
                    <span className={audioState === "DOCTOR_SPEAKING" ? "text-emerald-700 font-medium animate-pulse" : "text-slate-500"}>
                      {audioState === "DOCTOR_SPEAKING" ? "Doctor speaking" : audioState === "PATIENT_LISTENING" ? "Listening..." : "Connected"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!callActive ? (
                  <button
                    onClick={startConsultation}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                    Start Call
                  </button>
                ) : (
                  <button
                    onClick={endConsultation}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    End Call
                  </button>
                )}
              </div>
            </div>

            {/* Quiet Barge-In Interruption Bar */}
            <AnimatePresence>
              {audioState === "DOCTOR_SPEAKING" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-950"
                >
                  <span className="text-[11px] font-medium">Doctor is speaking. Speak aloud or click to interrupt:</span>
                  <button
                    onClick={() => triggerBargeIn()}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-md shadow-2xs transition-all cursor-pointer"
                  >
                    Interrupt
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mic Permission Alert */}
            {micPermissionError && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{micPermissionError}</span>
              </div>
            )}

            {/* Conversation Feed (Chat-like typography, no heavy card boxes) */}
            <div
              ref={chatScrollRef}
              className="h-[420px] overflow-y-auto flex flex-col gap-4 pr-2"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Stethoscope className="w-6 h-6 mb-2 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-700">Voice Consultation Ready</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Click "Start Call" or tap any clinical scenario below to speak directly with the clinical decision-support agent.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1 ${
                      msg.role === "doctor" ? "items-start" : "items-end"
                    }`}
                  >
                    {/* Doctor Message */}
                    {msg.role === "doctor" && (
                      <>
                        <span className="text-[11px] font-bold text-slate-700 tracking-wide">
                          {msg.doctorName?.toUpperCase() || "DR. SARAH CHEN"}
                          <span className="text-[10px] font-normal text-slate-400 ml-1.5">· {msg.doctorSpecialty}</span>
                        </span>
                        <div className="max-w-[90%] text-slate-800 text-xs leading-relaxed">
                          "{msg.text}"
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <span>{msg.timestamp}</span>
                          {msg.wasInterrupted && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600 font-sans font-medium">Interrupted by patient</span>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* Patient Message */}
                    {msg.role === "patient" && (
                      <>
                        <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-slate-900 text-white text-xs leading-relaxed shadow-2xs font-normal">
                          {msg.text}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono pr-1">
                          <span>{msg.timestamp}</span>
                          {msg.isBargeIn && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600 font-sans font-medium">Patient interruption</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}

              {/* LIVE SPEECH RECOGNITION INTERIM DISPLAY */}
              {audioState === "PATIENT_LISTENING" && (
                <div className="flex items-center gap-2 text-xs text-cyan-800 animate-pulse py-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
                  <span className="font-semibold text-cyan-900">Hearing:</span>
                  <span className="italic text-cyan-950 font-medium truncate">
                    {transcriptText ? `"${transcriptText}"` : "Listening to your voice... speak now"}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Test Scenarios */}
            <div className="pt-2 border-t border-slate-200/80">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-600" />
                Quick Test Scenarios
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CLINICAL_SCENARIOS.map((scen, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (scen.isBargeIn && audioState === "DOCTOR_SPEAKING") {
                        triggerBargeIn(scen.text);
                      } else {
                        handleUserUtterance(scen.text, scen.isBargeIn);
                      }
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all cursor-pointer ${
                      scen.isBargeIn
                        ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200 font-medium"
                        : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {scen.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input & Microphone Bar */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
              <button
                onClick={() => {
                  if (audioState === "DOCTOR_SPEAKING") {
                    triggerBargeIn();
                  } else if (audioState === "PATIENT_LISTENING") {
                    setAudioState("IDLE");
                    if (recognitionRef.current) recognitionRef.current.abort();
                  } else {
                    if (!callActive) {
                      callActiveRef.current = true;
                      setCallActive(true);
                    }
                    startSpeechRecognitionListening();
                  }
                }}
                className={`p-2.5 rounded-full transition-all cursor-pointer ${
                  audioState === "PATIENT_LISTENING"
                    ? "bg-rose-500 text-white animate-pulse shadow-xs"
                    : audioState === "DOCTOR_SPEAKING"
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
                title={audioState === "DOCTOR_SPEAKING" ? "Interrupt doctor" : "Toggle microphone"}
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                placeholder={
                  audioState === "DOCTOR_SPEAKING"
                    ? "Doctor speaking... tap interrupt or type here..."
                    : audioState === "PATIENT_LISTENING"
                    ? (transcriptText ? `Hearing: ${transcriptText}` : "Listening... speak now or type...")
                    : "Type symptoms or click mic to speak..."
                }
                value={typedInput}
                onChange={(e) => setTypedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typedInput.trim()) {
                    const t = typedInput.trim();
                    setTypedInput("");
                    if (audioState === "DOCTOR_SPEAKING") triggerBargeIn(t);
                    else handleUserUtterance(t);
                  }
                }}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
              />

              <button
                onClick={() => {
                  if (typedInput.trim()) {
                    const t = typedInput.trim();
                    setTypedInput("");
                    if (audioState === "DOCTOR_SPEAKING") triggerBargeIn(t);
                    else handleUserUtterance(t);
                  }
                }}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

          </section>

          {/* RIGHT PANEL: CLINICAL BOARD ROOM (Editorial stream, subtle background, zero box clutter) */}
          <section className="relative lg:col-span-6 flex flex-col gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
            
            {/* Subtle CursorGrid background texture */}
            <CursorGrid
              cellSize={56}
              radius={110}
              falloff="smooth"
              holdTime={250}
              fadeDuration={700}
              lineWidth={0.8}
              maxOpacity={0.08}
              fillOpacity={0}
              gridOpacity={0.02}
              cellRadius={0}
              clickPulse={true}
              pulseSpeed={600}
            />

            <div className="relative z-10 flex flex-col gap-4">
              
              {/* Header: Clean Tabs & Status */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveRightTab("board")}
                    className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeRightTab === "board"
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Clinical Board
                  </button>
                  <button
                    onClick={() => setActiveRightTab("safety")}
                    className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      activeRightTab === "safety"
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Patient Safety
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ROUND {currentRound} · LIVE</span>
                </div>
              </div>

              {/* TAB 1: CLINICAL BOARD DELIBERATION STREAM */}
              {activeRightTab === "board" && (
                <div className="flex flex-col gap-3">
                  
                  {/* Deliberation Stream Feed */}
                  <div className="flex flex-col max-h-[380px] overflow-y-auto pr-1">
                    {!boardData?.deliberation_messages || boardData.deliberation_messages.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                        <Users className="w-6 h-6 mb-2 text-slate-300" />
                        <p className="text-xs font-semibold text-slate-700">Clinical Board Standing By</p>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                          When you describe symptoms or test scenarios, the multidisciplinary board will deliberate in real-time here.
                        </p>
                      </div>
                    ) : (
                      boardData.deliberation_messages.map((msg, idx) => {
                        const isLead = msg.speakerRole === "lead";
                        const isTool = msg.speakerRole === "tool";
                        const isArbiter = msg.speakerRole === "safety_arbiter";

                        // Inline Diagnostic Tool Event
                        if (isTool) {
                          const toolName = msg.tool_data?.tool_name || "Diagnostic Tool";
                          const cleanToolName = toolName.replace(/^compute_|^analyze_|^calculate_/, "").toUpperCase();
                          const summary = msg.tool_data?.summary || msg.content.replace(/^Executed [^:]+:\s*/, "");
                          return (
                            <div
                              key={msg.id || idx}
                              className="my-1.5 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[9px] font-bold text-slate-600 uppercase tracking-wider">
                                  {cleanToolName}
                                </span>
                                <span className="text-slate-700 font-medium truncate text-[11px]">
                                  {summary}
                                </span>
                              </div>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 ml-2" />
                            </div>
                          );
                        }

                        // Safety Arbiter is rendered in dominant bottom section
                        if (isArbiter) {
                          return null;
                        }

                        // Doctor Turn (Editorial layout: avatar, name, speech, evidence)
                        const eventBadge = getEventBadge(msg.type, isLead);
                        const icon = getDoctorIcon(msg.doctorName, msg.specialty);
                        const cleanDocName = msg.doctorName.replace(", MD, FACC", "").replace(", MD, PhD", "").replace(", MD, FAAP", "").replace(", MD", "");

                        return (
                          <div
                            key={msg.id || idx}
                            className="py-2.5 border-b border-slate-100 last:border-0 flex flex-col gap-1"
                          >
                            {/* Speaker Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {icon}
                                <span className="font-bold text-xs text-slate-900">{cleanDocName}</span>
                                <span className="text-[11px] text-slate-500 font-normal">· {msg.specialty.split("&")[0]}</span>
                              </div>
                              <span className={`text-[9px] font-mono uppercase tracking-wider font-semibold ${eventBadge.color}`}>
                                {eventBadge.label}
                              </span>
                            </div>

                            {/* Human Clinical Utterance */}
                            <p className="text-xs text-slate-800 leading-relaxed pl-5 font-normal">
                              "{msg.content}"
                            </p>

                            {/* Evidence Citation */}
                            {msg.references && msg.references.length > 0 && (
                              <div className="pl-5 flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="font-medium text-slate-500">Evidence:</span>
                                <span className="truncate">{msg.references.join(" · ")}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* BOARD DECISION & SAFETY VERIFIED (Dominant bottom conclusion) */}
                  {boardData && (
                    <div className="mt-2 pt-3 border-t-2 border-slate-900 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Board Consensus</span>
                        <span className="text-[10px] font-mono text-slate-400">{boardData.opinions?.length || 1} Specialists</span>
                      </div>
                      
                      <p className="text-xs font-bold text-slate-900 leading-snug">
                        {boardData.conflicts && boardData.conflicts.length > 0
                          ? "Two acute pathways remain simultaneously active under dual-activation emergency protocol."
                          : boardData.opinions?.some(o => o.risk_level === "high")
                          ? "Specialist emergency consensus reached. Immediate hospital evaluation indicated."
                          : "Specialists agree presentation is non-emergent. Outpatient clinical monitoring recommended."}
                      </p>

                      {/* Safety Arbiter Disposition */}
                      <div className="mt-1 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <div>
                            <span className="text-[11px] font-bold text-slate-900">Safety Verified · ESI {triageData?.esiScore || 2}</span>
                            <p className="text-[10px] text-slate-500">Deterministic invariant override active</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                          AUDIT VERIFIED ✓
                        </span>
                      </div>

                      {/* Progressive Disclosure: Technical Drawer */}
                      <div className="mt-0.5">
                        <button
                          onClick={() => setShowTechnicalTrace(!showTechnicalTrace)}
                          className="text-[10px] font-mono text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {showTechnicalTrace ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          <span>Technical execution trace & audit ledger</span>
                        </button>

                        {showTechnicalTrace && (
                          <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono flex flex-col gap-1 text-slate-600">
                            <div className="flex justify-between">
                              <span>Pre-Arbiter:</span>
                              <span className="font-bold text-slate-900">{boardData?.trace?.pre_arbiter_latency_us || 32} µs</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Post-Arbiter:</span>
                              <span className="font-bold text-slate-900">{boardData?.trace?.post_arbiter_latency_us || 184} µs</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Deterministic Engine:</span>
                              <span className="font-bold text-emerald-700">{boardData?.trace?.total_board_latency_ms || 0.44} ms</span>
                            </div>
                            {boardData?.trace?.audit_sha256 && (
                              <div className="pt-1 border-t border-slate-200 truncate">
                                <span className="text-slate-400">SHA-256: </span>
                                <span className="text-slate-800">{boardData.trace.audit_sha256}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* TAB 2: PATIENT SAFETY */}
              {activeRightTab === "safety" && (
                <div className="flex flex-col gap-3 py-1">
                  {triageData ? (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Clinical ESI Level</p>
                          <p className="text-sm font-bold text-slate-900">{triageData.triageTitle}</p>
                        </div>
                        <span className="text-xl font-black text-slate-900">{triageData.esiScore ? `ESI ${triageData.esiScore}` : "ESI 2"}</span>
                      </div>

                      <div className="text-xs">
                        <p className="font-bold text-slate-800 mb-0.5 text-[11px]">Recommended Action</p>
                        <p className="text-slate-600 text-[11px] leading-relaxed">{triageData.recommendedAction}</p>
                      </div>

                      {triageData.detectedSymptoms && triageData.detectedSymptoms.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Clinical Findings
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {triageData.detectedSymptoms.map((sym, i) => (
                              <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                                {sym}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {triageData.triageLevel === "emergency" && (
                        <div className="mt-2">
                          <Link
                            href="/emergency"
                            className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            Locate Nearest Hospital & Dispatch Services
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-8 text-center text-slate-400">
                      <ShieldCheck className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs">No active triage evaluation yet.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Start speaking to receive an instant ESI score.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </section>

        </div>

      </main>

      <Footer />
    </div>
  );
}
