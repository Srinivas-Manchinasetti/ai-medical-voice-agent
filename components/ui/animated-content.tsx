"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AnimatedContentProps {
  children: React.ReactNode;
  contentKey?: string | number;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "none";
}

export function AnimatedContent({
  children,
  contentKey,
  className = "",
  delay = 0,
  direction = "up",
}: AnimatedContentProps) {
  const initialY = direction === "up" ? 8 : direction === "down" ? -8 : 0;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={contentKey}
        initial={{ opacity: 0, y: initialY }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -initialY }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
