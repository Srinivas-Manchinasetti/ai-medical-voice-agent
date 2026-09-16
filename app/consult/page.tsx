"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
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
  AlertCircle,
  ClipboardCheck,
  HelpCircle,
  Clock,
  ArrowRight,
  Flame,
  Volume2,
  FileText,
  MapPin,
  Navigation,
  PhoneCall,
  Circle,
  X,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "../_components/Navbar";
import { AppFooter } from "../_components/AppFooter";
import { SoapReportModal } from "../_components/SoapReportModal";
import { DOCTOR_PROFILES, DoctorProfile } from "@/config/doctors";
import { CursorGrid } from "@/components/ui/cursor-grid";
import RotatingText from "@/components/RotatingText";
import CountUp from "@/components/CountUp";
import SpecularButton from "@/components/SpecularButton";
import PremiumButton from "@/components/PremiumButton";
import AccordionGallery from "@/components/AccordionGallery";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { GlowingBorder } from "@/components/ui/glowing-border";
import { MovingBorder } from "@/components/ui/moving-border";
import { AnimatedContent } from "@/components/ui/animated-content";


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
  triageLevel: "emergency" | "priority" | "routine" | "gathering_history";
  triageTitle: string;
  esiScore?: number | null;
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
  phase?: "dormant" | "active_inquiring" | "deliberating" | "decided" | "gathering_history" | "specialist_deliberation" | "board_decision";
  information_state?: string;
  status_summary?: string;
  consensus_summary?: string;
  completeness_score?: number;
  known_facts?: string[];
  missing_dimensions?: string[];
  active_requests?: Array<{
    id: string;
    fromAgent: string;
    doctorName: string;
    type: string;
    targetSlot: string;
    urgency: string;
    reason: string;
    suggestedQuestion: string;
    status: string;
  }>;
  pending_question?: {
    id: string;
    targetSlot: string;
    askedBy: string;
    doctorName: string;
    question: string;
    purpose: string;
  } | null;
  slots?: any;
  inquiry?: {
    doctor_id?: string;
    doctor_name: string;
    specialty: string;
    avatarUrl?: string;
    target_dimension?: string;
    question: string;
  };
  orchestrator_summary?: string;
  active_specialists: string[];
  specialists_summoned?: string[];
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
  opinions?: Array<{
    doctor_name: string;
    specialty: string;
    concerns: string[];
    risk_level: string;
    confidence?: number;
    confidence_semantics?: string;
    primary_hypothesis?: string;
    recommended_actions?: string[];
  }>;
  differential?: Array<{
    condition: string;
    probability: string;
    supporting_agents?: string[];
  }>;
  conflicts?: Array<{
    topic: string;
    agents: string[];
    conflict_description: string;
    resolution: string;
  }>;
  deliberation_messages?: BoardMessage[];
  citations?: Record<string, {
    id: string;
    title: string;
    authority: string;
    source: string;
    section: string;
    content: string;
    releaseDate: string;
    organization: string;
    criteria?: string[];
  }>;
  trace?: {
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
  } | null;
}

const METHODOLOGY_STAGES = [
  {
    number: "01",
    label: "Speech & Acoustic Intake",
    description: "Real-time acoustic biomarker extraction, speech cadence tracking, and hands-free clinical transcription.",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1000&q=80",
    link: "#",
    alt: "Acoustic Biomarkers & Real-Time Transcription"
  },
  {
    number: "02",
    label: "Parallel Deliberation",
    description: "Cardiology, neurology, and pediatrics agent swarms evaluate symptoms concurrently in memory.",
    image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1000&q=80",
    link: "#",
    alt: "Cardiology, Neurology, & Pediatrics Evaluation"
  },
  {
    number: "03",
    label: "Peer Cross-Examination",
    description: "Multi-agent peer cross-examination, clinical hypothesis revision, and targeted diagnostic inquiries.",
    image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1000&q=80",
    link: "#",
    alt: "Differential Diagnosis & Clarification Inquiries"
  },
  {
    number: "04",
    label: "Deterministic Safety Arbiter",
    description: "Algorithmic ESI v4 life-threat invariants evaluate instantly with deterministic safety guardrails.",
    image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=80",
    link: "#",
    alt: "Algorithmic ESI v4 Invariant Verification"
  },
  {
    number: "05",
    label: "Consensus & Audit Ledger",
    description: "Specialist conclusions reconciled into structured SOAP, ICD-10 codes, and tamper-proof SHA-256 hash chains.",
    image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=80",
    link: "#",
    alt: "Structured SOAP, ICD-10 & SHA-256 Ledger"
  }
];

function formatTimelineTime(timestamp?: string): string {
  if (!timestamp || timestamp === "Live" || timestamp === "Pending") {
    return timestamp || "12:57 PM";
  }
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    }
  } catch {}
  return timestamp;
}

