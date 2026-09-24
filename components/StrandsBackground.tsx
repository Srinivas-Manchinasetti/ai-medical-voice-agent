'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Strands from './Strands';
import Aurora from './Aurora';

export interface StrandsBackgroundProps {
  colors?: string[];
  opacity?: number;
  intensity?: number;
  speed?: number;
  yOffset?: number;
}

export function StrandsBackground({
  colors = ['#38BDF8', '#818CF8', '#C084FC'],
  opacity = 0.28,
  speed = 0.7
}: StrandsBackgroundProps) {
  const pathname = usePathname();

  // Keep background atmosphere subtle and clinical across all pages
  const effectiveOpacity = pathname === '/' ? 0.20 : opacity;

  // Global ambient atmosphere covering entire viewport/page seamlessly
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden w-full h-full"
    >
      <Aurora
        colorStops={colors}
        blend={0.5}
        amplitude={1.1}
        opacity={effectiveOpacity}
        speed={speed}
        className="w-full h-full"
      />
    </div>
  );
}

export default StrandsBackground;

