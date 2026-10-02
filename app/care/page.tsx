"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Locate,
  Navigation,
  Phone,
  Shield,
  Star,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Building2,
  HeartPulse,
  Brain,
  Eye,
  Wind,
  Bone,
  Baby,
  Activity,
  Droplets,
  Pill,
  Volume2,
  Sun,
  Leaf,
  Flame,
  Search,
  RotateCcw,
  SlidersHorizontal,
  Compass,
} from "lucide-react";
import { ALL_REGION_PRESETS, RegionPresetItem, getHospitalFamousFor } from "@/lib/hospitals-india-data";
import { HospitalItem } from "@/app/_components/InteractiveRouteMap";
import { rankHospitals, RankedHospitalResult } from "@/lib/care-network/hospital-ranking";

// Dynamically import InteractiveRouteMap (Leaflet requires window object)
const InteractiveRouteMap = dynamic(
  () => import("@/app/_components/InteractiveRouteMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] sm:h-[580px] lg:h-[640px] rounded-2xl bg-[#0D121A] flex flex-col items-center justify-center border border-white/[0.08] shadow-2xl">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3" />
        <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Loading clinical route map...</span>
      </div>
    ),
  }
);

export type LocationStatus =
  | "LOCATION_UNKNOWN"
  | "LOCATION_PERMISSION_REQUESTED"
  | "LOCATION_PERMISSION_DENIED"
  | "LOCATION_RESOLVED"
  | "LOCATION_MANUALLY_SELECTED";

export type LocationSource = "gps" | "preset" | "search" | "manual_pin";

export interface CareOrigin {
  lat: number;
  lng: number;
  label: string;
  source: LocationSource;
  resolvedAt?: number;
}

const STORAGE_KEY = "medvoice_care_origin";

interface SpecialtyCategory {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CARE_CATEGORIES: SpecialtyCategory[] = [
  {
    id: "all",
    label: "All Care & 24/7 ERs",
    shortLabel: "All Care",
    description: "General emergency and multi-specialty care centers",
    icon: Building2,
  },
  {
    id: "cardiology",
    label: "Heart & Cardiology",
    shortLabel: "Cardiac",
    description: "Interventional cardiology, chest pain & cardiac CCU",
    icon: HeartPulse,
  },
  {
    id: "stroke",
    label: "Brain & Stroke",
    shortLabel: "Stroke / Neuro",
    description: "Neurology, acute stroke triage & neuro ICU",
    icon: Brain,
  },
  {
    id: "ophthalmology",
    label: "Eye & Vision",
    shortLabel: "Eye Care",
    description: "Ophthalmology, ocular trauma & cornea surgery",
    icon: Eye,
  },
  {
    id: "pulmonology",
    label: "Lungs & Respiratory",
    shortLabel: "Pulmonology",
    description: "Respiratory medicine, severe asthma & chest care",
    icon: Wind,
  },
  {
    id: "orthopedics",
    label: "Bones, Joints & Trauma",
    shortLabel: "Orthopedics",
    description: "Joint replacement, fracture trauma & spine care",
    icon: Bone,
  },
  {
    id: "pediatrics",
    label: "Child & Pediatrics",
    shortLabel: "Pediatrics",
    description: "Pediatric intensive care, NICU, PICU & child health",
    icon: Baby,
  },
  {
    id: "oncology",
    label: "Cancer & Oncology",
    shortLabel: "Oncology",
    description: "Comprehensive oncology, surgical tumor care & chemo",
    icon: Activity,
  },
  {
    id: "nephrology",
    label: "Kidney & Dialysis",
    shortLabel: "Nephrology",
    description: "Renal care, hemodialysis unit & kidney specialists",
    icon: Droplets,
  },
  {
    id: "maternity",
    label: "Maternity & Women",
    shortLabel: "Maternity",
    description: "Obstetrics, high-risk labor & women's health",
    icon: Sparkles,
  },
  {
    id: "gastroenterology",
    label: "Gastro & Liver",
    shortLabel: "Gastroenterology",
    description: "Digestive health, hepatology & endoscopy care",
    icon: Pill,
  },
  {
    id: "ent",
    label: "ENT & Head/Neck",
    shortLabel: "ENT",
    description: "Ear, nose, throat & head-neck specialty care",
    icon: Volume2,
  },
  {
    id: "dermatology",
    label: "Skin & Burns",
    shortLabel: "Dermatology",
    description: "Clinical dermatology, skin disorders & burn care",
    icon: Sun,
  },
  {
    id: "ayurveda",
    label: "Ayurveda & Traditional",
    shortLabel: "Ayurveda",
    description: "Panchakarma, AYUSH wellness & holistic recovery",
    icon: Leaf,
  },
  {
    id: "emergency",
    label: "24/7 Critical Emergency",
    shortLabel: "Emergency",
    description: "Immediate life resuscitation & multi-trauma triage",
    icon: Flame,
  },
];

export default function CarePage() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Authoritative location state machine
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("LOCATION_UNKNOWN");
  const [userLocation, setUserLocation] = useState<CareOrigin | null>(null);
  const [searchRegion, setSearchRegion] = useState<CareOrigin | null>(null);

