"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  LocateFixed,
  Compass,
  Search,
  PhoneCall,
  ExternalLink,
  ShieldCheck,
  Building2,
  Clock,
  Car,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Navigation,
  Activity,
  Sparkles,
} from "lucide-react";
import { Navbar } from "../_components/Navbar";
import { AppFooter } from "../_components/AppFooter";
import { HospitalItem } from "../_components/InteractiveRouteMap";
import { CardNav, RegionCardItem } from "@/components/navigation/CardNav";
import { MovingBorder } from "@/components/motion/MovingBorder";
import { OptionWheel, OptionWheelItem } from "@/components/navigation/OptionWheel";
import {
  ALL_REGION_PRESETS,
  RegionPresetItem,
  MEDICAL_ISSUE_OPTIONS,
  MedicalIssueOption,
  getHospitalFamousFor,
} from "@/lib/hospitals-india-data";

const SPECIALTY_WHEEL_OPTIONS: OptionWheelItem[] = [
  { id: "all", label: "All Hospitals & 24/7 ERs", category: "Comprehensive 24/7 Care", badge: "24/7 Emergency", badgeStyle: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { id: "ayurveda", label: "Ayurveda & Traditional", category: "Panchakarma & Holistic", badge: "Ayurvedic Care", badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "cardiology", label: "Interventional Cardiology", category: "Cath Lab / Door-to-Balloon", badge: "Door-to-Balloon", badgeStyle: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "neurology", label: "Comprehensive Stroke", category: "Thrombolysis & Neuro ICU", badge: "BE-FAST Unit", badgeStyle: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "cancer", label: "Surgical Oncology", category: "Tumor Board & Infusion", badge: "Oncology Care", badgeStyle: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "orthopedics", label: "Orthopedics & Joint Trauma", category: "Fracture & Joint Replacement", badge: "Bone & Joint", badgeStyle: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "pediatrics", label: "Pediatric Emergency", category: "PICU / NICU Level-3", badge: "Pediatric Resuscitation", badgeStyle: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "maternity", label: "Maternity & Obstetrics", category: "High-Risk Delivery & Labor", badge: "Maternity Unit", badgeStyle: "bg-pink-50 text-pink-700 border-pink-200" },
  { id: "kidney", label: "Kidney Care & Dialysis", category: "Nephrology & Renal ICU", badge: "Dialysis Center", badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "pulmonology", label: "Pulmonology & Respiratory", category: "Chest Care & Asthma ICU", badge: "Respiratory ICU", badgeStyle: "bg-sky-50 text-sky-700 border-sky-200" },
  { id: "eye", label: "Eye Care & Ophthalmology", category: "Retina, Cataract & Lasik", badge: "Eye Institute", badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

// Leaflet map dynamically imported with SSR disabled
const InteractiveRouteMap = dynamic(
  () => import("../_components/InteractiveRouteMap").then((mod) => mod.InteractiveRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] sm:h-[500px] rounded-3xl bg-slate-100/80 border border-slate-200/80 flex flex-col items-center justify-center gap-3 animate-pulse">
        <div className="w-8 h-8 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
        <span className="text-xs font-semibold text-slate-500 font-mono">Loading road network...</span>
      </div>
    ),
  }
);

export type LocationSource = "gps" | "preset" | "search" | "manual_pin";

interface CareOrigin {
  lat: number;
  lng: number;
  label: string;
  source: LocationSource;
}

const DEFAULT_ORIGIN: CareOrigin = {
  lat: ALL_REGION_PRESETS[0].lat,
  lng: ALL_REGION_PRESETS[0].lng,
  label: ALL_REGION_PRESETS[0].label,
  source: "preset",
};

const STORAGE_KEY = "medvoice_care_origin";
const PAGE_SIZE = 10;

export default function CarePage() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Patient departure location state (where the user actually is)
  const [userLocation, setUserLocation] = useState<CareOrigin>(DEFAULT_ORIGIN);
  // Target hospital exploration region state
  const [searchRegion, setSearchRegion] = useState<CareOrigin>(DEFAULT_ORIGIN);
  const [isOriginInitialized, setIsOriginInitialized] = useState<boolean>(false);

  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [isManualPicking, setIsManualPicking] = useState<boolean>(false);

  // Live road stats calculated from map routing
  const [liveRoadStats, setLiveRoadStats] = useState<{ roadDistanceKm: number; etaMinutes: number } | null>(null);

  // User Mode Choice: "all" (Show All Hospitals) vs "issues" (Based on Health Issues)
  const [viewMode, setViewMode] = useState<"all" | "issues">("all");
  const [selectedZone, setSelectedZone] = useState<string>("all");

  // Step 1: Medical issue & specialty states
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [issueSearchText, setIssueSearchText] = useState<string>("");

  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"fastest" | "government" | "rating">("fastest");

  // True Pagination state (10 results per page)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Step 2: Search autocomplete state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mode switcher handler
  const handleSelectViewMode = (mode: "all" | "issues") => {
    setViewMode(mode);
    if (mode === "all") {
      setSpecialtyFilter("all");
      setIssueSearchText("");
    } else {
      if (specialtyFilter === "all") {
        setSpecialtyFilter("cardiology");
        setIssueSearchText("Heart & Cardiology");
      }
    }
    setCurrentPage(1);
  };

  // Issue selection and search handlers
  const handleSelectSpecialty = (id: string, label?: string) => {
    setViewMode("issues");
    setSpecialtyFilter(id);
    setIssueSearchText(id === "all" ? "" : (label || id));
    setCurrentPage(1);
  };

  const handleIssueInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIssueSearchText(val);
    const trimmed = val.trim().toLowerCase();
    setViewMode("issues");
    setSpecialtyFilter(trimmed.length > 0 ? trimmed : "all");
    setCurrentPage(1);
  };

  const handleClearIssue = () => {
    setIssueSearchText("");
    setSpecialtyFilter("all");
    setCurrentPage(1);
  };

  // Unified hospital selection handler: updates selection, resets/syncs road stats, and triggers map route
  const handleSelectHospital = (hosp: HospitalItem) => {
    setSelectedHospital(hosp);
    setLiveRoadStats({
      roadDistanceKm: hosp.distanceKm,
      etaMinutes: hosp.etaMinutes || Math.max(3, Math.round(hosp.distanceKm * 1.5)),
    });
  };

  // 1. Check saved location or auto-detect user's live location on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    let restored = false;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.userLocation && parsed?.searchRegion) {
          setUserLocation(parsed.userLocation);
          setSearchRegion(parsed.searchRegion);
          setIsOriginInitialized(true);
          restored = true;
        } else if (parsed?.lat && parsed?.lng) {
          setUserLocation(parsed);
          setSearchRegion(parsed);
          setIsOriginInitialized(true);
          restored = true;
        }
      }
    } catch (e) {
      console.warn("Could not restore saved search origin:", e);
    }

    // If no previous location was saved, automatically detect live location from user
    if (!restored) {
      handleDetectLiveLocation(true);
    }
  }, []);

  // 2. Fetch facilities based on target region and user departure location
  const loadFacilities = async (
    targetRegion: CareOrigin,
    departureOrigin?: CareOrigin,
    targetSpecialty?: string
  ) => {
    setLoading(true);
    setCurrentPage(1);
    try {
      const departure = departureOrigin || userLocation;
      const activeSpec = targetSpecialty !== undefined ? targetSpecialty : specialtyFilter;
      const specialtyParam = activeSpec && activeSpec !== "all" ? `&specialty=${encodeURIComponent(activeSpec)}` : "";
      const res = await fetch(
        `/api/hospitals?lat=${targetRegion.lat}&lng=${targetRegion.lng}&patientLat=${departure.lat}&patientLng=${departure.lng}${specialtyParam}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.hospitals && data.hospitals.length > 0) {
          const list: HospitalItem[] = data.hospitals;
          setHospitals(list);
          const first = list[0] || null;
          setSelectedHospital(first);
          if (first) {
            setLiveRoadStats({
              roadDistanceKm: first.distanceKm,
              etaMinutes: first.etaMinutes || Math.max(3, Math.round(first.distanceKm * 1.5)),
            });
          }
        } else {
          setHospitals([]);
          setSelectedHospital(null);
          setLiveRoadStats(null);
        }
      }
      setSearchRegion(targetRegion);
      if (departureOrigin) {
        setUserLocation(departureOrigin);
      }

      // Persist active locations so refresh preserves them
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ userLocation: departure, searchRegion: targetRegion })
          );
        } catch { }
      }
    } catch (e) {
      console.warn("Failed to load facilities:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load facilities once initialized or when specialty filter changes
  useEffect(() => {
    if (isOriginInitialized) {
      loadFacilities(searchRegion, userLocation, specialtyFilter);
    }
  }, [isOriginInitialized, specialtyFilter]);

  // Handle GPS detection with high-to-low accuracy automatic fallback
  const handleDetectLiveLocation = (isAutoInit = false) => {
    if (typeof window === "undefined") return;

    if (!("geolocation" in navigator)) {
      if (isAutoInit) setIsOriginInitialized(true);
      return;
    }

    setIsDetectingGps(true);

    const onLocationSuccess = async (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      let label = "Your Live Location";
      try {
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16`,
          { signal: AbortSignal.timeout(2500) }
        );
        if (revRes.ok) {
          const revData = await revRes.json();
          if (revData.address) {
            const area =
              revData.address.suburb ||
              revData.address.neighbourhood ||
              revData.address.residential ||
              revData.address.road ||
              revData.address.city ||
              "Current Location";
            const city = revData.address.city || revData.address.state_district || revData.address.state || "";
            label = `Near ${area}${city ? `, ${city}` : ""}`;
          }
        }
      } catch { }

      const newGpsOrigin: CareOrigin = {
        lat: latitude,
        lng: longitude,
        label,
        source: "gps",
      };

      setUserLocation(newGpsOrigin);
      setSearchRegion(newGpsOrigin);
      setIsOriginInitialized(true);
      setIsDetectingGps(false);
      setSearchQuery("");
      loadFacilities(newGpsOrigin, newGpsOrigin);
    };

    const onLocationError = (err: GeolocationPositionError) => {
      console.warn("[CarePage] High-accuracy GPS failed, trying Wi-Fi/IP location fallback:", err.message);
      // Fallback with low accuracy (ideal for desktop/laptops without GPS chips)
      navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        (fallbackErr) => {
          console.warn("[CarePage] Geolocation unavailable:", fallbackErr.message);
          setIsDetectingGps(false);
          if (isAutoInit) {
            setIsOriginInitialized(true);
          } else {
            alert("Could not detect precise location. You can select a city preset or use 'Map Pin' to set manually.");
          }
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );
    };

    navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
      enableHighAccuracy: true,
      timeout: 4500,
      maximumAge: 180000,
    });
  };

  // Handle preset city selection (Explores hospitals in target city from userLocation)
  const handleSelectPreset = (preset: RegionPresetItem) => {
    setIsManualPicking(false);
    setSearchQuery("");
    setShowDropdown(false);
    const targetRegion: CareOrigin = {
      lat: preset.lat,
      lng: preset.lng,
      label: preset.label,
      source: "preset",
    };
    loadFacilities(targetRegion, userLocation);
  };

  // Handle Search Input Autocomplete
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.trim().length >= 3) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              query + ", India"
            )}&limit=5&countrycodes=in`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
            setShowDropdown(true);
          }
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 350);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setShowDropdown(false);
    setSearchQuery("");
    setIsManualPicking(false);
    const labelParts = result.display_name.split(",");
    const shortLabel = labelParts.slice(0, 2).join(",").trim();
    const targetRegion: CareOrigin = {
      lat,
      lng,
      label: shortLabel,
      source: "search",
    };
    loadFacilities(targetRegion, userLocation);
  };

  const handleConfirmManualLocation = async (lat: number, lng: number) => {
    setIsManualPicking(false);
    let label = `Selected Pin (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`;
    try {
      const revRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (revRes.ok) {
        const revData = await revRes.json();
        if (revData.address) {
          const area =
            revData.address.suburb ||
            revData.address.neighbourhood ||
            revData.address.residential ||
            revData.address.road ||
            revData.address.city ||
            "Selected Location";
          const city = revData.address.city || revData.address.state_district || revData.address.state || "";
          label = `Near ${area}${city ? `, ${city}` : ""}`;
        }
      }
    } catch { }

    const newOrigin: CareOrigin = {
      lat,
      lng,
      label,
      source: "manual_pin",
    };
    loadFacilities(newOrigin, newOrigin);
  };

  const handleSetRegionAsDeparture = () => {
    loadFacilities(searchRegion, searchRegion);
  };

  // Filter & Sort Hospitals: Prioritize specialized facilities first when a medical issue is selected
  const filteredAndSortedHospitals = useMemo(() => {
    let list = [...hospitals];

    // Ownership filter
    if (ownershipFilter === "government") {
      list = list.filter((h) => (h as any).ownership === "government");
    } else if (ownershipFilter === "private") {
      list = list.filter((h) => (h as any).ownership === "private");
    }

    // Sort order: When a medical issue is active, always put specialized facilities first!
    if (sortBy === "fastest") {
      list.sort((a, b) => {
        if (specialtyFilter !== "all") {
          const aEl = a.isEligible ? 1 : 0;
          const bEl = b.isEligible ? 1 : 0;
          if (aEl !== bEl) return bEl - aEl;
        }
        return a.distanceKm - b.distanceKm;
      });
    } else if (sortBy === "government") {
      list.sort((a, b) => {
        if (specialtyFilter !== "all") {
          const aEl = a.isEligible ? 1 : 0;
          const bEl = b.isEligible ? 1 : 0;
          if (aEl !== bEl) return bEl - aEl;
        }
        const aGov = (a as any).ownership === "government" ? 1 : 0;
        const bGov = (b as any).ownership === "government" ? 1 : 0;
        if (aGov !== bGov) return bGov - aGov;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sortBy === "rating") {
      list.sort((a, b) => {
        if (specialtyFilter !== "all") {
          const aEl = a.isEligible ? 1 : 0;
          const bEl = b.isEligible ? 1 : 0;
          if (aEl !== bEl) return bEl - aEl;
        }
        return (b.rating || 0) - (a.rating || 0);
      });
    }

    return list;
  }, [hospitals, ownershipFilter, sortBy, specialtyFilter]);

  // Breakdown of specialized vs other facilities
  const specializedCount = useMemo(() => {
    return filteredAndSortedHospitals.filter((h) => h.isEligible).length;
  }, [filteredAndSortedHospitals]);

  // True Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedHospitals.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredAndSortedHospitals.length);

  // Sliced 10 facilities for the active page
  const pageHospitals = useMemo(() => {
    return filteredAndSortedHospitals.slice(startIndex, endIndex);
  }, [filteredAndSortedHospitals, startIndex, endIndex]);

  // Generate pagination numbers (1, 2, 3... totalPages)
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push(-1); // Ellipsis
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push(-1); // Ellipsis
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const currentGoogleMapsUrl = selectedHospital
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${selectedHospital.latitude},${selectedHospital.longitude}&travelmode=driving`
    : "#";

  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-slate-900 font-sans flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      <Navbar />

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 flex flex-col gap-6">

        {/* COMPACT TOOL HEADER */}
        <header className="flex flex-col gap-2 pt-1 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50/90 border border-cyan-200/90 shadow-2xs mb-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-cyan-800">
                  MEDVOICE — CLINICAL CARE NETWORK
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-950 mt-1">
                Care Network
              </h1>
              <p className="text-sm sm:text-base text-slate-600 font-normal mt-1 max-w-2xl leading-relaxed">
                Find clinically appropriate care and see verified road reachability from your location across 36+ regions in India.
              </p>
            </div>

            {/* Departure Origin & Target Region Status Badges */}
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono font-semibold">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-2xs">
                {isDetectingGps ? (
                  <div className="flex items-center gap-2 text-cyan-700">
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                    <span className="font-bold">Accessing your live GPS...</span>
                  </div>
                ) : userLocation.source === "gps" ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-700 font-bold">📍 Live GPS:</span>
                    <span className="text-slate-800 truncate max-w-[150px] sm:max-w-[220px]">{userLocation.label}</span>
                    <button
                      onClick={() => handleDetectLiveLocation(false)}
                      title="Refresh current GPS location"
                      className="ml-1 text-[10.5px] text-cyan-700 hover:text-cyan-900 underline font-bold cursor-pointer"
                    >
                      Refresh
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="text-cyan-700 font-bold">📍 Your Location:</span>
                    <span className="text-slate-800 truncate max-w-[150px] sm:max-w-[220px]">{userLocation.label}</span>
                    <button
                      onClick={() => handleDetectLiveLocation(false)}
                      className="ml-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-cyan-600 text-white hover:bg-cyan-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      Use My GPS
                    </button>
                  </>
                )}
              </div>

              {searchRegion.label !== userLocation.label && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50/90 border border-cyan-200/90 text-cyan-900 shadow-2xs">
                  <span>Exploring: <strong className="text-cyan-950">{searchRegion.label}</strong></span>
                  <button
                    onClick={handleSetRegionAsDeparture}
                    title="Set this region as your starting point to view local distance (0 km)"
                    className="ml-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-white text-cyan-800 hover:bg-cyan-100 border border-cyan-300 shadow-2xs cursor-pointer transition-colors"
                  >
                    Set starting point here
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* DISCOVERY MODE CHOICE: Show All Hospitals vs Filter by Health Issues */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200/80 text-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-[0.1em] text-cyan-800">
                Hospital Discovery Mode
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-950">
              How would you like to explore hospitals?
            </h3>
            <p className="text-xs text-slate-600">
              Choose whether to explore all 24/7 hospitals or filter by specific medical issues and clinical specialties.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => handleSelectViewMode("all")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${viewMode === "all"
                ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-bold"
                : "text-slate-600 hover:text-slate-950"
                }`}
            >
              <span className="text-sm">🏥</span>
              <span>Show All Hospitals</span>
            </button>

            <button
              onClick={() => handleSelectViewMode("issues")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${viewMode === "issues"
                ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-bold"
                : "text-slate-600 hover:text-slate-950"
                }`}
            >
              <span className="text-sm">🎯</span>
              <span>Based on Health Issues</span>
            </button>
          </div>
        </div>

        {/* 2-STEP CLINICAL CARE & LOCATION FINDER */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-2xs flex flex-col gap-6">

          {/* ============================================================ */}
          {/* STEP 1: Medical Issue / Clinical Specialty */}
          {/* ============================================================ */}
          {viewMode === "all" ? (
            <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white text-base shadow-2xs shrink-0">
                  🏥
                </span>
                <div>
                  <span className="text-xs font-bold text-cyan-950 uppercase tracking-[0.08em] font-mono block">
                    Mode: Showing All Verified Hospitals & Emergency Centers
                  </span>
                  <p className="text-xs text-slate-600 font-normal mt-0.5">
                    Viewing all accredited healthcare facilities in <strong className="text-slate-800">{searchRegion.label}</strong>. Driving distance is calculated from <strong className="text-cyan-800">{userLocation.label}</strong>.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSelectViewMode("issues")}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-cyan-800 bg-white hover:bg-cyan-50 border border-cyan-200 shadow-2xs transition-colors cursor-pointer shrink-0"
              >
                Filter by Health Issue →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold font-mono shadow-2xs">
                    1
                  </span>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-slate-950 uppercase font-mono tracking-wider">
                      Select or Search Health Issue / Condition
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Prioritizes hospitals famous for or specializing in the exact condition you select
                    </p>
                  </div>
                </div>
                {specialtyFilter !== "all" && (
                  <span className="text-[11px] font-mono font-bold text-cyan-800 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200/90">
                    Active Filter: {specialtyFilter.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Direct Input for entering any issue or disease */}
              <div className="relative flex items-center">
                <Activity className="w-4 h-4 text-cyan-600 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={issueSearchText}
                  onChange={handleIssueInputChange}
                  placeholder="Search any health issue (e.g. Heart Attack, Cancer, Stroke, Bone Fracture, Ayurveda, Kidney, Child, Maternity, Eye, Lungs, Liver, ENT)..."
                  className="w-full pl-10 pr-16 py-3 rounded-2xl bg-white hover:bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none font-medium shadow-2xs"
                />
                {issueSearchText && (
                  <button
                    type="button"
                    onClick={handleClearIssue}
                    className="absolute right-3 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Comprehensive 17 Medical Issue Search Categories */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-1">
                {MEDICAL_ISSUE_OPTIONS.map((item) => {
                  const isActive = specialtyFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSpecialty(item.id, item.label)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${isActive
                        ? "bg-cyan-50 text-cyan-950 border-cyan-300 shadow-2xs ring-2 ring-cyan-200/80 font-bold"
                        : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-2xs"
                        }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-base shrink-0">{item.icon}</span>
                        <span className="text-xs font-bold truncate">{item.label}</span>
                      </div>
                      <span className={`text-[10px] line-clamp-1 ${isActive ? "text-cyan-700 font-semibold" : "text-slate-500"}`}>
                        {item.famousFor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-px bg-slate-200/80" />

          {/* ============================================================ */}
          {/* STEP 2: Location Input with 36+ Regions & Zone Filters */}
          {/* ============================================================ */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold font-mono shadow-2xs">
                  2
                </span>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-slate-950 uppercase font-mono tracking-wider">
                    Enter Location or Select from 36+ Indian Regions
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Searches all specialized and emergency hospitals within reachable driving distance
                  </p>
                </div>
              </div>
              <span className="text-xs text-cyan-800 font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Overpass POI Discovery Active Worldwide
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Autocomplete Input */}
              <div className="relative flex-1">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    placeholder="Search any city, town, village, or pincode across India & globally (e.g. Amaravati, Guntur, Vijayawada, Pune)..."
                    className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none font-medium shadow-2xs"
                  />
                  {isSearching && (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin absolute right-3.5" />
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectSearchResult(item)}
                        className="w-full px-4 py-2.5 text-left text-xs text-slate-800 hover:bg-cyan-50 hover:text-cyan-900 flex items-center gap-2.5 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDetectLiveLocation(false)}
                  disabled={isDetectingGps}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <LocateFixed className={`w-3.5 h-3.5 text-cyan-400 ${isDetectingGps ? "animate-spin" : ""}`} />
                  <span>{isDetectingGps ? "Locating..." : "Use Live GPS"}</span>
                </button>

                <button
                  onClick={() => setIsManualPicking(!isManualPicking)}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${isManualPicking
                    ? "bg-cyan-600 text-white border-cyan-600 shadow-xs ring-2 ring-cyan-200"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-2xs"
                    }`}
                >
                  <Compass className="w-3.5 h-3.5 text-cyan-600" />
                  <span>{isManualPicking ? "Placing Pin..." : "Pick on Map"}</span>
                </button>
              </div>
            </div>

            {/* Regional Zone Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-mono text-slate-400 uppercase font-bold mr-1">Zone:</span>
              {[
                { id: "all", label: "All Regions (36+)" },
                { id: "ap_tg", label: "AP & Telangana (15)" },
                { id: "south", label: "South (KA, TN, KL)" },
                { id: "west", label: "West (MH, GJ, GA)" },
                { id: "north", label: "North (DL, NCR, UP, RJ)" },
                { id: "east_central", label: "East & Central" },
              ].map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => setSelectedZone(zone.id)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${selectedZone === zone.id
                    ? "bg-slate-950 text-white shadow-2xs"
                    : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80 shadow-2xs"
                    }`}
                >
                  {zone.label}
                </button>
              ))}
            </div>

            {/* Quick Regional Presets (Filtered by Zone) */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs max-h-32 overflow-y-auto pr-1">
              {ALL_REGION_PRESETS.filter(
                (p) => selectedZone === "all" || p.zone === selectedZone
              ).map((preset) => {
                const isActive =
                  searchRegion.label.toLowerCase().includes(preset.name.toLowerCase()) ||
                  (Math.abs(searchRegion.lat - preset.lat) < 0.05 && Math.abs(searchRegion.lng - preset.lng) < 0.05);
                return (
                  <button
                    key={preset.name}
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${isActive
                      ? "bg-cyan-50 text-cyan-800 border-cyan-300 shadow-2xs font-extrabold ring-1 ring-cyan-200"
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-2xs"
                      }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. DENSE WORKSPACE: LIVE MAP (DOMINANT VISUAL ANCHOR) + SPECIALTY / ROUTE PANEL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* LEFT: Dominant Live Route Map */}
          <div className="lg:col-span-8 rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 bg-white">
            <InteractiveRouteMap
              patientCoords={{ lat: userLocation.lat, lng: userLocation.lng }}
              patientLocationName={userLocation.label}
              selectedHospital={selectedHospital}
              allHospitals={filteredAndSortedHospitals.slice(0, 60)}
              isManualPicking={isManualPicking}
              onSelectHospital={handleSelectHospital}
              onConfirmManualLocation={handleConfirmManualLocation}
              onCancelManualPicking={() => setIsManualPicking(false)}
              onRouteCalculated={(stats) => setLiveRoadStats(stats)}
            />
          </div>

          {/* RIGHT: Specialty Rotary Focus & Active Route Telemetry */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* Specialty Rotary Filter Card */}
            <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col gap-3">
              <div>
                <span className="text-[11px] font-mono text-cyan-800 font-bold uppercase tracking-wider block">
                  CLINICAL SPECIALTY FOCUS
                </span>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Route destination centers by verified sub-specialty readiness.
                </p>
              </div>

              <OptionWheel
                options={SPECIALTY_WHEEL_OPTIONS}
                selectedId={specialtyFilter}
                onChange={(opt) => {
                  setSpecialtyFilter(opt.id);
                  setCurrentPage(1);
                }}
                className="w-full"
              />
            </div>

            {/* Active Selected Destination / Telemetry Card */}
            {selectedHospital && (
              <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-cyan-500/30 p-4 sm:p-5 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                    Active Destination Route
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    ~{liveRoadStats ? liveRoadStats.etaMinutes : (selectedHospital.etaMinutes || 12)} min ETA
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-950 truncate">
                    {selectedHospital.name}
                  </h4>
                  <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-bold">
                    <span>⭐ Famous for:</span>
                    <span className="truncate">{selectedHospital.famousFor || getHospitalFamousFor(selectedHospital)}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-1">
                    {selectedHospital.address}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600">
                    Distance: ~{liveRoadStats ? liveRoadStats.roadDistanceKm.toFixed(1) : selectedHospital.distanceKm.toFixed(1)} km
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Verified ED
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`tel:${selectedHospital.emergencyPhone || selectedHospital.phone || "108"}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call ED</span>
                  </a>
                  <a
                    href={currentGoogleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* CLINICAL CAPABILITY FILTERS & STATUS BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-800 font-mono">
              {filteredAndSortedHospitals.length} facilities match your care criteria
            </span>
            {filteredAndSortedHospitals.length > 0 && (
              <span className="text-xs text-slate-500 font-mono">
                · Showing {startIndex + 1}–{endIndex} of {filteredAndSortedHospitals.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                aria-label="Sort order"
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="fastest">Sort: Fastest / Closest</option>
                <option value="government">Sort: Government First</option>
                <option value="rating">Sort: Highest Rating</option>
              </select>
            </div>

            {/* Specialty Selector */}
            <select
              value={specialtyFilter}
              onChange={(e) => {
                setSpecialtyFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Clinical capability filter"
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Specialties</option>
              <option value="cardiology">Cardiology / Heart</option>
              <option value="neurology">Neurology / Stroke</option>
              <option value="pediatrics">Pediatrics / Child</option>
              <option value="cancer">Oncology / Cancer</option>
            </select>

            {/* Ownership Selector */}
            <select
              value={ownershipFilter}
              onChange={(e) => {
                setOwnershipFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Ownership filter"
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Ownership</option>
              <option value="government">Government / Subsidized</option>
              <option value="private">Private Tertiary</option>
            </select>
          </div>
        </div>

        {/* Specialized Facilities Banner (When Medical Issue is Active) */}
        {specialtyFilter !== "all" && (
          <div className="p-4 rounded-2xl bg-cyan-50/90 border border-cyan-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white text-base shadow-xs shrink-0">
                ⭐
              </span>
              <div>
                <span className="text-xs font-bold text-cyan-950 uppercase tracking-wide font-mono block">
                  {specialtyFilter.toUpperCase()} SPECIALIZED CARE IN {searchRegion.label}
                </span>
                <span className="text-xs text-cyan-800 font-medium">
                  {specializedCount > 0
                    ? `Showing ${specializedCount} center${specializedCount > 1 ? "s" : ""} with verified on-duty specialists first, followed by all other emergency hospitals.`
                    : `No exclusive center found nearby; showing closest emergency facilities equipped for stabilization.`}
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setSpecialtyFilter("all");
                setCurrentPage(1);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-cyan-800 bg-white hover:bg-cyan-100/60 border border-cyan-300 shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              Show All Facilities ({filteredAndSortedHospitals.length})
            </button>
          </div>
        )}

        {/* 10-FACILITY PAGINATED RESULTS LIST */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
              <span>Scanning and evaluating clinically verified facilities nearby...</span>
            </div>
          ) : pageHospitals.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center flex flex-col items-center justify-center gap-2">
              <Building2 className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">No facilities matching current filters</p>
              <p className="text-[11px] text-slate-500">
                Try selecting "All Specialties" or changing your location.
              </p>
            </div>
          ) : (
            pageHospitals.map((hosp, pIdx) => {
              const globalIndex = startIndex + pIdx;
              const isSelected = selectedHospital?.id === hosp.id;
              const distanceNum =
                isSelected && liveRoadStats ? liveRoadStats.roadDistanceKm : hosp.distanceKm;
              const durationNum =
                isSelected && liveRoadStats ? liveRoadStats.etaMinutes : hosp.etaMinutes || Math.max(2, Math.round(distanceNum * 1.5));
              const isGovernment = (hosp as any).ownership === "government";
              const isSpecMatch = Boolean(hosp.isEligible && specialtyFilter !== "all");
              const isFirstGeneralHosp = specialtyFilter !== "all" && !hosp.isEligible && (pIdx === 0 || pageHospitals[pIdx - 1]?.isEligible);

              const generalDivider = isFirstGeneralHosp ? (
                <div key="general-divider" className="my-2 p-3 sm:p-4 rounded-2xl bg-slate-100/95 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800 text-white text-xs font-bold shrink-0">
                      🏥
                    </span>
                    <div>
                      <span className="text-xs font-mono font-black text-slate-900 uppercase tracking-wide block">
                        All Other Emergency Hospitals in {searchRegion.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        General 24/7 facilities equipped for triage, trauma stabilization, and initial emergency care
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-200 shrink-0">
                    Emergency Backup
                  </span>
                </div>
              ) : null;

              // ==========================================
              // PAGE 1, ITEM 1: HERO RECOMMENDATION CARD
              // ==========================================
              if (currentPage === 1 && pIdx === 0) {
                return (
                  <React.Fragment key={hosp.id}>
                    {generalDivider}
                    <MovingBorder active={isSelected} borderRadius="24px" className="w-full">
                      <div
                        onClick={() => handleSelectHospital(hosp)}
                        className={`p-5 sm:p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col gap-4 shadow-md ${isSelected
                          ? "bg-white border-cyan-400"
                          : "bg-white hover:bg-slate-50/80 border-slate-300"
                          }`}
                      >
                        {/* Top Row: Name, Fastest Badge, Distance & Travel Time */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base sm:text-lg font-black text-slate-950 truncate">
                                {hosp.name}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 tracking-wider shadow-2xs">
                                ⭐ Famous for: {hosp.famousFor || getHospitalFamousFor(hosp)}
                              </span>
                              {isSpecMatch && (
                                <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-600 text-white tracking-wider shadow-2xs">
                                  Verified {specialtyFilter.toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{hosp.address}</span>
                            </span>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            <span className="font-mono text-sm sm:text-base font-black text-cyan-950 bg-cyan-50 px-3 py-1 rounded-xl border border-cyan-200">
                              ~{durationNum} min
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 mt-0.5">
                              ~{distanceNum.toFixed(1)} km by road
                            </span>
                          </div>
                        </div>

                        {/* Middle Row: Capabilities & Badges */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>✓ 24/7 Verified Emergency</span>
                          </span>

                          {hosp.acceptsPublicInsurance && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                              ✓ Ayushman Bharat / Aarogyasri
                            </span>
                          )}

                          {hosp.specialty && hosp.specialty.slice(0, 3).map((s, sIdx) => (
                            <span key={sIdx} className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-900 border border-cyan-200 font-medium">
                              ✓ {s}
                            </span>
                          ))}

                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            🏛 {isGovernment ? "Government / Subsidized" : "Private Multi-Specialty"}
                          </span>
                        </div>

                        {/* Bottom Row: Direct Emergency Actions */}
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <Car className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Live road-network route active on map</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${hosp.emergencyPhone || hosp.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Call Emergency ({hosp.emergencyPhone || "108"})</span>
                            </a>

                            <a
                              href={currentGoogleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              <span>Directions</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </MovingBorder>
                  </React.Fragment>
                );
              }

              // ==========================================
              // PAGE 1, ITEMS 2–4: SECONDARY CARDS
              // ==========================================
              if (currentPage === 1 && pIdx < 4) {
                return (
                  <React.Fragment key={hosp.id}>
                    {generalDivider}
                    <div
                      onClick={() => handleSelectHospital(hosp)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 ${isSelected
                        ? "bg-white border-cyan-400 shadow-md ring-2 ring-cyan-200"
                        : "bg-white/85 hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
                              {hosp.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300">
                              ⭐ Famous for: {hosp.famousFor || getHospitalFamousFor(hosp)}
                            </span>
                            {isSpecMatch && (
                              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
                                Verified {specialtyFilter.toUpperCase()}
                              </span>
                            )}
                            {hosp.acceptsPublicInsurance && (
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ✓ Ayushman / Aarogyasri
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 truncate mt-0.5">{hosp.address}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            ~{durationNum} min
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-[10px] font-mono text-slate-500">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-600 font-semibold">
                            ~{distanceNum.toFixed(1)} km
                          </span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">✓ Verified Emergency</span>
                          {hosp.specialty && hosp.specialty[0] && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600">{hosp.specialty[0]}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectHospital(hosp);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 transition-colors cursor-pointer"
                          >
                            View on Map
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${hosp.latitude},${hosp.longitude}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>Directions</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }

              // ==========================================
              // ALL OTHER ITEMS (PAGE 1 #5-10 & ALL OF PAGES 2+): COMPACT ROWS
              // ==========================================
              return (
                <React.Fragment key={hosp.id}>
                  {generalDivider}
                  <div
                    onClick={() => handleSelectHospital(hosp)}
                    className={`px-4 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isSelected
                      ? "bg-white border-cyan-400 shadow-xs ring-1 ring-cyan-200"
                      : "bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300"
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono text-slate-400 font-bold w-5 shrink-0">
                        {globalIndex + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                        {hosp.name}
                      </span>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300 shrink-0">
                        ⭐ {hosp.famousFor || getHospitalFamousFor(hosp)}
                      </span>
                      {hosp.acceptsPublicInsurance && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 hidden sm:inline">
                          ✓ Ayushman
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500 hidden sm:inline shrink-0">
                        ({isGovernment ? "Govt" : "Private"})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono font-bold text-slate-700">
                        ~{durationNum} min
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                        ({distanceNum.toFixed(1)} km)
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHospital(hosp);
                        }}
                        className="px-2.5 py-1 rounded text-[11px] font-mono font-bold text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-colors cursor-pointer"
                      >
                        {isSelected ? "Active" : "View"}
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* EXPLICIT PAGINATION CONTROLS */}
        {!loading && filteredAndSortedHospitals.length > PAGE_SIZE && (
          <div className="pt-4 pb-4 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-mono text-slate-500">
              Showing {startIndex + 1}–{endIndex} of {filteredAndSortedHospitals.length} facilities
            </span>

            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {pageNumbers.map((p, idx) =>
                p === -1 ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${currentPage === p
                      ? "bg-cyan-600 text-white shadow-2xs"
                      : "bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"
                      }`}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </main>

      <AppFooter />
    </div>
  );
}
