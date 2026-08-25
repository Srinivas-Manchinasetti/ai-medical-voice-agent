"use client";

import React from "react";
import { Lock, Shield, Key, FileText, CheckCircle2 } from "lucide-react";

export function SecuritySection() {
  const SECURITY_ITEMS = [
    {
      title: "Encrypted in Transit & At Rest",
      desc: "Voice data is encrypted using TLS 1.3 during live call streaming and AES-256 in storage.",
    },
    {
      title: "Role-Based Access Controls",
      desc: "Granular access controls ensure only authorized care team members view clinical transcripts.",
    },
    {
      title: "Immutable Audit Logging",
      desc: "Detailed access logs track every intake call interaction, summary view, and EHR update.",
    },
    {
      title: "Configurable Retention",
      desc: "Set automated data retention or zero-retention policies matching your organization.",
    },
  ];

  return (
    <section id="security" className="w-full py-16 sm:py-20 bg-white border-t border-slate-200/80 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between pb-8 border-b border-slate-200/80 gap-4">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 block">
              SECURITY & COMPLIANCE
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
              Healthcare-grade privacy safeguards.
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>HIPAA ARCHITECTURE & BAA READY</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_ITEMS.map((item, i) => (
            <div
              key={i}
              className="bg-[#FAF9F6] border border-slate-200/90 rounded-xl p-5 space-y-2 font-sans"
            >
              <span className="font-mono text-xs font-bold text-slate-400 block">0{i + 1}</span>
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

