"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star, CheckCircle2 } from "lucide-react";

export interface PeekRatingProps {
  onSubmit?: (rating: number, tags: string[]) => void;
  className?: string;
}

const FEEDBACK_TAGS = [
  "Clinically Clear",
  "Accurate Advice",
  "Empathetic Tone",
  "Fast Response",
  "Helpful Triage",
];

export function PeekRating({ onSubmit, className = "" }: PeekRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleFinish = () => {
    setSubmitted(true);
    onSubmit?.(rating, selectedTags);
  };

  if (submitted) {
    return (
      <div className={`p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm text-center space-y-2 ${className}`}>
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
        <h4 className="text-sm font-bold text-slate-900">Thank you for your clinical feedback</h4>
        <p className="text-xs text-slate-500 font-medium">Your response helps improve MedVoice clinical assistance.</p>
      </div>
    );
  }

  return (
    <div
      className={`p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm text-center space-y-4 ${className}`}
    >
      <div className="space-y-1">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full inline-block">
          POST-CONSULTATION REVIEW
        </span>
        <h3 className="text-base font-bold text-slate-950">
          How was your voice consultation?
        </h3>
      </div>

      {/* Stars */}
      <div className="flex items-center justify-center gap-1.5 py-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = (hoverRating || rating) >= star;
          return (
            <button
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-1 transition-transform hover:scale-115 cursor-pointer text-slate-300 hover:text-amber-400"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  isActive ? "text-amber-400 fill-amber-400" : "text-slate-200"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Peek Contextual Chips (Revealed upon star selection) */}
      <AnimatePresence>
        {rating > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 10 }}
            className="space-y-4 pt-2 overflow-hidden"
          >
            <p className="text-xs text-slate-500 font-medium">
              What went well during this triage session?
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {FEEDBACK_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`font-mono text-xs px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-950 text-white border-slate-950 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleFinish}
              className="mt-2 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold font-mono uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            >
              Submit Feedback
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PeekRating;
