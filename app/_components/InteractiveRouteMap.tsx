"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navigation, ExternalLink, Plus, Minus, Locate, Check, X, MapPin } from "lucide-react";

export interface HospitalItem {
  id: string;
  name: string;
  specialty: string[];
  city: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  matchReasons?: string[];
  matchLabel?: string;
  rating?: number;
  isEmergency24x7?: boolean;
  etaMinutes?: number;
}

export function calculateCalibratedDriveTime(distanceKm: number, rawOsrmSeconds?: number): number {
  if (rawOsrmSeconds && rawOsrmSeconds > 0) {
    const rawMinutes = rawOsrmSeconds / 60;
    // OSRM calculates theoretical free-flow speed limits without traffic signals or congestion.
    // Apply realistic Indian traffic & congestion calibration factor:
    if (distanceKm <= 4) {
      // Dense city traffic: ~18-20 km/h + intersection delays
      return Math.max(4, Math.round(rawMinutes * 1.5 + 2));
    } else if (distanceKm <= 12) {
      // Mixed urban/arterial: ~25-30 km/h
      return Math.max(6, Math.round(rawMinutes * 1.45 + 3));
    } else {
      // Highway corridor + city exit: ~38-45 km/h (23.1 km -> ~37-39 mins)
      return Math.max(10, Math.round(rawMinutes * 1.4 + 4));
    }
  }

  // Fallback if OSRM is offline:
  if (distanceKm <= 4) {
    return Math.max(4, Math.round((distanceKm / 18) * 60));
  } else if (distanceKm <= 12) {
    return Math.max(6, Math.round((distanceKm / 25) * 60));
  } else {
    return Math.max(10, Math.round(13 + ((distanceKm - 4) / 45) * 60));
  }
}

interface InteractiveRouteMapProps {
  patientCoords: { lat: number; lng: number };
  patientLocationName: string;
  selectedHospital: HospitalItem | null;
  allHospitals: HospitalItem[];
  isManualPicking: boolean;
  onSelectHospital: (hospital: HospitalItem) => void;
  onConfirmManualLocation: (lat: number, lng: number) => void;
  onCancelManualPicking: () => void;
  onRouteCalculated?: (info: { roadDistanceKm: number; etaMinutes: number }) => void;
}

