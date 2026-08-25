"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PhoneCall, ExternalLink, Navigation, ShieldCheck, MapPin, LocateFixed } from "lucide-react";

interface HospitalItem {
  id: string;
  name: string;
  specialty: string[];
  city: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  distanceKm: number;
  googleMapsUrl: string;
}

const CITY_PRESETS = [
  { name: "Guntur (AP)", lat: 16.3067, lng: 80.4365, label: "GUNTUR / AMARAVATI REGION" },
  { name: "Hyderabad (TS)", lat: 17.4326, lng: 78.4071, label: "HYDERABAD METRO" },
  { name: "Vijayawada (AP)", lat: 16.5062, lng: 80.6480, label: "VIJAYAWADA METRO" },
  { name: "Bengaluru (KA)", lat: 12.9716, lng: 77.5946, label: "BENGALURU METRO" },
  { name: "Mumbai (MH)", lat: 19.0760, lng: 72.8777, label: "MUMBAI METRO" },
];

export function CareNetworkSection() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCity, setActiveCity] = useState(CITY_PRESETS[0]); // Default to Guntur (AP)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("GUNTUR / AMARAVATI REGION");
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);

  // Fetch hospitals based on active coordinates
  const loadHospitalsForLocation = async (lat: number, lng: number, locLabel: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hospitals?lat=${lat}&lng=${lng}&specialty=cardiology`);
      if (res.ok) {
        const data = await res.json();
        if (data.hospitals && data.hospitals.length > 0) {
          setHospitals(data.hospitals.slice(0, 4));
          setSelectedHospital(data.hospitals[0]);
        }
      }
      setLocationName(locLabel);
      setUserCoords({ lat, lng });
    } catch (e) {
      console.warn("Error fetching care network hospitals:", e);
    } finally {
      setLoading(false);
    }
  };

  // Attempt browser GPS auto-detect on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setIsDetectingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          // Check if coordinates correspond roughly to Guntur (approx 16.2 to 16.5 N, 80.3 to 80.6 E)
          let label = `DETECTED GPS (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`;
          if (latitude >= 16.1 && latitude <= 16.6 && longitude >= 80.2 && longitude <= 80.7) {
            label = "PATIENT GPS: DETECTED (GUNTUR, AP)";
          }
          loadHospitalsForLocation(latitude, longitude, label);
          setIsDetectingGps(false);
        },
        () => {
          // Fallback to Guntur default preset if user denies GPS permission
          loadHospitalsForLocation(CITY_PRESETS[0].lat, CITY_PRESETS[0].lng, CITY_PRESETS[0].label);
          setIsDetectingGps(false);
        },
        { timeout: 5000 }
      );
    } else {
      loadHospitalsForLocation(CITY_PRESETS[0].lat, CITY_PRESETS[0].lng, CITY_PRESETS[0].label);
    }
  }, []);

  const handleCitySelect = (preset: typeof CITY_PRESETS[0]) => {
    setActiveCity(preset);
    loadHospitalsForLocation(preset.lat, preset.lng, preset.label);
  };

  const handleManualGpsClick = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setIsDetectingGps(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          loadHospitalsForLocation(latitude, longitude, `LIVE GPS: ${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E`);
          setIsDetectingGps(false);
        },
        () => {
          alert("Location access denied or unavailable. Showing Guntur hospitals.");
          setIsDetectingGps(false);
        }
      );
    }
  };

  return (
    <section id="care-network" className="w-full py-28 sm:py-36 bg-[#FAF9F6] text-slate-900 border-t border-slate-200/80 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 lg:px-8 space-y-12">
        
        {/* SECTION HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200/80 pb-10 gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-700 bg-cyan-50 border border-cyan-200 px-3.5 py-1 rounded-full inline-block">
              CARE NETWORK / 05
            </span>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950 leading-tight">
              Spatial Care Routing & Proximity Intelligence
            </h2>
          </div>
          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-md">
            MedVoice translates clinical triage into live geographical dispatch, connecting high-risk cases directly to nearest PCI-capable ER facilities.
          </p>
        </div>

        {/* CITY & GPS LOCATION SWITCHER */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="text-slate-500 font-bold uppercase mr-2">Select Location:</span>
          {CITY_PRESETS.map((preset) => {
            const isActive = activeCity.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => handleCitySelect(preset)}
                className={`px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-950 text-white border-slate-900 font-bold shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {preset.name}
              </button>
            );
          })}
          <button
            onClick={handleManualGpsClick}
            disabled={isDetectingGps}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-cyan-300 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-bold transition-all cursor-pointer"
          >
            <LocateFixed className={`w-3.5 h-3.5 text-cyan-700 ${isDetectingGps ? "animate-spin" : ""}`} />
            <span>{isDetectingGps ? "Detecting GPS..." : "Auto-Detect My GPS"}</span>
          </button>
        </div>

        {/* MINIMALIST SPATIAL CARE MAP COMPOSITION */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm space-y-10 relative overflow-hidden">
          
          {/* MAP CANVAS GRID & ROUTING GRAPH */}
          <div className="relative min-h-[320px] sm:min-h-[380px] bg-slate-50/70 border border-slate-200/90 rounded-2xl p-6 sm:p-8 flex flex-col justify-between overflow-hidden">
            
            {/* BACKGROUND GEOGRAPHIC GRID LINES */}
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px]" />

            {/* TOP MAP STATUS BAR */}
            <div className="relative z-10 flex items-center justify-between font-mono text-xs border-b border-slate-200/80 pb-4">
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-bold text-slate-900">PATIENT LOCATION: {locationName}</span>
              </div>
              <span className="text-slate-400 font-semibold hidden sm:inline">LIVE ROUTE GRAPH · /api/hospitals</span>
            </div>

            {/* SPATIAL NODES & CONNECTING SVG ROUTE */}
            <div className="relative z-10 my-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              
              {/* PATIENT ORIGIN NODE */}
              <div className="md:col-span-4 bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 space-y-3 shadow-xl">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-400 border-b border-slate-800 pb-2">
                  <span>PATIENT ORIGIN</span>
                  <span className="text-emerald-400">EMERGENCY (LEVEL 1)</span>
                </div>
                <p className="text-sm font-bold text-slate-100">Acute Coronary Syndrome</p>
                <p className="text-xs text-slate-400 font-mono">
                  Lat: {userCoords ? userCoords.lat.toFixed(4) : "16.3067"}° N · Lng: {userCoords ? userCoords.lng.toFixed(4) : "80.4365"}° E
                </p>
              </div>

              {/* ROUTE ARROW DISPATCH */}
              <div className="md:col-span-2 flex flex-col items-center justify-center space-y-2 text-center">
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  OPTIMAL ROUTE
                </span>
                <div className="w-full h-0.5 bg-gradient-to-r from-slate-950 via-cyan-500 to-emerald-500 rounded-full" />
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  {selectedHospital ? `${selectedHospital.distanceKm} km` : "Searching..."}
                </span>
              </div>

              {/* HOSPITAL NODES GRID */}
              <div className="md:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loading ? (
                  <div className="col-span-2 py-8 text-center text-xs font-mono text-slate-400 animate-pulse">
                    Querying live hospital network for nearest emergency ERs...
                  </div>
                ) : (
                  hospitals.map((hosp) => {
                    const isSelected = selectedHospital?.id === hosp.id;
                    return (
                      <button
                        key={hosp.id}
                        onClick={() => setSelectedHospital(hosp)}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-slate-950 text-white border-slate-900 shadow-md ring-2 ring-cyan-500/40"
                            : "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold line-clamp-1 ${isSelected ? "text-cyan-400" : "text-slate-900"}`}>
                            {hosp.name.split("(")[0]}
                          </span>
                          {(hosp as any).hasDistanceContext && hosp.distanceKm !== null ? (
                            <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              isSelected ? "bg-emerald-500 text-slate-950" : "bg-slate-100 text-slate-600"
                            }`}>
                              {hosp.distanceKm} km
                            </span>
                          ) : (
                            <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0 ${
                              isSelected ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-500"
                            }`}>
                              {hosp.city}
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] line-clamp-1 font-mono ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                          {hosp.city} · 24/7 ER
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* SELECTED HOSPITAL DETAIL PAYOFF */}
            {selectedHospital && (
              <div className="relative z-10 pt-4 border-t border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-950">{selectedHospital.name}</h3>
                    {(selectedHospital as any).matchLabel && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-950 font-mono font-bold text-[11px]">
                        {(selectedHospital as any).matchLabel}
                      </span>
                    )}
                    {(selectedHospital as any).etaMinutes && (
                      <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 font-mono font-bold text-[11px]">
                        ~{(selectedHospital as any).etaMinutes} min ETA ({selectedHospital.distanceKm} km)
                      </span>
                    )}
                    {(selectedHospital as any).rating && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold text-[11px]">
                        ★ {(selectedHospital as any).rating}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{selectedHospital.address}</p>

                  {/* EXPLAINABLE MATCH REASONS */}
                  {(selectedHospital as any).matchReasons && (selectedHospital as any).matchReasons.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(selectedHospital as any).matchReasons.map((reason: string, rIdx: number) => (
                        <span key={rIdx} className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          ✓ {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0">
                  <a
                    href={`tel:${selectedHospital.emergencyPhone || selectedHospital.phone}`}
                    className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call ER Hotline</span>
                  </a>
                  <a
                    href={selectedHospital.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </section>
  );
}

