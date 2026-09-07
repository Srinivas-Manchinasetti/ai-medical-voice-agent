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
  Cpu
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

  // Audio & Speech recognition refs
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessingAI, isDoctorSpeaking]);

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

  // Text-To-Speech function
  const speakDoctorResponse = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = selectedDoctor.voiceGender === "female" ? 1.15 : 0.95;

    // Pick voice if available
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

    utterance.onstart = () => setIsDoctorSpeaking(true);
    utterance.onend = () => setIsDoctorSpeaking(false);
    utterance.onerror = () => setIsDoctorSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [selectedDoctor]);

  // Start voice consultation session
  const startConsultation = () => {
    setCallActive(true);
    setCallDuration(0);
    setSavedReportId(null);
    const initialGreeting: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "doctor",
      text: selectedDoctor.greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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

  // Quick clinical test scenarios for testing multi-agent board deliberation
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
    if (recognitionRef.current) recognitionRef.current.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setCallActive(false);
    setIsRecording(false);
    setIsDoctorSpeaking(false);
    setIsSavingReport(true);

    try {
      const reportPayload = {
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        specialty: selectedDoctor.specialty,
        chiefComplaint: messages.filter((m) => m.role === "patient").map((m) => m.text).join("; ") || "General Clinical Evaluation",
        transcript: messages.map((m) => ({ role: m.role, text: m.text, timestamp: m.timestamp })),
        triageLevel: triageData?.triageLevel || "routine",
        triageTitle: triageData?.triageTitle || "LEVEL 3: ROUTINE CLINICAL CARE",
        icd10Codes: triageData?.icdCodes || ["Z76.0"],
        detectedSymptoms: triageData?.detectedSymptoms || ["General Consultation"],
        soapSubjective: triageData?.soap.subjective || "Patient engaged in clinical voice consultation.",
        soapObjective: triageData?.soap.objective || "Voice triage parsed successfully.",
        soapAssessment: triageData?.soap.assessment || `Consultation performed by ${selectedDoctor.name}.`,
        soapPlan: triageData?.soap.plan || "Review clinical summary and follow recommended guidelines.",
        recommendedSpecialists: [selectedDoctor.specialty],
        recommendedAction: triageData?.recommendedAction || "Outpatient follow-up.",
        durationSeconds: callDuration
      };

      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedReportId(data.consultation?.id || "MED-REPORT");
      }
    } catch (err) {
      console.error("Save consultation error:", err);
    } finally {
      setIsSavingReport(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* PAGE HEADER */}
        <section className="pt-14 pb-8 px-6 max-w-4xl mx-auto text-center space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            REAL-TIME AI VOICE AGENT
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            Live Doctor Consultation Room
          </h1>
          <p className="text-base text-slate-600 max-w-xl mx-auto leading-relaxed font-medium">
            Speak directly with specialized clinical AI doctors. Real-time acoustic triage, diagnostic entity parsing, and instant SOAP documentation.
          </p>
        </section>

        {/* MAIN CONSULTATION WORKSPACE */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Doctor Selection & Live Status */}
            <div className="lg:col-span-4 space-y-6">
              {/* Doctor Specialist Selector */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-cyan-700" />
                    <span>Select Clinical Specialist</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">5 Available</span>
                </div>

                <div className="space-y-2.5">
                  {DOCTOR_PROFILES.map((doc) => {
                    const isSelected = selectedDoctor.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        disabled={callActive}
                        onClick={() => setSelectedDoctor(doc)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3 ${
                          isSelected
                            ? "bg-cyan-50/50 border-cyan-500 shadow-sm ring-2 ring-cyan-500/10"
                            : "bg-slate-50/60 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300"
                        } ${callActive ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <img
                          src={doc.avatarUrl}
                          alt={doc.name}
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-slate-900 text-sm truncate">{doc.name}</span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {doc.specialty}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5 font-medium">{doc.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Triage Sidebar */}
              {triageData && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-slate-500 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-rose-600" />
                      <span>Live Clinical Triage</span>
                    </span>
                    <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-full uppercase border ${getUrgencyBadge(triageData.triageLevel)}`}>
                      {triageData.triageLevel}
                    </span>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 font-mono font-bold mb-1">Detected Symptoms:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {triageData.detectedSymptoms.map((sym, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg font-medium">
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 font-mono font-bold mb-1">ICD-10 Diagnostic Codes:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {triageData.icdCodes.map((code, i) => (
                        <span key={i} className="text-xs bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md font-mono font-bold">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-1">Clinical Action:</span>
                    {triageData.recommendedAction}
                  </div>
                </motion.div>
              )}

              {/* Multi-Agent Clinical Board & Telemetry Panel */}
              {boardData && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-cyan-200/80 rounded-2xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2 text-cyan-900 font-extrabold text-xs">
                      <Users className="w-4 h-4 text-cyan-600" />
                      <span>Clinical Board Synthesis</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Dual-Arbiter Protected
                    </span>
                  </div>

                  {/* Active Board Specialists */}
                  <div>
                    <div className="text-[11px] font-mono font-bold text-slate-500 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                      <span>Board Specialists</span>
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

                  {/* Specialist Opinions & Hypotheses */}
                  {boardData.opinions && boardData.opinions.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono font-bold text-slate-500 mb-1 uppercase tracking-wider flex items-center justify-between">
                        <span>Specialist Opinions</span>
                        <span className="text-[10px] text-cyan-700 font-mono bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                          {boardData.opinions.length} opinion{boardData.opinions.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {boardData.opinions.map((op, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 text-xs space-y-1.5 hover:border-cyan-300 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                <span className="font-bold text-slate-900 text-[11px]">
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
                                {op.risk_level}
                              </span>
                            </div>

                            {op.primary_hypothesis && (
                              <div className="bg-white border border-slate-200/80 rounded-lg p-1.5 text-[11px]">
                                <span className="text-slate-400 font-mono text-[9px] uppercase block font-bold">
                                  Hypothesis:
                                </span>
                                <span className="font-semibold text-slate-800 leading-tight">
                                  {op.primary_hypothesis}
                                </span>
                              </div>
                            )}

                            {op.concerns && op.concerns.length > 0 && (
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-slate-500 font-mono font-bold block">
                                  Concerns:
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
                                <span className="text-slate-500">{op.confidence_semantics?.replace(/_/g, " ") || "score"}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Speech / Paralinguistic Signals */}
                  {speechData && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
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

                  {/* Differential Diagnosis Table */}
                  {boardData.differential.length > 0 && (
                    <div>
                      <div className="text-[11px] font-mono font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                        Ranked Differential
                      </div>
                      <div className="space-y-1.5">
                        {boardData.differential.slice(0, 3).map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs"
                          >
                            <span className="font-semibold text-slate-800 truncate max-w-[170px]">
                              {item.condition}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                item.probability === "high"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : item.probability === "moderate"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.probability}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Multi-Specialty Conflicts Resolved */}
                  {boardData.conflicts.length > 0 && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Clinical Conflict Resolved:
                      </span>
                      <p className="text-[11px] leading-relaxed text-amber-950">
                        {boardData.conflicts[0].description}
                      </p>
                    </div>
                  )}

                  {/* Bounded Diagnostic Tools Executed */}
                  {boardData.tools_executed && boardData.tools_executed.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Wrench className="w-3 h-3 text-cyan-600" />
                          Diagnostic Tools
                        </span>
                        <span className="text-[10px] text-cyan-700 font-mono bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                          {boardData.tools_executed.length} executed
                        </span>
                      </div>
                      <div className="space-y-1.5">
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

                  {/* Multi-Round Peer Review Challenges */}
                  {boardData.peer_challenges && boardData.peer_challenges.length > 0 && (
                    <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-2.5 text-xs text-indigo-950 space-y-1.5">
                      <div className="flex items-center justify-between text-indigo-900 font-bold">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                          Round 2 Peer Challenges
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
                              Resolved
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-700 leading-snug">
                            <strong className="text-slate-900">Dispute:</strong> {ch.claim_disputed}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tamper-Evident Audit Hash Chain Explorer */}
                  {boardData.trace.audit_hash_chain && boardData.trace.audit_hash_chain.length > 0 && (
                    <div className="border border-slate-200 bg-slate-50/80 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Lock className="w-3 h-3 text-emerald-600" />
                          Audit Hash Chain
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
                            <span className="font-semibold text-slate-700 truncate max-w-[130px]">
                              B{block.block_index}: {block.event_type.replace(/_/g, " ")}
                            </span>
                            <span className="text-slate-500 font-mono" title={block.current_hash}>
                              {block.current_hash.slice(0, 8)}...
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empirical Pipeline Latency */}
                  <div className="text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
                    <span>Board Runtime: {boardData.trace.total_board_latency_ms}ms</span>
                    <span>Pre: {boardData.trace.pre_arbiter_latency_us}µs | Post: {boardData.trace.post_arbiter_latency_us}µs</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* RIGHT COLUMN: Interactive Voice Screen & Conversation */}
            <div className="lg:col-span-8 flex flex-col space-y-6">
              
              {/* Voice Room Container */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between min-h-[500px]">
                
                {/* Consultation Room Top Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={selectedDoctor.avatarUrl}
                        alt={selectedDoctor.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-cyan-500 shadow-sm"
                      />
                      {callActive && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-slate-950 font-extrabold text-base flex items-center gap-2">
                        <span>{selectedDoctor.name}</span>
                        {callActive && (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            LIVE CALL
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">{selectedDoctor.department}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {callActive && (
                      <div className="font-mono text-sm font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-xl">
                        {formatTimer(callDuration)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Center Visualizer */}
                <div className="my-8 flex flex-col items-center justify-center text-center">
                  {!callActive ? (
                    <div className="space-y-4 py-8">
                      <div className="w-20 h-20 mx-auto rounded-full bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shadow-sm">
                        <Mic className="w-9 h-9" />
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-950">Ready for Voice Consultation</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium">
                          Click below to start your private real-time audio triage consultation with {selectedDoctor.name}.
                        </p>
                      </div>
                      <button
                        onClick={startConsultation}
                        className="inline-flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-xs px-6 py-3.5 rounded-xl shadow-md transition-all scale-100 hover:scale-105"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Voice Consultation</span>
                      </button>

                      <div className="pt-3 border-t border-slate-100/80 max-w-xl mx-auto">
                        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Or Click to Simulate Multi-Agent Case:
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {CLINICAL_SCENARIOS.map((sc, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                startConsultation();
                                setTimeout(() => handleUserUtterance(sc.text), 400);
                              }}
                              className="text-[11px] font-medium bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 border border-slate-200 hover:border-cyan-300 px-2.5 py-1.5 rounded-xl transition-all shadow-xs"
                              title={sc.desc}
                            >
                              {sc.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5 w-full max-w-md mx-auto">
                      {/* Pulsing Sphere */}
                      <div className="relative flex items-center justify-center">
                        <motion.div
                          animate={{
                            scale: isDoctorSpeaking ? [1, 1.25, 1] : isRecording ? [1, 1.15, 1] : 1,
                            opacity: isDoctorSpeaking || isRecording ? [0.3, 0.6, 0.3] : 0.1
                          }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className={`absolute w-32 h-32 rounded-full blur-lg ${
                            isDoctorSpeaking ? "bg-cyan-400" : isRecording ? "bg-emerald-400" : "bg-slate-300"
                          }`}
                        />
                        <div
                          className={`relative w-24 h-24 rounded-full border-2 flex items-center justify-center transition-all ${
                            isDoctorSpeaking
                              ? "bg-cyan-50 border-cyan-500 text-cyan-700 shadow-md"
                              : isRecording
                              ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md animate-pulse"
                              : "bg-slate-100 border-slate-200 text-slate-400"
                          }`}
                        >
                          {isDoctorSpeaking ? (
                            <Volume2 className="w-9 h-9 animate-bounce" />
                          ) : (
                            <Mic className="w-9 h-9" />
                          )}
                        </div>
                      </div>

                      {/* State Indicator */}
                      <div className="text-center">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                          {isDoctorSpeaking
                            ? `${selectedDoctor.name} is speaking...`
                            : isRecording
                            ? "Listening to your voice (Speak now)..."
                            : isProcessingAI
                            ? "AI evaluating clinical assessment..."
                            : "Microphone idle"}
                        </span>
                        {transcriptText && (
                          <div className="mt-2 text-xs text-cyan-900 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-xl italic max-w-sm mx-auto truncate font-medium">
                            "{transcriptText}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Consultation Live Chat Feed */}
                {callActive && (
                  <div
                    ref={chatScrollRef}
                    className="max-h-56 overflow-y-auto space-y-3 p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl mb-4"
                  >
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 text-xs leading-relaxed ${
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
                          className={`max-w-[80%] rounded-2xl p-3.5 ${
                            msg.role === "doctor"
                              ? msg.isSpecialistChime
                                ? "bg-amber-50/80 border border-amber-200 text-slate-800 shadow-sm"
                                : "bg-white border border-slate-200/90 text-slate-800 shadow-sm"
                              : "bg-slate-950 text-white font-medium shadow-sm"
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
                    ))}

                    {isProcessingAI && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 italic p-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-700" />
                        <span>Clinical Board evaluating multi-specialist assessment...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Call Control Footer */}
                {callActive && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    {/* Quick Multi-Agent Case Test Scenarios */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mr-1">
                        Test Scenarios:
                      </span>
                      {CLINICAL_SCENARIOS.map((sc, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleUserUtterance(sc.text)}
                          className="text-[11px] font-medium bg-slate-50 hover:bg-cyan-50 text-slate-700 hover:text-cyan-800 border border-slate-200 hover:border-cyan-300 px-2.5 py-1 rounded-lg transition-all shadow-xs"
                          title={sc.desc}
                        >
                          {sc.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMic}
                          className={`px-3.5 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
                            isRecording
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"
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
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={typedInput}
                            onChange={(e) => setTypedInput(e.target.value)}
                            placeholder="Type symptom text..."
                            className="bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none w-44 sm:w-64 transition-all"
                          />
                          <button
                            type="submit"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>

                      <button
                        onClick={endConsultationAndSave}
                        disabled={isSavingReport}
                        className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all ml-auto"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>{isSavingReport ? "Saving SOAP..." : "End & Generate SOAP"}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Saved Report Notification Banner */}
              {savedReportId && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-950 text-sm">Clinical SOAP Report Generated & Saved</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Record ID: <span className="font-mono text-slate-800 font-bold">{savedReportId}</span>. Saved to your consultation records.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex-shrink-0"
                  >
                    <span>View in SOAP Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
