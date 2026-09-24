"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export interface SwipeToastProps {
  id: string;
  type?: "success" | "warning" | "info";
  title: string;
  description: string;
  onDismiss?: (id: string) => void;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function SwipeToast({
  id,
  type = "success",
  title,
  description,
  onDismiss,
  actionLabel,
  onAction,
  className = "",
}: SwipeToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-120, 0, 120], [0, 1, 0]);

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => onDismiss?.(id), 250);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (Math.abs(info.offset.x) > 80) {
      handleDismiss();
    }
  };

  if (dismissed) return null;

  const isWarning = type === "warning";
  const isSuccess = type === "success";

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, opacity }}
      className={`relative flex items-start gap-3 p-4 rounded-2xl border shadow-lg backdrop-blur-xl cursor-grab active:cursor-grabbing select-none transition-colors ${
        isWarning
          ? "bg-rose-50/95 border-rose-200 text-rose-950"
          : isSuccess
          ? "bg-white/98 border-emerald-200/90 text-slate-900"
          : "bg-white/98 border-slate-200 text-slate-900"
      } ${className}`}
    >
      <div className="pt-0.5">
        {isWarning ? (
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
        ) : isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        ) : (
          <Info className="w-5 h-5 text-cyan-600 flex-shrink-0" />
        )}
      </div>

      <div className="flex-1 min-w-0 pr-2">
        <h4 className="text-xs sm:text-sm font-bold tracking-tight">{title}</h4>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
          {description}
        </p>
        {actionLabel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.();
            }}
            className="mt-2 text-xs font-bold text-cyan-700 hover:text-cyan-800 font-mono underline cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <span className="text-[9px] font-mono text-slate-400">← swipe</span>
      </div>
    </motion.div>
  );
}

export default SwipeToast;
