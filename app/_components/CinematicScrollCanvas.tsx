"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  PhoneCall,
  ShieldCheck,
  Zap,
  Lock,
  Radio,
  Sparkles,
  ArrowRight,
  FileText,
  AlertTriangle,
  Stethoscope,
  HeartPulse,
  MapPin,
  CheckCircle2
} from "lucide-react";
import { CinematicCareNetworkMap } from "./CinematicCareNetworkMap";

export function CinematicScrollCanvas() {
  // Hero headline words for LaunchFolio-style word reveal
  const heroWords = ["Voice", "triage", "that", "feels", "human."];

  return (
    <div className="w-full bg-[#FAF9F6] text-slate-950 space-y-24 sm:space-y-36 pb-24">
      {/* ------------------------------------------------------------------ */}
      {/* HERO SECTION — WORD REVEAL & RESTRAINED WORKSTATION PREVIEW */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-[85vh] max-w-7xl mx-auto px-6 sm:px-8 flex flex-col lg:flex-row items-center justify-between gap-12 pt-8 sm:pt-12">
        {/* Ambient Glow */}
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none z-0" />

        {/* Hero Left Content */}
        <div className="max-w-xl space-y-6 text-left z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200/90 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-slate-600 uppercase tracking-wider text-[11px]">
              Clinical Voice Engine
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-cyan-700 font-medium flex items-center gap-1.5 font-mono text-[11px]">
              <Radio className="w-3 h-3 animate-pulse" /> 24/7 Intake Active
            </span>
          </motion.div>

          {/* LaunchFolio Word-Level Blur/Opacity Reveal */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.04em] text-slate-950 leading-[0.98]">
            {heroWords.map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  duration: 0.6,
                  delay: 0.1 + index * 0.08,
                  ease: [0.25, 0.4, 0.25, 1],
                }}
                className="inline-block mr-3"
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-md"
          >
            MedVoice handles patient calls 24/7 — evaluating symptoms, escalating emergencies, and generating structured EHR notes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap items-center gap-4 pt-1"
          >
            <a
              href="/demo"
              className="inline-flex items-center gap-2.5 rounded-full bg-slate-950 px-7 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Simulate a Voice Call</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-500 pt-2"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> HIPAA Safeguards
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" /> FHIR Standard
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-cyan-600" /> Zero Retention
            </span>
          </motion.div>
        </div>

        {/* Hero Workstation Card with Micro Parallax Tilt */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          className="w-full max-w-xl rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl text-white z-10 overflow-hidden relative group hover:border-cyan-500/40 transition-colors"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-mono text-xs font-bold text-slate-200">
                MEDVOICE CLINICAL WORKSTATION
              </span>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ● LIVE STREAM 16kHz
            </span>
          </div>

          <div className="py-8 space-y-4 text-center">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400 bg-cyan-950 border border-cyan-800 px-3 py-1 rounded-md inline-block">
              REAL-TIME TRIAGE INGESTION
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Emergency Cardiac Escalation
            </h3>
            <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              Synthesizing multi-modal voice stream, mining ICD-10 symptoms, and computing clinical urgency score.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 01 — LISTEN (REAL-TIME VOICE INTAKE & AUDIO WAVEFORM) */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
          className="rounded-3xl bg-slate-950 border border-cyan-500/30 p-8 sm:p-10 text-white shadow-2xl space-y-6 relative overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 border border-cyan-800 px-3 py-1 rounded-md">
              01 / LISTEN
            </span>
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> SPEECH INTAKE
            </span>
          </div>

          <div className="space-y-2 text-left">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
              Listen to patient conversations as they happen.
            </h2>
            <p className="text-sm text-slate-400 font-medium">
              Every call is processed in 16kHz PCM audio stream with zero retention HIPAA safeguards.
            </p>
          </div>

          {/* Background Waveform */}
          <div className="h-16 w-full flex items-center justify-center gap-1.5 opacity-30">
            {[40, 70, 30, 85, 50, 95, 60, 40, 90, 65, 30, 80, 55, 90, 45, 75, 35].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="w-2 rounded-full bg-cyan-500 animate-pulse"
              />
            ))}
          </div>

          {/* Spoken Transcript */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left space-y-2">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
              Live Patient Audio Stream • 00:14
            </span>
            <p className="text-lg sm:text-2xl font-bold text-cyan-200 leading-snug">
              "My husband has severe <span className="text-amber-400 underline decoration-amber-500/50">crushing chest pain</span> radiating to his <span className="text-amber-400 underline decoration-amber-500/50">left arm</span> and has <span className="text-amber-400 underline decoration-amber-500/50">cold sweats</span>..."
            </p>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 02 — UNDERSTAND (CLINICAL ENTITY EXTRACTION & SOAP NOTE) */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center space-y-3"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            02 / UNDERSTAND
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            From Conversation to Clinical Intelligence
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-xl mx-auto">
            Spoken terms automatically split into ICD-10 entity findings and generate structured SOAP documentation.
          </p>
        </motion.div>

        {/* Clinical Entity Chips */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl bg-rose-500/20 border border-rose-500/40 px-4 py-2 text-xs font-mono font-extrabold text-rose-700 shadow-md"
          >
            CHEST PAIN (ICD R07.9)
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-mono font-extrabold text-amber-700 shadow-md"
          >
            LEFT ARM RADIATION
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 text-xs font-mono font-extrabold text-cyan-700 shadow-md"
          >
            DIAPHORESIS (ICD R61)
          </motion.div>
        </div>

        {/* Structured Clinical SOAP Note & ICD-10 Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="w-full rounded-3xl bg-slate-950 border border-slate-800 p-6 sm:p-8 text-white shadow-2xl grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="space-y-3 text-left bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold">
              <FileText className="w-4 h-4" /> ICD-10 SYMPTOM MINING
            </div>
            <h4 className="text-lg font-extrabold text-white">Symptom Findings</h4>
            <ul className="text-xs text-slate-300 space-y-2 font-mono">
              <li className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span>R07.9 Chest Pain, Unspecified</span>
                <span className="text-rose-400 font-bold">HIGH SEVERITY</span>
              </li>
              <li className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span>R61 Diaphoresis / Cold Sweats</span>
                <span className="text-amber-400 font-bold">PRESENT</span>
              </li>
              <li className="flex items-center justify-between">
                <span>I20.9 Angina Pectoris Profile</span>
                <span className="text-cyan-400 font-bold">POSSIBLE</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3 text-left bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 font-bold">
              <Stethoscope className="w-4 h-4" /> GENERATED SOAP NOTE
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              <strong className="text-white">S:</strong> 58yo M presenting with acute crushing substernal chest pressure radiating to L upper extremity.<br />
              <strong className="text-white">O:</strong> Associated diaphoresis & dyspnea.<br />
              <strong className="text-white">A:</strong> Acute Coronary Syndrome (ACS) suspected.<br />
              <strong className="text-white">P:</strong> Immediate 911 dispatch & ER alert.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 03 — ACT (EMERGENCY CARDIAC CARE DISPATCH PAYOFF) */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
          className="rounded-3xl bg-rose-950/95 border border-rose-500/50 p-8 sm:p-10 text-center text-white shadow-2xl space-y-6 backdrop-blur-xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 border border-rose-500/40 px-4 py-1.5 text-xs font-mono font-bold text-rose-300 animate-pulse">
            <AlertTriangle className="w-4 h-4" /> 03 / ACT • EMERGENCY DISPATCH
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Emergency Cardiac Dispatch
          </h2>

          <p className="text-sm sm:text-base text-rose-200 max-w-md mx-auto font-medium leading-relaxed">
            Clinical entities converged into Level-1 Emergency triage. Direct warm transfer and pre-arrival notification initiated.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a
              href="/care"
              className="inline-flex items-center gap-2.5 rounded-full bg-rose-500 hover:bg-rose-400 text-white px-7 py-3.5 text-sm font-extrabold shadow-lg transition-all cursor-pointer"
            >
              <HeartPulse className="w-4 h-4 animate-bounce" />
              <span>Route to Nearest ER Facility</span>
            </a>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 04 — CARE NETWORK (SPATIAL HOSPITAL NODE MAP) */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-5xl mx-auto px-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center space-y-3"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
            04 / CARE NETWORK
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Find the Right Care, When It Matters
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium max-w-xl mx-auto">
            Automated spatial hospital node routing powered by real-time geolocation & ABDM facility registries.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <CinematicCareNetworkMap />
        </motion.div>
      </section>
    </div>
  );
}
