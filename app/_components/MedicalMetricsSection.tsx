"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, ShieldCheck, Zap, Users, BarChart3, ArrowRight } from "lucide-react";

interface OrgData {
  id: string;
  name: string;
  metrics: {
    label: string;
    value: string;
    subtext: string;
    icon: React.ReactNode;
  }[];
  beforeVsAfter: {
    before: string;
    after: string;
    metricLabel: string;
  };
}

const ORG_TYPES: OrgData[] = [
  {
    id: "hospitals",
    name: "Health Systems & ERs",
    metrics: [
      {
        label: "Voice Response Latency",
        value: "< 200 ms",
        subtext: "Real-time speech-to-text & AI audio synthesis",
        icon: <Zap className="h-5 w-5 text-teal-400" />,
      },
      {
        label: "Triage Accuracy Target",
        value: "99.4%",
        subtext: "Validated against Emergency Severity Index (ESI)",
        icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
      },
      {
        label: "Call Abandonment Drop",
        value: "-84%",
        subtext: "Instant pick-up for after-hours patient intake",
        icon: <TrendingUp className="h-5 w-5 text-cyan-400" />,
      },
      {
        label: "Staff Hours Saved / Mo",
        value: "1,450+ hrs",
        subtext: "Automated SOAP note generation & EHR sync",
        icon: <Clock className="h-5 w-5 text-amber-400" />,
      },
    ],
    beforeVsAfter: {
      metricLabel: "Average Patient Triage & Routing Wait Time",
      before: "18.5 Minutes",
      after: "42 Seconds",
    },
  },
  {
    id: "urgent-care",
    name: "Urgent Care Networks",
    metrics: [
      {
        label: "Peak Intake Throughput",
        value: "4.8x",
        subtext: "Handles simultaneous patient voice calls without queueing",
        icon: <Users className="h-5 w-5 text-teal-400" />,
      },
      {
        label: "Symptom Extraction",
        value: "< 3 sec",
        subtext: "Instant entity extraction & chief complaint tagging",
        icon: <Zap className="h-5 w-5 text-emerald-400" />,
      },
      {
        label: "No-Show Reduction",
        value: "62%",
        subtext: "Proactive voice reminders & instant rescheduling",
        icon: <TrendingUp className="h-5 w-5 text-cyan-400" />,
      },
      {
        label: "Patient CSAT Score",
        value: "4.9 / 5.0",
        subtext: "Empathetic, zero-wait natural voice interaction",
        icon: <ShieldCheck className="h-5 w-5 text-amber-400" />,
      },
    ],
    beforeVsAfter: {
      metricLabel: "Patient Check-in & Intake Processing Time",
      before: "12.0 Minutes",
      after: "55 Seconds",
    },
  },
  {
    id: "primary-care",
    name: "Primary Care Practices",
    metrics: [
      {
        label: "Rx Refill Turnaround",
        value: "3x Faster",
        subtext: "Automated allergy check & digital doctor authorization",
        icon: <Zap className="h-5 w-5 text-teal-400" />,
      },
      {
        label: "Multilingual Reach",
        value: "30+ Languages",
        subtext: "Real-time speech translation during patient call",
        icon: <Users className="h-5 w-5 text-emerald-400" />,
      },
      {
        label: "HIPAA Security Score",
        value: "100%",
        subtext: "AES-256 encrypted voice stream & BAA ready",
        icon: <ShieldCheck className="h-5 w-5 text-cyan-400" />,
      },
      {
        label: "Overhead Reduction",
        value: "38%",
        subtext: "Lower administrative call center workload",
        icon: <BarChart3 className="h-5 w-5 text-amber-400" />,
      },
    ],
    beforeVsAfter: {
      metricLabel: "Administrative Phone Call Queue Time",
      before: "9.2 Minutes",
      after: "15 Seconds",
    },
  },
];

export function MedicalMetricsSection() {
  const [activeTab, setActiveTab] = useState<string>("hospitals");
  const currentOrg = ORG_TYPES.find((o) => o.id === activeTab) || ORG_TYPES[0];

  return (
    <section id="metrics" className="w-full py-20 bg-zinc-950/40 relative">
      <div className="mx-auto max-w-6xl px-4">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-950/40 px-3.5 py-1 text-xs font-semibold text-teal-400 mb-3 backdrop-blur-md">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Clinical Impact & Performance</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Designed for Measurable Healthcare Outcomes
          </h2>
          <p className="mt-2 max-w-2xl text-base text-zinc-400">
            See how AI voice automation delivers faster symptom triage, zero call queues, and reduced administrative burden across healthcare settings.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {ORG_TYPES.map((org) => (
            <button
              key={org.id}
              onClick={() => setActiveTab(org.id)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
                activeTab === org.id
                  ? "bg-teal-500 text-zinc-950 shadow-lg shadow-teal-500/20 scale-105"
                  : "glass-panel text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {currentOrg.metrics.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                    {m.icon}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                    BENCHMARK
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white tracking-tight font-mono mb-1">
                  {m.value}
                </h3>
                <p className="text-xs font-bold text-zinc-200 mb-2">{m.label}</p>
              </div>
              <p className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-3 mt-2">
                {m.subtext}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Before vs After Impact Visualizer */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400 block mb-1">
                INPACT VISUALIZER • {currentOrg.name}
              </span>
              <h4 className="text-lg font-bold text-white mb-2">{currentOrg.beforeVsAfter.metricLabel}</h4>
              <p className="text-xs text-zinc-400">
                Traditional phone tree queues vs instant parallel AI medical voice agent response.
              </p>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-center">
              {/* Before */}
              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 text-center min-w-[130px]">
                <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">BEFORE AI</span>
                <span className="text-xl font-bold font-mono text-zinc-400 line-through">
                  {currentOrg.beforeVsAfter.before}
                </span>
              </div>

              <ArrowRight className="h-5 w-5 text-teal-400 shrink-0" />

              {/* After */}
              <div className="rounded-2xl bg-teal-950/60 border border-teal-500/40 p-4 text-center min-w-[130px] shadow-lg shadow-teal-950/50">
                <span className="text-[10px] font-mono uppercase text-teal-400 block mb-1 font-bold">WITH MEDIVOICE AI</span>
                <span className="text-xl font-black font-mono text-teal-300">
                  {currentOrg.beforeVsAfter.after}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