  // Non-authoritative previously saved location suggestion
  const [savedSuggestion, setSavedSuggestion] = useState<CareOrigin | null>(null);
  const [isChoosingCity, setIsChoosingCity] = useState<boolean>(false);

  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [isManualPicking, setIsManualPicking] = useState<boolean>(false);

  // Live road stats calculated from map routing
  const [liveRoadStats, setLiveRoadStats] = useState<{ roadDistanceKm: number; etaMinutes: number } | null>(null);

  // Active Care Need Category
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 1. Session Storage on Mount: Non-authoritative suggestion ONLY
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const candidate = parsed?.userLocation || parsed;

        const allowedSources: LocationSource[] = ["gps", "preset", "search", "manual_pin"];
        const isValidSource = allowedSources.includes(candidate?.source);
        const hasValidCoords =
          candidate &&
          Number.isFinite(candidate.lat) &&
          Number.isFinite(candidate.lng) &&
          candidate.lat >= -90 &&
          candidate.lat <= 90 &&
          candidate.lng >= -180 &&
          candidate.lng <= 180;
        const isValidLabel = typeof candidate?.label === "string" && candidate.label.trim().length > 0;

        const isLegacyDefault =
          !candidate?.resolvedAt &&
          Math.abs(candidate?.lat - 16.5131) < 0.001 &&
          Math.abs(candidate?.lng - 80.5165) < 0.001;

        if (isValidSource && hasValidCoords && isValidLabel && !isLegacyDefault) {
          const restoredOrigin: CareOrigin = {
            lat: candidate.lat,
            lng: candidate.lng,
            label: candidate.label,
            source: candidate.source,
            resolvedAt: candidate.resolvedAt || Date.now(),
          };
          setSavedSuggestion(restoredOrigin);
          return;
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn("Could not read saved search origin suggestion:", e);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Explicit user confirmation to apply saved location suggestion
  const handleApplySuggestion = () => {
    if (!savedSuggestion) return;
    setUserLocation(savedSuggestion);
    setSearchRegion(savedSuggestion);
    const nextStatus: LocationStatus =
      savedSuggestion.source === "gps" ? "LOCATION_RESOLVED" : "LOCATION_MANUALLY_SELECTED";
    setLocationStatus(nextStatus);
    loadFacilities(savedSuggestion, savedSuggestion);
  };

  const handleDismissSuggestion = () => {
    setSavedSuggestion(null);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch { }
    }
  };

  const handleResetLocation = () => {
    setUserLocation(null);
    setSearchRegion(null);
    setLocationStatus("LOCATION_UNKNOWN");
    setHospitals([]);
    setSelectedHospital(null);
    setLiveRoadStats(null);
    setIsChoosingCity(false);
  };

