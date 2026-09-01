"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Activity,
  Calendar,
  Clock,
  User,
  Stethoscope,
  ChevronRight,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle,
  Building2,
  Mic,
  ArrowRight,
  Search,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ClipboardList
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "../_components/Navbar";
import { Footer } from "../_components/Footer";

interface ConsultationRecord {
  id: string;
  userId?: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  chiefComplaint: string;
  triageLevel: "emergency" | "priority" | "routine";
  triageTitle: string;
  icd10Codes?: string[];
  detectedSymptoms?: string[];
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  recommendedAction?: string;
  durationSeconds?: number;
  createdAt: string;
  transcript?: Array<{ role: string; text: string; timestamp: string }>;
}

export default function DashboardPage() {
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedReport, setSelectedReport] = useState<ConsultationRecord | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function loadConsultations() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/consultations");
        if (res.ok) {
          const data = await res.json();
          if (data.consultations) {
            setConsultations(data.consultations);
            if (data.consultations.length > 0) {
              setSelectedReport(data.consultations[0]);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load consultations:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadConsultations();
  }, []);

  const filteredConsultations = consultations.filter((c) => {
    const matchesSeverity = filterSeverity === "all" || c.triageLevel === filterSeverity;
    const matchesSearch =
      c.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.chiefComplaint && c.chiefComplaint.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSeverity && matchesSearch;
  });

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
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
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* PAGE HEADER */}
        <section className="pt-14 pb-8 px-6 max-w-4xl mx-auto text-center space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            EHR CLINICAL ARCHIVE
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            SOAP Clinical Reports & History
          </h1>
          <p className="text-base text-slate-600 max-w-xl mx-auto leading-relaxed font-medium">
            Review automated Subjective, Objective, Assessment, and Plan (SOAP) records generated from AI voice triage consultations.
          </p>
        </section>

        {/* MAIN WORKSPACE */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
          
          {/* Action & Filter Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-mono font-bold text-slate-500 mr-2 uppercase">Filter By:</span>
              {["all", "emergency", "priority", "routine"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterSeverity(lvl)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono uppercase transition-all ${
                    filterSeverity === lvl
                      ? "bg-slate-950 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search doctor or symptom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none w-full transition-all"
                />
              </div>

              <Link
                href="/consult"
                className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex-shrink-0"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>New Voice Consult</span>
              </Link>
            </div>
          </div>

          {/* GRID LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT: Consultation History List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
                  Recorded Sessions ({filteredConsultations.length})
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Click to inspect SOAP note</span>
              </div>

              {isLoading ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 shadow-sm">
                  Loading clinical consultation history...
                </div>
              ) : filteredConsultations.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-900">No Consultation Reports Found</div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Start a voice consultation with an AI Doctor to generate your first clinical SOAP note.
                  </p>
                  <Link
                    href="/consult"
                    className="inline-flex items-center gap-2 text-xs font-bold text-cyan-700 hover:text-cyan-800"
                  >
                    <span>Launch Voice Room</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[660px] overflow-y-auto pr-1">
                  {filteredConsultations.map((item) => {
                    const isSelected = selectedReport?.id === item.id;
                    const dateStr = item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                      : "Recent";

                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedReport(item)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          isSelected
                            ? "bg-white border-cyan-500 shadow-md ring-2 ring-cyan-500/10"
                            : "bg-white border-slate-200/90 hover:border-slate-300 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-slate-900 text-sm truncate">{item.doctorName}</span>
                          <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${getUrgencyBadge(item.triageLevel)}`}>
                            {item.triageLevel}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 mb-3 font-medium">
                          {item.chiefComplaint || "Routine clinical triage evaluation"}
                        </p>

                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 border-t border-slate-100 pt-2.5">
                          <span className="text-cyan-700 font-bold">{item.specialty}</span>
                          <span>{dateStr}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: SOAP Report Detailed Chart */}
            <div className="lg:col-span-7">
              {selectedReport ? (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                  
                  {/* Document Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-700 mb-1">
                        <span>RECORD ID: {selectedReport.id}</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-slate-950">Clinical SOAP Documentation</h2>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Evaluating Physician: <span className="text-slate-900 font-bold">{selectedReport.doctorName}</span> ({selectedReport.specialty})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                      <Link
                        href="/care"
                        className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Find ERs</span>
                      </Link>
                    </div>
                  </div>

                  {/* Urgency & Symptoms Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                      <span className="text-[11px] font-mono uppercase text-slate-500 font-bold block mb-1">Triage Urgency Level</span>
                      <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full uppercase inline-block border ${getUrgencyBadge(selectedReport.triageLevel)}`}>
                        {selectedReport.triageTitle || selectedReport.triageLevel}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                      <span className="text-[11px] font-mono uppercase text-slate-500 font-bold block mb-1">Diagnostic ICD-10 Tags</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedReport.icd10Codes && selectedReport.icd10Codes.length > 0
                          ? selectedReport.icd10Codes
                          : ["Z76.0"]
                        ).map((c, i) => (
                          <span key={i} className="text-xs bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md font-mono font-bold">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* SOAP NOTE CARDS */}
                  <div className="space-y-3.5 text-xs leading-relaxed">
                    {/* S - Subjective */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
                      <h4 className="font-extrabold text-cyan-800 font-mono text-xs mb-1.5 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-800 flex items-center justify-center text-[10px] font-bold">S</span>
                        <span>SUBJECTIVE (Patient Narrative & Chief Complaint)</span>
                      </h4>
                      <p className="text-slate-700 font-medium">
                        {selectedReport.soapSubjective || selectedReport.chiefComplaint || "No patient narrative logged."}
                      </p>
                    </div>

                    {/* O - Objective */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
                      <h4 className="font-extrabold text-teal-800 font-mono text-xs mb-1.5 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-100 border border-teal-200 text-teal-800 flex items-center justify-center text-[10px] font-bold">O</span>
                        <span>OBJECTIVE (Parsed Entities & Triage Metrics)</span>
                      </h4>
                      <p className="text-slate-700 font-medium">
                        {selectedReport.soapObjective || `Detected symptoms: ${selectedReport.detectedSymptoms?.join(", ") || "None"}.`}
                      </p>
                    </div>

                    {/* A - Assessment */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
                      <h4 className="font-extrabold text-amber-800 font-mono text-xs mb-1.5 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center text-[10px] font-bold">A</span>
                        <span>ASSESSMENT (Clinical Specialty Review)</span>
                      </h4>
                      <p className="text-slate-700 font-medium">
                        {selectedReport.soapAssessment || selectedReport.triageTitle || "Clinical triage evaluation complete."}
                      </p>
                    </div>

                    {/* P - Plan */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm">
                      <h4 className="font-extrabold text-emerald-800 font-mono text-xs mb-1.5 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center text-[10px] font-bold">P</span>
                        <span>PLAN (Actionable Directives & Follow-up)</span>
                      </h4>
                      <p className="text-slate-700 whitespace-pre-line font-medium">
                        {selectedReport.soapPlan || selectedReport.recommendedAction || "Follow standard clinical recommendations."}
                      </p>
                    </div>
                  </div>

                  {/* Transcript Accordion */}
                  {selectedReport.transcript && selectedReport.transcript.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <h4 className="text-xs font-mono font-bold text-slate-500 uppercase mb-3">
                        Full Recorded Audio Dialogue ({selectedReport.transcript.length} turns)
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedReport.transcript.map((t, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                            <span className="font-mono font-bold text-cyan-800 uppercase text-[10px] mr-2">
                              [{t.role}]:
                            </span>
                            <span className="text-slate-800">{t.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer Disclaimer */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3 text-[11px] text-slate-600">
                    <ShieldCheck className="w-4 h-4 text-cyan-700 flex-shrink-0" />
                    <span>
                      MediVoice AI clinical decision support documentation. For medical emergencies, always call 911 / 108 immediately.
                    </span>
                  </div>

                </div>
              ) : (
                <div className="h-full min-h-[350px] flex items-center justify-center p-12 bg-white border border-slate-200/90 rounded-2xl text-center text-slate-400 text-xs shadow-sm">
                  Select a consultation report from the left to view the complete clinical SOAP chart.
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
