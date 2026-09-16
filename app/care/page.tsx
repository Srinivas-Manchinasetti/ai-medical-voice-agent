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
} from "lucide-react";
import { Navbar } from "../_components/Navbar";
import { AppFooter } from "../_components/AppFooter";
import { HospitalItem } from "../_components/InteractiveRouteMap";

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

const REGION_PRESETS: Array<{ name: string; lat: number; lng: number; label: string }> = [
  { name: "Vijayawada", lat: 16.5062, lng: 80.6480, label: "Vijayawada, Andhra Pradesh" },
  { name: "Guntur", lat: 16.3067, lng: 80.4365, label: "Guntur, Andhra Pradesh" },
  { name: "Hyderabad", lat: 17.4326, lng: 78.4071, label: "Hyderabad, Telangana" },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, label: "Bengaluru, Karnataka" },
  { name: "Mumbai", lat: 19.0760, lng: 72.8777, label: "Mumbai, Maharashtra" },
  { name: "Delhi NCR", lat: 28.6139, lng: 77.2090, label: "New Delhi, Delhi" },
];

const DEFAULT_ORIGIN: CareOrigin = {
  lat: REGION_PRESETS[0].lat,
  lng: REGION_PRESETS[0].lng,
  label: REGION_PRESETS[0].label,
  source: "preset",
};

const STORAGE_KEY = "medvoice_care_origin";
const PAGE_SIZE = 10;

