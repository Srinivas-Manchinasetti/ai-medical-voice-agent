"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MovingBorderProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  borderRadius?: string;
  duration?: number;
}

export function MovingBorder({
  children,
  active = false,
  className = "",
  borderRadius = "12px",
  duration = 3,
}: MovingBorderProps) {
  if (!active) {
    return <div className={cn("relative", className)}>{children}</div>;
  }

  return (
    <div
      className={cn("relative p-[1.5px] overflow-hidden group transition-all", className)}
      style={{ borderRadius }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -translate-x-1/2 -translate-y-1/2 w-[250%] h-[250%]"
        style={{
          background: "conic-gradient(from 0deg at 50% 50%, #06b6d4 0deg, #14b8a6 60deg, transparent 120deg, transparent 360deg)",
        }}
        animate={{
          rotate: [0, 360],
        }}
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