export function InteractiveRouteMap({
  patientCoords,
  patientLocationName,
  selectedHospital,
  allHospitals,
  isManualPicking,
  onSelectHospital,
  onConfirmManualLocation,
  onCancelManualPicking,
  onRouteCalculated,
}: InteractiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Track previous coords and hospital to only fitBounds when they actually change
  const prevCoordsRef = useRef<string>("");
  const prevHospitalIdRef = useRef<string>("");

  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    etaMinutes: number;
    roadGeometryAvailable: boolean;
  }>({
    distanceKm: selectedHospital?.distanceKm || 1.1,
    etaMinutes: calculateCalibratedDriveTime(selectedHospital?.distanceKm || 1.1),
    roadGeometryAvailable: false,
  });
  const [isRouting, setIsRouting] = useState<boolean>(false);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = (await import("leaflet")).default;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [patientCoords.lat, patientCoords.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // Standard OpenStreetMap tiles (100% free, zero watermarks)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      if (isMounted) {
        updateMapElements(L, map, true);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync elements whenever selected hospital, allHospitals, or patientCoords change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const coordsKey = `${patientCoords.lat},${patientCoords.lng}`;
    const hospitalKey = selectedHospital?.id || "";

    const shouldFitBounds =
      prevCoordsRef.current !== coordsKey || prevHospitalIdRef.current !== hospitalKey;

    prevCoordsRef.current = coordsKey;
    prevHospitalIdRef.current = hospitalKey;

    import("leaflet").then((LModule) => {
      const L = LModule.default;
      updateMapElements(L, mapInstanceRef.current, shouldFitBounds);
    });
  }, [selectedHospital, allHospitals, patientCoords.lat, patientCoords.lng, isManualPicking]);

  const updateMapElements = async (L: any, map: any, shouldFitBounds: boolean) => {
    if (!map || !markersLayerRef.current || !routeLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    routeLayerRef.current.clearLayers();

    // If currently in manual picking mode, hide the fixed markers while positioning
    if (isManualPicking) {
      return;
    }

    const origin = { lat: patientCoords.lat, lng: patientCoords.lng };

    // 1. USER LOCATION MARKER
    const userPinIcon = L.divIcon({
      className: "custom-user-pin",
      html: `
        <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(2,132,199,0.22); animation:ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position:relative; width:20px; height:20px; border-radius:50%; background:#0284c7; border:3px solid #ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
            <div style="width:5px; height:5px; border-radius:50%; background:#ffffff;"></div>
          </div>
          <div style="position:absolute; top:-20px; white-space:nowrap; background:#0f172a; color:#ffffff; font-family:sans-serif; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; box-shadow:0 2px 6px rgba(0,0,0,0.25);">
            Your Location
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    const userMarker = L.marker([origin.lat, origin.lng], { icon: userPinIcon });
    userMarker.bindPopup(`
      <div style="font-family:sans-serif; padding:4px; line-height:1.4;">
        <b style="color:#0f172a; font-size:12px;">Your Location</b><br/>
        <span style="color:#64748b; font-size:11px;">${patientLocationName}</span>
      </div>
    `);
    markersLayerRef.current.addLayer(userMarker);

    // 2. HOSPITAL DESTINATION MARKERS
    const bounds: [number, number][] = [[origin.lat, origin.lng]];

    allHospitals.forEach((hosp) => {
      const hLat = hosp.latitude;
      const hLng = hosp.longitude;

      if (!hLat || !hLng) return;

      const isSelected = selectedHospital?.id === hosp.id;
      bounds.push([hLat, hLng]);

      const hospIcon = L.divIcon({
        className: "custom-hospital-marker",
        html: `
          <div style="position:relative; width:${isSelected ? "44px" : "32px"}; height:${isSelected ? "44px" : "32px"}; display:flex; align-items:center; justify-content:center; cursor:pointer;">
            ${isSelected ? `<div style="position:absolute; width:40px; height:40px; border-radius:50%; background:rgba(225,29,72,0.25); animation:pulse 2s infinite;"></div>` : ""}
            <div style="position:relative; width:${isSelected ? "32px" : "26px"}; height:${isSelected ? "32px" : "26px"}; border-radius:${isSelected ? "10px" : "8px"}; background:${isSelected ? "#e11d48" : "#ffffff"}; border:2px solid ${isSelected ? "#ffffff" : "#cbd5e1"}; box-shadow:0 3px 10px rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; color:${isSelected ? "#ffffff" : "#e11d48"};">
              <svg width="${isSelected ? "16" : "13"}" height="${isSelected ? "16" : "13"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            ${
              isSelected
                ? `<div style="position:absolute; bottom:-22px; white-space:nowrap; background:#0f172a; color:#ffffff; font-family:sans-serif; font-size:10px; font-weight:700; padding:2px 8px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.25);">
                    ${hosp.name.split("-")[0].trim()} (${hosp.distanceKm} km)
                  </div>`
                : ""
            }
          </div>
        `,
        iconSize: [isSelected ? 44 : 32, isSelected ? 44 : 32],
        iconAnchor: [isSelected ? 22 : 16, isSelected ? 22 : 16],
      });

      const marker = L.marker([hLat, hLng], { icon: hospIcon });
      marker.bindPopup(`
        <div style="font-family:sans-serif; padding:4px; line-height:1.4;">
          <b style="color:#0f172a; font-size:12px;">${hosp.name}</b><br/>
          <span style="color:#e11d48; font-size:11px; font-weight:bold;">${hosp.distanceKm} km away • 24/7 ER</span><br/>
          <span style="color:#64748b; font-size:10px;">${hosp.address}</span>
        </div>
      `);

      marker.on("click", () => {
        onSelectHospital(hosp);
      });

      markersLayerRef.current.addLayer(marker);
    });

    // 3. FETCH & DRAW REAL ROAD ROUTE TO SELECTED HOSPITAL
    if (selectedHospital && selectedHospital.latitude && selectedHospital.longitude) {
      const destination = { lat: selectedHospital.latitude, lng: selectedHospital.longitude };

      setIsRouting(true);

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(3500) });

        let polylinePoints: [number, number][] = [];
        let dist = selectedHospital.distanceKm;
        let dur = calculateCalibratedDriveTime(dist);
        let roadSuccess = false;

        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const geom = data.routes[0].geometry.coordinates;
            polylinePoints = geom.map((coord: [number, number]) => [coord[1], coord[0]]);
            dist = parseFloat((data.routes[0].distance / 1000).toFixed(1)) || dist;
            dur = calculateCalibratedDriveTime(dist, data.routes[0].duration);
            roadSuccess = true;
          }
        }

        if (polylinePoints.length === 0) {
          polylinePoints = [
            [origin.lat, origin.lng],
            [(origin.lat * 2 + destination.lat) / 3, (origin.lng * 2 + destination.lng) / 3],
            [(origin.lat + destination.lat * 2) / 3, (origin.lng + destination.lng * 2) / 3],
            [destination.lat, destination.lng],
          ];
        }

        // Base route glow
        const baseLine = L.polyline(polylinePoints, {
          color: "#0284c7",
          weight: 7,
          opacity: 0.3,
          lineCap: "round",
          lineJoin: "round",
        });

        // Active road polyline
        const mainLine = L.polyline(polylinePoints, {
          color: "#0284c7",
          weight: 4,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
          dashArray: "8, 8",
        });

        routeLayerRef.current.addLayer(baseLine);
        routeLayerRef.current.addLayer(mainLine);

        setRouteInfo({
          distanceKm: dist,
          etaMinutes: dur,
          roadGeometryAvailable: roadSuccess,
        });

        if (onRouteCalculated) {
          onRouteCalculated({ roadDistanceKm: dist, etaMinutes: dur });
        }
      } catch (err) {
        const polylinePoints: [number, number][] = [
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ];
        const line = L.polyline(polylinePoints, {
          color: "#0284c7",
          weight: 4,
          opacity: 0.9,
          dashArray: "6, 6",
        });
        routeLayerRef.current.addLayer(line);
      } finally {
        setIsRouting(false);
      }

      // ONLY fit bounds if explicitly needed (new location or hospital selected)
      if (shouldFitBounds && bounds.length > 1) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    }
  };

  // Custom Controls Handlers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([patientCoords.lat, patientCoords.lng], 14, { duration: 0.8 });
    }
  };

  const handleConfirmCenterLocation = () => {
    if (mapInstanceRef.current) {
      const center = mapInstanceRef.current.getCenter();
      onConfirmManualLocation(center.lat, center.lng);
    }
  };

  // Google Maps URL strictly from origin and destination coordinates
  const directGoogleMapsUrl = selectedHospital
    ? `https://www.google.com/maps/dir/?api=1&origin=${patientCoords.lat},${patientCoords.lng}&destination=${selectedHospital.latitude},${selectedHospital.longitude}&travelmode=driving`
    : "#";

  return (
    <div className="relative w-full h-[460px] sm:h-[520px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
      
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ============================================================ MANUAL POSITIONING MODE OVERLAY */}
      {isManualPicking && (
        <>
          {/* Top Floating Action Bar */}
          <div className="absolute top-4 left-4 right-4 z-20 mx-auto max-w-lg rounded-2xl bg-slate-950 text-white p-3.5 shadow-2xl border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-tight">Move map to position your location</div>
                <div className="text-[11px] text-slate-400 truncate">Align the center marker over your building</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onCancelManualPicking}
                className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCenterLocation}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm</span>
              </button>
            </div>
          </div>

          {/* FIXED CENTER CROSSHAIR PIN (Pointer events none, map moves underneath) */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="relative flex flex-col items-center -translate-y-5">
              {/* Pin Head */}
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 border-2 border-white shadow-2xl text-sky-400">
                <div className="h-3 w-3 rounded-full bg-sky-400" />
              </div>
              {/* Pin Stem */}
              <div className="h-4 w-1 bg-slate-950 rounded-b shadow-sm" />
              {/* Ground Shadow */}
              <div className="h-2 w-4 rounded-full bg-black/30 blur-[1px] mt-0.5" />
            </div>
          </div>
        </>
      )}

      {/* ============================================================ NORMAL ROUTE HUD (WHEN NOT MANUAL PICKING) */}
      {!isManualPicking && (
        <div className="absolute top-4 left-4 z-10 max-w-xs sm:max-w-sm rounded-2xl bg-white/95 text-slate-900 p-4 shadow-xl backdrop-blur-md border border-slate-200 space-y-3 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="font-bold text-xs text-slate-900">
                Emergency Route Summary
              </span>
            </div>
          </div>

          {/* Real Origin & Destination Labels */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start gap-2">
              <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mt-0.5">FROM:</span>
              <span className="font-bold text-slate-900 line-clamp-1">{patientLocationName}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-[10px] font-bold text-rose-500 uppercase tracking-wider shrink-0 mt-0.5">TO:</span>
              <span className="font-bold text-slate-900 line-clamp-1">{selectedHospital?.name}</span>
            </div>
          </div>

          {/* Distance & Time Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ROAD DISTANCE</div>
              <div className="text-xl font-extrabold text-slate-900 flex items-baseline gap-1">
                <span>{routeInfo.distanceKm}</span>
                <span className="text-xs font-bold text-slate-500">km</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">EST. DRIVE (TRAFFIC)</div>
              <div className="text-xl font-extrabold text-emerald-600 flex items-baseline gap-1">
                <span>~{routeInfo.etaMinutes}</span>
                <span className="text-xs font-bold text-slate-500">min</span>
              </div>
            </div>
          </div>

          {selectedHospital && (
            <div className="pt-1">
              <a
                href={directGoogleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white py-2.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <span>Open Live Navigation in Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ CUSTOM FLOATING MAP CONTROLS (BOTTOM RIGHT) */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex flex-col rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-md overflow-hidden divide-y divide-slate-100">
          <button
            onClick={handleZoomIn}
            aria-label="Zoom In"
            className="flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            aria-label="Zoom Out"
            className="flex h-8 w-8 items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRecenter}
          aria-label="Recenter on My Location"
          title="Recenter on My Location"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-sky-600 shadow-md transition-all cursor-pointer"
        >
          <Locate className="w-4 h-4" />
        </button>
      </div>

      {/* ============================================================ MAP LEGEND (BOTTOM LEFT) */}
      <div className="hidden sm:flex absolute bottom-4 left-4 z-10 items-center gap-3 rounded-xl bg-white/95 backdrop-blur-md px-3.5 py-2 text-[11px] font-bold text-slate-700 border border-slate-200 shadow-md pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7] border border-white shadow-xs" />
          <span>Your Location</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded bg-rose-600" />
          <span>Hospital ER</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-4 bg-[#0284c7] rounded-full" />
          <span>Driving Route</span>
        </div>
      </div>

      {/* ROUTING SPINNER */}
      {isRouting && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/90 text-slate-800 border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm backdrop-blur-sm">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
          <span>Calculating route...</span>
        </div>
      )}
    </div>
  );
}
