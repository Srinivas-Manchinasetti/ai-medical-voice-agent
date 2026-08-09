"use client";

import React, { useState, useEffect } from "react";
import { Activity, ArrowRight } from "lucide-react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-7xl px-6 transition-all duration-300">
      <nav
        className={`flex items-center justify-between rounded-2xl px-8 py-4.5 transition-all duration-300 ${
          scrolled
            ? "border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-2xl"
            : "border border-slate-200/80 bg-white/80 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
        }`}
      >
        {/* Brand Logo */}
        <a href="#" className="flex items-center gap-3.5 group cursor-pointer">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/20 transition-transform group-hover:scale-105">
            <Activity className="h-5 w-5 text-teal-400" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            MediVoice
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              AI
            </span>
          </span>
        </a>

        {/* Center Nav Links */}
        <div className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-600">
          <a
            href="#playground"
            className="rounded-xl px-5 py-2.5 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
          >
            Playground
          </a>
          <a
            href="#capabilities"
            className="rounded-xl px-5 py-2.5 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
          >
            Capabilities
          </a>
          <a
            href="#solutions"
            className="rounded-xl px-5 py-2.5 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
          >
            Solutions
          </a>
          <a
            href="#security"
            className="rounded-xl px-5 py-2.5 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
          >
            Security
          </a>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="hidden sm:inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
          >
            Sign in
          </a>
          <a
            href="#playground"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <span>Book Demo</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </a>
        </div>
      </nav>
    </header>
  );
}
