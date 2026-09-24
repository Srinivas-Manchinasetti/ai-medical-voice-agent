"use client";

import React, { useRef, useState } from "react";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightRadius?: number;
  isActive?: boolean;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(6, 182, 212, 0.12)",
  spotlightRadius = 280,
  isActive = false,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-3xl overflow-hidden transition-all duration-300 ${className}`}
      {...props}
    >
      {/* Dynamic Radial Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
        style={{
          opacity: isHovered || isActive ? 1 : 0,
          background: `radial-gradient(${spotlightRadius}px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
}

export default SpotlightCard;
