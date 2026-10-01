"use client";

import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Mic, Volume2, Send, Loader2, ArrowRight, Square } from "lucide-react";

export type VoicePillState = "idle" | "listening" | "transcribing" | "understanding" | "responding";

export interface VoicePillProps {
  state: VoicePillState;
  onToggleRecord?: () => void;
  onStopRecord?: () => void;
  onSendRecord?: () => void;
  onInterrupt?: () => void;
  transcriptSnippet?: string;
  typedValue?: string;
  onTypedChange?: (val: string) => void;
  onSubmitText?: (val: string) => void;
  className?: string;
  speakerName?: string;
  speakerVoiceId?: string;
}

export function VoicePill({
  state,
  onToggleRecord,
  onStopRecord,
  onSendRecord,
  onInterrupt,
  transcriptSnippet = "",
  typedValue = "",
  onTypedChange,
  onSubmitText,
  className = "",
  speakerName,
  speakerVoiceId,
}: VoicePillProps) {
  const shouldReduceMotion = useReducedMotion();
  const isListening = state === "listening";
  const isResponding = state === "responding";
  const isTranscribing = state === "transcribing" || state === "understanding";

  const statusAnnouncement = (() => {
    switch (state) {
      case "listening":
        return transcriptSnippet ? `Listening: "${transcriptSnippet}"` : "Listening for your voice. Speak now or click send.";
      case "transcribing":
        return "Transcribing your speech...";
      case "understanding":
        return "Reviewing clinical symptoms...";
      case "responding":
        return `${speakerName || "Doctor"} is speaking. Click Interrupt to speak.`;
      case "idle":
      default:
        return "Ready. Type symptoms or click microphone to speak.";
    }
  })();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && typedValue.trim()) {
      onSubmitText?.(typedValue.trim());
    }
  };

  return (
    <motion.div
      layout={!shouldReduceMotion}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
        isListening
          ? "bg-slate-950 text-white border-cyan-400 shadow-[0_8px_30px_rgba(6,182,212,0.25)] ring-4 ring-cyan-500/20"
          : isResponding
          ? "bg-slate-900 text-white border-cyan-500/80 shadow-md"
          : isTranscribing
          ? "bg-slate-900 text-white border-slate-700 shadow-sm"
          : "bg-white text-slate-900 border-slate-200/90 shadow-xs hover:border-slate-300 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100"
      } ${className}`}
    >
      {/* Visually hidden screen reader status announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusAnnouncement}
      </div>

      {/* ===================== LEFT: MICROPHONE / STATE ICON TRIGGER ===================== */}
      <button
        type="button"
        onClick={isListening ? (onStopRecord || onToggleRecord) : (isResponding ? onInterrupt : onToggleRecord)}
        aria-label={
          isResponding
            ? "Interrupt doctor"
            : isListening
            ? "Stop recording"
            : "Start microphone voice intake"
        }
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
          isListening
            ? `bg-rose-500 text-white shadow-md ${shouldReduceMotion ? "" : "animate-pulse"}`
            : isResponding
            ? "bg-cyan-500 text-white hover:bg-cyan-600 shadow-xs"
            : "bg-slate-900 text-white hover:bg-slate-800 shadow-2xs"
        }`}
      >
        {isListening ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : isResponding ? (
          <Volume2 className={`w-4 h-4 ${shouldReduceMotion ? "" : "animate-pulse"}`} />
        ) : isTranscribing ? (
          <Loader2 className={`w-4 h-4 text-cyan-400 ${shouldReduceMotion ? "" : "animate-spin"}`} />
        ) : (
          <Mic className="w-4 h-4 text-cyan-400" />
        )}
      </button>

      {/* ===================== CENTER: TRANSFORMING INTERACTION BODY ===================== */}
      <div className="flex-1 min-w-0">
        {/* State A: LISTENING (Live Waveform + Interim Speech Snippet) */}
        {isListening && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 h-5 flex-shrink-0" aria-hidden="true">
              {[0.4, 0.9, 0.6, 1, 0.7, 0.4, 0.8, 0.5, 0.9, 0.6].map((scale, i) =>
                shouldReduceMotion ? (
                  <div
                    key={i}
                    style={{ height: `${Math.round(scale * 100)}%` }}
                    className="w-1 bg-cyan-400 rounded-full origin-center"
                  />
                ) : (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [scale * 0.3, scale, scale * 0.35] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.07, ease: "easeInOut" }}
                    className="w-1 bg-cyan-400 rounded-full h-full origin-center"
                  />
                )
              )}
            </div>
            <span className="text-xs text-cyan-200 font-sans truncate font-medium">
              {transcriptSnippet ? `"${transcriptSnippet}"` : "Listening to your voice... speak now"}
            </span>
          </div>
        )}

        {/* State B: TRANSCRIBING / UNDERSTANDING (Processing Feedback) */}
        {isTranscribing && (
          <div className="flex items-center gap-2 text-xs text-slate-300 font-sans">
            <span className={`w-2 h-2 rounded-full bg-cyan-400 ${shouldReduceMotion ? "" : "animate-ping"}`} />
            <span className="font-mono text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
              {state === "understanding" ? "Reviewing..." : "Transcribing..."}
            </span>
            {transcriptSnippet && (
              <span className="text-slate-400 truncate italic">
                "{transcriptSnippet}"
              </span>
            )}
          </div>
        )}

        {/* State C: RESPONDING (Doctor Speech Playback + Waveform) */}
        {isResponding && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 ${shouldReduceMotion ? "" : "animate-pulse"}`} />
              <span className="text-xs font-semibold text-white truncate">
                {speakerName || "Doctor"} is speaking...
              </span>
            </div>
            <span className="text-[11px] font-mono text-cyan-300 hidden sm:inline flex-shrink-0">
              Click to interrupt
            </span>
          </div>
        )}

        {/* State D: IDLE (Direct Input Field for Typing or Voice) - Kept mounted to preserve focus */}
        <input
          type="text"
          value={typedValue}
          onChange={(e) => onTypedChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type symptoms or click mic to speak..."
          aria-label="Patient symptoms input"
          tabIndex={isListening || isTranscribing || isResponding ? -1 : 0}
          aria-hidden={isListening || isTranscribing || isResponding ? "true" : undefined}
          className={`w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none font-medium ${
            isListening || isTranscribing || isResponding ? "sr-only" : "block"
          }`}
        />
      </div>

      {/* ===================== RIGHT: CONTEXTUAL ACTION BUTTON ===================== */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {isListening ? (
          <button
            type="button"
            onClick={onSendRecord || onToggleRecord}
            aria-label="Send recorded voice"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30 text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3 h-3" />
          </button>
        ) : isResponding ? (
          <button
            type="button"
            onClick={onInterrupt}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30 text-xs font-bold font-mono uppercase tracking-wider transition-colors cursor-pointer"
          >
            Interrupt
          </button>
        ) : (
          typedValue.trim() && (
            <button
              type="button"
              onClick={() => onSubmitText?.(typedValue.trim())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
            >
              <span>Send</span>
              <ArrowRight className="w-3 h-3 text-cyan-400" />
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}

export default VoicePill;

