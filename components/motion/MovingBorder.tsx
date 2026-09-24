"use client";

import React from "react";
import { motion } from "motion/react";

export interface MovingBorderProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  borderRadius?: string;
  duration?: number;
  borderColors?: string;
}

export function MovingBorder({
  children,
  active = true,
  className = "",
  borderRadius = "16px",
  duration = 3.5,
  borderColors = "conic-gradient(from 0deg at 50% 50%, #06b6d4 0deg, #10b981 80deg, transparent 160deg, transparent 360deg)",
}: MovingBorderProps) {
  if (!active) {
    return <div className={`relative ${className}`}>{children}</div>;
  }

  return (
    <div
      className={`relative p-[1.5px] overflow-hidden group transition-all ${className}`}
      style={{ borderRadius }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%]"
        style={{ background: borderColors }}
        animate={{ rotate: [0, 360] }}
        transition={{
          repeat: Infinity,
          duration,
          ease: "linear",
        }}
      />
      <div
        className="relative bg-white z-10 w-full h-full"
        style={{ borderRadius: `calc(${borderRadius} - 1.5px)` }}
      >
        {children}
      </div>
    </div>
  );
}

export default MovingBorder;