export default function CarePage() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Care search origin state with source tracking
  const [origin, setOrigin] = useState<CareOrigin>(DEFAULT_ORIGIN);
  const [isOriginInitialized, setIsOriginInitialized] = useState<boolean>(false);

  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [isManualPicking, setIsManualPicking] = useState<boolean>(false);

  // Live road stats calculated from map routing
  const [liveRoadStats, setLiveRoadStats] = useState<{ roadDistanceKm: number; etaMinutes: number } | null>(null);

  // Filter & sorting states
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"fastest" | "government" | "rating">("fastest");

  // True Pagination state (10 results per page)
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Restore saved search origin on mount (Prevents location reverting to default on refresh)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number" && parsed.label) {
            setOrigin(parsed);
            setIsOriginInitialized(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not restore saved search origin:", e);
      }
    }
    setIsOriginInitialized(true);
  }, []);

  // 2. Fetch facilities based on active origin & filters
  const loadFacilities = async (targetOrigin: CareOrigin) => {
    setLoading(true);
    setCurrentPage(1); // Reset to page 1 on search origin change
    try {
      const specialtyParam = specialtyFilter !== "all" ? `&specialty=${encodeURIComponent(specialtyFilter)}` : "";
      const res = await fetch(`/api/hospitals?lat=${targetOrigin.lat}&lng=${targetOrigin.lng}${specialtyParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hospitals && data.hospitals.length > 0) {
          const list: HospitalItem[] = data.hospitals;
          setHospitals(list);
          setSelectedHospital(list[0] || null);
        } else {
          setHospitals([]);
          setSelectedHospital(null);
        }
      }
      setOrigin(targetOrigin);

      // Persist active origin so refresh doesn't lose it
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(targetOrigin));
        } catch {}
      }
    } catch (e) {
      console.warn("Failed to load facilities:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load facilities once origin is initialized or when specialty filter changes
  useEffect(() => {
    if (isOriginInitialized) {
      loadFacilities(origin);
    }
  }, [isOriginInitialized, specialtyFilter]);

  // Handle GPS detection
  const handleDetectLiveLocation = () => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      setIsDetectingGps(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          let label = "Your Current Location";
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
          } catch {}

          const newOrigin: CareOrigin = {
            lat: latitude,
            lng: longitude,
            label,
            source: "gps",
          };
          loadFacilities(newOrigin);
          setIsDetectingGps(false);
          setSearchQuery("");
        },
        (err) => {
          console.warn("GPS error:", err.message);
          setIsDetectingGps(false);
          alert("Could not detect precise location. You can select a city or use 'Map Pin' to set manually.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // Handle preset city selection
  const handleSelectPreset = (preset: typeof REGION_PRESETS[0]) => {
    setIsManualPicking(false);
    setSearchQuery("");
    setShowDropdown(false);
    const newOrigin: CareOrigin = {
      lat: preset.lat,
      lng: preset.lng,
      label: preset.label,
      source: "preset",
    };
    loadFacilities(newOrigin);
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
    const newOrigin: CareOrigin = {
      lat,
      lng,
      label: shortLabel,
      source: "search",
    };
    loadFacilities(newOrigin);
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
    } catch {}

    const newOrigin: CareOrigin = {
      lat,
      lng,
      label,
      source: "manual_pin",
    };
    loadFacilities(newOrigin);
  };

  // Filter & Sort Hospitals
  const filteredAndSortedHospitals = useMemo(() => {
    let list = [...hospitals];

    // Ownership filter
    if (ownershipFilter === "government") {
      list = list.filter((h) => (h as any).ownership === "government");
    } else if (ownershipFilter === "private") {
      list = list.filter((h) => (h as any).ownership === "private");
    }

    // Sort order
    if (sortBy === "fastest") {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (sortBy === "government") {
      list.sort((a, b) => {
        const aGov = (a as any).ownership === "government" ? 1 : 0;
        const bGov = (b as any).ownership === "government" ? 1 : 0;
        if (aGov !== bGov) return bGov - aGov;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sortBy === "rating") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [hospitals, ownershipFilter, sortBy]);

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
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${selectedHospital.latitude},${selectedHospital.longitude}&travelmode=driving`
    : "#";

  return (
    <div className="relative min-h-screen bg-transparent text-slate-900 font-sans flex flex-col selection:bg-cyan-500 selection:text-white">
      <Navbar />

      <main className="relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 flex flex-col gap-6">
        
        {/* COMPACT TOOL HEADER */}
        <header className="flex flex-col gap-2 pt-1 pb-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-800 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
                <span>Verified Emergency Care Network</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 mt-1">
                Care Network
              </h1>
              <p className="text-sm text-slate-600 font-medium mt-0.5">
                Find clinically appropriate care and see how reachable it is from your location.
              </p>
            </div>

            {/* Origin Provenance Status Badge */}
            <div className="flex items-center gap-2 text-xs font-mono font-semibold px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-slate-200/90 shadow-2xs">
              {origin.source === "gps" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-700 font-bold">GPS Live</span>
                </>
              ) : origin.source === "preset" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="text-cyan-700 font-bold">Region Preset</span>
                </>
              ) : origin.source === "manual_pin" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="text-purple-700 font-bold">Map Pin</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-700 font-bold">Searched</span>
                </>
              )}
              <span className="text-slate-300">•</span>
              <span className="text-slate-800 truncate max-w-[180px] sm:max-w-[280px]">{origin.label}</span>
            </div>
          </div>
        </header>

        {/* UNIFIED SEARCH & LOCATION HUD */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-xs flex flex-col gap-3.5">
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
                  placeholder="Enter city, district, or landmark (e.g. Narasaraopet, Guntur, Vijayawada)..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all outline-none"
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

            {/* GPS & Pin Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDetectLiveLocation}
                disabled={isDetectingGps}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <LocateFixed className={`w-3.5 h-3.5 text-cyan-400 ${isDetectingGps ? "animate-spin" : ""}`} />
                <span>{isDetectingGps ? "Detecting..." : "Detect GPS"}</span>
              </button>

              <button
                onClick={() => setIsManualPicking(!isManualPicking)}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  isManualPicking
                    ? "bg-cyan-600 text-white border-cyan-600 shadow-xs ring-2 ring-cyan-200"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs"
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-cyan-600" />
                <span>{isManualPicking ? "Click Map to Place" : "Map Pin"}</span>
              </button>
            </div>
          </div>

          {/* Quick Region Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-mono text-slate-400 shrink-0 font-semibold mr-1">
              REGIONS:
            </span>
            {REGION_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(preset)}
                className={`px-3 py-1 rounded-xl text-xs font-medium shrink-0 transition-all cursor-pointer ${
                  origin.label.includes(preset.name)
                    ? "bg-cyan-600 text-white shadow-2xs"
                    : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80"
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* PROMINENT INTERACTIVE MAP HUD */}
        <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200/80">
          <InteractiveRouteMap
            patientCoords={{ lat: origin.lat, lng: origin.lng }}
            patientLocationName={origin.label}
            selectedHospital={selectedHospital}
            allHospitals={filteredAndSortedHospitals.slice(0, 15)}
            isManualPicking={isManualPicking}
            onSelectHospital={(hosp) => setSelectedHospital(hosp)}
            onConfirmManualLocation={handleConfirmManualLocation}
            onCancelManualPicking={() => setIsManualPicking(false)}
            onRouteCalculated={(stats) => setLiveRoadStats(stats)}
          />
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

              // ==========================================
              // PAGE 1, ITEM 1: HERO RECOMMENDATION CARD
              // ==========================================
              if (currentPage === 1 && pIdx === 0) {
                return (
                  <div
                    key={hosp.id}
                    onClick={() => setSelectedHospital(hosp)}
                    className={`p-5 sm:p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col gap-4 shadow-md ${
                      isSelected
                        ? "bg-white border-cyan-400 ring-4 ring-cyan-100"
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
                          <span className="text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-600 text-white tracking-wider shadow-2xs">
                            Fastest Appropriate
                          </span>
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

                      {hosp.specialty && hosp.specialty.slice(0, 2).map((s, sIdx) => (
                        <span key={sIdx} className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-900 border border-cyan-200 font-medium">
                          ✓ {s}
                        </span>
                      ))}

                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        🏛 {isGovernment ? "Government / Subsidized" : "Private Multi-Specialty"}
                      </span>

                      <span className="text-slate-400 text-[10px] font-mono ml-auto hidden sm:inline">
                        Road-network routing active
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
                );
              }

              // ==========================================
              // PAGE 1, ITEMS 2–4: SECONDARY CARDS
              // ==========================================
              if (currentPage === 1 && pIdx < 4) {
                return (
                  <div
                    key={hosp.id}
                    onClick={() => setSelectedHospital(hosp)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
                      isSelected
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
                          <span className="text-[10px] font-mono text-slate-500 font-medium">
                            · {isGovernment ? "Government" : "Private"}
                          </span>
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
                            setSelectedHospital(hosp);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 transition-colors cursor-pointer"
                        >
                          View on Map
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${hosp.latitude},${hosp.longitude}&travelmode=driving`}
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
                );
              }

              // ==========================================
              // ALL OTHER ITEMS (PAGE 1 #5-10 & ALL OF PAGES 2+): COMPACT ROWS
              // ==========================================
              return (
                <div
                  key={hosp.id}
                  onClick={() => setSelectedHospital(hosp)}
                  className={`px-4 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-white border-cyan-400 shadow-xs ring-1 ring-cyan-200"
                      : "bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-slate-400 font-bold w-5 shrink-0">
                      {globalIndex + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                      {hosp.name}
                    </span>
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
                        setSelectedHospital(hosp);
                      }}
                      className="px-2.5 py-1 rounded text-[11px] font-mono font-bold text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 transition-colors cursor-pointer"
                    >
                      {isSelected ? "Active" : "View"}
                    </button>
                  </div>
                </div>
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
                    className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      currentPage === p
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
