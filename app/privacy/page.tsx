"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, CheckCircle2, FileText, Key, Activity } from "lucide-react";
import { Navbar } from "../_components/Navbar";
import { AppFooter } from "../_components/AppFooter";
import { ScrollExpand, ExpandItem } from "@/components/motion/ScrollExpand";
import { ClinicalFlipCard } from "@/components/clinical/ClinicalFlipCard";

const EXPAND_SAFEGUARDS: ExpandItem[] = [
  {
    id: "retention",
    num: "01",
    tag: "ZERO RETENTION",
    title: "Zero Voice Audio Retention Policy",
    headline: "Spoken patient audio streams are processed in ephemeral memory for real-time ICD-10 extraction and SOAP note generation, then immediately purged.",
    complianceBadge: "HIPAA 45 CFR § 164.312",
    pipelineFlow: [
      { label: "Microphone Audio", sub: "16kHz PCM Stream" },
      { label: "RAM Ring Buffer", sub: "Ephemeral In-Memory" },
      { label: "Entity Extraction", sub: "ICD-10 & Symptoms" },
      { label: "SOAP Compiled", sub: "FHIR R4 Ingestion" },
      { label: "Audio Purged", sub: "0 Bytes Persisted" },
    ],
    summary: "Voice recordings are never saved to disk, backup volumes, or used for model training without explicit institutional consent.",
  },
  {
    id: "encryption",
    num: "02",
    tag: "CRYPTOGRAPHY",
    title: "End-to-End TLS 1.3 & AES-256 Encryption",
    headline: "All voice telemetry and clinical consultation data are encrypted using TLS 1.3 in transit and AES-256 at rest within isolated Neon PostgreSQL storage.",
    complianceBadge: "FIPS 140-2 Validated",
    pipelineFlow: [
      { label: "Client Browser", sub: "WebRTC / Audio" },
      { label: "TLS 1.3 Socket", sub: "Sub-120ms Pipe" },
      { label: "FastAPI Engine", sub: "Protected Enclave" },
      { label: "Neon DB", sub: "AES-256 at Rest" },
      { label: "Audit Hash", sub: "SHA-256 Digest" },
    ],
    summary: "Key rotation occurs every 90 days. Data in transit cannot be intercepted, decrypted, or modified.",
  },
  {
    id: "access",
    num: "03",
    tag: "AUTHORIZATION",
    title: "Granular Role-Based Access Controls (RBAC)",
    headline: "Strict physician identity verification and least-privilege permissions govern every consultation review and FHIR export.",
    complianceBadge: "Minimum Necessary Rule",
    pipelineFlow: [
      { label: "Clerk Session", sub: "JWT Handshake" },
      { label: "Identity Check", sub: "Licensed Attending" },
      { label: "Triage Access", sub: "Level-1 Scope" },
      { label: "Session Token", sub: "Single Encounter" },
      { label: "Record Unlocked", sub: "Audit Entry Created" },
    ],
    summary: "Access boundaries ensure emergency room clinicians only access records for actively assigned patients.",
  },
  {
    id: "audit",
    num: "04",
    tag: "AUDIT TRAIL",
    title: "Immutable Cryptographic Audit Logging",
    headline: "Every consultation intake, doctor deliberation round, and hospital pre-arrival dispatch creates an immutable SHA-256 audit record.",
    complianceBadge: "HIPAA § 164.312(b)",
    pipelineFlow: [
      { label: "Clinical Action", sub: "Intake / Dispatch" },
      { label: "Payload Encoded", sub: "Canonical JSON" },
      { label: "SHA-256 Hash", sub: "Web Cryptography" },
      { label: "Timestamp Signed", sub: "UTC Clock" },
      { label: "Ledger Committed", sub: "Tamper Evident" },
    ],
    summary: "Provides automated, verifiable audit trails for institutional compliance and medical record verification.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <div>
        <Navbar />

        {/* HERO HEADER */}
        <section className="pt-16 pb-12 px-6 max-w-4xl mx-auto space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>

          <div className="space-y-2 pt-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-cyan-800 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
              SECURITY & COMPLIANCE ARCHITECTURE
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Privacy Policy & Technical Safeguards
            </h1>
            <p className="text-base text-slate-600 font-normal leading-relaxed max-w-2xl">
              MedVoice AI is engineered around strict zero voice-retention policies, end-to-end encryption, and verifiable cryptographic compliance logs.
            </p>
          </div>
        </section>

        {/* PROGRESSIVE DISCLOSURE: SCROLL EXPAND SAFEGUARDS */}
        <section className="pb-16 px-6 max-w-5xl mx-auto">
          <ScrollExpand items={EXPAND_SAFEGUARDS} />
        </section>

        {/* FLIP CARD SECTION: TECHNICAL SCHEMAS & BAA VERIFICATION */}
        <section className="pb-24 px-6 max-w-5xl mx-auto space-y-8">
          <div className="space-y-2">
            <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-slate-400 block">
              TECHNICAL VERIFICATION · FLIP TO INSPECT
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Architectural Compliance & Business Associate Agreements
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ClinicalFlipCard
              category="REGULATORY FRAMEWORK"
              title="HIPAA Security Rule (45 CFR Part 160 & 164)"
              frontSnippet="MedVoice architecture complies with administrative, physical, and technical safeguard requirements for protected health information (PHI)."
              frontBadge="BAA Agreement Ready"
              frontIcon={<ShieldCheck className="w-5 h-5" />}
              backTitle="SAFEGUARD SPECIFICATION"
              backItems={[
                { label: "ACCESS CONTROL (§ 164.312(a))", value: "Unique user identification & automatic session timeout" },
                { label: "TRANSMISSION SECURITY (§ 164.312(e))", value: "TLS 1.3 end-to-end encrypted voice sockets" },
                { label: "INTEGRITY CONTROL (§ 164.312(c))", value: "SHA-256 cryptographic verification of FHIR bundles" },
                { label: "AUDIT CONTROLS (§ 164.312(b))", value: "Immutable query, review, and telemetry dispatch records" },
              ]}
              backNote="Business Associate Agreements (BAAs) available for enterprise hospital deployments."
            />

            <ClinicalFlipCard
              category="DATA SOVEREIGNTY"
              title="Zero Voice Audio Retention Architecture"
              frontSnippet="Spoken conversational audio streams exist solely in volatile RAM ring-buffers during real-time transcription and are never written to persistent disk storage."
              frontBadge="Ephemeral Lifecycle Verified"
              frontIcon={<Lock className="w-5 h-5" />}
              backTitle="MEMORY LIFECYCLE AUDIT"
              backItems={[
                { label: "STREAM INGEST", value: "16kHz PCM chunks allocated in isolated volatile RAM" },
                { label: "TRANSCRIPTION PASS", value: "Real-time acoustic tokenization & entity extraction" },
                { label: "MEMORY CLEAR", value: "Explicit buffer zeroization upon socket turn closure" },
                { label: "PERSISTED DATA", value: "Only the structured text SOAP note and ICD-10 codes" },
              ]}
              backNote="Audited to ensure zero residual voice waveforms remain on servers after call termination."
            />
          </div>
        </section>
      </div>

      <AppFooter />
    </div>
  );
}
