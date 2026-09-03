"use client";

import React, { useState, useEffect, useRef } from "react";
import { PhoneCall, ExternalLink, Navigation, Search, MapPin, LocateFixed, Compass } from "lucide-react";
import dynamic from "next/dynamic";
import { HospitalItem } from "./InteractiveRouteMap";

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

const REGION_PRESETS = [
  { name: "Guntur", lat: 16.3067, lng: 80.4365, label: "Guntur, Andhra Pradesh" },
  { name: "Vijayawada", lat: 16.5062, lng: 80.6480, label: "Vijayawada, Andhra Pradesh" },
  { name: "Hyderabad", lat: 17.4326, lng: 78.4071, label: "Hyderabad, Telangana" },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946, label: "Bengaluru, Karnataka" },
  { name: "Mumbai", lat: 19.0760, lng: 72.8777, label: "Mumbai, Maharashtra" },
  { name: "Delhi NCR", lat: 28.6139, lng: 77.2090, label: "New Delhi, Delhi" },
];

export function CareNetworkSection() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<HospitalItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
    lat: REGION_PRESETS[0].lat,
    lng: REGION_PRESETS[0].lng,
  });
  const [locationName, setLocationName] = useState<string>("Guntur, Andhra Pradesh");
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [isManualPicking, setIsManualPicking] = useState<boolean>(false);

  // Live canonical road stats from OSRM
  const [liveRoadStats, setLiveRoadStats] = useState<{ roadDistanceKm: number; etaMinutes: number } | null>(null);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch hospitals based on coordinates
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
            loadHospitalsForLocation(REGION_PRESETS[0].lat, REGION_PRESETS[0].lng, REGION_PRESETS[0].label);
            setIsDetectingGps(false);
          },
          { enableHighAccuracy: true, timeout: 7000 }
        );
      } else {
        loadHospitalsForLocation(REGION_PRESETS[0].lat, REGION_PRESETS[0].lng, REGION_PRESETS[0].label);
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

        {/* REGION QUICK PILLS */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 font-bold mr-1">Quick Select:</span>
          {REGION_PRESETS.map((preset) => {
            const isCurrent = Math.abs(userCoords.lat - preset.lat) < 0.05 && Math.abs(userCoords.lng - preset.lng) < 0.05;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  setSearchQuery("");
                  setIsManualPicking(false);
                  loadHospitalsForLocation(preset.lat, preset.lng, preset.label);
                }}
                className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
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
              <span>Nearest Emergency Facilities ({hospitals.length})</span>
              <span className="text-slate-500 font-normal">Click a hospital to preview driving route</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {loading ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-400 animate-pulse">
                  Locating nearest emergency hospitals...
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
                            {displayDist} km
                          </span>
                        </div>
                        <p className={`text-[11px] line-clamp-1 ${isSelected ? "text-slate-400" : "text-slate-500"}`}>
                          {hosp.address}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-bold text-emerald-400">
                          <span>Active Route Destination</span>
                          <span>→</span>
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
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs">
                    24/7 Emergency Care
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs">
                    {liveRoadStats ? liveRoadStats.roadDistanceKm : selectedHospital.distanceKm} km away • ~{liveRoadStats ? liveRoadStats.etaMinutes : selectedHospital.etaMinutes || 12} min drive (traffic)
                  </span>
                  {selectedHospital.rating && (
                    <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs">
                      ★ {selectedHospital.rating}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600">{selectedHospital.address}</p>

                {selectedHospital.matchReasons && selectedHospital.matchReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedHospital.matchReasons.map((reason, rIdx) => (
                      <span key={rIdx} className="text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        ✓ {reason}
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
