"use client";

import React, { useEffect, useState } from "react";
import { Activity, MapPin, PhoneCall, Navigation, ShieldCheck, Zap } from "lucide-react";

interface HospitalItem {
  id: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  isEmergency24x7: boolean;
  distanceKm: number | null;
  etaMinutes: number | null;
  matchReasons: string[];
  googleMapsUrl: string;
  matchLabel: string;
}

export function CinematicCareNetworkMap() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [locationLabel, setLocationLabel] = useState<string>("No Location Selected");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHospitals() {
      try {
        const res = await fetch("/api/hospitals?urgency=emergency");
        if (res.ok) {
          const data = await res.json();
          if (data.hospitals && data.hospitals.length > 0) {
            setHospitals(data.hospitals.slice(0, 3));
          }
          if (data.locationContext?.label) {
            setLocationLabel(data.locationContext.label);
          }
        }
      } catch (err) {
        console.error("Failed to fetch hospital data for cinematic map", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHospitals();
  }, []);

  const fallbackHospitals: HospitalItem[] = [
    {
      id: "kims-guntur",
      name: "KIMS Hospitals & Emergency Care",
      city: "Guntur",
      address: "Sambasiva Pet, Main Road, Guntur, AP",
      latitude: 16.3067,
      longitude: 80.4365,
      isEmergency24x7: true,
      distanceKm: 4.2,
      etaMinutes: 8,
      matchReasons: ["24/7 Level-1 Emergency Department", "Shortest estimated travel time (8 min)", "NABH Accredited"],
      googleMapsUrl: "https://maps.google.com",
      matchLabel: "BEST MATCH",
    },
    {
      id: "apollo-guntur",
      name: "Apollo Speciality Hospital",
      city: "Guntur",
      address: "Kothapet, Guntur, Andhra Pradesh",
      latitude: 16.3015,
      longitude: 80.442,
      isEmergency24x7: true,
      distanceKm: 7.8,
      etaMinutes: 14,
      matchReasons: ["On-call Cardiology Specialists", "JCI Accredited"],
      googleMapsUrl: "https://maps.google.com",
      matchLabel: "RECOMMENDED CARE",
    },
    {
      id: "yashoda-secunderabad",
      name: "Yashoda Super Speciality Hospital",
      city: "Hyderabad",
      address: "Alexander Road, Secunderabad, AP",
      latitude: 17.4399,
      longitude: 78.4983,
      isEmergency24x7: true,
      distanceKm: 18.5,
      etaMinutes: 28,
      matchReasons: ["Advanced Cardiac ICU"],
      googleMapsUrl: "https://maps.google.com",
      matchLabel: "FACILITY DIRECTORY",
    },
  ];

  const activeHospitals = hospitals.length > 0 ? hospitals : fallbackHospitals;
  const bestMatch = activeHospitals[0];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-slate-950 border border-slate-800/80 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
      {/* Ambient Backdrop Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
                AUTOMATED CARE ROUTING ENGINE
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> {locationLabel}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Spatial Hospital Node Map
            </h3>
          </div>
        </div>

        <a
          href="/care"
          className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-2 text-xs font-bold text-slate-200 transition-all cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span>Explore Care Network</span>
        </a>
      </div>

      {/* SPATIAL MAP NODE ROUTING VISUALIZER */}
      <div className="relative w-full h-[260px] sm:h-[300px] my-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <line
            x1="25%"
            y1="50%"
            x2="50%"
            y2="30%"
            stroke="#0EA5E9"
            strokeWidth="2"
            strokeDasharray="6 4"
            className="animate-pulse"
          />
          <line
            x1="25%"
            y1="50%"
            x2="75%"
            y2="35%"
            stroke="#64748B"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <line
            x1="25%"
            y1="50%"
            x2="80%"
            y2="75%"
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        </svg>

        {/* Patient Node */}
        <div className="absolute left-[15%] sm:left-[20%] top-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-rose-400 opacity-75"></span>
            <MapPin className="w-6 h-6" />
          </div>
          <span className="mt-2 text-xs font-mono font-bold text-rose-300 bg-rose-950/80 border border-rose-800/80 px-2.5 py-0.5 rounded-md">
            PATIENT NODE
          </span>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">Acute Cardiac Urgency</span>
        </div>

        {/* Best Match Facility Node */}
        <div className="absolute left-[45%] sm:left-[48%] top-[18%] sm:top-[22%] z-20 flex flex-col items-center group">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 font-extrabold shadow-lg shadow-cyan-500/40 ring-4 ring-cyan-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div className="mt-1 text-center">
            <span className="text-xs font-extrabold text-white bg-slate-900/90 border border-cyan-500/40 px-2.5 py-0.5 rounded-md block truncate max-w-[160px]">
              {bestMatch.name.split(" ")[0]} Hospital
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/80 border border-cyan-800/80 px-2 py-0.5 rounded mt-0.5 inline-block">
              {bestMatch.distanceKm ? `${bestMatch.distanceKm} km` : "4.2 km"} • {bestMatch.etaMinutes ? `${bestMatch.etaMinutes} min ETA` : "8 min ETA"}
            </span>
          </div>
        </div>

        {/* Secondary Facility Nodes */}
        {activeHospitals[1] && (
          <div className="absolute left-[70%] sm:left-[72%] top-[25%] z-10 flex flex-col items-center opacity-70">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              <Activity className="w-4 h-4" />
            </div>
            <span className="mt-1 text-[11px] font-bold text-slate-300 truncate max-w-[130px]">
              {activeHospitals[1].name.split(" ")[0]}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {activeHospitals[1].distanceKm ? `${activeHospitals[1].distanceKm} km` : "7.8 km"}
            </span>
          </div>
        )}
      </div>

      {/* DOMINANT RECOMMENDED HOSPITAL CARD */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 p-5 z-10 relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-800/80 px-2.5 py-0.5 rounded-md">
              {bestMatch.matchLabel}
            </span>
            {bestMatch.isEmergency24x7 && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> 24/7 ER Department
              </span>
            )}
          </div>
          <h4 className="text-lg font-extrabold text-white tracking-tight">
            {bestMatch.name}
          </h4>
          <p className="text-xs text-slate-400 font-mono">
            {bestMatch.address}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={bestMatch.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 py-2.5 text-xs font-extrabold transition-all shadow-lg cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>Dispatch Directions</span>
          </a>
          <a
            href="/care"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 text-xs font-bold transition-all cursor-pointer border border-slate-700"
          >
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            <span>Nurse Line Transfer</span>
          </a>
        </div>
      </div>
    </div>
  );
}
