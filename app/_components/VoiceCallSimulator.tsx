"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Activity,
  Zap,
  PhoneCall,
  ExternalLink,
  Building2,
  ArrowRight,
  Sparkles,
  Check,
  Search,
  Crosshair
} from "lucide-react";

interface TriageResult {
  triage_level: "emergency" | "priority" | "routine";
  detected_symptoms: string[];
  recommended_action: string;
  soap_summary: string;
}

interface HospitalItem {
  id: string;
  name: string;
  specialty: string[];
  city: string;
  state: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  latitude: number;
  longitude: number;
  isEmergency24x7: boolean;
  rating: number;
  accreditation: string[];
  distanceKm: number;
  googleMapsUrl: string;
  cancerSpecialistsAvailable?: boolean;
}

const SAMPLE_PROMPTS = [
  "58yo male with severe crushing chest pain radiating to left arm and cold sweats",
  "62yo patient with acute oncology / cancer symptoms needing urgent specialist hospital triage",
  "4yo child with 102.8°F fever, lethargy, coughing, drinking fluids",
  "22yo athlete with sudden right lower quadrant abdominal pain and nausea",
];

export function VoiceCallSimulator() {
  const [customInput, setCustomInput] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);
  const [liveTriage, setLiveTriage] = useState<TriageResult | null>(null);

  const [reportHospitals, setReportHospitals] = useState<HospitalItem[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState<boolean>(false);
  const [locationSearchInput, setLocationSearchInput] = useState<string>("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedCategoryName, setDetectedCategoryName] = useState<string>("Emergency & Cardiac Trauma Centers");

  const fetchReportHospitals = useCallback(
    async (promptText: string, searchLocation?: string, coords?: { lat: number; lng: number } | null) => {
      setHospitalsLoading(true);
      try {
        const textLower = promptText.toLowerCase();
        let specialty = "emergency";
        let categoryName = "24/7 Emergency & Trauma Facilities";

        if (textLower.includes("cancer") || textLower.includes("oncology") || textLower.includes("tumor") || textLower.includes("chemo")) {
          specialty = "cancer";
          categoryName = "Oncology & Specialized Cancer Centers";
        } else if (textLower.includes("chest pain") || textLower.includes("heart") || textLower.includes("cardiac") || textLower.includes("arm pain")) {
          specialty = "cardiology";
          categoryName = "Cardiac Emergency & Heart Centers";
        } else if (textLower.includes("fever") || textLower.includes("child") || textLower.includes("pediatric")) {
          specialty = "pediatrics";
          categoryName = "Pediatric & Family Emergency Centers";
        }

        setDetectedCategoryName(categoryName);

        const params = new URLSearchParams();
        params.append("specialty", specialty);
        if (searchLocation && searchLocation.trim()) {
          params.append("query", searchLocation.trim());
        }
        if (coords?.lat && coords?.lng) {
          params.append("lat", coords.lat.toString());
          params.append("lng", coords.lng.toString());
        }

        const res = await fetch(`/api/hospitals?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hospitals) {
            setReportHospitals(data.hospitals.slice(0, 4));
          }
        }
      } catch (e) {
        console.warn("Error fetching report hospitals:", e);
      } finally {
        setHospitalsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
        },
        () => {}
      );
    }
  }, []);

  const handleRunTriage = async (textToTriage: string) => {
    setIsProcessing(true);
    setHasInteracted(true);
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
      fetchReportHospitals(textToTriage, locationSearchInput, userCoords);
    }
  };

  const handleLocationSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReportHospitals(customInput || SAMPLE_PROMPTS[0], locationSearchInput, userCoords);
  };

  const handleDetectGPSInReport = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        fetchReportHospitals(customInput || SAMPLE_PROMPTS[0], locationSearchInput, coords);
      });
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      setIsListening(false);
      if (customInput.trim()) {
        handleRunTriage(customInput);
      }
    } else {
      setIsListening(true);
      if (!customInput.trim()) {
        const defaultPrompt = SAMPLE_PROMPTS[0];
        setCustomInput(defaultPrompt);
        setTimeout(() => {
          setIsListening(false);
          handleRunTriage(defaultPrompt);
        }, 1800);
      }
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

  const getReasoningText = (level: string, promptText: string) => {
    const textLower = promptText.toLowerCase();
    if (textLower.includes("chest pain") || textLower.includes("heart") || level === "emergency") {
      return "Recommended because this assessment requires immediate emergency cardiac evaluation.";
    }
    if (textLower.includes("cancer") || textLower.includes("oncology")) {
      return "Recommended because this patient presents with high-risk oncology complications.";
    }
    if (textLower.includes("fever") || textLower.includes("child")) {
      return "Recommended for urgent pediatric evaluation and fever management.";
    }
    return "Recommended based on active clinical triage assessment & proximity.";
  };

  const parseSoap = (soapRaw: string) => {
    let subjective = "Patient presents with acute symptoms requiring evaluation.";
    let assessment = "Urgent clinical indicators identified by NLP engine.";
    let plan = "Direct clinical pathway transfer initiated.";

    if (soapRaw.includes("S:") || soapRaw.includes("P:")) {
      const parts = soapRaw.split(/(?:S:|O:|A:|P:)/g).filter(Boolean);
      if (parts.length >= 1) subjective = parts[0].trim();
      if (parts.length >= 2) assessment = parts[1].trim();
      if (parts.length >= 3) plan = parts[parts.length - 1].trim();
    } else {
      subjective = soapRaw;
    }

    return { subjective, assessment, plan };
  };

  return (
    <section id="playground" className="w-full py-8 md:py-12 bg-[#FAF9F6] border-b border-slate-200/80">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-700">
            TRY MEDVOICE
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
            Tell MedVoice what's happening.
          </h2>
          <p className="text-xs sm:text-sm font-normal text-slate-600">
            Hold to speak or type patient complaint below to trigger live clinical triage.
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-sm space-y-5 text-center">
          <div className="flex flex-col items-center justify-center pt-2 pb-1 space-y-2">
            <button
              type="button"
              onClick={handleMicClick}
              className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                isListening
                  ? "bg-rose-600 text-white ring-8 ring-rose-500/20 scale-110 shadow-lg"
                  : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-md hover:scale-105 hover:shadow-cyan-500/25"
              }`}
              title={isListening ? "Click to stop listening" : "Click to start voice input"}
            >
              <Mic className={`w-7 h-7 ${isListening ? "animate-bounce" : ""}`} />
              {isListening && (
                <span className="absolute -inset-1 rounded-full border-2 border-rose-400 animate-ping opacity-75" />
              )}
            </button>
            <span className="text-[11px] font-mono font-medium text-slate-500">
              {isListening ? "● Listening to voice input..." : "Click microphone or hold to speak"}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                rows={2}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Describe what is happening (e.g. 58yo male with severe crushing chest pain, 103°F fever)..."
                className="w-full rounded-xl border border-slate-300/90 bg-slate-50/50 p-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 font-sans resize-none shadow-2xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 text-left">
                <span className="text-xs font-mono font-medium text-slate-400 mr-1">Scenarios:</span>
                {SAMPLE_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePromptClick(prompt)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 transition-all cursor-pointer"
                  >
                    {idx === 0 ? "Pediatric Fever" : idx === 1 ? "Oncology ER" : idx === 2 ? "Chest Pain" : "Abdominal Pain"}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white px-5 py-2.5 text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-40 shrink-0"
              >
                {isProcessing ? (
                  <span>◌ Analyzing patient complaint...</span>
                ) : hasInteracted ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>✓ Analysis complete</span>
                  </>
                ) : customInput.trim() ? (
                  <>
                    <span>→ Analyze complaint</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Start voice session</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <AnimatePresence>
            {hasInteracted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pt-5 border-t border-slate-200/80 space-y-5 text-left"
              >
                {isProcessing ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-700 animate-pulse">
                      <Activity className="w-4 h-4" />
                      <span>MedVoice is analyzing patient symptoms & clinical pathways...</span>
                    </div>
                  </div>
                ) : liveTriage ? (
                  <div className="space-y-5">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 }}
                      className="space-y-2"
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Clinical Findings (ICD-10 NLP)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {liveTriage.detected_symptoms.map((symptom, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium"
                          >
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.24 }}
                      className="space-y-2 pt-2 border-t border-slate-100"
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Triage Assessment
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-3 py-1 text-xs font-mono font-bold rounded-full border ${getUrgencyBadge(liveTriage.triage_level)}`}>
                          {liveTriage.triage_level.toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {liveTriage.recommended_action}
                        </span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.36 }}
                      className="space-y-2 pt-2 border-t border-slate-100"
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        Clinical Note Document
                      </span>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5 font-sans text-xs">
                        {(() => {
                          const soap = parseSoap(liveTriage.soap_summary);
                          return (
                            <>
                              <div>
                                <span className="font-bold text-slate-900 block mb-0.5">Subjective Intake:</span>
                                <p className="text-slate-600 leading-relaxed">{soap.subjective}</p>
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block mb-0.5">Clinical Assessment:</span>
                                <p className="text-slate-600 leading-relaxed">{soap.assessment}</p>
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block mb-0.5">Care Plan & Dispatch:</span>
                                <p className="text-slate-600 leading-relaxed">{soap.plan}</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </motion.div>

                    {reportHospitals.length > 0 && reportHospitals[0] && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.48 }}
                        className="space-y-3 pt-2 border-t border-slate-100"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                            Recommended Care Facility
                          </span>

                          {/* CITY / PINCODE GPS LOCATION SEARCH FORM */}
                          <form onSubmit={handleLocationSearchSubmit} className="flex items-center gap-1.5">
                            <div className="relative">
                              <input
                                type="text"
                                value={locationSearchInput}
                                onChange={(e) => setLocationSearchInput(e.target.value)}
                                placeholder="City/Pincode..."
                                className="w-32 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                              />
                              <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2" />
                            </div>
                            <button
                              type="submit"
                              disabled={hospitalsLoading}
                              className="px-2.5 py-1 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all cursor-pointer"
                            >
                              Set City
                            </button>
                            <button
                              type="button"
                              onClick={handleDetectGPSInReport}
                              title="Use my current GPS location"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
                            >
                              <Crosshair className="w-3.5 h-3.5 text-cyan-600" />
                            </button>
                          </form>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/90 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{reportHospitals[0].name}</h4>
                              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                                {reportHospitals[0].distanceKm} km away
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{reportHospitals[0].address}</p>
                            <p className="text-[11px] text-cyan-800 font-medium pt-1">
                              {getReasoningText(liveTriage.triage_level, customInput)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <a
                              href={`tel:${reportHospitals[0].emergencyPhone || reportHospitals[0].phone}`}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Call Emergency</span>
                            </a>
                            <a
                              href={reportHospitals[0].googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              <span>Directions</span>
                            </a>
                          </div>
                        </div>

                        {reportHospitals.length > 1 && (
                          <details className="group pt-1">
                            <summary className="text-xs font-mono text-slate-500 hover:text-slate-900 cursor-pointer transition-all flex items-center gap-1">
                              <span>View {reportHospitals.length - 1} other suitable care options →</span>
                            </summary>
                            <div className="mt-3 space-y-2 pt-1">
                              {reportHospitals.slice(1).map((hosp) => (
                                <div key={hosp.id} className="bg-white p-3 rounded-lg border border-slate-200 text-xs flex items-center justify-between gap-3">
                                  <div>
                                    <h5 className="font-semibold text-slate-900">{hosp.name}</h5>
                                    <span className="text-[11px] font-mono text-slate-500">{hosp.distanceKm} km · {hosp.city}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <a
                                      href={`tel:${hosp.emergencyPhone || hosp.phone}`}
                                      className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200"
                                    >
                                      Call
                                    </a>
                                    <a
                                      href={hosp.googleMapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-bold text-[11px]"
                                    >
                                      Directions
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </motion.div>
                    )}
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
