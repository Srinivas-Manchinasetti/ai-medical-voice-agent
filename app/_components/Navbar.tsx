"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Radio,
  MapPin,
  FileText,
  Cpu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const userName =
    user?.fullName ||
    (user?.firstName
      ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
      : "") ||
    "Physician";

  const userInitials =
    userName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ME";

  return (
    <>
      <header className="sticky top-0 z-40 w-full transition-all duration-300 backdrop-blur-xl bg-[#FAF9F6]/90 border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          {/* Brand Logo matching Landing Page */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="relative flex items-center justify-center h-8 w-8 overflow-hidden rounded-xl border border-sky-200/80 bg-white shadow-sm transition-transform group-hover:scale-105">
              <img src="/images/medvoice-logo.png" alt="MedVoice AI" className="h-full w-full object-cover scale-110" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-extrabold tracking-wider text-slate-950 leading-tight">
                MEDVOICE
              </span>
              <span className="font-mono text-[9px] font-bold tracking-widest text-cyan-700 leading-tight">
                CLINICAL AI TRIAGE
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-bold">
            <Link
              href="/"
              className={`rounded-xl px-4 py-2 transition-all cursor-pointer ${
                pathname === "/"
                  ? "text-slate-950 bg-slate-200/70 font-extrabold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              Home
            </Link>
            <Link
              href="/demo"
              className={`rounded-xl px-4 py-2 transition-all cursor-pointer ${
                pathname === "/demo"
                  ? "text-slate-950 bg-slate-200/70 font-extrabold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              MedVoice Live
            </Link>
            <Link
              href="/care"
              className={`rounded-xl px-4 py-2 transition-all cursor-pointer ${
                pathname === "/care"
                  ? "text-slate-950 bg-slate-200/70 font-extrabold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              Care Network
            </Link>
            <Link
              href="/privacy"
              className={`rounded-xl px-4 py-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                pathname === "/privacy"
                  ? "text-slate-950 bg-slate-200/70 font-extrabold"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Privacy Policy</span>
            </Link>
          </nav>

          {/* Action Buttons & Burger */}
          <div className="flex items-center gap-3">
            {mounted && isLoaded ? (
              isSignedIn ? (
                /* Signed-in User Pill */
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-emerald-50/70 px-3.5 py-1.5 text-xs font-bold text-slate-900 shadow-sm transition-all hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="max-w-[130px] truncate">{userName}</span>
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </button>
              ) : (
                /* Signed-out Sign In Button */
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/80 bg-sky-50/80 px-4 py-1.5 text-xs font-bold text-sky-950 shadow-sm transition-all hover:bg-sky-100 hover:border-sky-400 cursor-pointer"
                >
                  <span>Sign In</span>
                  <ArrowRight className="h-3 w-3 text-sky-600" />
                </Link>
              )
            ) : (
              <div className="h-7 w-20 bg-slate-200/60 rounded-full animate-pulse" />
            )}

            {/* 2-bar Burger Menu Button matching landing page */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Navigation Drawer"
              className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 shadow-sm transition-all cursor-pointer"
            >
              <span className="h-0.5 w-4 rounded-full bg-slate-900" />
              <span className="h-0.5 w-2.5 self-start ml-2.5 rounded-full bg-slate-900" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================ Slide-out Clinical Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          />

          {/* Drawer Panel */}
          <aside className="relative z-50 flex h-full w-full max-w-sm sm:max-w-md flex-col justify-between overflow-y-auto bg-[#FAF9F6] p-6 shadow-2xl border-l border-slate-200 transition-transform duration-300 animate-in slide-in-from-right">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex items-center justify-center h-8 w-8 overflow-hidden rounded-xl border border-sky-200/80 bg-white shadow-sm">
                    <img src="/images/medvoice-logo.png" alt="MedVoice AI" className="h-full w-full object-cover scale-110" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-950 leading-tight">MEDVOICE AI</div>
                    <div className="font-mono text-[9px] font-bold text-slate-500 tracking-wider">CLINICAL PORTAL</div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Auth Card */}
              <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
                {mounted && isLoaded && isSignedIn ? (
                  /* Signed In Card */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      {user?.imageUrl ? (
                        <img
                          src={user.imageUrl}
                          alt={userName}
                          className="h-11 w-11 rounded-full object-cover border-2 border-sky-200"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-white font-bold text-sm">
                          {userInitials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-950 text-sm truncate">{userName}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                        </div>
                        <div className="text-xs text-slate-500 truncate font-mono">
                          {user?.primaryEmailAddress?.emailAddress}
                        </div>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                      VERIFIED CLINICAL ACCOUNT
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/demo"
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all text-center cursor-pointer"
                      >
                        <span>Clinical Triage</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                      </Link>
                      <button
                        onClick={() => {
                          setDrawerOpen(false);
                          signOut({ redirectUrl: "/" });
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Signed Out Card */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-800 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      <span>Clinical Account Access</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Sign in to manage patient triage records, review audio transcripts, and access real-time hospital dispatch.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/sign-in"
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all text-center cursor-pointer"
                      >
                        <span>Sign In</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                      </Link>
                      <Link
                        href="/sign-up"
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-200 transition-all text-center cursor-pointer"
                      >
                        <span>Create Account</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Clinical Applications Section */}
              <div className="mt-8">
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">
                  CLINICAL APPLICATIONS
                </div>
                <div className="space-y-2">
                  <Link
                    href="/demo"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-sky-300 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 border border-sky-100 group-hover:scale-105 transition-transform">
                      <Radio className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-sky-900 transition-colors">
                        MedVoice Live Triage
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        16kHz continuous acoustic intake & biomarker extractor
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/care"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-sky-300 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:scale-105 transition-transform">
                      <MapPin className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-900 transition-colors">
                        Care Network Locator
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Real-time hospital bed capacity & ambulance GPS routing
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/privacy"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-sky-300 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-900 transition-colors">
                        HIPAA & Privacy Policy
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Zero-retention data protection & ABDM compliance
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="pt-6 border-t border-slate-200 text-center">
              <span className="font-mono text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                MedVoice AI v2.4 • Clinical Voice Intelligence
              </span>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
