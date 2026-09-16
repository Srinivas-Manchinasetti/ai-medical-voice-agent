"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlowingBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glowColor?: "cyan" | "emerald" | "amber" | "rose" | "purple";
  active?: boolean;
  intensity?: "subtle" | "medium";
}

export function GlowingBorder({
  children,
  className = "",
  glowColor = "cyan",
  active = true,
  intensity = "subtle",
  ...props
}: GlowingBorderProps) {
  const glowStyles = {
    cyan: "from-cyan-500/25 via-teal-400/20 to-transparent",
    emerald: "from-emerald-500/25 via-teal-400/20 to-transparent",
    amber: "from-amber-500/25 via-yellow-400/20 to-transparent",
    rose: "from-rose-500/25 via-pink-400/20 to-transparent",
    purple: "from-purple-500/25 via-indigo-400/20 to-transparent",
  };

  const borderStyles = {
    cyan: "border-cyan-200/80 shadow-[0_0_15px_-3px_rgba(6,182,212,0.15)]",
    emerald: "border-emerald-200/80 shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]",
    amber: "border-amber-200/80 shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]",
    rose: "border-rose-200/80 shadow-[0_0_15px_-3px_rgba(244,63,94,0.15)]",
    purple: "border-purple-200/80 shadow-[0_0_15px_-3px_rgba(168,85,247,0.15)]",
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl transition-all duration-300",
        active ? borderStyles[glowColor] : "border-slate-200/80",
        className
      )}
      {...props}
    >
      {active && (
        <div
          className={cn(
            "pointer-events-none absolute -inset-0.5 rounded-[18px] bg-gradient-to-r opacity-50 blur-[2px] transition-opacity duration-500 -z-10",
            glowStyles[glowColor],
            intensity === "subtle" ? "opacity-35" : "opacity-60"
          )}
        />
      )}
      {children}
    </div>
  );
}