function formatClinicalFact(raw: string): string {
  if (!raw) return "";
  const clean = raw.trim();

  // If format is KEY: value (e.g. "CHEST_TIGHTNESS: present", "CHARACTER: tightness", "ONSET: a week", "Frequency: once in a month")
  if (clean.includes(":")) {
    const parts = clean.split(":");
    const key = parts[0].trim().toUpperCase();
    const val = parts.slice(1).join(":").trim();

    if (val.toLowerCase() === "present") {
      return key
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
    }

    if (key === "FREQUENCY") {
      return `Episodes occur ${val}`;
    }

    if (key === "RISK FACTORS" || key === "RISK_FACTORS") {
      if (val.toLowerCase().includes("none")) {
        return "No known cardiac risk factors";
      }
      return `Risk factors: ${val}`;
    }

    if (key === "CHARACTER") {
      return `${val.charAt(0).toUpperCase() + val.slice(1)} sensation`;
    }

    if (key === "ONSET") {
      return `Onset: approx. ${val}`;
    }

    if (key === "ASSOCIATED") {
      return `Associated ${val}`;
    }

    if (key === "NEUROLOGICAL") {
      return `Neurological: ${val}`;
    }

    const formattedKey = key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    return `${formattedKey}: ${val}`;
  }

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export default function ConsultPage() {
  const { user } = useUser();
  const patientDisplayName = user?.fullName || user?.firstName || "Patient";

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
  const [interviewState, setInterviewState] = useState<any>(null);
  
  const [activeRightTab, setActiveRightTab] = useState<"board" | "context" | "safety" | "care">("board");
  const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude?: number; longitude?: number; city?: string } | null>(null);
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "unknown">("unknown");

  // Context Tab State Calculations
  const contextKnownFacts: string[] = boardData?.known_facts || interviewState?.slots?.known_facts || [];
  const hasContextFacts = contextKnownFacts.length > 0;

  const defaultMissingDimensions = [
    "Symptoms & chief complaint",
    "Onset & timeline",
    "Episode duration & frequency",
    "Character & severity",
    "Associated symptoms",
  ];

  const contextMissingDimensions: string[] = boardData?.missing_dimensions !== undefined && boardData.missing_dimensions.length > 0
    ? boardData.missing_dimensions
    : (hasContextFacts ? [] : defaultMissingDimensions);

  const rawCompleteness = boardData?.completeness_score !== undefined
    ? boardData.completeness_score
    : (hasContextFacts ? Math.min(0.95, Math.round((contextKnownFacts.length / (contextKnownFacts.length + (contextMissingDimensions.length || 1))) * 100) / 100) : 0);

  const completenessPercent = Math.round(rawCompleteness * 100);

  const contextTitle = hasContextFacts ? "Context established" : "Consultation context";
  let contextSubtitle = "Building as you talk";

  if (audioState === "PATIENT_LISTENING") {
    contextSubtitle = "Listening to patient...";
  } else if (audioState === "PROCESSING_PATIENT" || audioState === "PROCESSING_INTERRUPTION") {
    contextSubtitle = "Updating context...";
  } else if (audioState === "DOCTOR_SPEAKING") {
    contextSubtitle = "Dr. Sarah speaking...";
  } else if (hasContextFacts) {
    contextSubtitle = "Context updated";
  } else {
    contextSubtitle = "Building as you talk";
  }

  const handleRequestLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(coords);
        setLocationPermission("granted");
      },
      (err) => {
        console.warn("Location permission error:", err);
        setLocationPermission("denied");
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const [showTechnicalTrace, setShowTechnicalTrace] = useState<boolean>(false);
  const [selectedCitationId, setSelectedCitationId] = useState<string | null>(null);
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<Record<string, boolean>>({});
  const toggleEvidence = (id: string) => {
    setExpandedEvidenceIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const [showSoapModal, setShowSoapModal] = useState<boolean>(false);
  const [emergencyCallTarget, setEmergencyCallTarget] = useState<{
    isOpen: boolean;
    number: string;
    title: string;
    description: string;
    serviceName: string;
  } | null>(null);

  const handleInitiateEmergencyCall = (number: string, serviceName?: string) => {
    if (number === "108") {
      setEmergencyCallTarget({
        isOpen: true,
        number: "108",
        title: "Call 108 ambulance services?",
        description: "This will open your phone's dialer for 108 (ambulance services).",
        serviceName: "Ambulance Services"
      });
    } else if (number === "112") {
      setEmergencyCallTarget({
        isOpen: true,
        number: "112",
        title: "Call 112 emergency services?",
        description: "This will open your phone's dialer for India's national emergency number.",
        serviceName: "National Emergency"
      });
    } else {
      setEmergencyCallTarget({
        isOpen: true,
        number,
        title: `Call ${serviceName || number}?`,
        description: `This will open your phone's dialer for ${serviceName || number}.`,
        serviceName: serviceName || "Emergency Contact"
      });
    }
  };

  const handleConfirmEmergencyCall = () => {
    if (emergencyCallTarget?.number) {
      const num = emergencyCallTarget.number;
      setEmergencyCallTarget(null);
      window.location.href = `tel:${num}`;
    }
  };

  useEffect(() => {
    if (!emergencyCallTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEmergencyCallTarget(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [emergencyCallTarget]);

  // Audio refs & Audio Guard
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStateRef = useRef<AudioState>("IDLE");
  const callActiveRef = useRef<boolean>(false);
  const lastDoctorSpeechRef = useRef<string>("");
  const lastDoctorSpeechTimeRef = useRef<number>(0);
  const preferredFemaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const preferredMaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize and pin deterministic voice identities on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const selectVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
      if (englishVoices.length === 0) return;

      const female =
        englishVoices.find((v) => /Zira|Samantha|Google UK English Female|Victoria|Jenny|Aria|Karen|Hazel/i.test(v.name)) ||
        englishVoices.find((v) => /Female|Woman/i.test(v.name)) ||
        englishVoices.find((v) => !/Male|David|Mark|George/i.test(v.name)) ||
        englishVoices[0];

      const male =
        englishVoices.find((v) => /David|Mark|George|Google UK English Male|Guy/i.test(v.name)) ||
        englishVoices.find((v) => /Male|Man/i.test(v.name)) ||
        englishVoices[0];

      if (female) preferredFemaleVoiceRef.current = female;
      if (male) preferredMaleVoiceRef.current = male;
    };

    selectVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = selectVoices;
    }
  }, []);

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
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
        activeAudioRef.current = null;
      } catch {}
    }
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

  // Text-To-Speech with Kokoro-first Neural Audio and deterministic browser fallback
  const speakDoctorResponse = useCallback(async (text: string) => {
    const cleanText = text.replace(/[*_#`\[\]()]/g, "").trim();
    if (!cleanText) return;

    // 1. Halt any ongoing audio immediately
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
        activeAudioRef.current = null;
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    lastDoctorSpeechRef.current = cleanText.toLowerCase();
    lastDoctorSpeechTimeRef.current = Date.now();
    setAudioState("DOCTOR_SPEAKING");

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const handleSpeechEnd = () => {
      if (audioStateRef.current === "DOCTOR_SPEAKING") {
        setAudioState("IDLE");
        // Audio Guard: 400ms buffer and verify audio is truly silent before re-arming mic
        setTimeout(() => {
          if (
            callActiveRef.current &&
            audioStateRef.current === "IDLE" &&
            (!activeAudioRef.current || activeAudioRef.current.paused) &&
            typeof window !== "undefined" &&
            !("speechSynthesis" in window && window.speechSynthesis.speaking)
          ) {
            startSpeechRecognitionListening();
          }
        }, 400);
      }
    };

    // Helper for deterministic browser TTS fallback (Only used on genuine Kokoro failure)
    const playBrowserFallback = () => {
      console.warn("[MedVoice Audio Fallback] Kokoro TTS unavailable. Using browser speech synthesis for:", selectedDoctor.name);
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        handleSpeechEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = selectedDoctor.voiceGender === "female" ? 1.15 : 0.95;

      const isFemale = selectedDoctor.voiceGender === "female";
      let chosenVoice = isFemale ? preferredFemaleVoiceRef.current : preferredMaleVoiceRef.current;

      if (!chosenVoice) {
        const voices = window.speechSynthesis.getVoices();
        const englishVoices = voices.filter((v) => v.lang.startsWith("en"));
        if (englishVoices.length > 0) {
          if (isFemale) {
            chosenVoice =
              englishVoices.find((v) => /Zira|Samantha|Google UK English Female|Victoria|Jenny|Aria|Karen|Hazel/i.test(v.name)) ||
              englishVoices.find((v) => /Female|Woman/i.test(v.name)) ||
              englishVoices.find((v) => !/Male|David|Mark|George/i.test(v.name)) ||
              englishVoices[0];
            if (chosenVoice) preferredFemaleVoiceRef.current = chosenVoice;
          } else {
            chosenVoice =
              englishVoices.find((v) => /David|Mark|George|Google UK English Male|Guy/i.test(v.name)) ||
              englishVoices.find((v) => /Male|Man/i.test(v.name)) ||
              englishVoices[0];
            if (chosenVoice) preferredMaleVoiceRef.current = chosenVoice;
          }
        }
      }

      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      utterance.onstart = () => {
        setAudioState("DOCTOR_SPEAKING");
      };
      utterance.onend = handleSpeechEnd;
      utterance.onerror = handleSpeechEnd;

      window.speechSynthesis.speak(utterance);
    };

    // 2. Primary Path: Kokoro Neural Audio (/api/voice/tts)
    try {
      console.log(`[MedVoice Audio] Synthesizing speech via Kokoro (voice: af_heart) for ${selectedDoctor.name}...`);
      const response = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          doctorId: selectedDoctor.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Kokoro TTS route returned status ${response.status}`);
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudioRef.current = null;
        handleSpeechEnd();
      };

      audio.onerror = (e) => {
        console.error("[MedVoice Audio] Audio playback error:", e);
        URL.revokeObjectURL(audioUrl);
        activeAudioRef.current = null;
        playBrowserFallback();
      };

      await audio.play();
      console.log("[MedVoice Audio] Kokoro af_heart audio playback started successfully.");
    } catch (err: any) {
      console.warn("[MedVoice Audio] Kokoro synthesis route error. Triggering browser fallback:", err.message);
      playBrowserFallback();
    }
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
          const spoken = finalChunk.trim();

          // Audio Guard: Acoustic Self-Echo Rejection (drop if Jaccard similarity > 0.50 within 4s of doctor speech)
          const timeSinceDoctorSpeech = Date.now() - lastDoctorSpeechTimeRef.current;
          if (lastDoctorSpeechRef.current && timeSinceDoctorSpeech < 4000) {
            const userWords = new Set(spoken.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
            const doctorWords = new Set(lastDoctorSpeechRef.current.split(/\s+/).filter((w) => w.length > 2));
            if (userWords.size > 0 && doctorWords.size > 0) {
              let overlap = 0;
              for (const w of userWords) {
                if (doctorWords.has(w)) overlap++;
              }
              const union = new Set([...userWords, ...doctorWords]).size;
              const jaccard = union > 0 ? overlap / union : 0;
              if (jaccard > 0.50) {
                console.warn("🛡️ Audio Guard: Dropped doctor acoustic self-echo (Jaccard: " + jaccard.toFixed(2) + "):", spoken);
                setTranscriptText("");
                return;
              }
            }
          }

          setTranscriptText("");
          handleUserUtterance(spoken);
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
    setInterviewState(null);
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
        activeAudioRef.current = null;
      } catch {}
    }
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
    // Transition to Clinical SOAP Review if an encounter took place
    if (messages.length > 0) {
      setShowSoapModal(true);
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
          patientName: patientDisplayName,
          userId: user?.id,
          isInterruption: isBargeIn,
          interruptedAgent: selectedDoctor.name,
          interviewState: interviewState,
          userLocation: userLocation || undefined,
          locationPermission: locationPermission,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const doctorReplyText = data.doctorReply || "I have received your symptoms and documented them.";

        const respondingDoctorName = data.doctor?.name || selectedDoctor.name;
        const respondingDoctorSpecialty = data.doctor?.specialty || selectedDoctor.department;

        const newDoctorMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "doctor",
          text: doctorReplyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          doctorName: respondingDoctorName,
          doctorSpecialty: respondingDoctorSpecialty
        };

        setMessages((prev) => [...prev, newDoctorMessage]);

        if (data.interviewState) {
          setInterviewState(data.interviewState);
        }

        if (data.nearbyHospitals && data.nearbyHospitals.length > 0) {
          setNearbyHospitals(data.nearbyHospitals);
          // If the patient expressed an access constraint, proactively bring attention to Care Options
          if (data.interviewState?.structuredHistory?.accessConstraints?.financial || data.interviewState?.structuredHistory?.accessConstraints?.remoteLocation) {
            setActiveRightTab("care");
          }
        }

        if (data.triage) {
          setTriageData(data.triage);
        }
        if (data.board) {
          setBoardData(data.board);
          if (data.board.phase === "dormant" || data.board.phase === "gathering_history") {
            setActiveRightTab("context");
          } else {
            setActiveRightTab("board");
          }
        }

        speakDoctorResponse(doctorReplyText);
      }
    } catch (err) {
      console.error("Consultation chat error:", err);
      setAudioState("IDLE");
    }
  };

  // Helper for Doctor Status
  const getDoctorLiveStatus = (doc: DoctorProfile) => {
    if (audioState === "DOCTOR_SPEAKING" && selectedDoctor.id === doc.id) {
      return { label: "Speaking", color: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500 animate-pulse" };
    }
    if (doc.id === "dr-sarah-chen") {
      return { label: "Lead", color: "text-cyan-800 bg-cyan-50", dot: "bg-cyan-500" };
    }
    // Check if specialist has an active request
    const isSpecialistInquiring = boardData?.active_requests?.some((r: any) =>
      r.status === "pending" && doc.name.toLowerCase().includes(r.doctorName?.toLowerCase().split(" ")[1] || "")
    );
    if (isSpecialistInquiring) {
      return { label: "Inquiring", color: "text-amber-800 bg-amber-50", dot: "bg-amber-500 animate-pulse" };
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
    <div className="relative min-h-screen bg-transparent text-slate-900 flex flex-col font-sans selection:bg-cyan-500 selection:text-white overflow-x-clip">
      <Navbar />

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 flex flex-col gap-8">
        
        {/* DYNAMIC HERO SECTION: COMPACT CLINICAL WORKSTATION WHEN ACTIVE, EXPANDED OVERVIEW WHEN IDLE */}
        {callActive ? (
          /* COMPACT ACTIVE CONSULTATION BAR */
          <header className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative flex-shrink-0">
                <img
                  src={selectedDoctor.avatarUrl}
                  alt={selectedDoctor.name}
                  className="w-11 h-11 rounded-xl object-cover border border-cyan-400 shadow-xs"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-black text-slate-950 truncate">
                    {selectedDoctor.name}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold truncate">
                    · {selectedDoctor.department}
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Active Session
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono font-bold text-cyan-900 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                    ⏱ {formatTimer(callDuration)}
                  </span>
                  <span>·</span>
                  <span className="text-slate-600 truncate">
                    {audioState === "DOCTOR_SPEAKING"
                      ? "Doctor speaking response..."
                      : audioState === "PATIENT_LISTENING"
                      ? "Listening to patient voice input..."
                      : "Multi-specialist board listening"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-xs font-mono font-semibold text-slate-600 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span>5 Specialists Synchronized</span>
              </div>

              <PremiumButton
                variant="danger"
                size="md"
                onClick={endConsultation}
              >
                ✦ End Consultation
              </PremiumButton>
            </div>
          </header>
        ) : (
          /* EXPANDED INTAKE HERO (IDLE / PRE-SESSION) */
          <header className="flex flex-col gap-6 pt-2 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/90 border border-cyan-300/80 text-xs font-bold text-cyan-950 tracking-wider uppercase shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
                <span>Autonomous Clinical Board</span>
                <span className="text-cyan-600 font-normal">·</span>
                <span className="text-cyan-800 font-semibold lowercase tracking-normal text-xs">multi-specialist live triage</span>
              </div>

              <div className="hidden sm:flex items-center gap-2.5 text-xs font-semibold text-slate-600">
                <span className="px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-2xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Sub-2s Triage</span>
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-2xs">
                  5 Board-Certified Agents
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-2xs font-medium">
                  Deterministic Guardrails
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-950 leading-[1.12] max-w-4xl">
                Clinical intelligence, built around the conversation.
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-lg sm:text-xl md:text-2xl font-bold text-slate-700">
                <span className="text-slate-500 font-medium">Designed for</span>
                <RotatingText
                  texts={['Emergency Triage', 'Cardiology Care', 'Acute Neurology', 'Differential Diagnosis', 'Clinical Consensus']}
                  mainClassName="px-3 sm:px-3.5 bg-cyan-300 text-black overflow-hidden py-1 sm:py-1.5 justify-center rounded-xl font-black text-base sm:text-lg md:text-xl shadow-xs"
                  staggerFrom="first"
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "-120%", opacity: 0 }}
                  transition={{ type: "spring", damping: 26, stiffness: 350 }}
                  rotationInterval={2500}
                  splitBy="words"
                  auto
                  loop
                />
              </div>

              <p className="text-base sm:text-lg text-slate-600 max-w-3xl font-normal leading-relaxed">
                Initiate hands-free patient history intake with Dr. Sarah Chen. Specialist agents listen concurrently in the background, cross-examining acoustic biomarkers and guideline protocols to reach instant consensus.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <PremiumButton
                  variant="primary"
                  size="lg"
                  onClick={startConsultation}
                >
                  ✦ Start Voice Consultation
                </PremiumButton>

                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-full border border-slate-200/80 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span>System Operational · 5 Specialists Online</span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* SPECIALIST NETWORK RAIL — COMPACT HUD PILLS WHEN ACTIVE, EXPANDED SELECTION CARDS WHEN IDLE */}
        {callActive ? (
          /* COMPACT ACTIVE SPECIALIST HUD */
          <section className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/70 shadow-2xs overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Active Board:
              </span>
            </div>
            <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
              {DOCTOR_PROFILES.map((doc) => {
                const isSelected = selectedDoctor.id === doc.id;
                const liveStatus = getDoctorLiveStatus(doc);
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDoctor(doc);
                      speakDoctorResponse(`Switched to ${doc.name}, ${doc.department}. How may I evaluate your symptoms?`);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex-shrink-0 ${
                      isSelected
                        ? "bg-cyan-500 text-white shadow-xs font-bold"
                        : "bg-white/90 text-slate-700 hover:bg-white border border-slate-200/80"
                    }`}
                  >
                    <img
                      src={doc.avatarUrl}
                      alt={doc.name}
                      className="w-5 h-5 rounded-full object-cover border border-white/40"
                    />
                    <span className="truncate max-w-[120px]">
                      {doc.name.split(" ")[1] || doc.name}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : liveStatus.dot}`} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          /* EXPANDED DOCTOR SHOWCASE CARDS (PRE-SESSION) */
          <section className="flex flex-col gap-2 pt-1 pb-1">
            <div className="px-1">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600 font-mono">Specialist Network</span>
              <p className="text-xs text-slate-500 font-medium mt-0.5">5 board-certified agents · 1 lead clinician</p>
            </div>

            {/* Horizontal scroll viewport with vertical breathing room for elevation & glow */}
            <div className="overflow-x-auto scrollbar-none -mx-2 px-2">
              <div className="flex items-stretch gap-4 pt-3 pb-4">
                {DOCTOR_PROFILES.map((doc) => {
                  const isSelected = selectedDoctor.id === doc.id;
                  const liveStatus = getDoctorLiveStatus(doc);
                  return (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedDoctor(doc);
                      }}
                      className={`group relative flex flex-col justify-between p-4 rounded-2xl transition-all duration-200 text-left cursor-pointer w-[260px] min-w-[260px] max-w-[260px] h-[180px] min-h-[180px] flex-shrink-0 ${
                        isSelected
                          ? "bg-white/95 backdrop-blur-md border-2 border-cyan-500 shadow-[0_6px_20px_rgba(6,182,212,0.18)] ring-2 ring-cyan-400/25 -translate-y-1"
                          : "bg-white/80 hover:bg-white/95 backdrop-blur-md border border-slate-200/80 hover:border-cyan-400/60 shadow-xs hover:shadow-md"
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="relative">
                          <img
                            src={doc.avatarUrl}
                            alt={doc.name}
                            className={`w-14 h-14 rounded-2xl object-cover border transition-all ${
                              isSelected
                                ? "border-cyan-400 shadow-sm"
                                : "border-slate-200 group-hover:border-slate-300"
                            }`}
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${liveStatus.dot}`} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          isSelected ? "bg-cyan-50 text-cyan-800 border border-cyan-200 font-extrabold" : "bg-slate-100/90 text-slate-600 border border-slate-200/60"
                        }`}>
                          {liveStatus.label}
                        </span>
                      </div>

                      <div className="flex flex-col mt-auto">
                        <span className="text-sm sm:text-base font-bold text-slate-900 leading-tight line-clamp-1">
                          {doc.name.replace(", MD, FACC", "").replace(", MD, PhD", "").replace(", MD, FAAP", "").replace(", MD, DVD", "").replace(", MD", "")}
                        </span>
                        <span className="text-xs text-slate-500 font-medium leading-snug line-clamp-2 mt-0.5">
                          {doc.department}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* CLINICAL WORKSPACE ENCLOSURE SHELL */}
        <section id="workspace" className="p-3 sm:p-6 lg:p-7 rounded-3xl bg-white/75 backdrop-blur-xl border border-slate-200/80 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-700 font-mono">
                Clinical Workstation · Multi-Specialist Deliberation
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2.5 text-xs font-mono text-slate-500">
              <span className="px-2.5 py-0.5 rounded-full bg-white/80 border border-slate-200/80 font-bold text-slate-700">
                16kHz PCM
              </span>
              <span>·</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                SAFETY ARBITER ACTIVE
              </span>
            </div>
          </div>

          {/* ASYMMETRIC WORKSPACE: 7:5 GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT PANEL (7 cols): PRIMARY VOICE CONSOLE */}
            <section className="relative lg:col-span-7 flex flex-col gap-5 p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={selectedDoctor.avatarUrl}
                    alt={selectedDoctor.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shadow-2xs"
                  />
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${getDoctorLiveStatus(selectedDoctor).dot}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-slate-950 whitespace-nowrap">{selectedDoctor.name}</h2>
                    <span className="text-xs sm:text-sm text-slate-500 font-medium truncate">· {selectedDoctor.department}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 mt-0.5">
                    <span className="font-mono font-bold text-slate-700">{formatTimer(callDuration)}</span>
                    <span>·</span>
                    <span className={audioState === "DOCTOR_SPEAKING" ? "text-emerald-700 font-bold animate-pulse" : "text-slate-500 font-medium"}>
                      {audioState === "DOCTOR_SPEAKING" ? "Doctor speaking" : audioState === "PATIENT_LISTENING" ? "Listening to your voice..." : "Connected"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <PremiumButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSoapModal(true)}
                    icon={<FileText className="w-3.5 h-3.5 text-cyan-700" />}
                  >
                    SOAP Report
                  </PremiumButton>
                )}

                <PremiumButton
                  variant={callActive ? "danger" : "primary"}
                  size="sm"
                  onClick={() => {
                    if (callActive) endConsultation();
                    else startConsultation();
                  }}
                  icon={callActive ? <PhoneOff className="w-3.5 h-3.5" /> : <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
                >
                  {callActive ? "End Call" : "Start Call"}
                </PremiumButton>
              </div>
            </div>

            {/* Quiet Barge-In Interruption Bar */}
            <AnimatePresence>
              {audioState === "DOCTOR_SPEAKING" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs sm:text-sm text-amber-950 shadow-2xs"
                >
                  <span className="font-medium flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-600" />
                    Doctor is speaking. Speak aloud or click to interrupt:
                  </span>
                  <PremiumButton
                    variant="danger"
                    size="sm"
                    onClick={() => triggerBargeIn()}
                  >
                    Interrupt
                  </PremiumButton>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mic Permission Alert */}
            {micPermissionError && (
              <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{micPermissionError}</span>
              </div>
            )}

            {/* Conversation Feed */}
            <div
              ref={chatScrollRef}
              className="h-[430px] overflow-y-auto flex flex-col gap-4 pr-2"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center mb-3 shadow-2xs">
                    <Stethoscope className="w-6 h-6 text-cyan-700" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Ready when you are</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed font-normal">
                    Start a voice consultation with Dr. Sarah Chen. You can speak naturally or type your symptoms below.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-1.5 ${
                      msg.role === "doctor" ? "items-start" : "items-end"
                    }`}
                  >
                    {/* Doctor Message */}
                    {msg.role === "doctor" && (
                      <>
                        <span className="text-xs sm:text-sm font-black text-slate-900 tracking-wide flex items-center gap-2">
                          {msg.doctorName?.toUpperCase() || "DR. SARAH CHEN"}
                          <span className="text-xs font-semibold text-slate-500">· {msg.doctorSpecialty}</span>
                        </span>
                        <div className="max-w-[92%] text-slate-900 text-sm sm:text-base leading-relaxed font-medium bg-slate-50/90 border border-slate-200/70 rounded-2xl px-4 py-3">
                          "{msg.text}"
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                          <span>{msg.timestamp}</span>
                          {msg.wasInterrupted && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600 font-sans font-semibold">Interrupted by patient</span>
                            </>
                          )}
                        </div>
                      </>
                    )}

                    {/* Patient Message */}
                    {msg.role === "patient" && (
                      <>
                        <div className="max-w-[85%] rounded-2xl px-5 py-3.5 bg-slate-950 text-white text-sm sm:text-base leading-relaxed shadow-2xs font-normal">
                          {msg.text}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 font-mono pr-1">
                          <span>{msg.timestamp}</span>
                          {msg.isBargeIn && (
                            <>
                              <span>·</span>
                              <span className="text-amber-600 font-sans font-semibold">Patient interruption</span>
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
                <div className="mt-3 flex items-center gap-2.5 text-sm text-cyan-900 animate-pulse py-2.5 px-4 rounded-xl bg-cyan-50/90 border border-cyan-200/80">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                  <span className="font-bold text-cyan-950">Hearing:</span>
                  <span className="italic text-cyan-900 font-semibold truncate">
                    {transcriptText ? `"${transcriptText}"` : "Listening to your voice... speak now"}
                  </span>
                </div>
              )}
            </div>

            {/* Input & Microphone Bar */}
            <div className="pt-3 border-t border-slate-200/80 flex items-center gap-3">
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
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                  audioState === "PATIENT_LISTENING"
                    ? "bg-rose-500 text-white animate-pulse shadow-md ring-4 ring-rose-200"
                    : audioState === "DOCTOR_SPEAKING"
                    ? "bg-amber-500 text-white hover:bg-amber-600 ring-4 ring-amber-200"
                    : "bg-slate-950 hover:bg-slate-800 text-white shadow-sm"
                }`}
                title={audioState === "DOCTOR_SPEAKING" ? "Interrupt doctor" : "Toggle microphone"}
              >
                <Mic className="w-6 h-6" />
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
                className="flex-1 bg-slate-50/90 border border-slate-200/90 rounded-xl px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30 focus:bg-white"
              />

              <PremiumButton
                variant="primary"
                size="md"
                onClick={() => {
                  if (typedInput.trim()) {
                    const t = typedInput.trim();
                    setTypedInput("");
                    if (audioState === "DOCTOR_SPEAKING") triggerBargeIn(t);
                    else handleUserUtterance(t);
                  }
                }}
                icon={<Send className="w-4 h-4" />}
              >
                Send
              </PremiumButton>
            </div>

          </section>

          {/* RIGHT PANEL (5 cols): CLINICAL BOARD HERO + UNIFIED STATUS */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* HERO MODULE: LIVE CLINICAL BOARD REASONING */}
            <section className="relative flex flex-col gap-4 p-5 sm:p-6 rounded-2xl bg-[#F8FAFC] border border-slate-200/90 shadow-sm overflow-hidden">
              
              {/* Subtle CursorGrid background texture */}
              <CursorGrid
                cellSize={50}
                radius={100}
                falloff="smooth"
                holdTime={250}
                fadeDuration={700}
                lineWidth={0.8}
                maxOpacity={0.07}
                fillOpacity={0}
                gridOpacity={0.02}
                cellRadius={0}
                clickPulse={true}
                pulseSpeed={600}
              />

              <div className="relative z-10 flex flex-col gap-5">
                
                {/* Module Header: Clean, Human-Scale Hierarchy with Subtle Active Status Beam */}
                <div className="relative flex flex-col gap-3 pb-3 border-b border-slate-200/80">
                  {/* Very subtle animated cyan status beam behind the active agent indicator */}
                  <div className="absolute -top-1 left-0 w-36 h-8 bg-cyan-500/10 rounded-full blur-xl pointer-events-none -z-10 animate-pulse" />

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
                        Clinical Board
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                        <span className="text-sm font-bold text-slate-900 uppercase tracking-wide font-mono">
                          {boardData?.phase === "deliberating" || boardData?.phase === "specialist_deliberation" || boardData?.phase === "board_decision" || boardData?.phase === "decided" || (boardData?.opinions && boardData.opinions.length > 1)
                            ? "Live Deliberation"
                            : "Primary Intake"}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-mono text-slate-500 font-semibold">
                          {(() => {
                            const count = boardData?.opinions?.length || (boardData?.deliberation_messages && boardData.deliberation_messages.length > 1 ? 2 : 1);
                            return `${count} ${count === 1 ? "specialist active" : "specialists active"}`;
                          })()}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50/90 text-cyan-800 border border-cyan-200/90 text-xs font-mono font-bold shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse" />
                      Multidisciplinary
                    </span>
                  </div>
                </div>

                {/* React Bits MovingBorder Segmented Tab Navigation */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200/60 text-sm font-semibold">
                  <div className="flex-1">
                    <MovingBorder active={activeRightTab === "board"} borderRadius="10px" duration={3.5}>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("board")}
                        className={`w-full py-2 px-3.5 rounded-lg transition-all cursor-pointer text-center ${
                          activeRightTab === "board"
                            ? "text-slate-950 font-bold shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                        }`}
                      >
                        Deliberation
                      </button>
                    </MovingBorder>
                  </div>

                  <div className="flex-1">
                    <MovingBorder active={activeRightTab === "context"} borderRadius="10px" duration={3.5}>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("context")}
                        className={`w-full py-2 px-3.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === "context"
                            ? "text-slate-950 font-bold shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                        }`}
                      >
                        <span>Context</span>
                        {hasContextFacts && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-teal-100 text-teal-800 font-bold">
                            {contextKnownFacts.length}
                          </span>
                        )}
                      </button>
                    </MovingBorder>
                  </div>

                  <div className="flex-1">
                    <MovingBorder active={activeRightTab === "care"} borderRadius="10px" duration={3.5}>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab("care")}
                        className={`w-full py-2 px-3.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === "care"
                            ? "text-slate-950 font-bold shadow-2xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                        }`}
                      >
                        <span>Care Options</span>
                        {nearbyHospitals && nearbyHospitals.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-100 text-emerald-800 font-bold">
                            {nearbyHospitals.length}
                          </span>
                        )}
                      </button>
                    </MovingBorder>
                  </div>
                </div>

                {/* TAB: DELIBERATION STREAM (HUMAN-SCALE AGENT CARDS + REACT BITS ANIMATION) */}
                {activeRightTab === "board" && (
                  <div className="flex flex-col gap-4">
                    
                    {/* Active Inquiry Specialist Banner (if awaiting response) */}
                    {boardData?.phase === "active_inquiring" && boardData.active_requests && boardData.active_requests.length > 0 && (
                      <AnimatedContent contentKey={boardData.active_requests[0].targetSlot}>
                        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex flex-col gap-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">
                              {boardData.active_requests[0].doctorName.replace(", MD, FACC", "").replace(", MD, PhD", "").replace(", MD, FAAP", "").replace(", MD", "")}
                            </span>
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                              {boardData.active_requests[0].targetSlot.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 italic leading-relaxed">
                            "{boardData.active_requests[0].suggestedQuestion}"
                          </p>
                        </div>
                      </AnimatedContent>
                    )}

                    {/* Agent Cards Feed with GlowingBorder & Tiny Pulse Motion */}
                    <div className="flex flex-col gap-3.5">
                      {(() => {
                        if (!boardData?.deliberation_messages || boardData.deliberation_messages.length === 0) {
                          return [
                            {
                              id: "intake-lead",
                              doctorName: "Dr. Sarah Chen",
                              specialty: "Primary Care & Clinical Triage Lead",
                              role: "lead",
                              statusText: callActive ? "LIVE" : "STANDBY",
                              statusColor: "bg-cyan-500",
                              badgeLabel: "PRIMARY INTAKE",
                              badgeColor: "text-cyan-800 bg-cyan-50 border-cyan-200",
                              isLive: callActive,
                              content: callActive
                                ? "Active clinical intake in progress. Specialist agents monitor incoming acoustic biomarkers and symptom reports."
                                : "Primary care lead ready on standby. Initiate voice consultation to evaluate symptoms.",
                              timestamp: "Live",
                              evidence: [] as Array<{ name: string; value: string }>
                            }
                          ];
                        }

                        const events: Array<{
                          id: string;
                          doctorName: string;
                          specialty: string;
                          role: string;
                          statusText: string;
                          statusColor: string;
                          badgeLabel: string;
                          badgeColor: string;
                          isLive: boolean;
                          content: string;
                          timestamp: string;
                          evidence: Array<{ name: string; value: string }>;
                        }> = [];

                        boardData.deliberation_messages.forEach((msg, idx) => {
                          if (msg.speakerRole === "safety_arbiter") return;

                          if (msg.speakerRole === "tool") {
                            if (events.length > 0) {
                              const lastEvent = events[events.length - 1];
                              const cleanToolName = (msg.tool_data?.tool_name || "Diagnostic Tool")
                                .replace(/^compute_|^analyze_|^calculate_/, "")
                                .toUpperCase();
                              const summary = msg.tool_data?.summary || msg.content.replace(/^Executed [^:]+:\s*/, "");
                              lastEvent.evidence.push({ name: cleanToolName, value: summary });
                            }
                            return;
                          }

                          const isLead = msg.speakerRole === "lead";
                          const cleanDocName = msg.doctorName
                            .replace(", MD, FACC", "")
                            .replace(", MD, PhD", "")
                            .replace(", MD, FAAP", "")
                            .replace(", MD, DVD", "")
                            .replace(", MD", "");
                          const specialtyClean = msg.specialty || (isLead ? "Primary Care & Clinical Triage Lead" : "Clinical Specialist");

                          let statusText = isLead ? "LIVE" : "REVIEWING";
                          let statusColor = isLead ? "bg-cyan-500" : "bg-purple-500";
                          let badgeLabel = isLead ? "PRIMARY INTAKE" : "ASSESSMENT";
                          let badgeColor = isLead
                            ? "text-cyan-800 bg-cyan-50 border-cyan-200"
                            : "text-purple-800 bg-purple-50 border-purple-200";

                          if (msg.type === "challenge") {
                            badgeLabel = "PEER CHALLENGE";
                            badgeColor = "text-amber-800 bg-amber-50 border-amber-200";
                            statusText = "CHALLENGING";
                            statusColor = "bg-amber-500";
                          } else if (msg.type === "synthesis") {
                            badgeLabel = "SYNTHESIS";
                            badgeColor = "text-emerald-800 bg-emerald-50 border-emerald-200";
                            statusText = "ALIGNED";
                            statusColor = "bg-emerald-500";
                          }

                          const evidence: Array<{ name: string; value: string }> = [];
                          if (msg.references && msg.references.length > 0) {
                            msg.references.forEach((ref) => {
                              const cit = boardData?.citations?.[ref];
                              evidence.push({
                                name: ref,
                                value: cit ? cit.title : "Clinical Protocol Reference"
                              });
                            });
                          }

                          events.push({
                            id: msg.id || `evt-${idx}`,
                            doctorName: cleanDocName,
                            specialty: specialtyClean,
                            role: msg.speakerRole,
                            statusText,
                            statusColor,
                            badgeLabel,
                            badgeColor,
                            isLive: isLead || msg.type === "synthesis",
                            content: msg.content.replace(/^"|"$/g, ""),
                            timestamp: msg.timestamp || "12:48 PM",
                            evidence
                          });
                        });

                        return events;
                      })().map((evt, idx) => {
                        return (
                          <AnimatedContent key={evt.id || idx} contentKey={evt.content}>
                            <GlowingBorder
                              active={evt.isLive}
                              glowColor={evt.role === "lead" ? "cyan" : "purple"}
                              intensity="subtle"
                              className="p-4 sm:p-5 bg-white shadow-2xs flex flex-col gap-3 transition-shadow hover:shadow-xs border"
                            >
                              {/* Card Header: Doctor Name, Specialty, Status & Timestamp */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${evt.statusColor} ${evt.isLive ? "animate-pulse" : ""}`} />
                                    <h4 className="text-base font-bold text-slate-900 tracking-tight">
                                      {evt.doctorName}
                                    </h4>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {evt.specialty}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border ${evt.badgeColor}`}>
                                    {evt.statusText}
                                  </span>
                                  <span className="text-xs font-mono text-slate-400 font-medium">
                                    {formatTimelineTime(evt.timestamp)}
                                  </span>
                                </div>
                              </div>

                              {/* Card Body: High-Legibility Clinical Summary */}
                              <p className="text-sm text-slate-700 font-normal leading-relaxed">
                                {evt.content}
                              </p>

                              {/* Evidence Accordion / Reference Footnote */}
                              {evt.evidence && evt.evidence.length > 0 && (
                                <div className="pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => toggleEvidence(evt.id)}
                                    className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center gap-1.5 cursor-pointer transition-colors"
                                  >
                                    {expandedEvidenceIds[evt.id] ? (
                                      <>
                                        <ChevronDown className="w-4 h-4" />
                                        <span>Hide clinical references</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronRight className="w-4 h-4" />
                                        <span>Evidence & guidelines referenced ({evt.evidence.length})</span>
                                      </>
                                    )}
                                  </button>

                                  {expandedEvidenceIds[evt.id] && (
                                    <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2 animate-in fade-in duration-200">
                                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                                        Evidence & Validated Guidelines
                                      </span>
                                      <div className="space-y-1.5">
                                        {evt.evidence.map((item, eIdx) => (
                                          <div key={eIdx} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white border border-slate-200/60 text-xs">
                                            <span className="font-mono font-bold text-xs text-slate-800 uppercase">
                                              {item.name}
                                            </span>
                                            <span className="font-medium text-xs text-slate-600 text-right truncate max-w-[220px]">
                                              {item.value}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </GlowingBorder>
                          </AnimatedContent>
                        );
                      })}
                    </div>

                    {/* React Bits SpotlightCard for Board Consensus Focal Point */}
                    <AnimatedContent contentKey={boardData?.consensus_summary || boardData?.opinions?.length || "consensus"}>
                      <SpotlightCard
                        isActive={Boolean(boardData?.opinions && boardData.opinions.length > 0)}
                        spotlightColor="rgba(6, 182, 212, 0.12)"
                        className={`p-5 rounded-2xl bg-white border shadow-2xs flex flex-col gap-2.5 transition-all ${
                          boardData?.opinions && boardData.opinions.length > 0
                            ? "border-cyan-300/80 shadow-[0_0_20px_-4px_rgba(6,182,212,0.18)]"
                            : "border-slate-200/90"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                            <span className="text-amber-500 text-base">✦</span>
                            <span>Board Consensus</span>
                          </div>
                          <span className="text-xs font-mono text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 font-bold">
                            {boardData?.opinions && boardData.opinions.length > 0
                              ? `${boardData.opinions.length} ${boardData.opinions.length > 1 ? "specialists" : "specialist"} aligned`
                              : (hasContextFacts || messages.length > 1)
                              ? "Intake in progress"
                              : "Awaiting clinical evidence"}
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                          {boardData?.conflicts && boardData.conflicts.length > 0
                            ? "Dual-activation acute protocol initiated under inter-specialist review."
                            : (boardData?.opinions?.some(o => o.risk_level === "high") || triageData?.triageLevel === "emergency" || (triageData?.esiScore && triageData.esiScore <= 2))
                            ? "Emergency evaluation indicated under specialist consensus."
                            : (!boardData?.opinions || boardData.opinions.length === 0 || triageData?.triageLevel === "gathering_history" || boardData?.phase === "gathering_history" || boardData?.phase === "dormant" || boardData?.phase === "active_inquiring")
                            ? (boardData?.consensus_summary || (contextKnownFacts.length > 0 ? "Primary care intake gathering clinical evidence before specialist board review." : "The board will form a clinical disposition after sufficient history is gathered."))
                            : "Presentation evaluated as non-emergent. Outpatient clinical monitoring recommended."}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                          Specialist consensus updates dynamically across every turn of the consultation based on acoustic biomarkers and symptom reports.
                        </p>
                      </SpotlightCard>
                    </AnimatedContent>

                  </div>
                )}

                {/* TAB: CLINICAL CONTEXT */}
                {activeRightTab === "context" && (
                  <div className="flex flex-col gap-4 py-1">
                    <SpotlightCard
                      spotlightColor="rgba(20, 184, 166, 0.12)"
                      className="p-4 sm:p-5 bg-white border border-slate-200/90 shadow-2xs flex flex-col gap-4"
                    >
                      
                      {/* Context Header: Eyebrow, Title & Subtitle + Percentage */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-teal-700">
                            CONTEXT
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {contextTitle}
                          </h3>
                          <p className="text-xs text-slate-500 font-normal flex items-center gap-1.5">
                            {(audioState === "PATIENT_LISTENING" || audioState === "PROCESSING_PATIENT" || audioState === "PROCESSING_INTERRUPTION") && (
                              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                            )}
                            <span>{contextSubtitle}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                            <CountUp to={completenessPercent} duration={1.0} />%
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                        <div
                          className="h-full bg-linear-to-r from-teal-500 via-emerald-500 to-cyan-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(completenessPercent === 0 ? 0 : 4, completenessPercent))}%`
                          }}
                        />
                      </div>

                      {/* Section 1: WHAT WE KNOW / CONFIRMED */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                            WHAT WE KNOW {hasContextFacts ? `(${contextKnownFacts.length})` : ""}
                          </span>
                        </div>

                        {!hasContextFacts ? (
                          <div className="py-2.5 px-3 rounded-xl bg-slate-50/80 border border-slate-200/60 flex flex-col gap-0.5">
                            <p className="text-xs sm:text-sm text-slate-600 font-medium">
                              No clinical information captured yet.
                            </p>
                            <p className="text-[11px] text-slate-400">
                              Start the consultation to build the patient's clinical context.
                            </p>
                          </div>
                        ) : (
                          <AnimatedContent contentKey={contextKnownFacts.length}>
                            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                              {contextKnownFacts.map((fact: string, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2.5 p-2 rounded-lg bg-teal-50/40 border border-teal-100/80 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                                  <span>{formatClinicalFact(fact)}</span>
                                </div>
                              ))}
                            </div>
                          </AnimatedContent>
                        )}
                      </div>

                      {/* Section 2: WHAT'S STILL NEEDED / STILL NEEDED */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                            WHAT'S STILL NEEDED {contextMissingDimensions.length > 0 ? `(${contextMissingDimensions.length})` : ""}
                          </span>
                        </div>

                        {contextMissingDimensions.length === 0 ? (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-xs sm:text-sm text-emerald-800 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Clinical context sufficient for diagnostic evaluation</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {contextMissingDimensions.map((dim: string, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2.5 py-1 px-2 text-xs sm:text-sm text-slate-700 font-normal"
                              >
                                <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{dim}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer Guidance Note */}
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
                        Context will update automatically as Dr. Sarah Chen learns more.
                      </div>

                    </SpotlightCard>
                  </div>
                )}

                {/* TAB: CARE OPTIONS & HOSPITAL RAG */}
                {activeRightTab === "care" && (
                  <div className="flex flex-col gap-3 py-1">
                    {/* Location Permission & Status Banner */}
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                          <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                          <span>Emergency Care Network</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                          Verified Registry RAG
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Verified emergency departments matched by clinical specialty, verified 24/7 ER status, and strict Haversine distance.
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span className={`w-2 h-2 rounded-full ${userLocation ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
                          <span className="font-medium text-[11px]">
                            {userLocation ? "Location verified (GPS)" : "Default Hub (Andhra Pradesh / Telangana)"}
                          </span>
                        </div>
                        {!userLocation && (
                          <button
                            type="button"
                            onClick={handleRequestLocation}
                            className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 flex items-center gap-1 cursor-pointer bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200 hover:bg-cyan-100 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Share Location</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Hospital Candidates List */}
                    <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {nearbyHospitals && nearbyHospitals.length > 0 ? (
                        nearbyHospitals.map((h: any, idx: number) => {
                          const isGov = h.ownership === "government";
                          const isTrust = h.ownership === "trust";
                          const ownershipLabel = isGov ? "Government" : isTrust ? "Trust Hospital" : "Private Center";

                          const isVerifiedMatch = h.clinicalSuitability === "verified_match";
                          const isGeneralER = h.clinicalSuitability === "general_emergency";

                          const isTrafficAware = h.routingMode === "traffic_aware";
                          const isRoadNetwork = h.routingMode === "road_network";

                          return (
                            <div
                              key={h.id || idx}
                              className={`p-3.5 rounded-xl bg-white border shadow-2xs flex flex-col gap-2 transition-all hover:border-slate-300 ${
                                idx === 0 && isVerifiedMatch ? "border-cyan-400/80 ring-1 ring-cyan-200" : "border-slate-200/90"
                              }`}
                            >
                              {/* Header: Name, City, and Travel ETA */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                      {h.name}
                                    </span>
                                    {idx === 0 && isVerifiedMatch && h.estimatedTravelMinutes && (
                                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800 font-extrabold tracking-wide">
                                        ⚡ Fastest Reachable
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500 font-medium truncate">
                                    {h.city}, {h.address}
                                  </span>
                                </div>

                                <div className="flex flex-col items-end shrink-0">
                                  <span className="font-mono text-xs font-black text-cyan-950 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                    {h.durationDisplay && h.durationDisplay !== "Driving time unavailable"
                                      ? h.durationDisplay
                                      : h.distanceDisplay || `~${Math.round(h.distanceKm)} km`}
                                  </span>
                                  {h.roadDistanceKm && (
                                    <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                      ~{h.roadDistanceKm} km by road
                                    </span>
                                  )}
                                </div>
                              </div>

                                {/* Badges: Routing Mode, Live Congestion, Clinical Suitability, Ownership */}
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                                  {/* Routing Mode Badge */}
                                  {isTrafficAware ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                      🚗 Traffic-Aware ETA
                                    </span>
                                  ) : isRoadNetwork ? (
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
                                      🚗 Road-Network Estimate
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                      📏 Straight-Line Distance
                                    </span>
                                  )}

                                  {/* Live Traffic Congestion Telemetry */}
                                  {h.congestionLevel && h.congestionLevel !== "unknown" && (
                                    <span className={`px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                                      h.congestionLevel === "heavy"
                                        ? "bg-rose-50 text-rose-800 border-rose-200"
                                        : h.congestionLevel === "moderate"
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        h.congestionLevel === "heavy"
                                          ? "bg-rose-500"
                                          : h.congestionLevel === "moderate"
                                          ? "bg-amber-500"
                                          : "bg-emerald-500"
                                      }`} />
                                      <span>
                                        {h.congestionLevel === "heavy" ? "Heavy Traffic" : h.congestionLevel === "moderate" ? "Moderate Traffic" : "Flowing Smoothly"}
                                        {h.trafficDelayMinutes ? ` (+${h.trafficDelayMinutes}m)` : ""}
                                      </span>
                                    </span>
                                  )}

                                  {/* Clinical Suitability Badge */}
                                  {isVerifiedMatch ? (
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-900 border border-cyan-300 font-bold">
                                      ✓ Verified Specialty & ER
                                    </span>
                                  ) : isGeneralER ? (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                      ● 24/7 ER (Specialty Unverified)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                      ○ Discovered Facility
                                    </span>
                                  )}

                                  {/* Ownership Badge */}
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                                    🏛 {ownershipLabel}
                                  </span>
                                </div>

                                {/* Typical vs Traffic Delay Sub-bar */}
                                {isTrafficAware && h.staticDurationMinutes && h.trafficDelayMinutes !== undefined && h.trafficDelayMinutes > 0 && (
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 bg-amber-50/60 px-2.5 py-1 rounded-lg border border-amber-100/80">
                                    <span className="font-semibold text-amber-900">Traffic Impact:</span>
                                    <span>Typical drive is ~{h.staticDurationMinutes} min · Current congestion adds +{h.trafficDelayMinutes} min</span>
                                  </div>
                                )}

                              {/* Affordability Notes (if verified) */}
                              {h.affordabilityNotes && (
                                <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed italic">
                                  💡 {h.affordabilityNotes}
                                </p>
                              )}

                              {/* Footer: Provenance & Direct Dial */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]" title={`${h.source} · ${h.freshnessLabel || "Calculated just now"}`}>
                                  ✓ {h.freshnessLabel || h.source || "Verified Registry"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleInitiateEmergencyCall(h.emergencyPhone || h.phone || "108", h.name)}
                                  className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                >
                                  <PhoneCall className="w-3 h-3 text-emerald-400" />
                                  <span>Call {h.emergencyPhone || "108"}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 rounded-xl bg-white border border-slate-200 text-center flex flex-col items-center justify-center text-slate-400 gap-2">
                          <Building2 className="w-8 h-8 text-slate-300" />
                          <p className="text-xs font-bold text-slate-700">No constraints triggered yet</p>
                          <p className="text-[11px] text-slate-500 max-w-xs">
                            Care Network routing engages when financial constraints, remote outskirts, or transportation barriers are expressed by the patient.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* National Emergency Protocols Box */}
                    <div className="mt-2 p-3.5 rounded-xl bg-red-50/80 border border-red-200 flex flex-col gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-800">
                        Emergency Dispatch (India)
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleInitiateEmergencyCall("108", "Ambulance")}
                          className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call 108 (Ambulance)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInitiateEmergencyCall("112", "National Emergency")}
                          className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Call 112 (National)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </section>

            {/* UNIFIED CLINICAL STATUS & SAFETY MODULE */}
            <GlowingBorder
              active={true}
              glowColor="emerald"
              intensity="subtle"
              className="p-5 sm:p-6 bg-white border border-slate-200/90 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold uppercase tracking-wider text-slate-900 font-mono">
                    Clinical Safety
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ACTIVE</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                
                {/* Left Card: Live Triage */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        Live Triage
                      </span>
                      {triageData ? (
                        <span className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                          triageData.triageLevel === "emergency"
                            ? "bg-rose-50 text-rose-700 border-rose-200 font-extrabold"
                            : triageData.triageLevel === "priority"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : triageData.triageLevel === "gathering_history"
                            ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {triageData.triageLevel === "gathering_history" ? "Intake Active" : triageData.triageLevel}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400">Standby</span>
                      )}
                    </div>

                    <div className="mt-3">
                      {triageData ? (
                        <AnimatedContent contentKey={`${triageData.esiScore}-${triageData.triageLevel}`}>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                              ESI Acuity Index
                            </span>
                            {triageData.esiScore !== null && triageData.esiScore !== undefined ? (
                              <span className={`text-3xl font-black font-mono leading-tight mt-0.5 ${
                                triageData.triageLevel === "emergency" ? "text-rose-600" : "text-slate-900"
                              }`}>
                                Level {triageData.esiScore}
                              </span>
                            ) : (
                              <span className="text-3xl font-black font-mono leading-tight text-slate-300 mt-0.5">
                                —
                              </span>
                            )}
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug mt-1">
                              {triageData.triageTitle.replace(/^ESI LEVEL \d+:\s*(EMERGENT|URGENT|ROUTINE)?\s*—?\s*/i, "") || "Clinical History Gathering"}
                            </h4>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                              {triageData.recommendedAction}
                            </p>
                          </div>
                        </AnimatedContent>
                      ) : (
                        <div className="py-1 flex flex-col gap-1">
                          <p className="text-sm font-semibold text-slate-700">Awaiting symptoms</p>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Your consultation is being assessed as you provide more information.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    {triageData?.triageLevel === "emergency" ? (
                      <Link
                        href="/emergency"
                        className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Hospital Dispatch →</span>
                      </Link>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span>Emergency dispatch standby</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Card: Safety Guard */}
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                        Safety Guard
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50/80 px-2 py-0.5 rounded-full border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Protected</span>
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                        Emergency safety rules remain active throughout the consultation.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setShowTechnicalTrace(!showTechnicalTrace)}
                      className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Safety details</span>
                      {showTechnicalTrace ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

              </div>

              {/* Patient-Facing Safety Details Drawer */}
              {showTechnicalTrace && (
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-xs text-slate-700 leading-relaxed animate-in fade-in duration-200 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-900 font-mono text-[11px] uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Consultation Safety Policy</span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Safety protection is active. MedVoice continuously checks for critical symptoms during the consultation. If an emergency concern is detected, the consultation will prioritize urgent care guidance.
                  </p>
                </div>
              )}
            </GlowingBorder>

          </div>

        </div>
        </section>

        {/* HOW MEDVOICE THINKS — DELIBERATION ARCHITECTURE GALLERY */}
        <section className="mt-12 sm:mt-16 flex flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-800 font-bold">
              <Zap className="w-3.5 h-3.5 text-cyan-600" />
              <span>How MedVoice Thinks</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight leading-tight">
              Autonomous Multidisciplinary Deliberation Architecture
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
              A deterministic multi-agent framework where specialists evaluate acoustic biomarkers, cross-examine differential diagnoses, and enforce ESI v4 safety invariants.
            </p>
          </div>

          <div className="w-full p-2 sm:p-2.5 rounded-2xl bg-white/75 backdrop-blur-xs border border-slate-200/80 shadow-xs">
            <AccordionGallery
              items={METHODOLOGY_STAGES}
              height={500}
              accentColor="#06B6D4"
              expandRatio={0.65}
            />
          </div>
        </section>

        {/* HEROIC FINAL CTA — OPEN UNBOXED FINALE SITTING DIRECTLY ON ATMOSPHERIC AURORA */}
        <section className="py-16 sm:py-20 text-center flex flex-col items-center gap-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-100/90 border border-cyan-300/80 text-xs font-bold text-cyan-950 tracking-wider uppercase shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span>Autonomous Voice Consultation</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight max-w-2xl leading-[1.15]">
            Ready to initiate patient intake?
          </h2>

          <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed font-normal">
            Begin hands-free consultation with Dr. Sarah Chen while specialist agents analyze symptoms concurrently.
          </p>

          <div className="pt-2">
            <PremiumButton
              size="lg"
              variant="primary"
              onClick={() => {
                if (!callActive) startConsultation();
                const el = document.getElementById("workspace");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              ✦ Start Voice Consultation
            </PremiumButton>
          </div>
        </section>

        {/* CLINICAL ENCOUNTER SOAP REVIEW & FINALIZATION MODAL */}
        <SoapReportModal
          isOpen={showSoapModal}
          onClose={() => setShowSoapModal(false)}
          encounter={{
            id: `ENC-${Date.now().toString().slice(-6)}`,
            patientName: patientDisplayName,
            doctorId: selectedDoctor.id,
            doctorName: selectedDoctor.name,
            specialty: selectedDoctor.department,
            callDuration: callDuration,
            transcript: messages.map((m) => ({
              role: m.role,
              text: m.text,
              timestamp: m.timestamp,
            })),
            triageLevel: triageData?.triageLevel || (boardData?.phase === "decided" ? "priority" : "routine"),
            triageTitle: triageData?.triageTitle || "Clinical Voice Consultation Evaluation",
            esiScore: triageData?.esiScore ?? (triageData?.triageLevel === "emergency" ? 2 : 3),
            detectedSymptoms: triageData?.detectedSymptoms || [],
            icdCodes: triageData?.icdCodes || ["Z76.0"],
            recommendedAction: triageData?.recommendedAction || "Consultation complete. Follow clinical disposition.",
            soap: triageData?.soap || {
              subjective: "",
              objective: "",
              assessment: "",
              plan: "",
            },
            auditSha256: boardData?.trace?.audit_sha256,
            userId: user?.id,
          }}
        />

        {/* EMERGENCY CALL CONFIRMATION MODAL */}
        {emergencyCallTarget?.isOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-dialog-title"
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setEmergencyCallTarget(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="emergency-dialog-title" className="text-base font-bold text-slate-900 leading-snug">
                      {emergencyCallTarget.title}
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      Target: {emergencyCallTarget.number} ({emergencyCallTarget.serviceName})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyCallTarget(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col gap-1.5">
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {emergencyCallTarget.description}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  MedVoice provides care guidance and navigation. Please confirm before initiating this outgoing call.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmergencyCallTarget(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEmergencyCall}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Open dialer ({emergencyCallTarget.number}) →</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      <AppFooter />
    </div>
  );
}


