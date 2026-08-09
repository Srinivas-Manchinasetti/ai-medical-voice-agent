"use client";

import React from "react";
import { Lock, Shield, Key, FileText, CheckCircle2 } from "lucide-react";

export function SecuritySection() {
  const SECURITY_ITEMS = [
    {
      icon: <Lock className="h-5 w-5 text-[#0F9F8F]" />,
      title: "Encrypted in Transit & At Rest",
      desc: "Voice data is encrypted using TLS 1.3 during calls and AES-256 in storage.",
    },
    {
      icon: <Shield className="h-5 w-5 text-[#0F9F8F]" />,
      title: "Role-Based Access Controls",
      desc: "Granular permissions ensure only authorized care team members access transcripts.",
    },
    {
      icon: <FileText className="h-5 w-5 text-[#0F9F8F]" />,
      title: "Immutable Audit Logging",
      desc: "Detailed access logs track every call interaction, summary read, and EHR update.",
    },
    {
      icon: <Key className="h-5 w-5 text-[#0F9F8F]" />,
      title: "Configurable Retention",
      desc: "Set automated data retention or zero-retention policies matching your organization.",
    },
  ];

  return (
    <section id="security" className="w-full py-20 bg-white border-t border-[#16302B]/5">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F9F8F] bg-[#E8F6F3] px-3.5 py-1 rounded-full">
            Privacy & Security
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#16302B] sm:text-4xl mt-3">
            Your Patients' Conversations Stay Protected
          </h2>
          <p className="mt-2 text-base text-[#60716D]">
            Security architecture designed for healthcare environments and compliance standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_ITEMS.map((item, i) => (
            <div
              key={i}
              className="warm-card rounded-3xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F6F3] mb-4">
                  {item.icon}
                </div>
                <h3 className="text-sm font-bold text-[#16302B] mb-2">{item.title}</h3>
                <p className="text-xs text-[#60716D] leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-xs text-[#60716D] flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#0F9F8F]" />
          <span>Designed to support HIPAA compliance requirements and BAA execution.</span>
        </div>
      </div>
    </section>
  );
}
