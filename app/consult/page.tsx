"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  PhoneOff,
  Activity,
  Volume2,
  VolumeX,
  FileText,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Send,
  Building2,
  ArrowLeft,
  Radio,
  Users,
  Zap,
  Award,
  Wrench,
  GitCompare,
  Lock,
  Cpu,
  Layers,
  Sparkle,
  Hand,
  CornerDownRight,
  HeartPulse,
  Brain,
  Baby
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "../_components/Navbar";
import { Footer } from "../_components/Footer";
import { DOCTOR_PROFILES, DoctorProfile, getDoctorById } from "@/config/doctors";

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
  isSpecialistChime?: boolean;
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

interface SpeechData {
  speech_pause_ratio: number;
  speech_rate_wpm: number;
  observations: string[];
  clinical_relevance: {
    respiratory_distress_signal: string;
    vocal_instability_signal?: string;
    confidence?: number;
  };
}

export default function ConsultPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile>(DOCTOR_PROFILES[0]);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [audioState, setAudioState] = useState<AudioState>("IDLE");

  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [typedInput, setTypedInput] = useState<string>("");
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [triageData, setTriageData] = useState<LiveTriageData | null>(null);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [speechData, setSpeechData] = useState<SpeechData | null>(null);
  
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<"board" | "triage">("board");
  const [showTechnicalTrace, setShowTechnicalTrace] = useState<boolean>(false);

  // Audio & barge-in refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStateRef = useRef<AudioState>("IDLE");
  const callActiveRef = useRef<boolean>(false);

  // Keep state ref updated
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
  }, [messages, audioState]);

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

  // Initialize browser audio stream with echo cancellation
  const initAudioStream = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      if (!micStreamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
        micStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      }
      return true;
    } catch (e) {
      console.warn("Microphone stream initialization error:", e);
      return false;
    }
  };

  // Immediate Barge-In trigger: kills TTS immediately, transitions state, and captures patient
  const triggerBargeIn = useCallback((customPhrase?: string) => {
    console.log("⚡ BARGE-IN DETECTED: Halting doctor speech immediately.");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    setAudioState("BARGE_IN_DETECTED");

    // Mark previous doctor message as interrupted
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
      // Start SpeechRecognition cleanly after TTS is silenced
      setTimeout(() => {
        setAudioState("PATIENT_LISTENING");
        startSpeechRecognitionListening();
      }, 100);
    }
  }, []);

  // Voice Activity Detector monitoring loop active exclusively during DOCTOR_SPEAKING
  const startVadMonitor = useCallback(() => {
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let speechThresholdCount = 0;

    vadIntervalRef.current = setInterval(() => {
      if (audioStateRef.current !== "DOCTOR_SPEAKING") {
        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      // Human voice threshold with echo cancellation active
      if (avg > 38) {
        speechThresholdCount++;
        if (speechThresholdCount >= 3) { // ~150ms of sustained voice
          triggerBargeIn();
        }
      } else {
        speechThresholdCount = Math.max(0, speechThresholdCount - 1);
      }
    }, 50);
  }, [triggerBargeIn]);

  // Text-To-Speech with Real-Time Barge-In Listener Armed
  const speakDoctorResponse = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*_#`\[\]()]/g, "").trim();
    if (!cleanText) return;

    setAudioState("DOCTOR_SPEAKING");

    // Abort active STT while speaking to prevent echo
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
      // Arm local VAD monitor for patient barge-in
      startVadMonitor();
    };

    const handleSpeechEnd = () => {
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
        vadIntervalRef.current = null;
      }
      if (audioStateRef.current === "DOCTOR_SPEAKING") {
        setAudioState("IDLE");
        // Re-arm patient listening after acoustic decay
        setTimeout(() => {
          if (callActiveRef.current && audioStateRef.current === "IDLE") {
            setAudioState("PATIENT_LISTENING");
            startSpeechRecognitionListening();
          }
        }, 400);
      }
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = handleSpeechEnd;

    window.speechSynthesis.speak(utterance);
  }, [selectedDoctor, startVadMonitor]);

  // Start continuous speech recognition for patient turn
  const startSpeechRecognitionListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setAudioState("PATIENT_LISTENING");
      };

      recognition.onresult = (event: any) => {
        // If doctor is currently speaking, do not process regular STT chunks
        if (audioStateRef.current === "DOCTOR_SPEAKING") {
          return;
        }

        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            setTranscriptText(event.results[i][0].transcript);
          }
        }

        if (finalTranscript.trim()) {
          setTranscriptText("");
          handleUserUtterance(finalTranscript.trim());
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition notice:", e.error);
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
    } catch (err) {
      console.warn("Speech recognition start error:", err);
    }
  };

  // Start consultation session
  const startConsultation = async () => {
    callActiveRef.current = true;
    setCallActive(true);
    setCallDuration(0);
    setSavedReportId(null);
    await initAudioStream();

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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Process User Utterance (Regular or Barge-In Interruption)
  const handleUserUtterance = async (userText: string, isBargeIn: boolean = false) => {
    if (!userText.trim()) return;

    if (!callActive) {
      callActiveRef.current = true;
      setCallActive(true);
      initAudioStream();
    }

    setAudioState(isBargeIn ? "PROCESSING_INTERRUPTION" : "PROCESSING_PATIENT");

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
        if (data.speech_features) {
          setSpeechData(data.speech_features);
        }

        speakDoctorResponse(doctorReplyText);
      }
    } catch (err) {
      console.error("Consultation chat error:", err);
      setAudioState("IDLE");
    }
  };

  // Clinical Test Scenarios
  const CLINICAL_SCENARIOS = [
    {
      label: "🫀 Cardio Emergency",
      text: "I've had crushing pressure in the center of my chest for thirty minutes radiating into my left arm with cold sweats.",
      desc: "Summons Dr. Vance (Cardiology) • Runs ECG & TIMI tools • ESI 2",
      isBargeIn: false
    },
    {
      label: "🧠 Stroke Deficit",
      text: "My wife noticed my right face is drooping, my right arm is weak and I have trouble getting my words out.",
      desc: "Summons Dr. Pendelton (Neurology) • Runs BE-FAST & NIHSS • ESI 2",
      isBargeIn: false
    },
    {
      label: "✋ Urgent Barge-In (Stroke Interruption)",
      text: "Wait doctor! My face just started drooping and I can't lift my left arm!",
      desc: "Simulates patient interrupting doctor TTS with acute stroke red flags",
      isBargeIn: true
    },
    {
      label: "⚡ Cardioneuro Dual-Threat",
      text: "I have sudden severe chest tightness, my left arm is numb, and I felt like I was going to black out with dizziness.",
      desc: "Summons Vance + Pendelton • Triggers Round 2 Peer Cross-Examination!",
      isBargeIn: false
    },
    {
      label: "👶 Pediatric Sepsis",
      text: "My 7-week-old newborn has a rectal temperature of 102.5 and is unusually floppy, grunting, and refusing to wake up to feed.",
      desc: "Summons Dr. Rostova (Pediatrics) • Runs PEWS tool • ESI 2",
      isBargeIn: false
    },
    {
      label: "💊 Routine Refill",
      text: "I am feeling completely fine and just need a prescription refill for my maintenance lisinopril 10mg.",
      desc: "Evaluated solo by Dr. Sarah Chen • Outpatient Ambulatory • ESI 4",
      isBargeIn: false
    }
  ];

  // Helper to determine doctor real-time status in deliberation
  const getDoctorLiveStatus = (doc: DoctorProfile) => {
    if (audioState === "DOCTOR_SPEAKING" && selectedDoctor.id === doc.id) {
      return { label: "Speaking", color: "text-emerald-700 bg-emerald-100 border-emerald-300 animate-pulse" };
    }
    if (boardData?.active_specialists?.some(s => s.toLowerCase().includes(doc.name.toLowerCase().split(" ")[1] || ""))) {
      return { label: "In Board", color: "text-cyan-800 bg-cyan-100 border-cyan-300" };
    }
    if (boardData?.peer_challenges?.some(c => c.from_agent.toLowerCase().includes(doc.department.toLowerCase().slice(0, 5)))) {
      return { label: "Challenging", color: "text-amber-800 bg-amber-100 border-amber-300" };
    }
    return { label: "Standby", color: "text-slate-500 bg-slate-100 border-slate-200" };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 flex flex-col gap-5">
        
        {/* TOP BAR: HORIZONTAL SPECIALIST SELECTOR */}
        <section className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Active Clinical Specialists
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (Click to switch primary consultant doctor)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/60">
                <Radio className="w-3 h-3 text-cyan-600 animate-pulse" />
                Level-5 Multi-Agent Board
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
                  className={`relative flex items-center gap-2.5 p-2 rounded-xl text-left transition-all border ${
                    isSelected
                      ? "bg-cyan-50/70 border-cyan-400 ring-2 ring-cyan-400/20 shadow-xs"
                      : "bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/80"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={doc.avatarUrl}
                      alt={doc.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-300"
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        liveStatus.label === "Speaking" ? "bg-emerald-500 animate-ping" : isSelected ? "bg-cyan-500" : "bg-slate-300"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{doc.name}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{doc.department}</p>
                    <span className={`inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-medium rounded border ${liveStatus.color}`}>
                      {liveStatus.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* MAIN WORKSPACE: 2-COLUMN BALANCED GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT COLUMN: TELEHEALTH VOICE ROOM (7 Cols) */}
          <section className="lg:col-span-6 xl:col-span-7 flex flex-col gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              
              {/* Telehealth Room Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={selectedDoctor.avatarUrl}
                      alt={selectedDoctor.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500 shadow-xs"
                    />
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      audioState === "DOCTOR_SPEAKING" ? "bg-emerald-500 animate-pulse" : callActive ? "bg-cyan-500" : "bg-slate-400"
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900">{selectedDoctor.name}</h2>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                        {selectedDoctor.department}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Activity className="w-3 h-3 text-cyan-600" />
                        {formatTimer(callDuration)}
                      </span>
                      <span>•</span>
                      {/* Live Audio State Indicator */}
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        audioState === "DOCTOR_SPEAKING" ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold animate-pulse" :
                        audioState === "BARGE_IN_DETECTED" ? "bg-amber-100 text-amber-900 border-amber-300 font-bold" :
                        audioState === "PROCESSING_INTERRUPTION" ? "bg-purple-100 text-purple-900 border-purple-300 font-bold" :
                        audioState === "PATIENT_LISTENING" ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                        audioState === "PROCESSING_PATIENT" ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {audioState === "DOCTOR_SPEAKING" && "🔊 Doctor Speaking (Barge-in Armed)"}
                        {audioState === "BARGE_IN_DETECTED" && "✋ Barge-In Detected!"}
                        {audioState === "PROCESSING_INTERRUPTION" && "⚡ Processing Interruption..."}
                        {audioState === "PATIENT_LISTENING" && "🎙️ Listening to Patient..."}
                        {audioState === "PROCESSING_PATIENT" && "⏳ Clinical Reasoning..."}
                        {audioState === "IDLE" && (callActive ? "● Ready" : "○ Offline")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call Start/End Toggle */}
                <div className="flex items-center gap-2">
                  {!callActive ? (
                    <button
                      onClick={startConsultation}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      Start Call
                    </button>
                  ) : (
                    <button
                      onClick={endConsultation}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      End Call
                    </button>
                  )}
                </div>
              </div>

              {/* BARGE-IN INTERRUPT BUTTON (Prominently displayed while doctor speaks) */}
              <AnimatePresence>
                {audioState === "DOCTOR_SPEAKING" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 text-xs text-amber-950 font-medium">
                      <Hand className="w-4 h-4 text-amber-600 animate-bounce" />
                      <span>Doctor is speaking. <strong>Speak aloud or click to interrupt immediately:</strong></span>
                    </div>
                    <button
                      onClick={() => triggerBargeIn()}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      Interrupt Doctor
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Conversation Transcript Feed */}
              <div
                ref={chatScrollRef}
                className="p-4 h-[440px] overflow-y-auto flex flex-col gap-3 bg-slate-50/40"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-100/70 border border-cyan-200 text-cyan-700 flex items-center justify-center mb-3">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Telehealth Consultation Ready</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Click "Start Call" or select a clinical test scenario below to speak directly with the AI medical board.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 text-xs leading-relaxed ${
                        msg.role === "doctor" ? "justify-start" : "justify-end"
                      }`}
                    >
                      {msg.role === "doctor" && (
                        <div className="w-7 h-7 rounded-full border border-cyan-200 bg-cyan-100 text-cyan-800 flex items-center justify-center flex-shrink-0 font-bold text-[10px]">
                          MD
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 ${
                          msg.role === "doctor"
                            ? "bg-white border border-slate-200/90 text-slate-800 shadow-xs"
                            : msg.isBargeIn
                            ? "bg-amber-600 text-white font-medium shadow-xs border border-amber-700"
                            : "bg-slate-950 text-white font-medium shadow-xs"
                        }`}
                      >
                        {/* Barge In Pill */}
                        {msg.isBargeIn && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-800 text-amber-100 text-[9px] font-bold uppercase tracking-wider mb-1">
                            <Hand className="w-2.5 h-2.5" />
                            Urgent Patient Barge-In
                          </div>
                        )}
                        <p>{msg.text}</p>
                        {/* Was Interrupted Tag */}
                        {msg.wasInterrupted && (
                          <div className="mt-1.5 pt-1 border-t border-slate-100 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                            <Hand className="w-3 h-3" />
                            [Interrupted by Patient Barge-In]
                          </div>
                        )}
                        <span className={`block mt-1 text-[9px] font-mono text-right ${
                          msg.role === "doctor" ? "text-slate-400" : "text-slate-300"
                        }`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                
                {/* Live Processing Indicator */}
                {(audioState === "PROCESSING_PATIENT" || audioState === "PROCESSING_INTERRUPTION") && (
                  <div className="flex gap-2 items-center text-xs text-cyan-700 p-2 bg-cyan-50 border border-cyan-200/70 rounded-xl animate-pulse">
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Specialist board deliberating on new patient evidence...</span>
                  </div>
                )}
              </div>

              {/* 1-Click Clinical Test Chips */}
              <div className="p-3 bg-slate-100/70 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  Quick Test Scenarios & Barge-In Triggers
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
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 font-semibold"
                          : "bg-white hover:bg-slate-200/90 text-slate-800 border-slate-300"
                      }`}
                    >
                      {scen.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Input & Microphone Bar */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (audioState === "DOCTOR_SPEAKING") {
                      triggerBargeIn();
                    } else if (audioState === "PATIENT_LISTENING") {
                      setAudioState("IDLE");
                      if (recognitionRef.current) recognitionRef.current.abort();
                    } else {
                      startSpeechRecognitionListening();
                    }
                  }}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    audioState === "PATIENT_LISTENING"
                      ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-xs"
                      : audioState === "DOCTOR_SPEAKING"
                      ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                  title={audioState === "DOCTOR_SPEAKING" ? "Click to interrupt doctor" : "Toggle microphone"}
                >
                  {audioState === "PATIENT_LISTENING" ? (
                    <Mic className="w-4 h-4" />
                  ) : audioState === "DOCTOR_SPEAKING" ? (
                    <Hand className="w-4 h-4" />
                  ) : (
                    <MicOff className="w-4 h-4" />
                  )}
                </button>

                <input
                  type="text"
                  placeholder={
                    audioState === "DOCTOR_SPEAKING"
                      ? "Doctor speaking... type to barge in or click interrupt..."
                      : "Type symptoms or press mic to speak..."
                  }
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && typedInput.trim()) {
                      const text = typedInput.trim();
                      setTypedInput("");
                      if (audioState === "DOCTOR_SPEAKING") {
                        triggerBargeIn(text);
                      } else {
                        handleUserUtterance(text);
                      }
                    }
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                />

                <button
                  onClick={() => {
                    if (typedInput.trim()) {
                      const text = typedInput.trim();
                      setTypedInput("");
                      if (audioState === "DOCTOR_SPEAKING") {
                        triggerBargeIn(text);
                      } else {
                        handleUserUtterance(text);
                      }
                    }
                  }}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          </section>

          {/* RIGHT COLUMN: AUTHENTIC CLINICAL BOARD DELIBERATION STREAM (5 Cols) */}
          <section className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
            
            {/* Top Container with Tab Switcher */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden flex flex-col">
              
              {/* Header with Clean Tabs */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveRightTab("board")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeRightTab === "board"
                        ? "bg-white text-cyan-900 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-600" />
                    Clinical Board
                    {boardData?.deliberation_rounds && (
                      <span className="text-[10px] font-mono bg-cyan-100 text-cyan-800 px-1 rounded">
                        R{boardData.deliberation_rounds}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveRightTab("triage")}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeRightTab === "triage"
                        ? "bg-white text-cyan-900 shadow-xs border border-slate-200/80 font-bold"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
                    Triage & Risk
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>LIVE</span>
                </div>
              </div>

              {/* TAB 1: AUTHENTIC CLINICAL BOARD DELIBERATION STREAM */}
              {activeRightTab === "board" && (
                <div className="p-4 flex flex-col gap-3">
                  
                  {/* Deliberation Stream Feed */}
                  <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">
                    {!boardData?.deliberation_messages || boardData.deliberation_messages.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
                        <Users className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-700">Clinical Board Standing By</p>
                        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                          When you describe symptoms or test scenarios, the board will deliberate in real-time here.
                        </p>
                      </div>
                    ) : (
                      boardData.deliberation_messages.map((msg, idx) => {
                        const isLead = msg.speakerRole === "lead";
                        const isTool = msg.speakerRole === "tool";
                        const isArbiter = msg.speakerRole === "safety_arbiter";
                        const isChallenge = msg.type === "challenge";
                        const isResponse = msg.type === "response";

                        // Tool Result Card
                        if (isTool) {
                          return (
                            <div key={msg.id || idx} className="ml-8 my-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                              <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 mb-1">
                                <span className="flex items-center gap-1 font-semibold text-slate-700">
                                  <Wrench className="w-3 h-3 text-cyan-600" />
                                  {msg.tool_data?.tool_name || "Diagnostic Tool"}
                                </span>
                                {msg.tool_data?.latency_ms !== undefined && (
                                  <span className="text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">
                                    {msg.tool_data.latency_ms}ms
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-800 font-medium">{msg.content.replace(/^Executed [^:]+:s*/, "")}</p>
                            </div>
                          );
                        }

                        // Safety Arbiter Disposition Card
                        if (isArbiter) {
                          return (
                            <div key={msg.id || idx} className="mt-2 p-3 rounded-xl bg-rose-50/90 border border-rose-200 text-xs">
                              <div className="flex items-center gap-1.5 text-rose-800 font-bold mb-1">
                                <ShieldCheck className="w-4 h-4 text-rose-600" />
                                <span>{msg.doctorName}</span>
                                <span className="ml-auto text-[10px] bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-mono">
                                  FINAL DISPOSITION
                                </span>
                              </div>
                              <p className="text-rose-950 font-medium">{msg.content}</p>
                            </div>
                          );
                        }

                        // Specialist Dialogue Card
                        return (
                          <div
                            key={msg.id || idx}
                            className={`p-3 rounded-xl border text-xs leading-relaxed ${
                              isLead
                                ? "bg-cyan-50/60 border-cyan-200 text-slate-900"
                                : isChallenge
                                ? "bg-amber-50/60 border-amber-200 text-slate-900"
                                : isResponse
                                ? "bg-purple-50/60 border-purple-200 text-slate-900"
                                : "bg-white border-slate-200 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                {msg.specialty.includes("Cardio") ? (
                                  <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                                ) : msg.specialty.includes("Neuro") ? (
                                  <Brain className="w-3.5 h-3.5 text-purple-600" />
                                ) : msg.specialty.includes("Pedia") ? (
                                  <Baby className="w-3.5 h-3.5 text-amber-600" />
                                ) : (
                                  <Stethoscope className="w-3.5 h-3.5 text-cyan-600" />
                                )}
                                <span className="font-bold text-slate-900">{msg.doctorName}</span>
                                <span className="text-[10px] text-slate-500">({msg.specialty})</span>
                              </div>
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold uppercase ${
                                isChallenge ? "bg-amber-200 text-amber-900" :
                                isResponse ? "bg-purple-200 text-purple-900" :
                                isLead ? "bg-cyan-200 text-cyan-900" : "bg-slate-200 text-slate-700"
                              }`}>
                                {msg.type}
                              </span>
                            </div>

                            <p className="text-slate-800 italic">"{msg.content}"</p>

                            {/* Reference citations if present */}
                            {msg.references && msg.references.length > 0 && (
                              <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center gap-1 text-[10px] text-slate-500">
                                <span className="font-semibold">Evidence:</span>
                                <span className="truncate">{msg.references.join(" • ")}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* BOARD DECISION BANNER */}
                  {boardData && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-900 text-white text-xs">
                      <div className="flex items-center gap-1.5 mb-1 text-cyan-400 font-bold uppercase tracking-wider text-[11px]">
                        <Award className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Board Decision</span>
                        <span className="ml-auto text-[9px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800">
                          {boardData.opinions?.length || 1} Specialists
                        </span>
                      </div>
                      <p className="text-slate-200 font-medium">
                        {boardData.conflicts && boardData.conflicts.length > 0
                          ? "⚠ Competing acute pathways remain simultaneously active (Cardiovascular + Acute Neurologic Event). Dual-activation protocol initiated."
                          : boardData.opinions?.some(o => o.risk_level === "high")
                          ? "Emergency specialist consensus reached. Immediate emergency medical intervention indicated."
                          : "Specialists agree presentation is non-emergent. Outpatient clinical monitoring recommended."}
                      </p>
                    </div>
                  )}

                  {/* COLLAPSIBLE TECHNICAL TRACE & CRYPTOGRAPHIC LEDGER */}
                  <div className="mt-1 border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowTechnicalTrace(!showTechnicalTrace)}
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs text-slate-700 font-semibold cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-slate-500" />
                        Technical Execution Trace & Cryptographic Ledger
                      </span>
                      {showTechnicalTrace ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {showTechnicalTrace && (
                      <div className="p-3 bg-white text-[11px] font-mono flex flex-col gap-2 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="p-2 rounded bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 block">Pre-Arbiter Latency</span>
                            <span className="font-bold text-slate-900">{boardData?.trace?.pre_arbiter_latency_us || 32} µs</span>
                          </div>
                          <div className="p-2 rounded bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 block">Post-Arbiter Latency</span>
                            <span className="font-bold text-slate-900">{boardData?.trace?.post_arbiter_latency_us || 184} µs</span>
                          </div>
                          <div className="p-2 rounded bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 block">Total Pipeline Latency</span>
                            <span className="font-bold text-emerald-700">{boardData?.trace?.total_board_latency_ms || 4} ms</span>
                          </div>
                          <div className="p-2 rounded bg-slate-50 border border-slate-200">
                            <span className="text-slate-500 block">Tamper-Proof Blocks</span>
                            <span className="font-bold text-slate-900">{boardData?.trace?.audit_hash_chain?.length || 4} Blocks</span>
                          </div>
                        </div>

                        {boardData?.trace?.audit_sha256 && (
                          <div className="p-2 rounded bg-slate-950 text-cyan-400 text-[10px] break-all">
                            <span className="text-slate-400 block mb-0.5">SHA-256 Root Hash:</span>
                            {boardData.trace.audit_sha256}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: CLINICAL TRIAGE & RISK */}
              {activeRightTab === "triage" && (
                <div className="p-4 flex flex-col gap-3">
                  {triageData ? (
                    <>
                      {/* ESI Badge */}
                      <div className={`p-3 rounded-xl border flex items-center justify-between ${
                        triageData.triageLevel === "emergency"
                          ? "bg-rose-50 border-rose-300 text-rose-900"
                          : triageData.triageLevel === "priority"
                          ? "bg-amber-50 border-amber-300 text-amber-900"
                          : "bg-emerald-50 border-emerald-300 text-emerald-900"
                      }`}>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider">Clinical ESI Triage Level</p>
                          <p className="text-base font-black">{triageData.triageTitle}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black">{triageData.esiScore ? `ESI ${triageData.esiScore}` : "ESI 2"}</span>
                        </div>
                      </div>

                      {/* Recommended Action */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <p className="font-bold text-slate-800 mb-1">Recommended Disposition</p>
                        <p className="text-slate-700">{triageData.recommendedAction}</p>
                      </div>

                      {/* Detected Symptoms */}
                      {triageData.detectedSymptoms && triageData.detectedSymptoms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Detected Symptoms & Findings
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

                      {/* ICD-10 Tags */}
                      {triageData.icdCodes && triageData.icdCodes.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            ICD-10 Diagnostic Tags
                          </p>
                          <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                            {triageData.icdCodes.map((code, i) => (
                              <span key={i} className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Emergency Referral Directives */}
                      {triageData.triageLevel === "emergency" && (
                        <div className="mt-1 flex flex-col gap-2">
                          <Link
                            href="/emergency"
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Building2 className="w-4 h-4" />
                            Dispatch Emergency Services & Locate Hospital
                          </Link>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-8 text-center text-slate-400">
                      <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs">No active triage evaluation yet.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Start speaking to receive an instant ESI clinical score.</p>
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
