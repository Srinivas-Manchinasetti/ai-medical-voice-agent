"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  PhoneCall,
  ExternalLink,
  Navigation,
  Search,
  MapPin,
  LocateFixed,
  Compass,
  Sparkles,
  Hospital,
  Target,
  Star,
  Check,
  ArrowRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { HospitalItem } from "./InteractiveRouteMap";
import CountUp from "@/components/CountUp";
import { SpecialtyIcon } from "@/components/care/SpecialtyIcon";
import {
  ALL_REGION_PRESETS,
  RegionPresetItem,
  MEDICAL_ISSUE_OPTIONS,
  getHospitalFamousFor,
} from "@/lib/hospitals-india-data";

// Dynamically import Leaflet map with SSR disabled
const InteractiveRouteMap = dynamic(
  () => import("./InteractiveRouteMap").then((mod) => mod.InteractiveRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] sm:h-[520px] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center space-y-3 animate-pulse">
        <div className="w-9 h-9 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading map and road network...</span>
      </div>
    ),
  }
);

export function CareNetworkSection() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: ALL_REGION_PRESETS[0].lat,
    lng: ALL_REGION_PRESETS[0].lng,
  });
  const [locationName, setLocationName] = useState<string>("Amaravati, Andhra Pradesh");
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [isManualPicking, setIsManualPicking] = useState<boolean>(false);

  // Choice mode: "all" (Show All Hospitals) vs "issues" (Based on Health Issues)
  const [viewMode, setViewMode] = useState<"all" | "issues">("all");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");

  // Live canonical road stats from OSRM
  const [liveRoadStats, setLiveRoadStats] = useState<{ roadDistanceKm: number; etaMinutes: number } | null>(null);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch hospitals based on coordinates and optional specialty
  const loadHospitalsForLocation = async (
    lat: number,
    lng: number,
    locLabel: string,
    targetSpecialty?: string
  ) => {
    setLoading(true);
    try {
      const activeSpec = targetSpecialty !== undefined ? targetSpecialty : specialtyFilter;
      const specParam = activeSpec && activeSpec !== "all" ? `&specialty=${encodeURIComponent(activeSpec)}` : "";
      const res = await fetch(`/api/hospitals?lat=${lat}&lng=${lng}${specParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hospitals && data.hospitals.length > 0) {
          setHospitals(data.hospitals.slice(0, 8));
          setSelectedHospital(data.hospitals[0]);
        } else {
          setHospitals([]);
          setSelectedHospital(null);
        }
      }
      setLocationName(locLabel);
      setUserCoords({ lat, lng });
    } catch (e) {
      console.warn("Error fetching hospitals:", e);
    } finally {
      setLoading(false);
    }
  };

  // 3-Tier Location Initialization: Browser GPS -> IP Fallback -> Default Preset
  useEffect(() => {
    let active = true;

    async function detectLocation() {
      setIsDetectingGps(true);

      // 1. High-Accuracy Browser Geolocation
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            if (!active) return;
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
                  const area = revData.address.suburb || revData.address.neighbourhood || revData.address.residential || revData.address.road || revData.address.city || "Current Location";
                  const city = revData.address.city || revData.address.state_district || revData.address.state || "";
                  label = `Near ${area}${city ? `, ${city}` : ""}`;
                }
              }
            } catch (e) {
              // Ignore
            }

            loadHospitalsForLocation(latitude, longitude, label);
            setIsDetectingGps(false);
          },
          async () => {
            // 2. Fallback to IP Geolocation if GPS denied/unavailable
            if (!active) return;
            try {
              const ipRes = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
              if (ipRes.ok) {
                const ipData = await ipRes.json();
                if (ipData.latitude && ipData.longitude) {
                  const label = `${ipData.city || "Detected City"}, ${ipData.region_code || ipData.region || "India"}`;
                  loadHospitalsForLocation(ipData.latitude, ipData.longitude, label);
                  setIsDetectingGps(false);
                  return;
                }
              }
            } catch (err) {
              console.log("IP fallback unavailable, using preset");
            }
            // 3. Fallback to default preset
            loadHospitalsForLocation(ALL_REGION_PRESETS[0].lat, ALL_REGION_PRESETS[0].lng, ALL_REGION_PRESETS[0].label);
            setIsDetectingGps(false);
          },
          { enableHighAccuracy: true, timeout: 7000 }
        );
      } else {
        loadHospitalsForLocation(ALL_REGION_PRESETS[0].lat, ALL_REGION_PRESETS[0].lng, ALL_REGION_PRESETS[0].label);
        setIsDetectingGps(false);
      }
    }

    detectLocation();

    return () => {
      active = false;
    };
  }, []);

  // Search input handler with Nominatim debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=in&limit=5`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch (err) {
        console.error("Nominatim search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectSearchResult = (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const shortLabel = result.display_name.split(",").slice(0, 3).join(",").trim();
    setSearchQuery(shortLabel);
    setShowDropdown(false);
    loadHospitalsForLocation(lat, lng, shortLabel);
  };

  // Re-trigger GPS button
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
                const area = revData.address.suburb || revData.address.neighbourhood || revData.address.residential || revData.address.road || revData.address.city || "Current Location";
                const city = revData.address.city || revData.address.state_district || revData.address.state || "";
                label = `Near ${area}${city ? `, ${city}` : ""}`;
              }
            }
          } catch (e) {
            // Ignore
          }
          loadHospitalsForLocation(latitude, longitude, label);
          setIsDetectingGps(false);
          setSearchQuery("");
        },
        () => {
          alert("Location permission was denied. You can search your address or use Set Location on Map.");
          setIsDetectingGps(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  // Manual map positioning confirmation handler
  const handleConfirmManualLocation = async (lat: number, lng: number) => {
    setIsManualPicking(false);
    let label = `Near Selected Location (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;
    try {
      const revRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (revRes.ok) {
        const revData = await revRes.json();
        if (revData.address) {
          const area = revData.address.suburb || revData.address.neighbourhood || revData.address.residential || revData.address.road || revData.address.city || "Selected Location";
          const city = revData.address.city || revData.address.state_district || revData.address.state || "";
          label = `Near ${area}${city ? `, ${city}` : ""}`;
        }
      }
    } catch (e) {
      // Ignore
    }
    loadHospitalsForLocation(lat, lng, label);
  };

  // Construct direct Google Maps URL strictly from origin and selected hospital coordinates
  const currentGoogleMapsUrl = selectedHospital
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${selectedHospital.latitude},${selectedHospital.longitude}&travelmode=driving`
    : "#";

  return (
    <section id="care-network" className="w-full py-16 sm:py-24 bg-[#FAF9F6] text-slate-900 border-t border-slate-200/80">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* SECTION HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200/80 pb-6 gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-950 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>MEDVOICE EMERGENCY NETWORK</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
              Emergency Hospital Locator
            </h2>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              Find nearest 24/7 emergency departments, trauma centers, and cardiac care facilities with direct road routing and one-touch ER calling.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
              <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="line-clamp-1 max-w-[200px]">{locationName}</span>
            </div>
          </div>
        </div>

        {/* LOCATION SEARCH & ACTIONS TOOLBAR */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          
          {/* SEARCH INPUT BAR WITH AUTOCOMPLETE */}
          <div className="relative flex-1">
            <div className="flex items-center rounded-2xl border border-slate-300 bg-white px-3.5 py-2.5 shadow-sm focus-within:border-slate-900 transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search area, landmark, or city (e.g. VIT-AP, Arundelpet, Banjara Hills)..."
                className="w-full bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {isSearching && (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-400 border-t-transparent animate-spin ml-2" />
              )}
            </div>

            {/* AUTOCOMPLETE DROPDOWN */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden divide-y divide-slate-100">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-start gap-2.5 transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{res.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDetectLiveLocation}
              disabled={isDetectingGps}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <LocateFixed className={`w-3.5 h-3.5 text-sky-400 ${isDetectingGps ? "animate-spin" : ""}`} />
              <span>{isDetectingGps ? "Detecting GPS..." : "Use My Live Location"}</span>
            </button>

            <button
              onClick={() => setIsManualPicking(true)}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-bold shadow-sm transition-all cursor-pointer ${
                isManualPicking
                  ? "bg-sky-50 border-sky-300 text-sky-950 font-extrabold ring-2 ring-sky-400/30"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-slate-600" />
              <span>Set on Map</span>
            </button>
          </div>
        </div>

        {/* DISCOVERY MODE CHOICE: Show All Hospitals vs Filter by Health Issues */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200/80 text-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-[0.1em] text-cyan-800">
                Hospital Discovery Mode
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-950">
              How would you like to explore hospitals?
            </h3>
            <p className="text-xs text-slate-600">
              Choose whether to view all emergency hospitals or filter centers specializing in your medical issue.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => {
                setViewMode("all");
                setSpecialtyFilter("all");
                loadHospitalsForLocation(userCoords.lat, userCoords.lng, locationName, "all");
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "all"
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-bold"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Hospital className="w-4 h-4 text-cyan-700" />
              <span>All Hospitals</span>
            </button>

            <button
              onClick={() => {
                setViewMode("issues");
                const defaultSpec = specialtyFilter === "all" ? "cardiology" : specialtyFilter;
                setSpecialtyFilter(defaultSpec);
                loadHospitalsForLocation(userCoords.lat, userCoords.lng, locationName, defaultSpec);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === "issues"
                  ? "bg-white text-slate-950 shadow-sm border border-slate-200 font-bold"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              <Target className="w-3.5 h-3.5 text-cyan-600" />
              <span>By Health Issue</span>
            </button>
          </div>
        </div>

        {/* ISSUE QUICK SELECT PILLS (When in "issues" mode) */}
        {viewMode === "issues" && (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
              <span>Filter by Medical Condition / Specialty:</span>
              <span className="text-[11px] font-mono font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200 uppercase">
                Active: {specialtyFilter}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {MEDICAL_ISSUE_OPTIONS.slice(0, 10).map((opt) => {
                const isActive = specialtyFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSpecialtyFilter(opt.id);
                      loadHospitalsForLocation(userCoords.lat, userCoords.lng, locationName, opt.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isActive
                        ? "bg-cyan-50 text-cyan-950 border-cyan-300 shadow-2xs ring-1 ring-cyan-200 font-bold"
                        : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-2xs"
                    }`}
                  >
                    <SpecialtyIcon id={opt.id} className="w-3.5 h-3.5 shrink-0" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* REGION QUICK PILLS */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold mr-1">Quick Select Region:</span>
          {ALL_REGION_PRESETS.slice(0, 15).map((preset) => {
            const isCurrent = Math.abs(userCoords.lat - preset.lat) < 0.05 && Math.abs(userCoords.lng - preset.lng) < 0.05;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  setSearchQuery("");
                  setIsManualPicking(false);
                  loadHospitalsForLocation(preset.lat, preset.lng, preset.label);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-cyan-50 text-cyan-800 border-cyan-300 shadow-2xs font-extrabold ring-1 ring-cyan-200"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-2xs"
                }`}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        {/* MAP CONTAINER */}
        <div className="space-y-6">
          <InteractiveRouteMap
            patientCoords={userCoords}
            patientLocationName={locationName}
            selectedHospital={selectedHospital}
            allHospitals={hospitals}
            isManualPicking={isManualPicking}
            onSelectHospital={(hosp) => setSelectedHospital(hosp)}
            onConfirmManualLocation={handleConfirmManualLocation}
            onCancelManualPicking={() => setIsManualPicking(false)}
            onRouteCalculated={(stats) => setLiveRoadStats(stats)}
          />

          {/* NEARBY HOSPITALS LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
              <span>Emergency & Specialized Facilities ({hospitals.length})</span>
              <span className="text-slate-500 font-normal">Click a hospital to preview driving route</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {loading ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-400 animate-pulse">
                  Locating emergency hospitals...
                </div>
              ) : (
                hospitals.map((hosp) => {
                  const isSelected = selectedHospital?.id === hosp.id;
                  const displayDist = isSelected && liveRoadStats ? liveRoadStats.roadDistanceKm : hosp.distanceKm;

                  return (
                    <button
                      key={hosp.id}
                      onClick={() => setSelectedHospital(hosp)}
                      className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-slate-950 text-white border-slate-900 shadow-md ring-2 ring-sky-500/50"
                          : "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-xs font-bold line-clamp-1 ${isSelected ? "text-sky-400" : "text-slate-950"}`}>
                            {hosp.name.split("-")[0].trim()}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isSelected ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-700"
                          }`}>
                            <CountUp to={displayDist} duration={1} /> km
                          </span>
                        </div>

                        {/* Famous For Badge */}
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1 ${
                          isSelected ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-amber-50 text-amber-900 border border-amber-200"
                        }`}>
                          <Star className={`w-2.5 h-2.5 shrink-0 ${isSelected ? "text-amber-300 fill-amber-300" : "text-amber-600 fill-amber-500"}`} />
                          <span>{hosp.famousFor || getHospitalFamousFor(hosp)}</span>
                        </div>

                        <p className={`text-[11px] line-clamp-1 ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                          {hosp.address}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-bold text-emerald-400">
                          <span>Active Route Destination</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* SELECTED HOSPITAL PAYOFF CARD */}
          {selectedHospital && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-950">{selectedHospital.name}</h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                    <span>Famous for: {selectedHospital.famousFor || getHospitalFamousFor(selectedHospital)}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs">
                    24/7 Emergency Care
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs">
                    <CountUp to={liveRoadStats ? liveRoadStats.roadDistanceKm : selectedHospital.distanceKm} duration={1.2} /> km away • ~<CountUp to={liveRoadStats ? liveRoadStats.etaMinutes : selectedHospital.etaMinutes || 12} duration={1} /> min drive (traffic)
                  </span>
                  {selectedHospital.rating && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                      <span>{selectedHospital.rating}</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600">{selectedHospital.address}</p>

                {selectedHospital.matchReasons && selectedHospital.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedHospital.matchReasons.map((reason, rIdx) => (
                      <span key={rIdx} className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{reason}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
                <a
                  href={`tel:${selectedHospital.emergencyPhone || selectedHospital.phone}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Emergency</span>
                </a>
                <a
                  href={currentGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Directions in Google Maps</span>
                </a>
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}
