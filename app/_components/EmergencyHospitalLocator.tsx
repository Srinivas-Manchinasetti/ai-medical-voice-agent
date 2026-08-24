"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Navigation,
  PhoneCall,
  Activity,
  ShieldCheck,
  Search,
  Crosshair,
  AlertCircle,
  ExternalLink,
  Award,
  Sparkles,
  Stethoscope,
  HeartPulse,
  Building2,
  ArrowLeft,
  RotateCcw
} from "lucide-react";

interface HospitalItem {
  id: string;
  name: string;
  specialty: string[];
  city: string;
  state: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  latitude: number;
  longitude: number;
  isEmergency24x7: boolean;
  rating: number;
  accreditation: string[];
  distanceKm: number;
  googleMapsUrl: string;
  cancerSpecialistsAvailable?: boolean;
}

const POPULAR_SEARCH_CHIPS = [
  { label: "Cancer / Oncology 🎗️", query: "cancer", type: "specialty" },
  { label: "24/7 Emergency ER 🚨", query: "emergency", type: "specialty" },
  { label: "Cardiology / Heart 🫀", query: "cardiology", type: "specialty" },
  { label: "Pediatrics 👶", query: "pediatrics", type: "specialty" },
  { label: "Hyderabad Hospitals 📍", query: "Hyderabad", type: "city" },
  { label: "Mumbai Hospitals 📍", query: "Mumbai", type: "city" },
  { label: "Delhi NCR Hospitals 📍", query: "Delhi", type: "city" },
  { label: "Bengaluru Hospitals 📍", query: "Bengaluru", type: "city" },
];

