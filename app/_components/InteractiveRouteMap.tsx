"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Navigation, ExternalLink, Plus, Minus, Locate, Check, MapPin, Building2, Flame } from "lucide-react";
import { getHospitalFamousFor } from "@/lib/hospitals-india-data";

export interface HospitalItem {
  id: string;
  name: string;
  specialty: string[];
  famousFor?: string;
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
  isEligible?: boolean;
  acceptsPublicInsurance?: boolean;
  ownership?: string;
}

export function calculateCalibratedDriveTime(distanceKm: number, rawOsrmSeconds?: number): number {
  if (rawOsrmSeconds && rawOsrmSeconds > 0) {
    const rawMinutes = rawOsrmSeconds / 60;
    if (distanceKm <= 4) {
      return Math.max(4, Math.round(rawMinutes * 1.5 + 2));
    } else if (distanceKm <= 12) {
      return Math.max(6, Math.round(rawMinutes * 1.45 + 3));
    } else {
      return Math.max(10, Math.round(rawMinutes * 1.4 + 4));
    }
  }

  if (distanceKm <= 4) {
    return Math.max(4, Math.round((distanceKm / 18) * 60));
  } else if (distanceKm <= 12) {
    return Math.max(6, Math.round((distanceKm / 25) * 60));
  } else {
    return Math.max(10, Math.round(13 + ((distanceKm - 4) / 45) * 60));
  }
}

export interface InteractiveRouteMapProps {
  patientCoords: { lat: number; lng: number } | null;
  patientLocationName?: string;
  selectedHospital: HospitalItem | null;
  allHospitals: HospitalItem[];
  isManualPicking: boolean;
  onSelectHospital: (hospital: HospitalItem) => void;
  onConfirmManualLocation: (lat: number, lng: number) => void;
  onCancelManualPicking: () => void;
  onRouteCalculated?: (info: { roadDistanceKm: number; etaMinutes: number }) => void;
  onRequestLocation?: () => void;
  mapCenter?: { lat: number; lng: number };
}

/**
 * Generate a realistic road spline between origin and destination
 */
function generateHighwaySpline(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): [number, number][] {
  const points: [number, number][] = [];
  const segments = 12;

  const dLat = dest.lat - origin.lat;
  const dLng = dest.lng - origin.lng;

  const perpLat = -dLng * 0.12;
  const perpLng = dLat * 0.12;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const curve = Math.sin(t * Math.PI);
    const jitter = Math.sin(t * Math.PI * 3) * 0.03;

    const lat = origin.lat + dLat * t + (perpLat * curve) + (perpLat * jitter);
    const lng = origin.lng + dLng * t + (perpLng * curve) + (perpLng * jitter);
    points.push([lat, lng]);
  }

  return points;
}

