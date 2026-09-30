"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Download,
  Copy,
  Check,
  Edit3,
  Save,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import PremiumButton from "@/components/PremiumButton";
import { generateFHIRBundle } from "@/lib/fhir/bundle";

export interface SoapEncounterData {
  id?: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  callDuration: number;
  transcript: Array<{ role: string; text: string; timestamp?: string }>;
  triageLevel: string;
  triageTitle: string;
  esiScore?: number | null;
  detectedSymptoms: string[];
  icdCodes: string[];
  recommendedAction: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  auditSha256?: string;
  boardConsensusCount?: string;
  userId?: string;
}

interface SoapReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: SoapEncounterData;
  onSaveSuccess?: (savedRecord: any) => void;
}

export function SoapReportModal({
  isOpen,
  onClose,
  encounter,
  onSaveSuccess,
}: SoapReportModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedEncounterId, setSavedEncounterId] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const isReportReady = Boolean(encounter?.soap?.subjective && encounter?.soap?.assessment);

  // Initialize and format text values when encounter changes
  useEffect(() => {
    if (isOpen && encounter) {
      if (encounter.soap?.subjective && encounter.soap?.assessment) {
        setSubjective(encounter.soap.subjective);
        setObjective(encounter.soap.objective || "");
        setAssessment(encounter.soap.assessment);
        setPlan(encounter.soap.plan || "");
      } else {
        setSubjective("");
        setObjective("");
        setAssessment("");
        setPlan("");
      }

      setIsEditing(false);
      setSaveSuccess(false);
    }
  }, [isOpen, encounter]);

  if (!isOpen) return null;

  const encounterId = encounter.id || `ENC-${Date.now().toString().slice(-6)}`;
  const encounterDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const encounterTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Copy standard clinical note to clipboard
  const handleCopyNote = async () => {
    if (!isReportReady) return;
    const formattedNote = `==============================================================================
SOAP NOTE — MEDVOICE CLINICAL ENCOUNTER
==============================================================================
Encounter ID:    ${encounterId}
Date & Time:     ${encounterDate} · ${encounterTime}
Duration:        ${formatTimer(encounter.callDuration)}
Patient:         ${encounter.patientName}
Attending:       ${encounter.doctorName} (${encounter.specialty})
Triage Acuity:   ${encounter.triageTitle} (ESI ${encounter.esiScore ?? (encounter.triageLevel === "emergency" ? 2 : 3)})
Governance:      AI DRAFT · CLINICAL REVIEW REQUIRED
==============================================================================

[S] SUBJECTIVE:
${subjective}

[O] OBJECTIVE:
${objective}

[A] ASSESSMENT:
${assessment}

[P] PLAN:
${plan}

==============================================================================
Attending Clinician Signature: _________________________ Date: ____________
==============================================================================`;

    try {
      await navigator.clipboard.writeText(formattedNote);
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 2500);
    } catch {
      console.error("Failed to copy SOAP note to clipboard");
    }
  };

  // Export HL7 FHIR R4 Bundle
  const handleExportFhir = () => {
    if (!isReportReady) return;
    const bundle = generateFHIRBundle({
      id: encounterId,
      patientName: encounter.patientName,
      patientGender: encounter.patientGender,
      patientAge: encounter.patientAge,
      doctorId: encounter.doctorId,
      doctorName: encounter.doctorName,
      specialty: encounter.specialty,
      chiefComplaint: encounter.transcript.find((t) => t.role === "patient")?.text || "",
      triageLevel: encounter.triageLevel as any,
      triageTitle: encounter.triageTitle,
      esiScore: encounter.esiScore ?? (encounter.triageLevel === "emergency" ? 2 : 3),
      icd10Codes: encounter.icdCodes,
      detectedSymptoms: encounter.detectedSymptoms,
      soapSubjective: subjective,
      soapObjective: objective,
      soapAssessment: assessment,
      soapPlan: plan,
      recommendedAction: encounter.recommendedAction,
      createdAt: new Date().toISOString(),
      transcript: encounter.transcript.map((t) => ({
        role: t.role,
        text: t.text,
        timestamp: t.timestamp || new Date().toISOString(),
      })),
    });

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/fhir+json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fhir-r4-bundle-${encounterId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Commit / Save Encounter to Database & Longitudinal Record
  const handleApproveAndSave = async () => {
    if (!isReportReady) return;
    setIsSaving(true);
    try {
      const payload = {
        id: encounterId,
        userId: encounter.userId || "anon-user",
        patientName: encounter.patientName,
        patientAge: encounter.patientAge,
        patientGender: encounter.patientGender,
        doctorId: encounter.doctorId,
        doctorName: encounter.doctorName,
        specialty: encounter.specialty,
        chiefComplaint:
          encounter.transcript.find((t) => t.role === "patient")?.text || "Clinical Voice Intake",
        transcript: encounter.transcript,
        triageLevel: encounter.triageLevel,
        triageTitle: encounter.triageTitle,
        esiScore: encounter.esiScore ?? (encounter.triageLevel === "emergency" ? 2 : 3),
        icd10Codes: encounter.icdCodes,
        detectedSymptoms: encounter.detectedSymptoms,
        soapSubjective: subjective,
        soapObjective: objective,
        soapAssessment: assessment,
        soapPlan: plan,
        recommendedAction: encounter.recommendedAction,
        durationSeconds: encounter.callDuration,
      };

      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setSaveSuccess(true);
        setSavedEncounterId(encounterId);
        setIsEditing(false);
        if (onSaveSuccess) {
          onSaveSuccess(data.consultation || payload);
        }
      } else {
        throw new Error("Failed to save consultation");
      }
    } catch (err) {
      console.error("Error approving encounter:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* ============================================================ Document Header */}
        <div className="px-7 sm:px-9 pt-7 pb-5 border-b border-slate-200 bg-white shrink-0 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-800 font-bold">
                Clinical Progress Note · Encounter #{encounterId}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-serif mt-1">
                SOAP NOTE
              </h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Voice Consultation · {encounterDate} · {encounterTime} · Duration {formatTimer(encounter.callDuration)}
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Close document"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Clean Telemetry Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Patient</span>
              <p className="font-bold text-slate-900 truncate mt-0.5">{encounter.patientName}</p>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Consulting Attending</span>
              <p className="font-bold text-slate-900 truncate mt-0.5">
                {encounter.doctorName.replace(", MD, FACC", "").replace(", MD, PhD", "").replace(", MD, FAAP", "").replace(", MD, DVD", "").replace(", MD", "")}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{encounter.specialty}</p>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Triage Acuity</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${encounter.triageLevel === "emergency" ? "bg-rose-500" : "bg-emerald-500"}`} />
                <p className="font-black font-mono text-slate-900">
                  ESI {encounter.esiScore ?? (encounter.triageLevel === "emergency" ? 2 : 3)} · {encounter.triageLevel.toUpperCase()}
                </p>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Governance</span>
              <div className="mt-1">
                <span className={`inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${
                  !isReportReady
                    ? "bg-slate-50 text-slate-600 border-slate-200"
                    : "bg-amber-50 text-amber-900 border-amber-200"
                }`}>
                  {!isReportReady ? "REPORT IN PROGRESS" : "AI DRAFT · REVIEW REQUIRED"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ Scrollable Document Body */}
        <div className="flex-1 overflow-y-auto px-7 sm:px-9 py-6 space-y-7 text-xs sm:text-sm leading-relaxed text-slate-800">
          
          {/* Save Success Banner */}
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">
                  ✓ Encounter Approved & Committed to Longitudinal Record (#{savedEncounterId})
                </span>
              </div>
              <Link
                href="/dashboard"
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] font-mono transition-colors flex items-center gap-1 shrink-0"
              >
                <span>View Dashboard</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </motion.div>
          )}

          {!isReportReady ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 mb-4 shadow-xs">
                <FileText className="w-7 h-7 text-cyan-600 animate-pulse" />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-800 font-bold bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full mb-2">
                Clinical Report in Progress
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-serif mb-2">
                Deliberation & Provenance Generation Pending
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-6">
                The multi-agent clinical board convenes once sufficient symptom dimensions are gathered or the consultation completes. SOAP notes are generated strictly from verified patient testimony and acoustic telemetry—no parallel notes are fabricated from raw transcripts.
              </p>
              <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-3.5 text-left text-xs font-mono space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Intake Dialogue:</span>
                  <span className="font-bold text-slate-900">{encounter.transcript.length} turns recorded</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Triage:</span>
                  <span className="font-bold text-slate-900">{encounter.triageTitle}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Provenance Model:</span>
                  <span className="font-bold text-cyan-800">Strict Patient-Reported</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* S — SUBJECTIVE */}
              <section className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-cyan-700 text-white flex items-center justify-center text-[11px] font-mono font-bold">
                      S
                    </span>
                    <span>SUBJECTIVE</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Patient-Reported Narrative</span>
                </div>

                {isEditing ? (
                  <textarea
                    value={subjective}
                    onChange={(e) => setSubjective(e.target.value)}
                    rows={5}
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-cyan-300 focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 bg-slate-50/50 leading-relaxed font-sans"
                  />
                ) : (
                  <div className="pt-1 whitespace-pre-line font-normal text-slate-700 leading-relaxed">
                    {subjective}
                  </div>
                )}
              </section>

              {/* O — OBJECTIVE */}
              <section className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-teal-700 text-white flex items-center justify-center text-[11px] font-mono font-bold">
                      O
                    </span>
                    <span>OBJECTIVE</span>
                  </h3>
                  <span className="text-[10px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 font-bold">
                    Zero Vitals Fabricated
                  </span>
                </div>

                {isEditing ? (
                  <textarea
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    rows={5}
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-teal-300 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 bg-slate-50/50 leading-relaxed font-sans"
                  />
                ) : (
                  <div className="pt-1 whitespace-pre-line font-normal text-slate-700 leading-relaxed">
                    {objective}
                  </div>
                )}

                {/* ICD-10 Chips */}
                {encounter.icdCodes && encounter.icdCodes.length > 0 && !isEditing && (
                  <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                      ICD-10 Tags:
                    </span>
                    {encounter.icdCodes.map((code) => (
                      <span
                        key={code}
                        className="text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {/* A — ASSESSMENT */}
              <section className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-600 text-white flex items-center justify-center text-[11px] font-mono font-bold">
                      A
                    </span>
                    <span>ASSESSMENT</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    Acuity: ESI {encounter.esiScore ?? (encounter.triageLevel === "emergency" ? 2 : 3)}
                  </span>
                </div>

                {isEditing ? (
                  <textarea
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    rows={5}
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-amber-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 bg-slate-50/50 leading-relaxed font-sans"
                  />
                ) : (
                  <div className="pt-1 whitespace-pre-line font-normal text-slate-700 leading-relaxed">
                    {assessment}
                  </div>
                )}
              </section>

              {/* P — PLAN */}
              <section className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <h3 className="text-xs font-black uppercase font-mono tracking-wider text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-emerald-700 text-white flex items-center justify-center text-[11px] font-mono font-bold">
                      P
                    </span>
                    <span>PLAN</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Actionable Directives</span>
                </div>

                {isEditing ? (
                  <textarea
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    rows={5}
                    className="w-full text-xs sm:text-sm p-3 rounded-xl border border-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 bg-slate-50/50 leading-relaxed font-sans"
                  />
                ) : (
                  <div className="pt-1 whitespace-pre-line font-normal text-slate-700 leading-relaxed">
                    {plan}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Collapsible Audio Dialogue Drawer */}
          {encounter.transcript && encounter.transcript.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center justify-between w-full text-xs font-mono font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <span>RECORDED DIALOGUE ({encounter.transcript.length} TURNS)</span>
                {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTranscript && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1 animate-in fade-in duration-200">
                  {encounter.transcript.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <div className="flex items-center justify-between mb-0.5 text-[10px] font-mono text-slate-400">
                        <span className="font-bold uppercase">
                          {item.role === "patient" ? encounter.patientName : encounter.doctorName}
                        </span>
                        {item.timestamp && <span>{item.timestamp}</span>}
                      </div>
                      <p className="text-slate-800">{item.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ============================================================ Fixed Bottom Action Bar */}
        <div className="px-7 sm:px-9 py-4 border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              disabled={!isReportReady}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                !isReportReady
                  ? "opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                  : isEditing
                  ? "bg-slate-900 text-white border-slate-900 cursor-pointer"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 cursor-pointer"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? "Lock & Preview" : "Edit Note"}</span>
            </button>

            <button
              onClick={handleCopyNote}
              disabled={!isReportReady}
              className={`px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 ${
                !isReportReady
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : "text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              {copiedNote ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedNote ? "Copied" : "Copy SOAP"}</span>
            </button>

            <button
              onClick={handleExportFhir}
              disabled={!isReportReady}
              className={`px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 ${
                !isReportReady
                  ? "opacity-40 cursor-not-allowed text-slate-400"
                  : "text-slate-700 hover:bg-slate-50 cursor-pointer"
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export FHIR</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>

            <PremiumButton
              variant="primary"
              size="md"
              onClick={handleApproveAndSave}
              disabled={isSaving || saveSuccess || !isReportReady}
              icon={saveSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
            >
              {isSaving
                ? "Saving..."
                : saveSuccess
                ? "Approved & Saved"
                : !isReportReady
                ? "Report Pending"
                : "Approve & Save Encounter"}
            </PremiumButton>
          </div>

        </div>

      </div>
    </div>
  );
}