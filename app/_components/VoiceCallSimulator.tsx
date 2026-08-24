"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Terminal,
  MapPin,
  Navigation,
  PhoneCall,
  ExternalLink,
  Search,
  Crosshair,
  Building2,
  Stethoscope
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
  const [customInput, setCustomInput] = useState<string>(SAMPLE_PROMPTS[0]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [liveTriage, setLiveTriage] = useState<TriageResult | null>({
    triage_level: "emergency",
    detected_symptoms: ["Substernal Chest Pain", "Left Arm Radiation", "Diaphoresis", "Dyspnea"],
    recommended_action: "Direct 911 EMS Dispatch & Warm Transfer to ER Nurse Triage",
    soap_summary: "S: 58yo M presenting with acute onset crushing chest pressure (9/10), diaphoresis & radiation. P: Trigger emergency cardiology pathway.",
  });

  // Automatically generated hospitals state inside report
  const [reportHospitals, setReportHospitals] = useState<HospitalItem[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState<boolean>(false);
  const [locationSearchInput, setLocationSearchInput] = useState<string>("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detectedCategoryName, setDetectedCategoryName] = useState<string>("Emergency & Cardiac Trauma Centers");

  // Fetch hospital recommendations based on prompt & location
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
            setReportHospitals(data.hospitals.slice(0, 4)); // Show top 4 closest
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

  // Auto-fetch GPS on initial load
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          fetchReportHospitals(SAMPLE_PROMPTS[0], "", coords);
        },
        () => {
          fetchReportHospitals(SAMPLE_PROMPTS[0], "", null);
        }
      );
    } else {
      fetchReportHospitals(SAMPLE_PROMPTS[0], "", null);
    }
  }, [fetchReportHospitals]);

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
      fetchReportHospitals(textToTriage, locationSearchInput, userCoords);
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

  const handleLocationSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReportHospitals(customInput, locationSearchInput, userCoords);
  };

  const handleDetectGPSInReport = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        fetchReportHospitals(customInput, locationSearchInput, coords);
      });
    }
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
            placeholder="Type any patient symptom complaint (e.g. Cancer emergency, Chest pain)..."
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
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 shadow-xl max-w-4xl mx-auto space-y-6"
          >
            {/* Header Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
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

            {/* AUTOMATICALLY GENERATED NEAREST HOSPITALS FOR THIS REPORT */}
            <div className="pt-6 border-t border-slate-200/90">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Nearest Hospitals for {detectedCategoryName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Calculated automatically based on patient condition & location
                  </p>
                </div>

                {/* Report Inline Location Search */}
                <form onSubmit={handleLocationSearchSubmit} className="flex items-center gap-1.5 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={locationSearchInput}
                      onChange={(e) => setLocationSearchInput(e.target.value)}
                      placeholder="City/Pincode..."
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shrink-0"
                  >
                    Set City
                  </button>
                  <button
                    type="button"
                    onClick={handleDetectGPSInReport}
                    title="Use GPS"
                    className="p-1.5 rounded-lg bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-emerald-600" />
                  </button>
                </form>
              </div>

              {/* Nearest Hospitals List Inside Report */}
              {hospitalsLoading ? (
                <div className="py-6 text-center text-xs text-slate-500 font-medium">
                  Locating nearest hospitals for this report...
                </div>
              ) : reportHospitals.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                  No matching hospital records found for this location. Try setting city to "Hyderabad", "Mumbai", or "Delhi".
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {reportHospitals.map((hosp) => (
                    <div
                      key={hosp.id}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-cyan-400 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Navigation className="w-2.5 h-2.5" />
                            <span>{hosp.distanceKm} km away</span>
                          </span>

                          <span className="text-[10px] font-bold text-slate-500 truncate max-w-[120px]">
                            {hosp.city}, {hosp.state}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                          {hosp.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {hosp.address}
                        </p>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {hosp.specialty.slice(0, 2).map((s, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                s.toLowerCase().includes("cancer") || s.toLowerCase().includes("oncology")
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 mt-2 border-t border-slate-100">
                        <a
                          href={`tel:${hosp.emergencyPhone || hosp.phone}`}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Call ER</span>
                        </a>

                        <a
                          href={hosp.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                          <span>Navigate</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View Full Interactive Locator Button */}
            <div className="pt-2 text-center">
              <a
                href="#nearest-hospitals"
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950 underline decoration-slate-300 underline-offset-4"
              >
                <span>View Full Interactive GPS Hospital Directory & Filters →</span>
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}


