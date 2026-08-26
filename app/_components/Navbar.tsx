"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { useUser, UserButton } from "@clerk/nextjs";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-7xl px-4 sm:px-6 transition-all duration-300">
      <nav
        className={`flex items-center justify-between rounded-2xl px-6 sm:px-8 py-3.5 sm:py-4 transition-all duration-300 ${
          scrolled
            ? "border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-2xl"
            : "border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/5 backdrop-blur-xl"
        }`}
      >
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/20 transition-transform group-hover:scale-105">
            <Activity className="h-5 w-5 text-teal-400" />
          </div>
          <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            MedVoice
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              AI
            </span>
          </span>
        </Link>

        {/* Center Nav Links: Home, MedVoice Live, Care Network, Privacy Policy */}
        <div className="hidden lg:flex items-center gap-1 text-xs font-bold text-slate-600">
          <Link
            href="/"
            className="rounded-xl px-3.5 py-2 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
          >
            Home
          </Link>
          <Link
            href="/demo"
            className="rounded-xl px-3.5 py-2 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer font-bold text-slate-950"
          >
            MedVoice Live
          </Link>
          <Link
            href="/care"
            className="rounded-xl px-3.5 py-2 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer"
          >
            Care Network
          </Link>
          <Link
            href="/privacy"
            className="rounded-xl px-3.5 py-2 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Privacy Policy</span>
          </Link>
        </div>

        {/* Authentication State & Actions */}
        <div className="flex items-center gap-2.5 min-h-[36px]">
          {mounted && isLoaded ? (
            isSignedIn ? (
              /* IF SIGNED IN: Render Clerk UserButton Avatar with Profile & Signout Dropdown */
              <div className="flex items-center gap-3">
                <Link
                  href="/demo"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 px-3 py-2 text-xs font-bold transition-all cursor-pointer"
                >
                  <span>Voice Demo</span>
                </Link>
                <div className="p-0.5 rounded-full border border-slate-200 hover:border-slate-400 transition-all">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8 rounded-full",
                      },
                    }}
                  />
                </div>
              </div>
            ) : (
              /* IF SIGNED OUT: Render Login & Create Account Buttons */
              <div className="flex items-center gap-2">
                <Link
                  href="/sign-in"
                  className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Login
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                >
                  <span>Create Account</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              </div>
            )
          ) : (
            /* Hydration fallback */
            <div className="h-8 w-24 bg-slate-100 rounded-xl animate-pulse" />
          )}
        </div>
      </nav>
    </header>
  );
}
