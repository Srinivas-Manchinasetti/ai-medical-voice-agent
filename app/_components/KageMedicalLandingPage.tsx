"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  CheckCircle2,
  Menu,
  X
} from "lucide-react";
import { KageThreeCanvas } from "./KageThreeCanvas";
import { CinematicCareNetworkMap } from "./CinematicCareNetworkMap";

export function KageMedicalLandingPage() {
  const [activeChapter, setActiveChapter] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [cursorActive, setCursorActive] = useState(false);

  // ---------------------------------------------------------------------------
  // INTERACTIVE FOLLOWER CURSOR & SCROLL TRACKING
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 1. Cursor movement tracking
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("[data-cursor]") || target.tagName === "A" || target.tagName === "BUTTON")) {
        setCursorActive(true);
      } else {
        setCursorActive(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);

    // 2. Scroll tracking for Chapter Rail & Three.js Camera Waypoints
    const sections = ["hero", "gate", "pathways", "lessons", "eternity", "care"];
    const handleScroll = () => {
      const scrollY = window.scrollY + window.innerHeight * 0.35;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollY) {
          setActiveChapter(i);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#05070a] text-[#dfe7e0] font-sans selection:bg-[#e0231c] selection:text-white overflow-x-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* THREE.JS WORLD SCENE & ATMOSPHERIC LAYERS */}
      {/* ------------------------------------------------------------------ */}
      <KageThreeCanvas activeChapter={activeChapter} />

      {/* Radial Vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background:
            "radial-gradient(125% 95% at 50% 42%, transparent 40%, rgba(2,4,6,0.70) 100%)",
        }}
      />

      {/* Interactive Follower Cursor Dot */}
      <div
        className={`fixed pointer-events-none rounded-full border transition-all duration-300 ease-out z-50 hidden sm:block ${
          cursorActive
            ? "w-12 h-12 -ml-6 -mt-6 bg-[rgba(223,231,224,0.08)] border-[rgba(223,231,224,0.6)]"
            : "w-6 h-6 -ml-3 -mt-3 border-[rgba(223,231,224,0.35)]"
        }`}
        style={{
          left: `${cursorPos.x}px`,
          top: `${cursorPos.y}px`,
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* FIXED NAVIGATION (FROSTED GLASS WASH + DUAL-LABEL HOVER REVEALS) */}
      {/* ------------------------------------------------------------------ */}
      <header className="fixed top-0 left-0 w-full h-20 z-40 flex items-center justify-between px-6 sm:px-12 backdrop-blur-md bg-[rgba(5,7,10,0.65)] border-b border-[rgba(223,231,224,0.08)] transition-all duration-500">
        {/* Brand Logo */}
        <a
          href="#hero"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection("hero");
          }}
          className="flex items-center gap-3 group"
          data-cursor
        >
          <div className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-[#e0231c] to-[#0a0e12] border border-[rgba(223,231,224,0.2)] shadow-lg shadow-red-950/40 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-mono text-xs font-bold tracking-[0.25em] text-[#dfe7e0]">
              MEDVOICE
            </span>
            <span className="text-[9px] font-mono tracking-[0.32em] text-[#78837c] mt-0.5">
              CLINICAL TRIAGE
            </span>
          </div>
        </a>

        {/* Desktop Nav Links with Dual-Layer Slide Up Reveals */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-11">
          {[
            { id: "gate", en: "Overview", jp: "概要" },
            { id: "pathways", en: "Listen", jp: "聴取" },
            { id: "lessons", en: "Understand", jp: "診断" },
            { id: "eternity", en: "Act", jp: "出動" },
            { id: "care", en: "Care Network", jp: "救急" },
          ].map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(link.id);
              }}
              data-cursor
              className="relative block h-5 overflow-hidden text-[11px] font-medium tracking-[0.2em] uppercase text-[#aab4ad] hover:text-[#dfe7e0] transition-colors group"
            >
              <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full">
                {link.en}
              </span>
              <span className="absolute inset-0 block text-[#e0231c] tracking-[0.3em] font-sans transition-transform duration-500 ease-out translate-y-full group-hover:translate-y-0">
                {link.jp}
              </span>
            </a>
          ))}
        </nav>

        {/* Demo Button & Mobile Hamburger */}
        <div className="flex items-center gap-4">
          <a
            href="/demo"
            data-cursor
            className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[rgba(223,231,224,0.18)] bg-white/5 hover:bg-white/10 px-5 py-2 text-xs font-medium tracking-[0.16em] uppercase text-[#dfe7e0] hover:border-[#dfe7e0] transition-all"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#e0231c] animate-pulse" />
            <span>Launch Triage</span>
          </a>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[#dfe7e0] hover:text-white"
            aria-label="Toggle Menu"
            data-cursor
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 z-30 bg-[#05070a]/95 backdrop-blur-xl flex flex-col justify-center px-8 space-y-6 md:hidden"
          >
            {[
              { id: "hero", en: "00 / Thresholds", jp: "山門" },
              { id: "gate", en: "01 / Overview", jp: "概要" },
              { id: "pathways", en: "02 / Listen", jp: "聴取" },
              { id: "lessons", en: "03 / Understand", jp: "診断" },
              { id: "eternity", en: "04 / Act", jp: "出動" },
              { id: "care", en: "05 / Care Network", jp: "救急" },
            ].map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(link.id);
                }}
                className="flex items-baseline justify-between border-b border-white/10 pb-4 text-xl font-bold tracking-wider text-[#dfe7e0]"
              >
                <span>{link.en}</span>
                <span className="text-xs text-[#e0231c] tracking-widest">{link.jp}</span>
              </a>
            ))}
            <div className="pt-4">
              <a
                href="/demo"
                className="w-full text-center block rounded-full bg-[#e0231c] py-3.5 text-sm font-bold text-white uppercase tracking-widest"
              >
                Simulate Call Live
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* FIXED VERTICAL SCROLL PROGRESS RAIL */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed right-6 sm:right-10 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col gap-3.5 items-center">
        {[0, 1, 2, 3, 4, 5].map((idx) => (
          <button
            key={idx}
            onClick={() => {
              const targets = ["hero", "gate", "pathways", "lessons", "eternity", "care"];
              scrollToSection(targets[idx]);
            }}
            data-cursor
            aria-label={`Jump to Chapter 0${idx}`}
            className="w-6 h-3 flex items-center justify-center group"
          >
            <i
              className={`block h-[1.5px] transition-all duration-500 ${
                activeChapter === idx
                  ? "w-6 bg-[#e0231c]"
                  : "w-3 bg-[rgba(223,231,224,0.22)] group-hover:w-5 group-hover:bg-[#aab4ad]"
              }`}
            />
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* MAIN DOCUMENT PAGE CONTAINER */}
      {/* ================================================================== */}
      <main className="relative z-20 pt-20">
        {/* ---------------------------------------------------------------- */}
        {/* CHAPTER 00 — THE CLINICAL GATE (HERO) */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="hero"
          className="relative min-h-[92vh] max-w-7xl mx-auto px-6 sm:px-12 flex flex-col justify-between pt-12 pb-16"
        >
          <div className="max-w-2xl space-y-6 pt-6 sm:pt-10 text-left">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="inline-flex items-center gap-2.5 text-[10px] font-mono font-medium tracking-[0.24em] uppercase text-[#aab4ad]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#e0231c] shadow-[0_0_8px_#e0231c] animate-pulse" />
              <span>Chapter 00 — Clinical Thresholds</span>
            </motion.div>

            {/* Line-Masked Display Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.035em] text-[#dfe7e0] uppercase leading-[0.98]">
              <span className="block overflow-hidden">
                <motion.span
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className="block"
                >
                  Where voice
                </motion.span>
              </span>
              <span className="block overflow-hidden">
                <motion.span
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="block"
                >
                  intake reveals
                </motion.span>
              </span>
              <span className="block overflow-hidden">
                <motion.span
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="block text-[#e0231c]"
                >
                  clinical urgency.
                </motion.span>
              </span>
            </h1>

            {/* Subhead Lead */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-base sm:text-lg text-[#9aa5a0] font-light leading-relaxed max-w-lg"
            >
              Enter the future of patient triage: 16kHz multi-modal speech streaming, instant ICD-10 symptom mining, and zero-retention HIPAA safeguards.
            </motion.p>
          </div>

          {/* Floating Workstation Peek Frame */}
          <motion.a
            href="#gate"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            data-cursor
            onClick={(e) => {
              e.preventDefault();
              scrollToSection("gate");
            }}
            className="hidden lg:block absolute right-12 top-24 w-72 rounded-2xl bg-gradient-to-b from-[#0a0e12] to-[#05070a] border border-[rgba(223,231,224,0.16)] p-5 shadow-2xl hover:border-[rgba(223,231,224,0.4)] transition-all group"
          >
            <div className="aspect-[16/10] rounded-xl bg-slate-900/90 border border-white/5 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="w-10 h-10 rounded-full bg-[#e0231c]/20 border border-[#e0231c]/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Radio className="w-5 h-5 text-[#e0231c] animate-pulse" />
              </div>
            </div>
            <div className="flex items-baseline justify-between mt-3 text-xs">
              <b className="font-mono text-[#dfe7e0] uppercase tracking-widest">
                WORKSTATION
              </b>
              <i className="not-italic text-[10px] text-[#78837c] font-mono tracking-wider">
                16kHz PCM ACTIVE
              </i>
            </div>
          </motion.a>

          {/* Chapter Chips Navigation */}
          <div className="pt-10 border-t border-[rgba(223,231,224,0.08)]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { num: "01", title: "Speech Stream", desc: "16kHz PCM acoustic capture & intake.", target: "gate" },
                { num: "02", title: "Still Gardens", desc: "Multi-channel symptom triage cards.", target: "pathways" },
                { num: "03", title: "Sacred Craft", desc: "ICD-10 entity mining & SOAP notes.", target: "lessons" },
                { num: "04", title: "Afterlight", desc: "Emergency cardiac dispatch payoff.", target: "eternity" },
              ].map((chip) => (
                <div
                  key={chip.num}
                  onClick={() => scrollToSection(chip.target)}
                  data-cursor
                  className="flex gap-3.5 items-start cursor-pointer group"
                >
                  <span className="text-2xl sm:text-3xl font-light font-mono text-[#dfe7e0] group-hover:text-[#ff5a3c] transition-colors">
                    {chip.num}
                  </span>
                  <div className="space-y-1">
                    <b className="block text-[10px] font-medium tracking-[0.2em] uppercase text-[#aab4ad] group-hover:text-[#dfe7e0] transition-colors">
                      {chip.title}
                    </b>
                    <p className="text-xs text-[#78837c] group-hover:text-[#aab4ad] transition-colors line-clamp-2">
                      {chip.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CHAPTER 01 — THE SANMON / OVERVIEW */}
        {/* ---------------------------------------------------------------- */}
        <section id="gate" className="relative py-24 sm:py-36 max-w-7xl mx-auto px-6 sm:px-12">
          <div className="flex items-baseline gap-4 mb-12 border-b border-[rgba(223,231,224,0.08)] pb-4">
            <span className="text-[10px] font-mono font-medium tracking-[0.24em] uppercase text-[#78837c]">
              <b className="text-[#e0231c]">01</b> — The Sanmon Gate
            </span>
            <div className="flex-1 h-px bg-[rgba(223,231,224,0.08)]" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#78837c]">山門</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[#dfe7e0] leading-tight">
                High-fidelity voice triage, built for zero latency.
              </h2>
            </div>

            <div className="lg:col-span-6 space-y-6 text-left">
              <p className="text-base sm:text-lg text-[#c2cdc5] font-light leading-relaxed">
                MedVoice begins where standard IVR fails: an intelligent speech engine calibrated to comprehend acute distress, breathlessness, and complex symptom clusters in real time.
              </p>
              <p className="text-sm text-[#9aa5a0] leading-relaxed">
                Calls are processed with sub-100ms turn-taking latency. While the patient speaks, the system computes emergency escalation criteria, indexes clinical terminology to ICD-10 ontologies, and syncs directly with ABDM hospital emergency nodes.
              </p>

              <a
                href="#pathways"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("pathways");
                }}
                data-cursor
                className="inline-flex items-center gap-3 text-xs font-mono tracking-[0.2em] uppercase text-[#dfe7e0] hover:text-white pt-4 group"
              >
                <span>Enter Chapter 02 (Listen)</span>
                <span className="w-8 h-8 rounded-full border border-[rgba(223,231,224,0.18)] flex items-center justify-center group-hover:bg-white group-hover:border-white group-hover:text-black transition-all">
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            </div>
          </div>

          {/* Clinical Stats Counter Band */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-8 border-t border-[rgba(223,231,224,0.08)]">
            {[
              { num: "05", label: "Clinical Chapters" },
              { num: "92ms", label: "Speech Latency" },
              { num: "1,611", label: "Hospital Registry Nodes" },
              { num: "100%", label: "Zero Data Retention" },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <b className="block text-3xl sm:text-4xl font-light font-mono tracking-tight text-[#dfe7e0]">
                  {stat.num}
                </b>
                <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#78837c]">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CHAPTER 02 — STILL GARDENS / VOICE INTAKE CARDS */}
        {/* ---------------------------------------------------------------- */}
        <section id="pathways" className="relative py-24 sm:py-36 max-w-7xl mx-auto px-6 sm:px-12">
          <div className="flex items-baseline gap-4 mb-12 border-b border-[rgba(223,231,224,0.08)] pb-4">
            <span className="text-[10px] font-mono font-medium tracking-[0.24em] uppercase text-[#78837c]">
              <b className="text-[#e0231c]">02</b> — Still Gardens
            </span>
            <div className="flex-1 h-px bg-[rgba(223,231,224,0.08)]" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#78837c]">庭園</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Card 1 */}
            <article
              data-cursor
              className="rounded-2xl bg-gradient-to-b from-[#0a0e12] to-[#05070a] border border-[rgba(223,231,224,0.12)] p-6 space-y-4 shadow-xl hover:border-[rgba(223,231,224,0.3)] transition-all group"
            >
              <div className="aspect-[4/5] rounded-xl bg-slate-900/80 border border-white/5 p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>16kHz PCM</span>
                </div>
                <div className="space-y-2 relative z-10">
                  <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-cyan-300">
                    Live Stream
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Speech Intake
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    "Crushing chest pain radiating to left arm..."
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#78837c]">
                <span>Acoustic Ingestion</span>
                <span>01 / 03</span>
              </div>
            </article>

            {/* Card 2 */}
            <article
              data-cursor
              className="rounded-2xl bg-gradient-to-b from-[#0a0e12] to-[#05070a] border border-[rgba(223,231,224,0.12)] p-6 space-y-4 shadow-xl hover:border-[rgba(223,231,224,0.3)] transition-all md:translate-y-8 group"
            >
              <div className="aspect-[4/5] rounded-xl bg-slate-900/80 border border-white/5 p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-mono text-[#ff5a3c]">
                  <Activity className="w-4 h-4" />
                  <span>Biomarkers</span>
                </div>
                <div className="space-y-2 relative z-10">
                  <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-rose-300">
                    Symptom Analysis
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    Acoustic Biomarkers
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    Respiratory distress index & pain vocalization detection.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#78837c]">
                <span>Vocal Extraction</span>
                <span>02 / 03</span>
              </div>
            </article>

            {/* Card 3 */}
            <article
              data-cursor
              className="rounded-2xl bg-gradient-to-b from-[#0a0e12] to-[#05070a] border border-[rgba(223,231,224,0.12)] p-6 space-y-4 shadow-xl hover:border-[rgba(223,231,224,0.3)] transition-all md:translate-y-16 group"
            >
              <div className="aspect-[4/5] rounded-xl bg-slate-900/80 border border-white/5 p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Zero Retention</span>
                </div>
                <div className="space-y-2 relative z-10">
                  <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-emerald-300">
                    Compliance
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    HIPAA Privacy
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    Stateless audio processing pipeline with zero audio storage.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#78837c]">
                <span>Technical Safeguards</span>
                <span>03 / 03</span>
              </div>
            </article>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CHAPTER 03 — SACRED CRAFT / CLINICAL SYLLABUS */}
        {/* ---------------------------------------------------------------- */}
        <section id="lessons" className="relative py-24 sm:py-36 max-w-7xl mx-auto px-6 sm:px-12">
          <div className="flex items-baseline gap-4 mb-12 border-b border-[rgba(223,231,224,0.08)] pb-4">
            <span className="text-[10px] font-mono font-medium tracking-[0.24em] uppercase text-[#78837c]">
              <b className="text-[#e0231c]">03</b> — Sacred Craft
            </span>
            <div className="flex-1 h-px bg-[rgba(223,231,224,0.08)]" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#78837c]">手業</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
            <div className="lg:col-span-7">
              <h2 className="text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[#dfe7e0]">
                Five clinical modules. 90-second triage. Complete accuracy.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm sm:text-base text-[#9aa5a0] font-light leading-relaxed">
                Each interaction translates unstructured voice stream into definitive clinical intelligence ready for EHR ingestion and emergency escalation.
              </p>
            </div>
          </div>

          {/* Syllabus Lesson Rows with Red Indicator Bar */}
          <div className="border-t border-[rgba(223,231,224,0.08)] divide-y divide-[rgba(223,231,224,0.08)]">
            {[
              {
                num: "01",
                title: "Symptom Extraction",
                jp: "症状抽出",
                desc: "Real-time ICD-10 and SNOMED-CT clinical entity mining.",
                time: "Real-time",
              },
              {
                num: "02",
                title: "SOAP Documentation",
                jp: "カルテ作成",
                desc: "Automated generation of Subjective, Objective, Assessment, Plan notes.",
                time: "Instant",
              },
              {
                num: "03",
                title: "Emergency Severity Index",
                jp: "重症度判定",
                desc: "Algorithm-backed triage level computation (ESI 1 through 5).",
                time: "<50ms",
              },
              {
                num: "04",
                title: "EHR Interoperability",
                jp: "電子カルテ連携",
                desc: "Direct FHIR & ABDM registry patient encounter dispatch.",
                time: "Sync",
              },
              {
                num: "05",
                title: "Stateless Security",
                jp: "安全保障",
                desc: "Cryptographically verified ephemeral compute pipeline.",
                time: "Zero log",
              },
            ].map((lesson) => (
              <div
                key={lesson.num}
                data-cursor
                className="relative group py-6 sm:py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 hover:pl-4"
              >
                <div className="flex items-center gap-6">
                  <span className="font-mono text-xs text-[#78837c] group-hover:text-[#e0231c] transition-colors">
                    {lesson.num}
                  </span>
                  <div>
                    <h3 className="text-lg sm:text-xl font-medium text-[#dfe7e0]">
                      {lesson.title}{" "}
                      <em className="not-italic text-xs font-sans text-[#78837c] tracking-widest ml-2">
                        {lesson.jp}
                      </em>
                    </h3>
                    <p className="text-xs text-[#9aa5a0] mt-1 font-light">
                      {lesson.desc}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-[#78837c]">
                  <span>{lesson.time}</span>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#e0231c]" />
                </div>

                {/* Hover Underline Bar */}
                <div className="absolute left-0 bottom-0 w-full h-[1px] bg-[#e0231c] scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500" />
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CHAPTER 04 — AFTERLIGHT / ACTION PAYOFF */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="eternity"
          className="relative min-h-[75vh] flex flex-col items-center justify-center text-center px-6 py-24 sm:py-36 max-w-4xl mx-auto"
        >
          <div className="text-[10px] font-mono font-medium tracking-[0.24em] uppercase text-[#aab4ad] mb-6">
            Chapter 04 — Afterlight Action
          </div>

          <h2 className="text-4xl sm:text-7xl font-extrabold uppercase tracking-tight text-[#dfe7e0] leading-none mb-6">
            Emergency Cardiac Care Dispatch
          </h2>

          <p className="text-base sm:text-lg text-[#b4bfb7] font-light max-w-xl mx-auto leading-relaxed mb-10">
            Clinical entities converged into Level-1 Emergency triage. Direct warm transfer and pre-arrival notification initiated.
          </p>

          <a
            href="/demo"
            data-cursor
            className="inline-flex items-center gap-3.5 rounded-full border border-[rgba(223,231,224,0.3)] bg-gradient-to-r from-[#e0231c] to-[#ff5a3c] px-9 py-4 text-xs font-mono font-bold uppercase tracking-[0.22em] text-white shadow-2xl hover:scale-105 transition-transform"
          >
            <HeartPulse className="w-4 h-4" />
            <span>Simulate Call Encounter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CHAPTER 05 — CARE NETWORK / SPATIAL HOSPITAL MAP */}
        {/* ---------------------------------------------------------------- */}
        <section id="care" className="relative py-24 sm:py-36 max-w-7xl mx-auto px-6 sm:px-12">
          <div className="flex items-baseline gap-4 mb-12 border-b border-[rgba(223,231,224,0.08)] pb-4">
            <span className="text-[10px] font-mono font-medium tracking-[0.24em] uppercase text-[#78837c]">
              <b className="text-[#e0231c]">05</b> — Spatial Hospital Network
            </span>
            <div className="flex-1 h-px bg-[rgba(223,231,224,0.08)]" />
            <span className="text-[10px] font-mono tracking-[0.3em] text-[#78837c]">救急網</span>
          </div>

          <div className="space-y-4 mb-10 text-left">
            <h2 className="text-3xl sm:text-4xl font-extrabold uppercase text-[#dfe7e0]">
              Real-Time Care Facility Routing
            </h2>
            <p className="text-sm text-[#9aa5a0] max-w-xl">
              Live hospital nodes dynamically retrieved from the National Registry, providing bed availability, cardiac ICU status, and transit telemetry.
            </p>
          </div>

          <CinematicCareNetworkMap />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* COLOPHON FOOTER */}
        {/* ---------------------------------------------------------------- */}
        <footer className="relative border-t border-[rgba(223,231,224,0.08)] pt-20 pb-12 px-6 sm:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#e0231c] flex items-center justify-center text-white">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="font-mono text-sm font-bold tracking-widest text-[#dfe7e0]">
                  MEDVOICE
                </span>
              </div>
              <p className="text-xs text-[#78837c] leading-relaxed max-w-xs">
                A five-chapter clinical voice architecture for 24/7 intelligent patient intake, triage calculation, and care routing.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-mono font-medium tracking-[0.22em] uppercase text-[#78837c]">
                Chapters
              </h4>
              <ul className="space-y-2 text-xs text-[#aab4ad]">
                <li><a href="#gate" onClick={(e) => { e.preventDefault(); scrollToSection("gate"); }} className="hover:text-white" data-cursor>The Sanmon (Overview)</a></li>
                <li><a href="#pathways" onClick={(e) => { e.preventDefault(); scrollToSection("pathways"); }} className="hover:text-white" data-cursor>Still Gardens (Listen)</a></li>
                <li><a href="#lessons" onClick={(e) => { e.preventDefault(); scrollToSection("lessons"); }} className="hover:text-white" data-cursor>Sacred Craft (Understand)</a></li>
                <li><a href="#eternity" onClick={(e) => { e.preventDefault(); scrollToSection("eternity"); }} className="hover:text-white" data-cursor>Afterlight (Act)</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-mono font-medium tracking-[0.22em] uppercase text-[#78837c]">
                Clinical Practice
              </h4>
              <ul className="space-y-2 text-xs text-[#aab4ad]">
                <li><a href="/care" className="hover:text-white" data-cursor>Emergency Dispatch</a></li>
                <li><a href="/demo" className="hover:text-white" data-cursor>Simulate Call</a></li>
                <li><a href="/privacy" className="hover:text-white" data-cursor>HIPAA BAA Safeguards</a></li>
                <li><a href="#care" onClick={(e) => { e.preventDefault(); scrollToSection("care"); }} className="hover:text-white" data-cursor>Hospital Registry</a></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-mono font-medium tracking-[0.22em] uppercase text-[#78837c]">
                Architecture
              </h4>
              <ul className="space-y-2 text-xs text-[#78837c] font-mono">
                <li>Three.js 3D Sanctuary World</li>
                <li>Camera Scroll Waypoint Rig</li>
                <li>Instanced Maple Leaf Physics</li>
                <li>Glowing Vermilion Moon Corona</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[rgba(223,231,224,0.08)] text-[10px] font-mono tracking-widest text-[#78837c] uppercase">
            <span>© 2026 MEDVOICE AI — CLINICAL TRIAGE ENGINE</span>
            <span className="text-[#aab4ad]">静けさは一つの技である • STILLNESS IN CLINICAL CARE</span>
            <span>THREE.JS · NEXT.JS · TURBOPACK · FHIR</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
