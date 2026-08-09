"use client";

import React from "react";
import { Activity, ShieldCheck, CheckCircle2, ArrowUpRight, Globe, Mail, FileText, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-12">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand Column (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm">
                <Activity className="h-5 w-5 text-teal-400" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                MediVoice
                <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">
                  AI
                </span>
              </span>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Deliver instant, empathetic medical assistance through natural voice conversations. Automating symptom triage, appointment scheduling, and EHR SOAP charting 24/7.
            </p>

            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[11px] text-emerald-400 font-bold">ALL SYSTEMS OPERATIONAL</span>
            </div>

            {/* Security Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-teal-400" /> HIPAA Architecture</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> SOC 2 Type II</span>
            </div>
          </div>

          {/* Product Links (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="font-bold text-white text-xs block uppercase tracking-wider font-mono">Product</span>
            <ul className="space-y-2.5 text-slate-400">
              <li><a href="#playground" className="hover:text-white transition-colors flex items-center gap-1">Voice Simulator <ArrowUpRight className="h-3 w-3 text-slate-600" /></a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">Real-Time Triage</a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">SOAP Note Generator</a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">EHR Integration</a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">Multilingual Engine</a></li>
            </ul>
          </div>

          {/* Solutions Links (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="font-bold text-white text-xs block uppercase tracking-wider font-mono">Solutions</span>
            <ul className="space-y-2.5 text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Hospitals & ERs</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Urgent Care Networks</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Primary Care Clinics</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Specialty Practices</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Telehealth Platforms</a></li>
            </ul>
          </div>

          {/* Resources Links (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="font-bold text-white text-xs block uppercase tracking-wider font-mono">Resources</span>
            <ul className="space-y-2.5 text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">API Documentation</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">Security & Trust</a></li>
              <li><a href="#" className="hover:text-white transition-colors">BAA Request</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Clinical Benchmarks</a></li>
              <li><a href="#" className="hover:text-white transition-colors">System Status</a></li>
            </ul>
          </div>

          {/* Company Links (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="font-bold text-white text-xs block uppercase tracking-wider font-mono">Company</span>
            <ul className="space-y-2.5 text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Clinical Advisory</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers <span className="text-[10px] bg-teal-950 text-teal-400 border border-teal-500/30 px-1.5 py-0.5 rounded font-mono">HIRING</span></a></li>
              <li><a href="#" className="hover:text-white transition-colors">Press & Media</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Sales</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#94A3B8] text-[11px]">
          <p>© {new Date().getFullYear()} MediVoice AI Inc. All rights reserved.</p>

          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">HIPAA Notice</a>
            <a href="#" className="hover:text-white transition-colors">Security Statement</a>
          </div>

          <div className="flex items-center gap-3">
            <a href="#" className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all" title="Website">
              <Globe className="h-4 w-4" />
            </a>
            <a href="#" className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all" title="Documentation">
              <FileText className="h-4 w-4" />
            </a>
            <a href="#" className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all" title="Security Vault">
              <Lock className="h-4 w-4" />
            </a>
            <a href="#" className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-all" title="Contact Us">
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