export function InteractiveRouteMap({
  patientCoords,
  patientLocationName = "Your departure location",
  selectedHospital,
  allHospitals,
  isManualPicking,
  onSelectHospital,
  onConfirmManualLocation,
  onCancelManualPicking,
  onRouteCalculated,
  onRequestLocation,
  mapCenter,
}: InteractiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const prevHospitalIdRef = useRef<string | null>(null);
  const prevCoordsRef = useRef<string | null>(null);

  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    etaMinutes: number;
    roadGeometryAvailable: boolean;
  }>({
    distanceKm: 0,
    etaMinutes: 0,
    roadGeometryAvailable: false,
  });

  const [isRouting, setIsRouting] = useState<boolean>(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const routingRequestIdRef = useRef<number>(0);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetches real OSRM road geometry or falls back to spline
   */
  const drawRouteToHospital = useCallback(
    async (
      L: any,
      map: any,
      targetHospital: HospitalItem,
      autoFrame: boolean = true
    ) => {
      if (
        !map ||
        !routeLayerRef.current ||
        !L ||
        !patientCoords ||
        !Number.isFinite(patientCoords.lat) ||
        !Number.isFinite(patientCoords.lng)
      ) {
        if (routeLayerRef.current) routeLayerRef.current.clearLayers();
        setIsRouting(false);
        return;
      }

      const currentId = ++routingRequestIdRef.current;

      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }

      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }

      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;

      routeLayerRef.current.clearLayers();

      const origin = { lat: patientCoords.lat, lng: patientCoords.lng };
      const destination = { lat: targetHospital.latitude, lng: targetHospital.longitude };

      // 1. Instant preview spline in cyan (#22D3EE)
      const previewPoints = generateHighwaySpline(origin, destination);
      let dist = targetHospital.distanceKm;
      let dur = calculateCalibratedDriveTime(dist);

      const previewGlowLine = L.polyline(previewPoints, {
        color: "#22D3EE",
        weight: 7,
        opacity: 0.2,
        lineCap: "round",
        lineJoin: "round",
      });

      const previewCoreLine = L.polyline(previewPoints, {
        color: "#22D3EE",
        weight: 3.5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "6, 6",
      });

      routeLayerRef.current.addLayer(previewGlowLine);
      routeLayerRef.current.addLayer(previewCoreLine);

      if (autoFrame && previewPoints.length > 1) {
        const bounds = L.latLngBounds([
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
      }

      setRouteInfo({
        distanceKm: dist,
        etaMinutes: dur,
        roadGeometryAvailable: false,
      });

      if (onRouteCalculated) {
        onRouteCalculated({ roadDistanceKm: dist, etaMinutes: dur });
      }

      setIsRouting(true);

      safetyTimeoutRef.current = setTimeout(() => {
        if (routingRequestIdRef.current === currentId) {
          setIsRouting(false);
        }
      }, 5000);

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl, { signal: abortController.signal });

        if (routingRequestIdRef.current !== currentId) return;

        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const primaryRoute = data.routes[0];
            const coordinates = primaryRoute.geometry.coordinates;
            const roadPoints: [number, number][] = coordinates.map((c: [number, number]) => [c[1], c[0]]);

            dist = Math.round((primaryRoute.distance / 1000) * 10) / 10;
            dur = calculateCalibratedDriveTime(dist, primaryRoute.duration);

            routeLayerRef.current.clearLayers();

            const roadGlow = L.polyline(roadPoints, {
              color: "#22D3EE",
              weight: 8,
              opacity: 0.25,
              lineCap: "round",
              lineJoin: "round",
            });

            const roadCore = L.polyline(roadPoints, {
              color: "#22D3EE",
              weight: 4,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            });

            routeLayerRef.current.addLayer(roadGlow);
            routeLayerRef.current.addLayer(roadCore);

            if (autoFrame && roadPoints.length > 1) {
              map.fitBounds(L.latLngBounds(roadPoints), { padding: [60, 60], maxZoom: 15, animate: true });
            }

            setRouteInfo({
              distanceKm: dist,
              etaMinutes: dur,
              roadGeometryAvailable: true,
            });

            if (onRouteCalculated) {
              onRouteCalculated({ roadDistanceKm: dist, etaMinutes: dur });
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[InteractiveRouteMap] Road route preview geometry active:", err.message);
        }
      } finally {
        if (routingRequestIdRef.current === currentId) {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
          activeAbortControllerRef.current = null;
          setIsRouting(false);
        }
      }
    },
    [patientCoords?.lat, patientCoords?.lng, onRouteCalculated]
  );

  /**
   * Renders User Location and Hospital Destination Markers in Dark Theme
   */
  const renderMarkers = useCallback(
    (L: any, map: any) => {
      if (!map || !markersLayerRef.current || !L) return;

      markersLayerRef.current.clearLayers();

      if (isManualPicking) return;

      // 1. USER LOCATION MARKER
      if (patientCoords && Number.isFinite(patientCoords.lat) && Number.isFinite(patientCoords.lng)) {
        const origin = { lat: patientCoords.lat, lng: patientCoords.lng };
        const userPinIcon = L.divIcon({
          className: "custom-user-pin",
          html: `
            <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(34,211,238,0.25); animation:ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position:relative; width:20px; height:20px; border-radius:50%; background:#22D3EE; border:2.5px solid #070A0F; box-shadow:0 0 12px rgba(34,211,238,0.6); display:flex; align-items:center; justify-content:center;">
                <div style="width:6px; height:6px; border-radius:50%; background:#070A0F;"></div>
              </div>
              <div style="position:absolute; top:-22px; white-space:nowrap; background:#0D121A; color:#22D3EE; font-family:sans-serif; font-size:10px; font-weight:700; padding:2px 8px; border-radius:6px; border:1px solid rgba(34,211,238,0.3); box-shadow:0 4px 10px rgba(0,0,0,0.5); pointer-events:none;">
                Your Location
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const userMarker = L.marker([origin.lat, origin.lng], { icon: userPinIcon, zIndexOffset: 1000 });
        userMarker.bindPopup(`
          <div style="font-family:sans-serif; padding:6px; background:#0D121A; color:#F4F7FA; border-radius:8px;">
            <b style="color:#22D3EE; font-size:12px;">Departure Location</b><br/>
            <span style="color:#8B98A8; font-size:11px;">${patientLocationName}</span>
          </div>
        `);
        markersLayerRef.current.addLayer(userMarker);
      }

      // Expose click helper for popup navigation
      (window as any).medvoiceSelectHospitalById = (hospId: string) => {
        const found = allHospitals.find((h) => h.id === hospId);
        if (found) onSelectHospital(found);
      };

      // 2. HOSPITAL DESTINATION MARKERS
      allHospitals.forEach((hosp) => {
        const hLat = hosp.latitude;
        const hLng = hosp.longitude;
        if (!hLat || !hLng) return;

        const isSelected = selectedHospital?.id === hosp.id;
        const isEligible = Boolean(hosp.isEligible);
        const famousFor = hosp.famousFor || getHospitalFamousFor(hosp);
        const shortName = hosp.name.split("-")[0].split("(")[0].trim();

        // Dark Luxury Marker Palette
        const pinBg = isSelected
          ? (hosp.isEmergency24x7 ? "#FB7185" : "#22D3EE")
          : isEligible
          ? "#111923"
          : "#0D121A";
        const pinBorder = isSelected
          ? "#FFFFFF"
          : isEligible
          ? "rgba(34,211,238,0.4)"
          : "rgba(255,255,255,0.12)";
        const iconColor = isSelected
          ? "#070A0F"
          : isEligible
          ? "#22D3EE"
          : "#8B98A8";

        const hospIcon = L.divIcon({
          className: "custom-hospital-marker",
          html: `
            <div style="position:relative; width:${isSelected ? "38px" : "24px"}; height:${isSelected ? "38px" : "24px"}; display:flex; align-items:center; justify-content:center; cursor:pointer; ${isSelected ? "z-index:1000;" : "opacity:0.85;"}">
              ${isSelected ? `<div style="position:absolute; width:38px; height:38px; border-radius:50%; background:${hosp.isEmergency24x7 ? "rgba(251,113,133,0.3)" : "rgba(34,211,238,0.3)"}; animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>` : ""}
              <div style="position:relative; width:${isSelected ? "28px" : "20px"}; height:${isSelected ? "28px" : "20px"}; border-radius:${isSelected ? "8px" : "6px"}; background:${pinBg}; border:${isSelected ? "2px" : "1.5px"} solid ${pinBorder}; box-shadow:${isSelected ? "0 0 16px rgba(34,211,238,0.5)" : "0 2px 6px rgba(0,0,0,0.4)"}; display:flex; align-items:center; justify-content:center; color:${iconColor};">
                <svg width="${isSelected ? "14" : "10"}" height="${isSelected ? "14" : "10"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </div>
              ${isSelected
                ? `<div style="position:absolute; bottom:-46px; left:50%; transform:translateX(-50%); white-space:nowrap; background:#0D121A; color:#F4F7FA; font-family:sans-serif; padding:4px 9px; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.6); z-index:9999; border:1px solid rgba(34,211,238,0.4); pointer-events:none;">
                      <div style="font-size:11px; font-weight:700; color:#F4F7FA; display:flex; align-items:center; gap:5px; line-height:1.2;">
                        <span>${shortName}</span> <span style="color:#22D3EE; font-weight:600;">(${hosp.distanceKm} km)</span>
                      </div>
                      <div style="font-size:9.5px; font-weight:600; color:#8B98A8; margin-top:2px; line-height:1.2;">
                        ${famousFor}
                      </div>
                    </div>`
                : ""
              }
            </div>
          `,
          iconSize: [isSelected ? 38 : 24, isSelected ? 38 : 24],
          iconAnchor: [isSelected ? 19 : 12, isSelected ? 19 : 12],
        });

        const marker = L.marker([hLat, hLng], {
          icon: hospIcon,
          zIndexOffset: isSelected ? 1200 : isEligible ? 400 : 100,
        });

        // Hover Tooltip in dark theme
        marker.bindTooltip(
          `
          <div style="font-family:sans-serif; padding:4px 6px; line-height:1.35; max-width:240px; background:#0D121A; color:#F4F7FA; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
            <b style="color:#F4F7FA; font-size:11px; display:block;">${hosp.name}</b>
            <div style="margin:2px 0; font-size:9.5px; color:#22D3EE; font-weight:600;">${famousFor}</div>
            <span style="color:#8B98A8; font-size:9.5px;">${hosp.distanceKm} km away • ${hosp.isEmergency24x7 ? "24/7 Emergency Care" : "Specialty Center"}</span>
          </div>
        `,
          { direction: "top", offset: [0, -16], opacity: 0.98, className: "custom-dark-tooltip" }
        );

        // Click popup in dark theme
        marker.bindPopup(`
          <div style="font-family:sans-serif; padding:6px; line-height:1.4; max-width:260px; background:#0D121A; color:#F4F7FA;">
            <b style="color:#F4F7FA; font-size:12px; display:block; margin-bottom:4px;">${hosp.name}</b>
            <div style="display:inline-block; margin-bottom:5px; background:rgba(34,211,238,0.1); color:#22D3EE; border:1px solid rgba(34,211,238,0.3); font-size:10px; font-weight:600; padding:2px 7px; border-radius:5px;">
              ${famousFor}
            </div>
            <div style="color:${hosp.isEmergency24x7 ? "#FB7185" : "#22D3EE"}; font-size:11px; font-weight:600; margin-bottom:3px;">
              ${hosp.distanceKm} km away • ${hosp.isEmergency24x7 ? "24/7 Verified Emergency" : "Care Center"}
            </div>
            <div style="color:#8B98A8; font-size:10px; line-height:1.3; margin-bottom:8px;">${hosp.address}</div>
            <button 
              onclick="window.medvoiceSelectHospitalById('${hosp.id}')"
              style="width:100%; background:#22D3EE; color:#070A0F; font-weight:700; font-size:11px; padding:7px 10px; border-radius:8px; border:none; cursor:pointer;"
            >
              Set as Destination
            </button>
          </div>
        `);

        marker.on("click", () => {
          onSelectHospital(hosp);
        });

        markersLayerRef.current.addLayer(marker);
      });
    },
    [patientCoords?.lat, patientCoords?.lng, patientLocationName, isManualPicking, selectedHospital?.id, allHospitals, onSelectHospital]
  );

  // Initialize Leaflet Map on Mount with CartoDB Dark Matter tiles
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = (await import("leaflet")).default;
      leafletRef.current = L;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      if (!mapContainerRef.current || !isMounted) return;

      const initialCenter: [number, number] =
        patientCoords && Number.isFinite(patientCoords.lat) && Number.isFinite(patientCoords.lng)
          ? [patientCoords.lat, patientCoords.lng]
          : mapCenter && Number.isFinite(mapCenter.lat) && Number.isFinite(mapCenter.lng)
          ? [mapCenter.lat, mapCenter.lng]
          : selectedHospital
          ? [selectedHospital.latitude, selectedHospital.longitude]
          : [20.5937, 78.9629];

      const initialZoom = patientCoords ? 14 : selectedHospital ? 13 : 5;

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      });

      // CartoDB Dark Matter tiles (free, dark luxury aesthetic)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 100);

      renderMarkers(L, map);

      if (
        selectedHospital &&
        selectedHospital.latitude &&
        selectedHospital.longitude &&
        patientCoords &&
        Number.isFinite(patientCoords.lat) &&
        Number.isFinite(patientCoords.lng)
      ) {
        prevHospitalIdRef.current = selectedHospital.id;
        prevCoordsRef.current = `${patientCoords.lat},${patientCoords.lng}`;
        drawRouteToHospital(L, map, selectedHospital, true);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when hospital list or selection changes
  useEffect(() => {
    if (leafletRef.current && mapInstanceRef.current) {
      renderMarkers(leafletRef.current, mapInstanceRef.current);
    }
  }, [allHospitals, selectedHospital?.id, patientCoords?.lat, patientCoords?.lng, renderMarkers]);

  // Recalculate route when selection or patient coordinates change
  useEffect(() => {
    if (!leafletRef.current || !mapInstanceRef.current) return;

    const currentCoords = patientCoords ? `${patientCoords.lat},${patientCoords.lng}` : null;
    const coordsChanged = currentCoords !== prevCoordsRef.current;
    const hospChanged = selectedHospital?.id !== prevHospitalIdRef.current;

    if (
      selectedHospital &&
      selectedHospital.latitude &&
      selectedHospital.longitude &&
      patientCoords &&
      Number.isFinite(patientCoords.lat) &&
      Number.isFinite(patientCoords.lng) &&
      (coordsChanged || hospChanged)
    ) {
      prevHospitalIdRef.current = selectedHospital.id;
      prevCoordsRef.current = currentCoords;
      drawRouteToHospital(leafletRef.current, mapInstanceRef.current, selectedHospital, true);
    } else if (!selectedHospital || !patientCoords) {
      if (routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      }
      prevHospitalIdRef.current = null;
    }
  }, [selectedHospital?.id, patientCoords?.lat, patientCoords?.lng, drawRouteToHospital]);

  // Map Controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    if (patientCoords && Number.isFinite(patientCoords.lat) && Number.isFinite(patientCoords.lng)) {
      mapInstanceRef.current.setView([patientCoords.lat, patientCoords.lng], 14, { animate: true });
    } else if (selectedHospital) {
      mapInstanceRef.current.setView([selectedHospital.latitude, selectedHospital.longitude], 14, { animate: true });
    }
  };

  const handleConfirmCenterLocation = () => {
    if (!mapInstanceRef.current) return;
    const center = mapInstanceRef.current.getCenter();
    onConfirmManualLocation(center.lat, center.lng);
  };

  const directGoogleMapsUrl =
    selectedHospital && patientCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${patientCoords.lat},${patientCoords.lng}&destination=${selectedHospital.latitude},${selectedHospital.longitude}&travelmode=driving`
      : selectedHospital
      ? `https://www.google.com/maps/search/?api=1&query=${selectedHospital.latitude},${selectedHospital.longitude}`
      : "#";

  return (
    <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[640px] rounded-2xl overflow-hidden bg-[#070A0F] border border-white/[0.08] shadow-2xl">
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* MANUAL POSITIONING MODE OVERLAY */}
      {isManualPicking && (
        <>
          <div className="absolute top-4 left-4 right-4 z-20 mx-auto max-w-lg rounded-2xl bg-[#0D121A]/95 text-white p-3.5 shadow-2xl border border-white/10 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-tight">Move map to position your location</div>
                <div className="text-[11px] text-slate-400 truncate">Align the center reticle over your departure point</div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onCancelManualPicking}
                className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCenterLocation}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm</span>
              </button>
            </div>
          </div>

          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="relative flex flex-col items-center -translate-y-5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#070A0F] border-2 border-cyan-400 shadow-2xl text-cyan-400">
                <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="h-4 w-1 bg-cyan-400 rounded-b shadow-sm" />
              <div className="h-2 w-4 rounded-full bg-black/60 blur-[1px] mt-0.5" />
            </div>
          </div>
        </>
      )}

      {/* COMPACT LIVE ROUTE PILL */}
      {!isManualPicking && patientCoords && selectedHospital && (
        <div className="absolute top-3.5 left-3.5 z-10 max-w-[280px] sm:max-w-[310px] rounded-xl bg-[#0D121A]/90 backdrop-blur-md border border-white/10 shadow-xl p-3 text-xs text-[#F4F7FA] pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Active Route
              </span>
            </div>
            {isRouting ? (
              <span className="text-[10px] font-semibold text-cyan-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
                Calculating...
              </span>
            ) : (
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                Live Turn-by-Turn
              </span>
            )}
          </div>

          <div className="font-semibold text-white truncate text-xs mt-1.5 leading-snug" title={selectedHospital.name}>
            {selectedHospital.name}
          </div>

          <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-white/[0.08]">
            <span className="font-bold text-white">
              {routeInfo.distanceKm} km <span className="text-slate-500 font-normal">·</span> ~{routeInfo.etaMinutes} min
            </span>
            <a
              href={directGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span>Navigation</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}

      {/* LOCATION REQUIRED OVERLAY */}
      {!isManualPicking && !patientCoords && allHospitals.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-[#070A0F]/70 backdrop-blur-sm pointer-events-none">
          <div className="bg-[#0D121A]/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl p-6 max-w-sm text-center flex flex-col items-center gap-3.5 pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Location Needed</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Allow location to discover nearby accredited emergency hospitals, calculate drive times, and rank capabilities.
              </p>
            </div>
            {onRequestLocation && (
              <button
                onClick={onRequestLocation}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Locate className="w-3.5 h-3.5" />
                <span>Detect my location</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* MAP CONTROLS */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex flex-col rounded-xl bg-[#0D121A]/90 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden divide-y divide-white/[0.08]">
          <button
            onClick={handleZoomIn}
            aria-label="Zoom In"
            className="flex h-8 w-8 items-center justify-center text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            aria-label="Zoom Out"
            className="flex h-8 w-8 items-center justify-center text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRecenter}
          aria-label="Recenter on My Location"
          title="Recenter on My Location"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0D121A]/90 backdrop-blur-md border border-white/10 text-slate-200 hover:bg-white/[0.08] hover:text-cyan-400 shadow-lg transition-all cursor-pointer"
        >
          <Locate className="w-4 h-4" />
        </button>
      </div>

      {/* MAP LEGEND */}
      <div className="hidden sm:flex absolute bottom-3.5 left-3.5 z-10 items-center gap-2.5 rounded-lg bg-[#0D121A]/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-slate-400 border border-white/10 shadow-lg pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-xs" />
          <span>Patient</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-rose-400" />
          <span>Recommended ER</span>
        </div>
        <span className="text-white/20">|</span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-3.5 bg-cyan-400 rounded-full" />
          <span>Road Route</span>
        </div>
      </div>

      {/* TOP-RIGHT ROUTING NOTIFICATION */}
      {isRouting && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[#0D121A]/95 text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span>Calculating road route...</span>
        </div>
      )}
    </div>
  );
}

export default InteractiveRouteMap;
