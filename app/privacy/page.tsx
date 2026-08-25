"use client";

import React from "react";
import { Navbar } from "../_components/Navbar";
import { Footer } from "../_components/Footer";
import { SecuritySection } from "../_components/SecuritySection";
import { ShieldCheck, Lock, Key, FileText, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  const POLICY_SECTIONS = [
    {
      id: "encryption",
      title: "01. Data Encryption & Transit Safeguards",
      desc: "All patient spoken audio streams and clinical transcripts are encrypted using TLS 1.3 in transit and AES-256 at rest within isolated Neon PostgreSQL storage.",
    },
    {
      id: "retention",
      title: "02. Zero Voice Retention Policy",
      desc: "Spoken patient audio streams are processed in ephemeral memory for real-time ICD-10 extraction and SOAP note generation, then purged. Voice audio is never stored permanently.",
    },
    {
      id: "access",
      title: "03. Role-Based Access Controls (RBAC)",
      desc: "Granular access controls enforce strict authorization boundaries. Only credentialed care team members with explicit patient permissions can review clinical intake charts.",
    },
    {
      id: "audit",
      title: "04. Immutable Audit Logging",
      desc: "Every system interaction, API query, EHR export, and triage assessment produces a cryptographically signed, immutable audit log entry for regulatory compliance.",
    },
    {
      id: "compliance",
      title: "05. Regulatory Standards Alignment",
      desc: "MedVoice technical architecture is designed to align with HIPAA Security Rule requirements (45 CFR Part 160 and Part 164), Indian DPDP Act, and ABDM HFR standards.",
    },
  ];

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
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-800 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
              LEGAL & PRIVACY ARCHITECTURE
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Privacy Policy & Technical Safeguards
            </h1>
            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-2xl">
              Last updated: August 2026 • MedVoice AI is built with healthcare-grade privacy controls, zero-retention voice processing, and immutable compliance logging.
            </p>
          </div>
        </section>

        {/* DETAILED POLICY SECTIONS */}
        <section className="pb-20 px-6 max-w-4xl mx-auto">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm space-y-10">
            {POLICY_SECTIONS.map((sec) => (
              <div key={sec.id} className="space-y-2 border-b border-slate-100 pb-8 last:border-0 last:pb-0">
                <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{sec.title}</span>
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed font-medium pl-6">
                  {sec.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* TECHNICAL SAFEGUARDS COMPONENT */}
        <SecuritySection />
      </div>

      <Footer />
    </div>
  );
}
