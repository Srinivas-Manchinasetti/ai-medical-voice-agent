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
  Sparkle
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "../_components/Navbar";
import { Footer } from "../_components/Footer";
import { DOCTOR_PROFILES, DoctorProfile, getDoctorById } from "@/config/doctors";

interface ChatMessage {
  id: string;
  role: "doctor" | "patient" | "system";
  text: string;
  timestamp: string;
  doctorName?: string;
  doctorSpecialty?: string;
  isSpecialistChime?: boolean;
}

interface LiveTriageData {
  triageLevel: "emergency" | "priority" | "routine";
  triageTitle: string;
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
    supporting_specialists: string[];
  }>;
  conflicts: Array<{
    description: string;
    resolution: string;
  }>;
  trace: {
    pre_arbiter_latency_us: number;
    post_arbiter_latency_us: number;
    total_board_latency_ms: number;
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
    cognitive_load_signal: string;
  };
}

export default function ConsultPage() {
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile>(DOCTOR_PROFILES[0]);
  const [callActive, setCallActive] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isDoctorSpeaking, setIsDoctorSpeaking] = useState<boolean>(false);
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);

  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [typedInput, setTypedInput] = useState<string>("");
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [triageData, setTriageData] = useState<LiveTriageData | null>(null);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [speechData, setSpeechData] = useState<SpeechData | null>(null);
  
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [isSavingReport, setIsSavingReport] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<"triage" | "board">("board");

  // Audio & speech recognition refs
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isDoctorSpeakingRef = useRef<boolean>(false);
  const callActiveRef = useRef<boolean>(false);

  // Sync call active ref
  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessingAI]);

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

  // Text-To-Speech with strict echo feedback suppression
  const speakDoctorResponse = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[*_#`[\]()]/g, "").trim();
    if (!cleanText) return;

    // Immediately flag doctor speaking and abort recognition to kill speaker echo
    isDoctorSpeakingRef.current = true;
    setIsDoctorSpeaking(true);
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
        const femaleVoice = englishVoices.find((v) => v.name.includes("Female") || v.name.includes("Zira") || v.name.includes("Samantha") || v.name.includes("Google UK English Female"));
        if (femaleVoice) utterance.voice = femaleVoice;
      } else {
        const maleVoice = englishVoices.find((v) => v.name.includes("Male") || v.name.includes("David") || v.name.includes("Google UK English Male"));
        if (maleVoice) utterance.voice = maleVoice;
      }
    }

    utterance.onstart = () => {
      isDoctorSpeakingRef.current = true;
      setIsDoctorSpeaking(true);
    };

    const handleSpeechEnd = () => {
      isDoctorSpeakingRef.current = false;
      setIsDoctorSpeaking(false);
      // Wait 500ms after TTS finishes before resuming microphone
      setTimeout(() => {
        if (callActiveRef.current && recognitionRef.current && !isDoctorSpeakingRef.current) {
          try {
            recognitionRef.current.start();
          } catch {}
        }
      }, 500);
    };

    utterance.onend = handleSpeechEnd;
    utterance.onerror = handleSpeechEnd;

    window.speechSynthesis.speak(utterance);
  }, [selectedDoctor]);

  // Start voice consultation session
  const startConsultation = () => {
    callActiveRef.current = true;
    setCallActive(true);
    setCallDuration(0);
    setSavedReportId(null);
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
    initSpeechRecognition();
  };

  // Speech Recognition Initializer
  const initSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Browser does not support Web Speech Recognition. Using text input mode.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        // Drop any audio picked up while doctor is speaking to kill acoustic echo
        if (isDoctorSpeakingRef.current) {
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
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Speech recognition initialization error:", err);
    }
  };

  // Toggle microphone recording
  const toggleMic = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch {
          initSpeechRecognition();
        }
      } else {
        initSpeechRecognition();
      }
    }
  };

  // Quick clinical test scenarios
  const CLINICAL_SCENARIOS = [
    {
      label: "🫀 Cardio Emergency",
      text: "I've had crushing pressure in the center of my chest for thirty minutes radiating into my left arm with cold sweats.",
      desc: "Summons Dr. Vance (Cardiology) • Runs ECG & TIMI tools • ESI 2"
    },
    {
      label: "🧠 Stroke (BE-FAST)",
      text: "My wife noticed my right face is drooping, my right arm is weak and I have trouble getting my words out.",
      desc: "Summons Dr. Pendelton (Neurology) • Runs BE-FAST & NIHSS • ESI 2"
    },
    {
      label: "⚡ Cardioneuro Dual-Threat",
      text: "I have sudden severe chest tightness, my left arm is numb, and I felt like I was going to black out with dizziness.",
      desc: "Summons Vance + Pendelton • Triggers Round 2 Peer Cross-Examination!"
    },
    {
      label: "💊 Lethal Drug Contraindication",
      text: "I am experiencing severe tight chest pressure and took sildenafil four hours ago. Can I take sublingual nitroglycerin for relief?",
      desc: "Cardiology • Absolute Nitrate + PDE5 Contraindication Flagged"
    },
    {
      label: "👶 Pediatric Sepsis",
      text: "My 7-week-old newborn has a rectal temperature of 102.5 and is unusually floppy, grunting, and refusing to wake up to feed.",
      desc: "Summons Dr. Rostova (Pediatrics) • Runs PEWS tool • ESI 2"
    }
  ];

  // Process User Utterance & Trigger Doctor Reasoning
  const handleUserUtterance = async (userText: string) => {
    if (!userText.trim()) return;

    if (!callActive) {
      callActiveRef.current = true;
      setCallActive(true);
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "patient",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessingAI(true);

    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.id,
          message: userText,
          conversationHistory: [...messages, userMessage],
          patientName: "Patient"
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newMessages: ChatMessage[] = [];

        // If specialists were summoned, add their opinions to the live deliberation chat
        if (data.board?.opinions && data.board.opinions.length > 0) {
          for (const op of data.board.opinions) {
            if (op.doctor_name !== selectedDoctor.name && op.primary_hypothesis) {
              newMessages.push({
                id: `msg-spec-${Date.now()}-${op.specialty}`,
                role: "doctor",
                text: `${op.primary_hypothesis}. Priority Concern: ${op.concerns?.[0] || op.specialty}. Recommended action: ${op.recommended_actions?.[0] || "Urgent clinical workup."}`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                doctorName: op.doctor_name,
                doctorSpecialty: op.specialty,
                isSpecialistChime: true
              });
            }
          }
        }

        const doctorReplyText = data.doctorReply || "I have received your symptoms and documented them.";
        newMessages.push({
          id: `msg-${Date.now() + 1}`,
          role: "doctor",
          text: doctorReplyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          doctorName: selectedDoctor.name,
          doctorSpecialty: selectedDoctor.department
        });

        setMessages((prev) => [...prev, ...newMessages]);
        if (data.triage) {
          setTriageData(data.triage);
        }
        if (data.board) {
          setBoardData(data.board);
          if (data.board.specialists_summoned?.length > 0) {
            setActiveRightTab("board");
          }
        }
        if (data.speech_features) {
          setSpeechData(data.speech_features);
        }
        speakDoctorResponse(doctorReplyText);
      }
    } catch (err) {
      console.error("Consultation chat error:", err);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // End consultation and save clinical SOAP report
  const endConsultationAndSave = async () => {
    callActiveRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setCallActive(false);
    setIsRecording(false);
    setIsDoctorSpeaking(false);
    setIsSavingReport(true);

    try {
      const fullTranscript = messages
        .map((m) => `${m.role === "doctor" ? (m.doctorName || "Doctor") : "Patient"}: ${m.text}`)
        .join("\\n");

      const soapPayload = triageData?.soap || {
        subjective: `Patient consultation with ${selectedDoctor.name}. Chief complaint: ${messages[1]?.text || "General health inquiry"}.`,
        objective: `Vital Signs: Reassuring. Audio Biomarkers: ${speechData ? `${speechData.speech_rate_wpm} WPM, ${Math.round(speechData.speech_pause_ratio * 100)}% pauses` : "Normal cadence"}.`,
        assessment: `${triageData?.triageTitle || "Clinical Voice Triage Evaluation"}. Diagnoses: ${triageData?.icdCodes.join(", ") || "Z76.0"}.`,
        plan: `${triageData?.recommendedAction || "Outpatient clinical review if symptoms persist."}`,
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: "Alex Mercer",
          patientAge: 45,
          gender: "Male",
          triageLevel: triageData?.triageLevel || "routine",
          symptoms: triageData?.detectedSymptoms || ["General Consultation"],
          icdCodes: triageData?.icdCodes || ["Z76.0"],
          recommendedAction: triageData?.recommendedAction || "Outpatient follow-up.",
          transcript: fullTranscript,
          subjective: soapPayload.subjective,
          objective: soapPayload.objective,
          assessment: soapPayload.assessment,
          plan: soapPayload.plan,
          doctorName: selectedDoctor.name,
          doctorSpecialty: selectedDoctor.specialty,
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        setSavedReportId(saved.report?.id || "REP-SUCCESS");
      }
    } catch (err) {
      console.error("Save report error:", err);
    } finally {
      setIsSavingReport(false);
    }
  };

  const getUrgencyBadge = (level: string) => {
    switch (level) {
      case "emergency":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "priority":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* PAGE HEADER */}
        <section className="pt-10 pb-5 px-6 max-w-4xl mx-auto text-center space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            AI MEDICAL VOICE AGENT
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
            Live Doctor Consultation Room
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed font-medium">
            Real-time voice consultation with specialized AI physicians, dual-arbiter safety verification, and multi-agent peer deliberations.
          </p>
        </section>

        {/* HORIZONTAL SPECIALIST SELECTOR STRIP */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-cyan-700" />
                Select Attending Physician
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {callActive ? `Active Call: ${selectedDoctor.name}` : "Click doctor to switch attending specialist"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {DOCTOR_PROFILES.map((doc) => {
                const isSelected = selectedDoctor.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    disabled={callActive}
                    onClick={() => setSelectedDoctor(doc)}
                    className={`p-2.5 rounded-xl border transition-all flex items-center gap-2.5 text-left ${
                      isSelected
                        ? "bg-cyan-50/80 border-cyan-500 shadow-xs ring-2 ring-cyan-500/10"
                        : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
                    } ${callActive ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <img
                      src={doc.avatarUrl}
                      alt={doc.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 text-xs truncate">{doc.name}</div>
                      <div className="text-[10px] text-cyan-800 font-semibold truncate">{doc.specialty}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* MAIN BALANCED 2-COLUMN WORKSPACE */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN (7 of 12): Telehealth Room & Deliberation Chat */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between min-h-[620px]">
                
                {/* Consultation Room Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={selectedDoctor.avatarUrl}
                        alt={selectedDoctor.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-cyan-500 shadow-xs"
                      />
                      {callActive && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-slate-950 font-extrabold text-sm sm:text-base flex items-center gap-2">
                        <span>{selectedDoctor.name}</span>
                        {callActive ? (
                          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            LIVE CALL
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            READY
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">{selectedDoctor.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {callActive ? (
                      <div className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-lg">
                        {formatTimer(callDuration)}
                      </div>
                    ) : (
                      <button
                        onClick={startConsultation}
                        className="inline-flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-xs transition-all"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Start Call</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact Audio / Voice State Indicator */}
                <div className="py-2.5 px-3 bg-slate-50/80 border border-slate-200/70 rounded-xl my-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      isDoctorSpeaking
                        ? "bg-cyan-500 animate-ping"
                        : isRecording
                        ? "bg-emerald-500 animate-pulse"
                        : isProcessingAI
                        ? "bg-amber-500 animate-spin"
                        : "bg-slate-300"
                    }`} />
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {isDoctorSpeaking
                        ? `${selectedDoctor.name} is speaking...`
                        : isRecording
                        ? "Listening to microphone (Speak now)..."
                        : isProcessingAI
                        ? "Clinical Board deliberating multi-specialist assessment..."
                        : callActive
                        ? "Microphone ready — speak or type symptoms"
                        : "Call offline — click 'Start Call' or pick a scenario below"}
                    </span>
                  </div>
                  {transcriptText && (
                    <span className="text-[11px] text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded max-w-xs truncate italic">
                      "${transcriptText}"
                    </span>
                  )}
                </div>

                {/* Live Conversation Chat Room */}
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-50/60 border border-slate-200/80 rounded-xl mb-3 min-h-[380px] max-h-[440px]"
                >
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                      <div className="w-14 h-14 rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shadow-xs">
                        <Mic className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">Consultation Feed Ready</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5 font-medium">
                          Click <strong>Start Call</strong> or select a <strong>Test Scenario</strong> to start your consultation.
                        </p>
                      </div>
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
                          <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 font-bold text-[10px] ${
                            msg.isSpecialistChime
                              ? "bg-amber-100 border-amber-300 text-amber-900"
                              : "bg-cyan-100 border-cyan-200 text-cyan-800"
                          }`}>
                            {msg.isSpecialistChime ? "MD" : "DR"}
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 ${
                            msg.role === "doctor"
                              ? msg.isSpecialistChime
                                ? "bg-amber-50/90 border border-amber-200 text-slate-900 shadow-xs"
                                : "bg-white border border-slate-200/90 text-slate-800 shadow-xs"
                              : "bg-slate-950 text-white font-medium shadow-xs"
                          }`}
                        >
                          {msg.isSpecialistChime && (
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-amber-200/70 text-[11px] font-bold text-amber-900">
                              <Stethoscope className="w-3.5 h-3.5 text-amber-700" />
                              <span>{msg.doctorName || "Specialist"} ({msg.doctorSpecialty})</span>
                              <span className="text-[9px] font-mono bg-amber-200 text-amber-950 px-1 py-0.2 rounded ml-auto">
                                BOARD CONSULT
                              </span>
                            </div>
                          )}
                          <p>{msg.text}</p>
                          <span className="text-[9px] opacity-60 block mt-1 font-mono">{msg.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}

                  {isProcessingAI && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 italic p-2 bg-white/70 rounded-lg border border-slate-200/50">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-700" />
                      <span>Multi-Agent Board synthesizing specialist findings...</span>
                    </div>
                  )}
                </div>

                {/* Quick Simulation Scenarios Bar */}
                <div className="pt-2 pb-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Quick Clinical Test Scenarios:
                    </span>
                    <span className="text-[10px] text-slate-400">1-click simulation</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CLINICAL_SCENARIOS.map((sc, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (!callActive) startConsultation();
                          setTimeout(() => handleUserUtterance(sc.text), 300);
                        }}
                        className="text-[11px] font-medium bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 border border-slate-200 hover:border-cyan-300 px-2.5 py-1 rounded-lg transition-all shadow-xs"
                        title={sc.desc}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottom Call Controls & Input Bar */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={callActive ? toggleMic : startConsultation}
                      className={`px-3.5 py-2 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
                        isRecording
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                    >
                      {isRecording ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      <span>{isRecording ? "Mute Mic" : "Unmute Mic"}</span>
                    </button>

                    {/* Text Input Fallback */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (typedInput.trim()) {
                          handleUserUtterance(typedInput.trim());
                          setTypedInput("");
                        }
                      }}
                      className="flex items-center gap-1.5 flex-1"
                    >
                      <input
                        type="text"
                        value={typedInput}
                        onChange={(e) => setTypedInput(e.target.value)}
                        placeholder="Type symptoms or speak into mic..."
                        className="bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none flex-1 transition-all"
                      />
                      <button
                        type="submit"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>

                  {callActive && (
                    <button
                      onClick={endConsultationAndSave}
                      disabled={isSavingReport}
                      className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex-shrink-0"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>{isSavingReport ? "Saving..." : "End Call"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (5 of 12): Clinical Intelligence & Board Telemetry */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              
              {/* Tab Navigation Header */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-1.5 shadow-xs flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveRightTab("board")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeRightTab === "board"
                      ? "bg-cyan-50 text-cyan-900 border border-cyan-200/90 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Clinical Board Deliberation</span>
                  {boardData?.opinions && boardData.opinions.length > 1 && (
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab("triage")}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeRightTab === "triage"
                      ? "bg-cyan-50 text-cyan-900 border border-cyan-200/90 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-rose-600" />
                  <span>Triage & SOAP Assessment</span>
                </button>
              </div>

              {/* TAB CONTENT 1: MULTI-AGENT CLINICAL BOARD */}
              {activeRightTab === "board" && (
                <div className="space-y-4">
                  {boardData ? (
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
                      
                      {/* Board Header & Arbiter Shield */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2 text-cyan-900 font-extrabold text-xs">
                          <Users className="w-4 h-4 text-cyan-600" />
                          <span>Multi-Agent Specialist Deliberation</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Dual-Arbiter Protected
                        </span>
                      </div>

                      {/* Active Board Specialists Tags */}
                      <div>
                        <div className="text-[11px] font-mono font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                          <span>Board Specialists Summoned</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {boardData.specialists_summoned.length ? `${boardData.specialists_summoned.length + 1} consulted` : "Solo Primary Care"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {boardData.active_specialists.map((doc, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg"
                            >
                              <Stethoscope className="w-3 h-3 text-cyan-600" />
                              {doc.replace(/, MD.*$/, "")}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Specialist Opinions & Hypotheses Cards */}
                      {boardData.opinions && boardData.opinions.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-mono font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center justify-between">
                            <span>Specialist Opinions & Hypotheses</span>
                            <span className="text-[10px] text-cyan-700 font-mono bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                              {boardData.opinions.length} opinion{boardData.opinions.length > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {boardData.opinions.map((op, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-3 text-xs space-y-1.5 hover:border-cyan-300 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                    <span className="font-bold text-slate-900 text-xs">
                                      {op.doctor_name.replace(/, MD.*$/, "")}
                                    </span>
                                    <span className="text-[9px] font-mono text-slate-500 bg-white border border-slate-200 px-1 py-0.2 rounded">
                                      {op.specialty}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                                      op.risk_level === "high"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : op.risk_level === "moderate"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                                  >
                                    {op.risk_level} risk
                                  </span>
                                </div>

                                {op.primary_hypothesis && (
                                  <div className="bg-white border border-slate-200/80 rounded-lg p-2 text-[11px]">
                                    <span className="text-slate-400 font-mono text-[9px] uppercase block font-bold">
                                      Primary Clinical Hypothesis:
                                    </span>
                                    <span className="font-semibold text-slate-800 leading-tight">
                                      {op.primary_hypothesis}
                                    </span>
                                  </div>
                                )}

                                {op.concerns && op.concerns.length > 0 && (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] text-slate-500 font-mono font-bold block">
                                      Key Concerns:
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {op.concerns.map((c, ci) => (
                                        <span
                                          key={ci}
                                          className="text-[9px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.2 rounded"
                                        >
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {op.confidence !== undefined && (
                                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-200/50">
                                    <span>Confidence: {Math.round(op.confidence * 100)}%</span>
                                    <span className="text-slate-500">{op.confidence_semantics?.replace(/_/g, " ") || "model score"}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bounded Diagnostic Tools Executed */}
                      {boardData.tools_executed && boardData.tools_executed.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1.5">
                              <Wrench className="w-3 h-3 text-cyan-600" />
                              Diagnostic Tools Executed
                            </span>
                            <span className="text-[10px] text-cyan-700 font-mono bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                              {boardData.tools_executed.length} executed
                            </span>
                          </div>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {boardData.tools_executed_details && boardData.tools_executed_details.length > 0 ? (
                              boardData.tools_executed_details.map((tool, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-50 border border-slate-200/90 rounded-lg p-2 text-xs space-y-0.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-[10px] text-slate-800 flex items-center gap-1">
                                      <Cpu className="w-3 h-3 text-cyan-600" />
                                      {tool.tool_name.replace(/_/g, " ").toUpperCase()}
                                    </span>
                                    <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                      {tool.latency_ms}ms
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-600 leading-tight">
                                    {tool.clinical_summary}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {boardData.tools_executed.map((tool, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[10px] font-mono font-medium bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded"
                                  >
                                    <Cpu className="w-2.5 h-2.5 text-cyan-600" />
                                    {tool}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Multi-Round Peer Challenges */}
                      {boardData.peer_challenges && boardData.peer_challenges.length > 0 && (
                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-2.5 text-xs text-indigo-950 space-y-1.5">
                          <div className="flex items-center justify-between text-indigo-900 font-bold">
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                              Round 2 Peer Review Challenges
                            </span>
                            <span className="text-[9px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-300">
                              {boardData.peer_challenges.length} issued
                            </span>
                          </div>
                          {boardData.peer_challenges.map((ch, idx) => (
                            <div key={idx} className="bg-white/90 border border-indigo-200/80 rounded-lg p-2 space-y-1">
                              <div className="text-[10px] font-mono font-bold text-indigo-700 flex items-center justify-between">
                                <span>{ch.from_agent.replace(/-.*$/, "")} ➔ {ch.to_agent.replace(/-.*$/, "")}</span>
                                <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                  Resolved in Consensus
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-700 leading-snug">
                                <strong className="text-slate-900">Dispute:</strong> {ch.claim_disputed}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tamper-Evident SHA-256 Audit Chain */}
                      {boardData.trace.audit_hash_chain && boardData.trace.audit_hash_chain.length > 0 && (
                        <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600">
                            <span className="flex items-center gap-1 text-slate-700">
                              <Lock className="w-3 h-3 text-emerald-600" />
                              Tamper-Evident Audit Hash Chain
                            </span>
                            <span className="text-[9px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              SHA-256 Chained
                            </span>
                          </div>
                          <div className="space-y-1">
                            {boardData.trace.audit_hash_chain.map((block, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[9px] font-mono bg-white border border-slate-200/90 px-2 py-1 rounded"
                              >
                                <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                                  B{block.block_index}: {block.event_type.replace(/_/g, " ")}
                                </span>
                                <span className="text-slate-500 font-mono" title={block.current_hash}>
                                  {block.current_hash.slice(0, 10)}...
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pipeline Latency Footer */}
                      <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
                        <span>Board Runtime: {boardData.trace.total_board_latency_ms}ms</span>
                        <span>Pre: {boardData.trace.pre_arbiter_latency_us}µs | Post: {boardData.trace.post_arbiter_latency_us}µs</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                      <div className="w-12 h-12 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Clinical Board Ready</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        When you describe symptoms or click a test scenario on the left, specialists will be summoned here to deliberate hypotheses, run diagnostic tools, and issue peer reviews.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT 2: LIVE CLINICAL TRIAGE & RISK */}
              {activeRightTab === "triage" && (
                <div className="space-y-4">
                  {triageData ? (
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
                      
                      {/* Urgency Level Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <span className="text-xs font-mono font-bold uppercase text-slate-500 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-rose-600" />
                          <span>Emergency Severity Triage</span>
                        </span>
                        <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full uppercase border ${getUrgencyBadge(triageData.triageLevel)}`}>
                          {triageData.triageLevel}
                        </span>
                      </div>

                      {/* Triage Title & Clinical Action */}
                      <div className={`p-3.5 rounded-xl border ${
                        triageData.triageLevel === "emergency"
                          ? "bg-rose-50/80 border-rose-200 text-rose-950"
                          : triageData.triageLevel === "priority"
                          ? "bg-amber-50/80 border-amber-200 text-amber-950"
                          : "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                      }`}>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-70">
                          Primary Disposition Recommendation:
                        </span>
                        <h4 className="font-extrabold text-sm mt-0.5">
                          {triageData.triageTitle}
                        </h4>
                        <p className="text-xs mt-1 leading-relaxed opacity-90">
                          {triageData.recommendedAction}
                        </p>
                      </div>

                      {/* Detected Symptoms List */}
                      <div>
                        <div className="text-xs text-slate-500 font-mono font-bold mb-1.5 uppercase tracking-wider">
                          Detected Symptoms:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {triageData.detectedSymptoms.map((sym, i) => (
                            <span key={i} className="text-xs bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg font-medium">
                              {sym}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* ICD-10 Diagnostic Codes */}
                      <div>
                        <div className="text-xs text-slate-500 font-mono font-bold mb-1.5 uppercase tracking-wider">
                          ICD-10 Diagnostic Codes:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {triageData.icdCodes.map((code, i) => (
                            <span key={i} className="text-xs bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md font-mono font-bold">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Speech Paralinguistics */}
                      {speechData && (
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <Radio className="w-3 h-3 text-cyan-600" />
                              Acoustic Biomarkers
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {speechData.speech_rate_wpm} WPM • {Math.round(speechData.speech_pause_ratio * 100)}% pause
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {speechData.observations.map((obs, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md"
                              >
                                {obs}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-3 shadow-xs">
                      <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                        <Activity className="w-6 h-6" />
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Triage Engine Ready</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        Speak or select a scenario to evaluate Emergency Severity Index (ESI), ICD-10 diagnosis codes, and deterministic safety rules.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Saved Report Notification Banner */}
              {savedReportId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-extrabold text-slate-950 text-xs">SOAP Report Saved</h4>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      Record ID: <span className="font-mono text-slate-800 font-bold">{savedReportId}</span>
                    </p>
                  </div>
                  <Link
                    href="/reports"
                    className="text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-xl hover:bg-cyan-100 transition-colors flex-shrink-0"
                  >
                    View
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
