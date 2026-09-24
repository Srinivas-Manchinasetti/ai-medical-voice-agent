"use client";

import React from "react";
import { motion } from "motion/react";
import { MapPin, Navigation, Building2, ShieldCheck, HeartPulse } from "lucide-react";

export interface RegionCardItem {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  traumaLevel: string;
  facilitiesCount: number;
  avgEtaMinutes: number;
  specialties: string[];
}

export interface CardNavProps {
  regions: RegionCardItem[];
  selectedId: string;
  onSelect: (region: RegionCardItem) => void;
  className?: string;
}

export function CardNav({
  regions,
  selectedId,
  onSelect,
  className = "",
}: CardNavProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {regions.map((region) => {
          const isSelected = region.id === selectedId;

          return (
            <motion.button
              key={region.id}
              onClick={() => onSelect(region)}
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-white border-cyan-500 shadow-md ring-2 ring-cyan-500/20"
                  : "bg-white/90 border-slate-200/90 text-slate-800 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {region.traumaLevel}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                  )}
                </div>

                <h4 className={`text-sm font-black tracking-tight truncate ${isSelected ? "text-slate-950" : "text-slate-900"}`}>
                  {region.name}
                </h4>
                <p className="text-[10px] font-mono truncate text-slate-500">
                  {region.state}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-600 font-medium">
                  {region.facilitiesCount} Hubs
                </span>
                <span className="text-cyan-700 font-bold">
                  ~{region.avgEtaMinutes}m ETA
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default CardNav;
