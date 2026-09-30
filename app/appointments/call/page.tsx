"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Building2,
  Calendar,
  Clock,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  Download,
  ExternalLink,
  ChevronRight,
  Stethoscope,
  MapPin,
  RefreshCw,
  Search,
  Inbox,
  FileCheck,
} from "lucide-react";
import { Navbar } from "@/app/_components/Navbar";
import { AppFooter } from "@/app/_components/AppFooter";
import { ALL_INDIA_HOSPITALS, Hospital } from "@/lib/hospitals-india-data";
import { AppointmentRecord, DaySlots } from "@/lib/appointments/appointment-service";

interface Message {
  role: "patient" | "receptionist";
  text: string;
  time: string;
}

function AppointmentCallContent() {
  const searchParams = useSearchParams();
  const initialHospitalId = searchParams.get("hospitalId") || "apollo-hyderabad-jubilee";

  // Selected Hospital
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>(initialHospitalId);
  const [searchQuery, setSearchQuery] = useState("");
  const [isHospitalSelectorOpen, setIsHospitalSelectorOpen] = useState(false);

  const currentHospital: Hospital = useMemo(() => {
    return (
      ALL_INDIA_HOSPITALS.find((h) => h.id === selectedHospitalId) ||
      ALL_INDIA_HOSPITALS[0]
    );
  }, [selectedHospitalId]);

  // Call States: "idle" | "ringing" | "connected" | "ended"
  const [callStatus, setCallStatus] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);

  // Dialog & Booking State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [currentState, setCurrentState] = useState<"identify_issue" | "select_slot" | "collect_name" | "collect_email" | "confirmed">("identify_issue");
  const [sessionData, setSessionData] = useState<any>({});
  const [confirmedAppointment, setConfirmedAppointment] = useState<AppointmentRecord | null>(null);
  const [emailDetails, setEmailDetails] = useState<any>(null);
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [isAgentReplying, setIsAgentReplying] = useState<boolean>(false);

  // Audio / Speech Recognition Refs
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Filtered hospitals for picker
  const filteredHospitals = useMemo(() => {
    if (!searchQuery.trim()) return ALL_INDIA_HOSPITALS.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return ALL_INDIA_HOSPITALS.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [searchQuery]);

  // Call duration timer
  useEffect(() => {
    if (callStatus === "connected") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentReplying]);

  // Format call timer (mm:ss)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Speak receptionist reply using Web Speech Synthesis
  const speakText = (text: string) => {
    if (isSpeakerMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      utterance.lang = "en-IN";

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.includes("en-IN") || v.name.includes("India") || v.name.includes("Priya") || v.name.includes("Natural")) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  };

  // Setup Web Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            handleSendMessage(transcript);
          }
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [callStatus, currentState, sessionData]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Mic start error:", err);
      }
    }
  };

  // Start Call Handler
  const handleStartCall = () => {
    setCallStatus("ringing");
    setMessages([]);
    setSessionData({});
    setCurrentState("identify_issue");
    setConfirmedAppointment(null);
    setEmailDetails(null);
    setShowEmailModal(false);

    // Simulate ringtone connection delay
    setTimeout(() => {
      setCallStatus("connected");
      const greeting = `Hello! Thank you for calling the Appointment Desk at ${currentHospital.name}. I am Priya, your AI receptionist. Please tell me what health concern or symptoms you'd like to consult for today?`;
      
      setMessages([
        {
          role: "receptionist",
          text: greeting,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      speakText(greeting);
    }, 1800);
  };

  // End Call Handler
  const handleEndCall = () => {
    setCallStatus("ended");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Send message to AI Receptionist
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isAgentReplying) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const newMsg: Message = { role: "patient", text: userText.trim(), time: timeStr };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");
    setIsAgentReplying(true);

    try {
      const res = await fetch("/api/appointments/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId: currentHospital.id,
          message: userText,
          conversationHistory: [...messages, newMsg],
          currentState,
          sessionData,
        }),
      });

      const data = await res.json();

      if (data.receptionistReply) {
        const replyMsg: Message = {
          role: "receptionist",
          text: data.receptionistReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, replyMsg]);
        speakText(data.receptionistReply);
      }

      if (data.nextState) {
        setCurrentState(data.nextState);
      }

      if (data.extractedData) {
        setSessionData((prev: any) => ({ ...prev, ...data.extractedData }));
      }

      if (data.appointment) {
        setConfirmedAppointment(data.appointment);
        setEmailDetails(data.emailDetails);
        setShowEmailModal(true);
      }
    } catch (err) {
      console.error("Agent chat error:", err);
      const fallbackMsg: Message = {
        role: "receptionist",
        text: "I am having trouble connecting with our scheduling desk. Let me check your slot right away.",
        time: timeStr,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsAgentReplying(false);
    }
  };

  // Quick slot selection by clicking
  const handleSlotClick = (dayStr: string, slotTime: string, docName: string) => {
    handleSendMessage(`I would like to book the ${slotTime} slot on ${dayStr} with ${docName}.`);
  };

  // Quick preset queries adapted for clinical intake
  const quickChips = useMemo(() => {
    if (currentState === "collect_email") {
      return ["patient@gmail.com", "sashank@outlook.com", "user@hospital.org"];
    }
    if (currentState === "collect_name") {
      return ["My name is Sashank", "Rahul Sharma", "Dr. A. K. Patel"];
    }
    if (currentState === "select_slot") {
      return ["Today 04:15 PM works for me", "Tomorrow morning 10:00 AM", "Tomorrow afternoon 03:45 PM"];
    }
    return [
      "I've had severe lower back and knee joint pain for a week",
      "I need a cardiology checkup for chest palpitations",
      "High fever and cough in my 5-year-old child",
      "Skin rash and itching on my arms for 3 days",
    ];
  }, [currentState]);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#0f172a] flex flex-col font-sans selection:bg-cyan-100 selection:text-cyan-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        
        {/* Top Header Block matching the Home page typography */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200/80 text-cyan-800 text-xs font-bold mb-3 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
              <span>AI Front Desk Receptionist • Direct Hospital Outpatient Intake</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">
              Hospital Appointment Voice Hotline
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl leading-relaxed">
              Connect directly with our automated hospital front desk. Speak your symptoms naturally—our clinical receptionist matches the right medical specialist, locks your preferred slot, and emails your official outpatient clinic pass.
            </p>
          </div>

          {/* Hospital Switcher Anchor */}
          <div className="relative">
            <button
              onClick={() => setIsHospitalSelectorOpen(!isHospitalSelectorOpen)}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:border-cyan-400 hover:shadow-md transition-all group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 group-hover:scale-105 transition-transform flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 block font-semibold">
                  Calling Hospital
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[210px] block">
                  {currentHospital.name}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ml-1" />
            </button>

            {/* Hospital Dropdown Popover */}
            {isHospitalSelectorOpen && (
              <div className="absolute right-0 mt-2 w-84 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search hospital by name or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredHospitals.map((hosp) => (
                    <button
                      key={hosp.id}
                      onClick={() => {
                        setSelectedHospitalId(hosp.id);
                        setIsHospitalSelectorOpen(false);
                        if (callStatus === "connected") {
                          handleEndCall();
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                        hosp.id === currentHospital.id
                          ? "bg-cyan-50 border border-cyan-200 text-cyan-900"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-cyan-600" />
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold truncate">{hosp.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                          <span>{hosp.city}, {hosp.state}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid: Dialer / Call Interface (7 Cols) + Live Front Desk HUD (5 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Phone Interface & Conversation Card */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-[0_10px_35px_rgba(40,70,100,0.06)] overflow-hidden flex flex-col min-h-[580px]">
            
            {/* Top Call Banner */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  {callStatus === "connected" && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-ping" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">Priya • AI Front Desk Receptionist</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-800">
                      LIVE
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-slate-700">{currentHospital.name}</span>
                    <span>•</span>
                    <span className="font-mono text-cyan-700 font-bold">{currentHospital.phone || "+91-40-23607777"}</span>
                  </div>
                </div>
              </div>

              {/* Call Status Badge */}
              <div className="text-right">
                {callStatus === "connected" ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-xs font-bold shadow-2xs">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{formatTime(callDuration)}</span>
                  </div>
                ) : callStatus === "ringing" ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-mono text-xs font-bold animate-pulse">
                    <span>Connecting...</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium">
                    <span>Ready to dial</span>
                  </div>
                )}
              </div>
            </div>

            {/* Conversation Log / Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[380px] min-h-[300px] bg-slate-50/60 custom-scrollbar">
              
              {/* Idle State Banner */}
              {callStatus === "idle" && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 my-auto">
                  <div className="w-16 h-16 rounded-3xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center text-cyan-600 mb-4 shadow-sm">
                    <PhoneCall className="w-8 h-8 animate-bounce text-cyan-600" />
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900 mb-1">Click Call to Speak with AI Receptionist</h3>
                  <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
                    Connect directly with {currentHospital.name}&apos;s appointment hotline. Our voice agent will evaluate your health concerns, recommend the right specialist, and email your official clinic pass.
                  </p>
                  <button
                    onClick={handleStartCall}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <PhoneCall className="w-4 h-4 text-cyan-400" />
                    <span>Call Reception Desk ({currentHospital.phone || "108"})</span>
                  </button>
                </div>
              )}

              {/* Ringing State Banner */}
              {callStatus === "ringing" && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 my-auto">
                  <div className="w-20 h-20 rounded-full bg-cyan-100/70 border-2 border-cyan-400 flex items-center justify-center text-cyan-700 animate-pulse mb-4">
                    <PhoneCall className="w-9 h-9" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">Calling {currentHospital.name}...</h3>
                  <p className="text-xs text-slate-500">Connecting to automated clinical front desk</p>
                </div>
              )}

              {/* Connected Chat Bubbles */}
              {callStatus === "connected" && (
                <>
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === "patient" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "receptionist" && (
                        <div className="w-8 h-8 rounded-xl bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-800 shrink-0 text-xs font-bold">
                          AI
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                          msg.role === "patient"
                            ? "bg-slate-950 text-white rounded-tr-none"
                            : "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                        }`}
                      >
                        <p>{msg.text}</p>
                        <span className={`block text-[10px] mt-1.5 text-right ${msg.role === "patient" ? "text-slate-400" : "text-slate-400"}`}>
                          {msg.time}
                        </span>
                      </div>
                      {msg.role === "patient" && (
                        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shrink-0 text-xs font-bold">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isAgentReplying && (
                    <div className="flex gap-3 justify-start items-center">
                      <div className="w-8 h-8 rounded-xl bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-800 text-xs font-bold">
                        AI
                      </div>
                      <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 border border-slate-200 text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" />
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]" />
                        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]" />
                        <span className="text-[11px] font-mono text-cyan-700 font-semibold">Priya is speaking...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}

              {/* Ended State Banner */}
              {callStatus === "ended" && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 my-auto">
                  <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3">
                    <PhoneOff className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">Call Completed</h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-4">
                    {confirmedAppointment
                      ? `Your appointment is confirmed (ID: ${confirmedAppointment.id}). Confirmation was emailed to ${confirmedAppointment.patientEmail}.`
                      : "The call has ended. You can start a new call at any time."}
                  </p>
                  <button
                    onClick={handleStartCall}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Redial Hospital Desk</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Context-Aware Suggestion Chips */}
            {callStatus === "connected" && (
              <div className="px-4 py-2.5 bg-slate-100/70 border-t border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[11px] text-slate-500 shrink-0 font-semibold">Quick replies:</span>
                {quickChips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(chip)}
                    className="text-[11px] shrink-0 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer font-medium"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom Controls / Microphone & Input */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center gap-3">
              {callStatus === "connected" ? (
                <>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Voice Mic Toggle */}
                    <button
                      onClick={toggleMic}
                      className={`relative flex items-center justify-center w-11 h-11 rounded-2xl font-bold transition-all shadow-sm cursor-pointer ${
                        isListening
                          ? "bg-rose-600 text-white animate-pulse"
                          : "bg-cyan-600 hover:bg-cyan-500 text-white"
                      }`}
                      title={isListening ? "Listening... click to stop" : "Click to speak"}
                    >
                      {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                      {isListening && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-400 animate-ping" />
                      )}
                    </button>

                    {/* Speaker mute toggle */}
                    <button
                      onClick={() => {
                        setIsSpeakerMuted(!isSpeakerMuted);
                        if (typeof window !== "undefined" && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                        }
                      }}
                      className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title={isSpeakerMuted ? "Unmute AI Voice" : "Mute AI Voice"}
                    >
                      {isSpeakerMuted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5 text-cyan-700" />}
                    </button>

                    {/* End Call Button */}
                    <button
                      onClick={handleEndCall}
                      className="p-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-sm"
                      title="Hang Up"
                    >
                      <PhoneOff className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Text Input Field */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage(inputMessage);
                    }}
                    className="flex-1 w-full flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder={
                        isListening
                          ? "Listening to your voice..."
                          : currentState === "collect_email"
                          ? "Enter your email address (e.g. name@example.com)..."
                          : currentState === "collect_name"
                          ? "Enter your full name..."
                          : "Type your message or symptoms here..."
                      }
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isAgentReplying}
                      className="p-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white cursor-pointer transition-all shadow-xs"
                    >
                      <Send className="w-4 h-4 text-cyan-300" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="w-full flex items-center justify-between text-xs text-slate-500 px-2 py-1">
                  <span>Hotline standby. Direct line to OPD Scheduling.</span>
                  <button
                    onClick={handleStartCall}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold cursor-pointer transition-colors shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Start Call</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: Real-Time Smart Receptionist HUD */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Clinical Intake Status Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-[0_10px_35px_rgba(40,70,100,0.06)]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-700">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 tracking-wide uppercase font-mono">
                    Live Booking HUD
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  currentState === "confirmed"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : currentState === "select_slot"
                    ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  Phase: {currentState.replace("_", " ").toUpperCase()}
                </span>
              </div>

              {/* Matched Specialty & Doctor */}
              <div className="space-y-3">
                <div>
                  <span className="text-[11px] font-mono text-slate-500 block mb-1 font-semibold">
                    Detected Condition & Specialty:
                  </span>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90">
                    <div className="text-xs font-bold text-slate-900">
                      {sessionData.department || "Listening to your health complaint..."}
                    </div>
                    {sessionData.chiefComplaint && (
                      <div className="text-[11px] text-slate-500 mt-1 italic line-clamp-2">
                        &quot;{sessionData.chiefComplaint}&quot;
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-slate-500 block mb-1 font-semibold">
                    Assigned Medical Consultant:
                  </span>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {sessionData.doctorName || "Chief Medical Consultant (OPD)"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Consultation Fee: ₹800 (Verified OPD)</div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  </div>
                </div>

                {/* Patient Information Progress */}
                {(sessionData.patientName || sessionData.patientEmail) && (
                  <div>
                    <span className="text-[11px] font-mono text-slate-500 block mb-1 font-semibold">
                      Patient Contact Record:
                    </span>
                    <div className="p-3 rounded-2xl bg-cyan-50/50 border border-cyan-200/80 text-xs space-y-1">
                      {sessionData.patientName && (
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <User className="w-3.5 h-3.5 text-cyan-700" />
                          <span><b>Name:</b> {sessionData.patientName}</span>
                        </div>
                      )}
                      {sessionData.patientEmail && (
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <Mail className="w-3.5 h-3.5 text-cyan-700" />
                          <span><b>Email:</b> {sessionData.patientEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Available Slots Grid */}
              {sessionData.availableDays && sessionData.availableDays.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-slate-500 font-semibold">
                      Select Available Slot (Click or Speak):
                    </span>
                    <Clock className="w-3.5 h-3.5 text-cyan-600" />
                  </div>

                  <div className="space-y-3">
                    {sessionData.availableDays.map((day: DaySlots, dIdx: number) => (
                      <div key={dIdx}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          {day.date}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {day.slots.map((s) => {
                            const isSelected =
                              sessionData.selectedTime === s.time &&
                              (sessionData.selectedDate?.includes(day.date.split(" ")[0]) ||
                                (day.date.includes("Today") && sessionData.selectedDate === "Today"));

                            return (
                              <button
                                key={s.id}
                                onClick={() => handleSlotClick(day.date, s.time, sessionData.doctorName)}
                                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-cyan-50 border-cyan-500 text-cyan-950 shadow-xs"
                                    : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                                }`}
                              >
                                <div className="text-xs font-bold">{s.time}</div>
                                <div className="text-[10px] text-slate-400">{s.period}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmed Appointment Banner */}
              {confirmedAppointment && (
                <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Appointment Booked & Email Dispatched!</span>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1">
                    <div>
                      <span className="text-slate-500">Ref ID:</span>{" "}
                      <span className="font-mono font-bold text-slate-900">{confirmedAppointment.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Patient:</span>{" "}
                      <span className="font-bold text-slate-900">{confirmedAppointment.patientName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Sent to:</span>{" "}
                      <span className="font-bold text-cyan-700">{confirmedAppointment.patientEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Slot:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {confirmedAppointment.appointmentDate} at {confirmedAppointment.appointmentTime}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="mt-3 w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-300" />
                    <span>View Sent Email Receipt & Pass</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hospital Contact Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 text-xs text-slate-600 space-y-3 shadow-[0_10px_35px_rgba(40,70,100,0.04)]">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Hospital Front Desk</span>
              </div>
              <p className="leading-relaxed">
                All appointments scheduled through this AI voice desk automatically sync with {currentHospital.name}&apos;s patient queue with official doctor tokens.
              </p>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">24/7 Emergency Casualty:</span>
                <span className="font-mono font-bold text-rose-600">{currentHospital.emergencyPhone || "108"}</span>
              </div>
            </div>

          </div>

        </div>

        {/* EMAIL CONFIRMATION RECEIPT MODAL */}
        {showEmailModal && confirmedAppointment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              
              {/* Modal Header */}
              <div className="p-5 bg-gradient-to-r from-cyan-600 to-teal-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold">Appointment Pass Emailed</h3>
                    <p className="text-xs text-white/80">
                      Dispatched to <strong>{confirmedAppointment.patientEmail}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar bg-[#faf9f6]">
                
                {/* Official Pass Preview */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-cyan-700 block font-bold">Official Outpatient Pass</span>
                      <div className="text-base font-extrabold text-slate-900">{confirmedAppointment.hospitalName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{confirmedAppointment.hospitalAddress}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block font-semibold">Booking Ref</span>
                      <span className="text-base font-black font-mono text-cyan-700">{confirmedAppointment.id}</span>
                    </div>
                  </div>

                  <div className="py-4 grid grid-cols-2 gap-4 text-xs border-b border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Patient Name</span>
                      <span className="font-bold text-slate-900">{confirmedAppointment.patientName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Confirmation Email</span>
                      <span className="font-bold text-slate-900">{confirmedAppointment.patientEmail}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Consulting Specialist</span>
                      <span className="font-bold text-cyan-800">{confirmedAppointment.doctorName}</span>
                      <span className="text-[10px] text-slate-500 block">{confirmedAppointment.department}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Appointment Slot</span>
                      <span className="font-bold text-emerald-700">{confirmedAppointment.appointmentDate}</span>
                      <span className="font-mono text-slate-900 font-bold block">{confirmedAppointment.appointmentTime}</span>
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Present this pass or email at OPD reception desk</span>
                    <span className="font-bold text-emerald-700">STATUS: CONFIRMED</span>
                  </div>
                </div>

                {emailDetails?.previewUrl && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold">Test Email Mode Active:</span> The email was dispatched using the local test mail server. Click <strong>&quot;View Live Sent Email Receipt&quot;</strong> below to inspect the delivered email. To deliver into your live Gmail inbox, add your Gmail or Resend keys in <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">.env.local</code>.
                    </div>
                  </div>
                )}

                {/* Email Delivery Actions */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {/* Live Webmail Link */}
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Inbox className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Open Mail Inbox</span>
                  </a>

                  {/* If test/ethereal preview URL exists */}
                  {emailDetails?.previewUrl && (
                    <a
                      href={emailDetails.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View Live Sent Email Receipt</span>
                    </a>
                  )}

                  {/* Download Calendar Invite */}
                  <button
                    onClick={() => {
                      const icsData = `BEGIN:VCALENDAR\nVERSION:2.0\nSUMMARY:${confirmedAppointment.doctorName} - ${confirmedAppointment.hospitalName}\nLOCATION:${confirmedAppointment.hospitalName}\nSTATUS:CONFIRMED\nEND:VCALENDAR`;
                      const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.setAttribute("download", `appointment-${confirmedAppointment.id}.ics`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Calendar (.ics)</span>
                  </button>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Done
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

export default function AppointmentCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#faf9f6] text-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
      </div>
    }>
      <AppointmentCallContent />
    </Suspense>
  );
}
