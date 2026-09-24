"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";

export interface ScrollStackCard {
  step: string;
  tag: string;
  title: string;
  description: string;
  highlightBadge: string;
  badgeColor: string;
  metric?: string;
  content: React.ReactNode;
}

export interface ScrollStackProps {
  cards: ScrollStackCard[];
  className?: string;
}

function StackCardItem({
  card,
  index,
  total,
  progress,
}: {
  card: ScrollStackCard;
  index: number;
  total: number;
  progress: any;
}) {
  const cardStart = index / total;
  const cardEnd = (index + 1) / total;

  // Scale down slightly as subsequent cards stack on top
  const scale = useTransform(progress, [cardStart, 1], [1, 1 - (total - index - 1) * 0.035]);
  // Smoothly elevate
  const yOffset = index * 18;

  return (
    <motion.div
      style={{
        scale,
        top: `calc(12vh + ${yOffset}px)`,
      }}
      className="sticky w-full max-w-4xl mx-auto rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.08)] p-6 sm:p-10 mb-8 transition-colors"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Information Side */}
        <div className="lg:col-span-6 space-y-4 text-left">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-slate-400">
              {card.step}
            </span>
            <span className="text-slate-300">/</span>
            <span
              className={`font-mono text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${card.badgeColor}`}
            >
              {card.tag}
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight leading-tight">
            {card.title}
          </h3>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
            {card.description}
          </p>

          <div className="pt-2 flex items-center gap-3">
            <span className="font-mono text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-xl inline-block">
              {card.highlightBadge}
            </span>
            {card.metric && (
              <span className="font-mono text-xs text-slate-500 font-medium">
                {card.metric}
              </span>
            )}
          </div>
        </div>

        {/* Right Visual Clinical Slate */}
        <div className="lg:col-span-6 w-full">
          <div className="w-full rounded-2xl bg-slate-50 border border-slate-200/90 p-5 font-mono text-xs shadow-2xs">
            {card.content}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export function ScrollStack({ cards, className = "" }: ScrollStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const smoothProgress = useSpring(scrollYProgress, { damping: 25, stiffness: 100 });

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {cards.map((card, index) => (
        <StackCardItem
          key={card.step}
          card={card}
          index={index}
          total={cards.length}
          progress={smoothProgress}
        />
      ))}
    </div>
  );
}

export default ScrollStack;