export function EmergencyHospitalLocator() {
  const [hospitals, setHospitals] = useState<HospitalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [activeFilterTitle, setActiveFilterTitle] = useState<string>("");

  // Location states
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "success" | "denied">("idle");
  const [locationAddressName, setLocationAddressName] = useState<string>("India (Auto-Sorted by Proximity)");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState<string>("all");
  const ITEMS_PER_PAGE = 6;

  const executeSearch = useCallback(async (queryStr?: string, specialtyStr?: string, coords?: { lat: number; lng: number } | null) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentPage(1);

    const term = queryStr !== undefined ? queryStr : searchQuery;
    setActiveFilterTitle(term || specialtyStr || "All Emergency Facilities");

    try {
      const params = new URLSearchParams();
      if (specialtyStr && specialtyStr !== "all") params.append("specialty", specialtyStr);
      if (term) params.append("query", term);
      if (coords?.lat && coords?.lng) {
        params.append("lat", coords.lat.toString());
        params.append("lng", coords.lng.toString());
      }

      const res = await fetch(`/api/hospitals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to search hospital data");
      const data = await res.json();
      if (data.hospitals) {
        setHospitals(data.hospitals);
      }
    } catch (e: any) {
      console.error("Error searching hospitals:", e);
      setError("Unable to complete hospital search. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Request browser GPS position
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      setError("Geolocation is not supported by your browser. Please search by city.");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lng: longitude };
        setUserCoords(coords);
        setLocationStatus("success");
        setLocationAddressName(`Live GPS (${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°)`);
        executeSearch(searchQuery, "", coords);
      },
      (err) => {
        console.warn("GPS Permission error:", err);
        setLocationStatus("denied");
        setLocationAddressName("Metro Proximity Sort");
        executeSearch(searchQuery, "", null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery, "", userCoords);
  };

  const handleChipClick = (chip: { query: string; type: string; label: string }) => {
    setSearchQuery(chip.query);
    if (chip.type === "specialty") {
      executeSearch("", chip.query, userCoords);
    } else {
      executeSearch(chip.query, "", userCoords);
    }
  };

  const handleResetSearch = () => {
    setHasSearched(false);
    setSearchQuery("");
    setHospitals([]);
    setError(null);
    setCurrentPage(1);
    setSelectedSpecialtyFilter("all");
  };

  // Filter hospitals list based on active sub-filter
  const filteredHospitals = hospitals.filter((hosp) => {
    if (selectedSpecialtyFilter === "24x7") return hosp.isEmergency24x7;
    if (selectedSpecialtyFilter === "oncology")
      return hosp.specialty.some((s) => s.toLowerCase().includes("cancer") || s.toLowerCase().includes("oncology"));
    if (selectedSpecialtyFilter === "cardiology")
      return hosp.specialty.some((s) => s.toLowerCase().includes("cardiology") || s.toLowerCase().includes("heart"));
    if (selectedSpecialtyFilter === "pediatrics")
      return hosp.specialty.some((s) => s.toLowerCase().includes("pediatric"));
    return true;
  });

  const totalPages = Math.ceil(filteredHospitals.length / ITEMS_PER_PAGE) || 1;
  const paginatedHospitals = filteredHospitals.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <section id="nearest-hospitals" className="w-full py-20 bg-[#FAF9F6] border-y border-slate-200/80 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* HEADER SECTION */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 border border-rose-200 px-4 py-1.5 text-xs font-bold text-rose-700 mb-4 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <MapPin className="w-3.5 h-3.5 text-rose-600" />
            <span>Emergency GPS Locator • Search Nearest Hospitals</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Find Specialized Emergency & Cancer Hospitals Near You
          </h2>

          <p className="mt-3 text-base text-slate-500 font-normal leading-relaxed">
            Search any medical condition (e.g. Cancer, Heart Emergency) or City in India to find nearest hospitals sorted by GPS distance.
          </p>
        </div>

        {/* MAIN SEARCH CONTROL BOX */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 mb-8 shadow-lg shadow-slate-900/5 max-w-4xl mx-auto">
          <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row items-stretch gap-3">
            
            {/* GPS Location Button */}
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locationStatus === "locating"}
              className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-300 font-bold text-xs transition-all cursor-pointer shrink-0 disabled:opacity-50"
            >
              <Crosshair className={`w-4 h-4 ${locationStatus === "locating" ? "animate-spin text-cyan-600" : "text-emerald-600"}`} />
              <span>
                {locationStatus === "locating"
                  ? "Locating..."
                  : locationStatus === "success"
                  ? "GPS Active"
                  : "📍 Detect GPS Location"}
              </span>
            </button>

            {/* Input Field */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter medical issue (e.g. Cancer, Heart) or City (e.g. Hyderabad, Mumbai, Delhi)..."
                className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all font-sans"
              />
            </div>

            {/* Search Submit Button */}
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 font-bold text-sm text-white shadow-md transition-all cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Search Hospitals</span>
            </button>
          </form>

          {/* Quick Search Chips */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-400 block mb-2 font-mono uppercase tracking-wider">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SEARCH_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChipClick(chip)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 text-xs font-semibold transition-all cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* INITIAL STATE: SEARCH PROMPT LANDING */}
        {!hasSearched && !loading && (
          <div className="py-12 px-6 bg-white rounded-2xl border border-slate-200/90 max-w-3xl mx-auto text-center shadow-2xs">
            <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Ready to Search Nearest Hospitals
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Enter your specific medical condition or location above, or select one of the quick suggestion chips to view nearest verified hospitals with distance tracking.
            </p>
          </div>
        )}

        {/* RESULTS SECTION WHEN USER HAS SEARCHED */}
        {hasSearched && (
          <div>
            {/* Results Header Status Bar & Category Sub-Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500">Filter Specialty:</span>
                {[
                  { id: "all", label: "All Facilities" },
                  { id: "24x7", label: "24/7 ER Open 🚨" },
                  { id: "oncology", label: "Oncology / Cancer 🎗️" },
                  { id: "cardiology", label: "Cardiology 🫀" },
                  { id: "pediatrics", label: "Pediatrics 👶" },
                ].map((filterBtn) => (
                  <button
                    key={filterBtn.id}
                    onClick={() => {
                      setSelectedSpecialtyFilter(filterBtn.id);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSpecialtyFilter === filterBtn.id
                        ? "bg-cyan-950 text-cyan-300 border border-cyan-800 shadow-2xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                    }`}
                  >
                    {filterBtn.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs text-slate-400 font-mono">
                  ({filteredHospitals.length} facilities found)
                </span>
                <button
                  onClick={handleResetSearch}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 cursor-pointer transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* HOSPITALS GRID / CONTENT */}
            {loading ? (
              <div className="py-16 text-center">
                <div className="inline-block w-8 h-8 border-4 border-slate-900 border-t-cyan-500 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500">Calculating GPS distances and fetching nearby specialty hospitals...</p>
              </div>
            ) : error ? (
              <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center max-w-lg mx-auto">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-rose-800">{error}</p>
              </div>
            ) : filteredHospitals.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
                <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 mb-1">No Matching Hospitals Found</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  No hospital records matched your active filter. Try resetting filters or searching for a city like "Hyderabad", "Mumbai", or "Delhi".
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 6 CARDS PER PAGE GRID WITH SMOOTH MOTION TRANSITION */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${currentPage}-${selectedSpecialtyFilter}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {paginatedHospitals.map((hosp) => (
                      <div
                        key={hosp.id}
                        className="bg-white border border-slate-200/90 hover:border-cyan-500/60 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 group"
                      >
                        <div>
                          {/* Top Distance & Status Badges */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono">
                              <Navigation className="w-3 h-3 text-emerald-600" />
                              <span>{hosp.distanceKm} km away</span>
                            </span>

                            {hosp.isEmergency24x7 && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                <span>24/7 ER Open</span>
                              </span>
                            )}
                          </div>

                          {/* Hospital Name */}
                          <h3 className="text-lg font-bold text-slate-950 group-hover:text-cyan-700 transition-colors leading-snug mb-2">
                            {hosp.name}
                          </h3>

                          {/* Address & City */}
                          <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-4">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{hosp.address}</span>
                          </div>

                          {/* Specialties Badges */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {hosp.specialty.map((spec, i) => (
                              <span
                                key={i}
                                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                                  spec.toLowerCase().includes("cancer") || spec.toLowerCase().includes("oncology")
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {spec}
                              </span>
                            ))}
                          </div>

                          {/* Accreditations */}
                          {hosp.accreditation.length > 0 && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mb-4">
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                              <span>Accreditation: {hosp.accreditation.join(" • ")}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2 mt-2">
                          <a
                            href={`tel:${hosp.emergencyPhone || hosp.phone}`}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>Call ER Hotline</span>
                          </a>

                          <a
                            href={hosp.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-sm"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            <span>Get Directions</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* PAGINATION CONTROLS */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/90 bg-white p-4 rounded-xl shadow-2xs">
                    <span className="text-xs font-mono text-slate-500 font-medium">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                      {Math.min(currentPage * ITEMS_PER_PAGE, filteredHospitals.length)} of {filteredHospitals.length} care facilities
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-bold transition-all cursor-pointer"
                      >
                        ← Previous
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === pageNum
                              ? "bg-slate-950 text-white shadow-2xs"
                              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 text-xs font-bold transition-all cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