  // Fetch facilities based on target region and user departure location
  const loadFacilities = async (targetRegion: CareOrigin, departureOrigin: CareOrigin) => {
    if (
      !targetRegion ||
      !Number.isFinite(targetRegion.lat) ||
      !Number.isFinite(targetRegion.lng) ||
      !departureOrigin ||
      !Number.isFinite(departureOrigin.lat) ||
      !Number.isFinite(departureOrigin.lng)
    ) {
      console.warn("[CarePage] Aborted loadFacilities: Missing verified departure coordinates.");
      return;
    }

    setLoading(true);
    try {
      // Query nearby candidate facilities around the coordinates
      const res = await fetch(
        `/api/hospitals?lat=${targetRegion.lat}&lng=${targetRegion.lng}&patientLat=${departureOrigin.lat}&patientLng=${departureOrigin.lng}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.hospitals && data.hospitals.length > 0) {
          setHospitals(data.hospitals);
        } else {
          setHospitals([]);
        }
      }
      setSearchRegion(targetRegion);
      setUserLocation(departureOrigin);

      // Persist verified location
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              userLocation: departureOrigin,
              searchRegion: targetRegion,
              resolvedAt: Date.now(),
            })
          );
        } catch { }
      }
    } catch (e) {
      console.warn("Failed to load facilities:", e);
    } finally {
      setLoading(false);
    }
  };

  // Detect Live GPS Location
  const handleDetectLiveLocation = () => {
    if (typeof window === "undefined") return;

    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser. Please select your city or region.");
      return;
    }

    setLocationStatus("LOCATION_PERMISSION_REQUESTED");
    setIsDetectingGps(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        const resolved: CareOrigin = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Live Location (GPS)",
          source: "gps",
          resolvedAt: Date.now(),
        };
        setUserLocation(resolved);
        setSearchRegion(resolved);
        setLocationStatus("LOCATION_RESOLVED");
        loadFacilities(resolved, resolved);
      },
      (err) => {
        setIsDetectingGps(false);
        console.warn("Geolocation permission denied or timed out:", err.message);
        setLocationStatus("LOCATION_PERMISSION_DENIED");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Select Preset City
  const handleSelectCityPreset = (preset: RegionPresetItem) => {
    const origin: CareOrigin = {
      lat: preset.lat,
      lng: preset.lng,
      label: preset.name,
      source: "preset",
      resolvedAt: Date.now(),
    };
    setUserLocation(origin);
    setSearchRegion(origin);
    setLocationStatus("LOCATION_MANUALLY_SELECTED");
    setIsChoosingCity(false);
    loadFacilities(origin, origin);
  };

  // Confirm Manual Pin on Map
  const handleConfirmManualPin = (lat: number, lng: number) => {
    const origin: CareOrigin = {
      lat,
      lng,
      label: `Pinned Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
      source: "manual_pin",
      resolvedAt: Date.now(),
    };
    setUserLocation(origin);
    setSearchRegion(origin);
    setLocationStatus("LOCATION_MANUALLY_SELECTED");
    setIsManualPicking(false);
    loadFacilities(origin, origin);
  };

  // =========================================================================
  // CORE REACTIVE RANKING ENGINE INTEGRATION
  // selectedCareType + patientLocation + hospitalCandidates
  //          ↓
  //    rankedHospitals
  //          ↓
  //  recommendedHospital
  //          ↓
  //        route
  // =========================================================================
  const rankedResults = useMemo<RankedHospitalResult[]>(() => {
    if (!userLocation || hospitals.length === 0) return [];

    let pool = hospitals;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      pool = pool.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          (h.specialty || []).some((s) => s.toLowerCase().includes(q))
      );
    }

    return rankHospitals({
      hospitals: pool,
      patientLocation: { lat: userLocation.lat, lng: userLocation.lng },
      careType: specialtyFilter,
    });
  }, [hospitals, userLocation, specialtyFilter, searchQuery]);

  const topRecommendation = rankedResults[0] || null;

  // When ranking produces a new recommendation (e.g. user selected Heart & Cardiology or Stroke),
  // automatically update the active destination!
  useEffect(() => {
    if (topRecommendation) {
      setSelectedHospital(topRecommendation.hospital);
      setLiveRoadStats({
        roadDistanceKm: topRecommendation.hospital.distanceKm,
        etaMinutes:
          topRecommendation.hospital.etaMinutes ||
          Math.max(3, Math.round(topRecommendation.hospital.distanceKm * 1.5)),
      });
    }
  }, [topRecommendation?.hospital.id]);

  const activeCategory = CARE_CATEGORIES.find((c) => c.id === specialtyFilter) || CARE_CATEGORIES[0];

  // =========================================================================
  // VIEW 1: LOCATION UNKNOWN (Serene Dark Luxury Landing Screen)
  // Zero map rendering, zero hospital requests, zero destination
  // =========================================================================
  if (!userLocation && !isManualPicking) {
    return (
      <div className="min-h-screen bg-[#070A0F] text-[#F4F7FA] font-sans flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-xl">
            {/* Header Identity */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold tracking-wider uppercase mb-4">
                <Compass className="w-3.5 h-3.5" />
                <span>MedVoice Care Network</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Find the right emergency care near you
              </h1>
              <p className="mt-3 text-sm text-[#8B98A8] max-w-md mx-auto leading-relaxed">
                Connect your departure location to discover accredited 24/7 facilities, rank specialist capability, and compute live road routing.
              </p>
            </div>

            {/* Saved Location Suggestion (Non-authoritative) */}
            {savedSuggestion && (
              <div className="mb-6 p-4 rounded-2xl bg-[#0D121A] border border-cyan-500/30 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                        Last Used Location
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {savedSuggestion.label}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleDismissSuggestion}
                      className="px-2.5 py-1.5 rounded-xl border border-white/10 text-xs text-[#8B98A8] hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={handleApplySuggestion}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                      Use this location
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Action Card */}
            <div className="rounded-3xl bg-[#0D121A] border border-white/[0.08] shadow-2xl p-6 sm:p-8 backdrop-blur-xl">
              <div className="space-y-4">
                <button
                  onClick={handleDetectLiveLocation}
                  disabled={isDetectingGps}
                  className="w-full py-4 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-60"
                >
                  {isDetectingGps ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                      <span>Detecting live location...</span>
                    </>
                  ) : (
                    <>
                      <Locate className="w-4 h-4 text-slate-950" />
                      <span>Detect My Location</span>
                    </>
                  )}
                </button>

                <div className="relative flex items-center justify-center my-4">
                  <div className="border-t border-white/[0.08] w-full" />
                  <span className="bg-[#0D121A] px-3 text-xs uppercase tracking-wider text-[#8B98A8] font-semibold">
                    Or select manually
                  </span>
                </div>

                <button
                  onClick={() => setIsChoosingCity(!isChoosingCity)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-[#111923] hover:bg-white/[0.06] border border-white/10 text-white font-semibold text-sm flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Choose a city or accredited region</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isChoosingCity ? "rotate-90" : ""}`} />
                </button>

                <button
                  onClick={() => setIsManualPicking(true)}
                  className="w-full py-3 px-5 rounded-2xl bg-transparent hover:bg-white/[0.04] border border-white/[0.06] text-xs text-[#8B98A8] hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Pin departure point manually on map</span>
                </button>
              </div>

              {/* City Presets Grid */}
              {isChoosingCity && (
                <div className="mt-6 pt-6 border-t border-white/[0.08] animate-in fade-in duration-200">
                  <div className="text-xs font-semibold text-[#8B98A8] uppercase tracking-wider mb-3">
                    Major Healthcare Hubs
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ALL_REGION_PRESETS.slice(0, 9).map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleSelectCityPreset(preset)}
                        className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-cyan-500/10 border border-white/[0.06] hover:border-cyan-500/30 text-left transition-all cursor-pointer group"
                      >
                        <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{preset.label || preset.zoneLabel}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {locationStatus === "LOCATION_PERMISSION_DENIED" && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Location access was denied. Please select a city preset above or pin your location manually.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE CLINICAL COCKPIT (HERO MAP + REACTIVE DECISION PANEL)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#070A0F] text-[#F4F7FA] font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Cockpit Header */}
      <header className="sticky top-0 z-30 bg-[#070A0F]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Location Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Compass className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
                MEDVOICE <span className="text-cyan-400">CARE</span>
              </span>
            </div>

            <div className="h-4 w-px bg-white/10 hidden sm:block" />

            {/* Active Departure Pill */}
            {userLocation && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D121A] border border-white/10 text-xs">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-[#8B98A8]">From:</span>
                <span className="font-bold text-white truncate max-w-[140px] sm:max-w-[220px]">
                  {userLocation.label}
                </span>
                <button
                  onClick={handleResetLocation}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold ml-1 cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Quick Search & Count */}
          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search hospital or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0D121A] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400 transition-colors"
              />
            </div>

            {loading && (
              <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            )}
          </div>
        </div>

        {/* CARE NEED HORIZONTAL CATEGORY RAIL */}
        <div className="max-w-7xl mx-auto mt-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 mr-1">
              Care Need:
            </span>
            {CARE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = specialtyFilter === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSpecialtyFilter(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/50 shadow-[0_0_14px_rgba(34,211,238,0.25)]"
                      : "bg-[#0D121A] text-slate-400 hover:text-slate-200 border border-white/[0.06] hover:bg-[#111923]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-cyan-400" : "text-slate-400"}`} />
                  <span>{cat.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Cockpit Split Grid */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: HERO MAP (Dominant Centerpiece) */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{activeCategory.label}</span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-400">{rankedResults.length} eligible facilities discovered</span>
              </div>
              <div className="text-[11px] text-cyan-400 font-semibold hidden sm:block">
                {activeCategory.description}
              </div>
            </div>

            <InteractiveRouteMap
              patientCoords={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null}
              patientLocationName={userLocation?.label}
              selectedHospital={selectedHospital}
              allHospitals={rankedResults.map((r) => r.hospital)}
              isManualPicking={isManualPicking}
              onSelectHospital={(hosp) => {
                setSelectedHospital(hosp);
                setLiveRoadStats({
                  roadDistanceKm: hosp.distanceKm,
                  etaMinutes: hosp.etaMinutes || Math.max(3, Math.round(hosp.distanceKm * 1.5)),
                });
              }}
              onConfirmManualLocation={handleConfirmManualPin}
              onCancelManualPicking={() => setIsManualPicking(false)}
              onRouteCalculated={(info) => setLiveRoadStats(info)}
              onRequestLocation={handleDetectLiveLocation}
            />
          </div>

          {/* RIGHT: DECISION & DESTINATION COCKPIT */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
            {/* 1. RECOMMENDED DESTINATION CARD */}
            {topRecommendation ? (
              <div className="rounded-3xl bg-[#0D121A] border border-cyan-500/30 p-5 sm:p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl relative overflow-hidden">
                {/* Glow accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative">
                  {/* Top Label & Score */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Recommended Destination</span>
                    </div>

                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-bold text-white">
                      <span className="text-cyan-400 font-extrabold">{Math.round(topRecommendation.score)}</span>
                      <span className="text-slate-500">/100</span>
                    </div>
                  </div>

                  {/* Hospital Name & Specialty */}
                  <h2 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                    {topRecommendation.hospital.name}
                  </h2>
                  <div className="text-xs text-cyan-400 font-semibold mt-1">
                    {topRecommendation.hospital.famousFor || getHospitalFamousFor(topRecommendation.hospital)}
                  </div>

                  {/* Proximity & ETA Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                    <span className="px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 font-bold text-white flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                      {liveRoadStats ? `${liveRoadStats.roadDistanceKm} km` : `${topRecommendation.hospital.distanceKm} km`}
                      <span className="text-slate-500">·</span>
                      ~{liveRoadStats ? `${liveRoadStats.etaMinutes} min` : `${topRecommendation.hospital.etaMinutes} min`}
                    </span>

                    {topRecommendation.hospital.isEmergency24x7 && (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 font-bold text-rose-300 text-[11px] flex items-center gap-1">
                        <Flame className="w-3 h-3 text-rose-400" />
                        24/7 ER
                      </span>
                    )}

                    {typeof topRecommendation.factors.rating === "number" && topRecommendation.factors.rating > 0 && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 font-bold text-amber-300 text-[11px] flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {topRecommendation.factors.rating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/[0.08]">
                    <a
                      href={topRecommendation.hospital.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(topRecommendation.hospital.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Directions</span>
                    </a>

                    <a
                      href={`tel:${topRecommendation.hospital.emergencyPhone || topRecommendation.hospital.phone || "108"}`}
                      className="py-2.5 px-3 rounded-xl bg-[#111923] hover:bg-white/[0.08] border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Emergency Call</span>
                    </a>
                  </div>

                  {/* TRANSPARENT MATCH BREAKDOWN */}
                  <div className="mt-4 pt-4 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between text-xs font-bold text-white mb-2.5">
                      <span>Why This Facility</span>
                      <span className="text-[10px] text-slate-500 font-normal">Deterministic Engine</span>
                    </div>

                    {/* Progress Breakdown Bars */}
                    <div className="space-y-2 text-[11px]">
                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Specialty Capability</span>
                          <span className="font-bold text-white">
                            {Math.round((topRecommendation.breakdown.specialtyMatch / 40) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                            style={{ width: `${(topRecommendation.breakdown.specialtyMatch / 40) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Proximity & Speed</span>
                          <span className="font-bold text-white">
                            {Math.round((topRecommendation.breakdown.distance / 25) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                            style={{ width: `${(topRecommendation.breakdown.distance / 25) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Emergency Readiness</span>
                          <span className="font-bold text-white">
                            {Math.round((topRecommendation.breakdown.emergency / 10) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${(topRecommendation.breakdown.emergency / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Verified Evidence Checkmarks */}
                    <div className="mt-3.5 space-y-1.5">
                      {topRecommendation.reasons.map((reason, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-[#0D121A] border border-white/[0.08] p-6 text-center text-xs text-slate-400">
                No facilities matching active care need. Try selecting &quot;All Care&quot; or expanding search radius.
              </div>
            )}

            {/* 2. OTHER RANKED ALTERNATIVES */}
            {rankedResults.length > 1 && (
              <div className="rounded-3xl bg-[#0D121A] border border-white/[0.08] p-5">
                <div className="flex items-center justify-between mb-3 text-xs font-bold text-white">
                  <span>Other Ranked Facilities</span>
                  <span className="text-[10px] text-slate-500">{rankedResults.length - 1} more</span>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {rankedResults.slice(1, 8).map((res) => {
                    const isCurrent = selectedHospital?.id === res.hospital.id;

                    return (
                      <button
                        key={res.hospital.id}
                        onClick={() => {
                          setSelectedHospital(res.hospital);
                          setLiveRoadStats({
                            roadDistanceKm: res.hospital.distanceKm,
                            etaMinutes: res.hospital.etaMinutes || Math.max(3, Math.round(res.hospital.distanceKm * 1.5)),
                          });
                        }}
                        className={`w-full p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                          isCurrent
                            ? "bg-cyan-500/10 border-cyan-500/30 text-white shadow-md"
                            : "bg-[#111923]/60 hover:bg-[#111923] border-white/[0.04] text-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {res.hospital.name}
                            </div>
                            <div className="text-[10px] text-cyan-400 truncate mt-0.5">
                              {res.hospital.famousFor || getHospitalFamousFor(res.hospital)}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-white">
                              {res.hospital.distanceKm} km
                            </div>
                            <div className="text-[10px] text-slate-500">
                              ~{res.hospital.etaMinutes} min
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                          {res.hospital.isEmergency24x7 && (
                            <span className="text-rose-400 font-semibold">24/7 ER</span>
                          )}
                          {typeof res.factors.rating === "number" && res.factors.rating > 0 && (
                            <span className="text-amber-400 font-semibold">{res.factors.rating.toFixed(1)}★</span>
                          )}
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 truncate">{res.reasons[0] || "Accredited Center"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
