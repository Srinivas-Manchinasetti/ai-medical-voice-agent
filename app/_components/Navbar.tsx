"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  ArrowRight,
  ShieldCheck,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";

interface NavLinkItem {
  href: string;
  label: string;
  alt: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { href: "/", label: "Home", alt: "OVERVIEW" },
  { href: "/consult", label: "Voice Consult", alt: "DOCTORS" },
  { href: "/dashboard", label: "SOAP Reports", alt: "RECORDS" },
  { href: "/care", label: "Care Network", alt: "HOSPITALS" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    setMounted(true);
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
      {/* ============================================================ Sticky Glass Header */}
      <header className="sticky top-0 z-40 w-full transition-all duration-300 backdrop-blur-xl bg-[#FAF9F6]/90 border-b border-slate-200/80">
        <div className="mx-auto flex h-16 sm:h-[72px] max-w-7xl items-center justify-between px-6 sm:px-10">
          
          {/* Brand Logo & Clinical Typography matching Kage */}
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-[9px] overflow-hidden border border-sky-300/80 shadow-[0_0_10px_rgba(2,132,199,0.2)] bg-white flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
              <img
                src="/images/medvoice-logo.png"
                alt="MedVoice AI"
                className="w-full h-full object-cover scale-110"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold tracking-[0.26em] text-slate-950 uppercase leading-none">
                MEDVOICE
              </span>
              <span className="text-[8px] font-semibold tracking-[0.34em] text-cyan-800 uppercase leading-none">
                CLINICAL AI TRIAGE
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links with Dual-tier Rolling Hover UX */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-10">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative block h-[16px] overflow-hidden group cursor-pointer text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors ${
                    isActive ? "text-slate-950 font-bold" : "text-slate-600 hover:text-slate-950"
                  }`}
                >
                  <span className="block h-[16px] leading-[16px] transition-transform duration-500 ease-out group-hover:-translate-y-full">
                    {item.label}
                  </span>
                  <span className="absolute inset-0 block h-[16px] leading-[16px] transition-transform duration-500 ease-out translate-y-full group-hover:translate-y-0 text-cyan-700 tracking-[0.28em] font-bold">
                    {item.alt}
                  </span>
                  {isActive && (
                    <span className="absolute left-0 -bottom-1 w-full h-[2px] bg-cyan-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Section: User Capsule + 2-bar Burger Button */}
          <div className="flex items-center gap-4">
            {mounted && isLoaded ? (
              isSignedIn ? (
                /* Signed-in User Pill */
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-300/80 bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition-all hover:bg-sky-50 hover:border-sky-400 cursor-pointer"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="max-w-[130px] truncate text-[11px] font-bold tracking-tight">
                    {userName}
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-500" />
                </button>
              ) : (
                /* Signed-out Sign In Button */
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/80 bg-sky-50/80 px-4 py-1.5 text-[11px] font-bold tracking-[0.08em] uppercase text-sky-950 shadow-sm transition-all hover:bg-sky-100 hover:border-sky-400 cursor-pointer"
                >
                  <span>Sign In</span>
                  <ArrowRight className="h-3 w-3 text-sky-600" />
                </Link>
              )
            ) : (
              <div className="h-7 w-20 bg-slate-200/60 rounded-full animate-pulse" />
            )}

            {/* 2-bar Minimalist Burger Menu Button matching Kage */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="w-[26px] h-[16px] relative flex flex-col justify-between items-end cursor-pointer group bg-transparent border-0 p-0 focus:outline-none"
            >
              <span className="block h-[1.5px] bg-slate-800 rounded-full w-[26px] transition-all duration-300 ease-out group-hover:w-[17px]" />
              <span className="block h-[1.5px] bg-slate-800 rounded-full w-[17px] transition-all duration-300 ease-out group-hover:w-[26px]" />
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
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

          {/* Drawer Panel */}
          <aside className="relative z-50 flex h-full w-full max-w-sm sm:max-w-md flex-col justify-between overflow-y-auto bg-[#FAF9F6] p-6 shadow-2xl border-l border-slate-200 transition-transform duration-300 animate-in slide-in-from-right">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[9px] overflow-hidden border border-sky-300/80 shadow-sm bg-white flex items-center justify-center flex-shrink-0">
                    <img
                      src="/images/medvoice-logo.png"
                      alt="MedVoice AI"
                      className="w-full h-full object-cover scale-110"
                    />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-950 leading-tight tracking-wider">
                      MEDVOICE AI
                    </div>
                    <div className="font-mono text-[9px] font-bold text-slate-500 tracking-widest">
                      CLINICAL PORTAL
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close Drawer"
                  className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-950 flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
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
                          <span className="font-extrabold text-slate-950 text-sm truncate">
                            {userName}
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                        </div>
                        <div className="text-xs text-slate-500 truncate font-mono">
                          {user?.primaryEmailAddress?.emailAddress}
                        </div>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[9px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                      VERIFIED CLINICAL ACCOUNT
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Link
                        href="/consult"
                        onClick={() => setDrawerOpen(false)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-all text-center cursor-pointer"
                      >
                        <span>Voice Consult</span>
                        <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
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

              {/* Clinical Applications Section matching Kage Drawer */}
              <div className="mt-8">
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">
                  CLINICAL APPLICATIONS
                </div>
                <div className="space-y-2">
                  <Link
                    href="/consult"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-cyan-200/90 bg-cyan-50/40 p-3.5 transition-all hover:border-cyan-400 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-100 text-cyan-800 border border-cyan-200 text-base group-hover:scale-105 transition-transform flex-shrink-0">
                      🩺
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-cyan-900 transition-colors">
                        Live Doctor Voice Consultation
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Real-time clinical interview with AI specialists & instant SOAP note
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-emerald-300 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 text-base group-hover:scale-105 transition-transform flex-shrink-0">
                      📋
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-900 transition-colors">
                        My SOAP Clinical Reports
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        View past consultation records, ICD-10 codes, and printable charts
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/care"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-sky-300 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-800 border border-sky-100 text-base group-hover:scale-105 transition-transform flex-shrink-0">
                      🏥
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-sky-900 transition-colors">
                        Care Network Locator
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium truncate">
                        Real-time hospital bed capacity & emergency GPS routing
                      </div>
                    </div>
                  </Link>

                  <Link
                    href="/privacy"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 bg-white p-3.5 transition-all hover:border-slate-300 hover:shadow-md group cursor-pointer"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-base group-hover:scale-105 transition-transform flex-shrink-0">
                      🔒
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 group-hover:text-slate-950 transition-colors">
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
              <span className="font-mono text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                MedVoice AI v2.4 • Clinical Voice Intelligence
              </span>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
