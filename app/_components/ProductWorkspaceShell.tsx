"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ProductWorkspaceShell({ children, className = "", style }: Props) {
  return (
    <div
      style={style}
      className={`relative max-w-5xl mx-auto w-full rounded-3xl border border-slate-800/80 bg-[#0B0F17] p-2 md:p-3 shadow-[0_45px_120px_-20px_rgba(0,0,0,0.6)] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
}
