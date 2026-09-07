"use client";

import React, { useEffect, useRef } from "react";

interface CursorGridProps {
  cellSize?: number;
  radius?: number;
  falloff?: "smooth" | "linear";
  holdTime?: number;
  fadeDuration?: number;
  lineWidth?: number;
  maxOpacity?: number;
  fillOpacity?: number;
  gridOpacity?: number;
  cellRadius?: number;
  clickPulse?: boolean;
  pulseSpeed?: number;
  className?: string;
}

export function CursorGrid({
  cellSize = 56,
  radius = 110,
  falloff = "smooth",
  holdTime = 250,
  fadeDuration = 700,
  lineWidth = 0.8,
  maxOpacity = 0.14,
  fillOpacity = 0,
  gridOpacity = 0.04,
  cellRadius = 0,
  clickPulse = true,
  pulseSpeed = 600,
  className = "",
}: CursorGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean; lastMove: number }>({
    x: -9999,
    y: -9999,
    active: false,
    lastMove: 0,
  });
  const pulsesRef = useRef<Array<{ x: number; y: number; startTime: number }>>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = container.clientWidth);
    let height = (canvas.height = container.clientHeight);

    const handleResize = () => {
      if (!container || !canvas) return;
      width = canvas.width = container.clientWidth;
      height = canvas.height = container.clientHeight;
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
        lastMove: performance.now(),
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleClick = (e: MouseEvent) => {
      if (!clickPulse) return;
      const rect = container.getBoundingClientRect();
      pulsesRef.current.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        startTime: performance.now(),
      });
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("click", handleClick);

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      // Base faint grid
      ctx.strokeStyle = `rgba(14, 116, 144, ${gridOpacity})`;
      ctx.lineWidth = lineWidth;

      // Draw horizontal lines
      for (let y = 0; y <= height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw vertical lines
      for (let x = 0; x <= width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      const mouse = mouseRef.current;
      const timeSinceMove = now - mouse.lastMove;
      let cursorStrength = 0;

      if (mouse.active) {
        cursorStrength = 1;
      } else if (timeSinceMove < holdTime + fadeDuration) {
        cursorStrength = Math.max(0, 1 - (timeSinceMove - holdTime) / fadeDuration);
      }

      // Cursor proximity illumination
      if (cursorStrength > 0.01 && mouse.x >= 0 && mouse.y >= 0) {
        const rad = radius;
        const startCol = Math.max(0, Math.floor((mouse.x - rad) / cellSize));
        const endCol = Math.min(Math.ceil(width / cellSize), Math.ceil((mouse.x + rad) / cellSize));
        const startRow = Math.max(0, Math.floor((mouse.y - rad) / cellSize));
        const endRow = Math.min(Math.ceil(height / cellSize), Math.ceil((mouse.y + rad) / cellSize));

        for (let col = startCol; col <= endCol; col++) {
          const x = col * cellSize;
          const dist = Math.abs(x - mouse.x);
          if (dist < rad) {
            const factor = falloff === "smooth" ? Math.cos((dist / rad) * (Math.PI / 2)) : 1 - dist / rad;
            const alpha = factor * maxOpacity * cursorStrength;
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.lineWidth = lineWidth * 1.5;
            ctx.beginPath();
            ctx.moveTo(x, Math.max(0, mouse.y - rad));
            ctx.lineTo(x, Math.min(height, mouse.y + rad));
            ctx.stroke();
          }
        }

        for (let row = startRow; row <= endRow; row++) {
          const y = row * cellSize;
          const dist = Math.abs(y - mouse.y);
          if (dist < rad) {
            const factor = falloff === "smooth" ? Math.cos((dist / rad) * (Math.PI / 2)) : 1 - dist / rad;
            const alpha = factor * maxOpacity * cursorStrength;
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.lineWidth = lineWidth * 1.5;
            ctx.beginPath();
            ctx.moveTo(Math.max(0, mouse.x - rad), y);
            ctx.lineTo(Math.min(width, mouse.x + rad), y);
            ctx.stroke();
          }
        }
      }

      // Render expanding click pulses
      if (clickPulse && pulsesRef.current.length > 0) {
        pulsesRef.current = pulsesRef.current.filter((p) => {
          const elapsed = now - p.startTime;
          if (elapsed > pulseSpeed) return false;
          const progress = elapsed / pulseSpeed;
          const currentRadius = progress * (radius * 1.6);
          const alpha = (1 - progress) * (maxOpacity * 1.2);

          ctx.strokeStyle = `rgba(14, 165, 233, ${alpha})`;
          ctx.lineWidth = lineWidth * 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
          ctx.stroke();
          return true;
        });
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("click", handleClick);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cellSize, radius, falloff, holdTime, fadeDuration, lineWidth, maxOpacity, gridOpacity, clickPulse, pulseSpeed]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
