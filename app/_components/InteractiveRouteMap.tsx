"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Navigation, ExternalLink, Plus, Minus, Locate, Check, MapPin } from "lucide-react";
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
  mapCenter?: { lat: number; lng: number };
  onRequestLocation?: () => void;
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
  mapCenter,
  onRequestLocation,
}: InteractiveRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const hospitalMarkersMapRef = useRef<Map<string, { marker: any; hosp: HospitalItem }>>(new Map());

  // Track sequence ID to cancel older routing requests and prevent race conditions
  const routingRequestIdRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Helper to generate natural bezier highway spline between coordinates
  function generateHighwaySpline(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): [number, number][] {
    const steps = 16;
    const points: [number, number][] = [];
    const midLat = (origin.lat + destination.lat) / 2;
    const midLng = (origin.lng + destination.lng) / 2;
    const dLat = destination.lat - origin.lat;
    const dLng = destination.lng - origin.lng;
    const perpLat = -dLng * 0.08;
    const perpLng = dLat * 0.08;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat =
        (1 - t) * (1 - t) * origin.lat + 2 * (1 - t) * t * (midLat + perpLat) + t * t * destination.lat;
      const lng =
        (1 - t) * (1 - t) * origin.lng + 2 * (1 - t) * t * (midLng + perpLng) + t * t * destination.lng;
      points.push([parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))]);
    }
    return points;
  }

  function createHospitalIcon(L: any, hosp: HospitalItem, isSelected: boolean) {
    const isEligible = Boolean(hosp.isEligible);
    const famousFor = hosp.famousFor || getHospitalFamousFor(hosp);
    const shortName = hosp.name.split("-")[0].split("(")[0].trim();

    const pinBg = isSelected
      ? (hosp.isEmergency24x7 ? "#B42318" : "#0F6B6D")
      : isEligible
      ? "#FBF7EE"
      : "#FFFFFF";
    const pinBorder = isSelected
      ? "#FFFFFF"
      : isEligible
      ? "#B79A63"
      : "#CBD5E1";
    const iconColor = isSelected
      ? "#FFFFFF"
      : isEligible
      ? "#B79A63"
      : "#64748B";

    return L.divIcon({
      className: "custom-hospital-marker",
      html: `
        <div style="position:relative; width:${isSelected ? "44px" : "28px"}; height:${isSelected ? "44px" : "28px"}; display:flex; align-items:center; justify-content:center; cursor:pointer; ${isSelected ? "z-index:1000;" : "opacity:0.85;"}">
          ${isSelected ? `<div style="position:absolute; width:44px; height:44px; border-radius:50%; background:${hosp.isEmergency24x7 ? "rgba(180,35,24,0.25)" : "rgba(15,107,109,0.25)"}; animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>` : ""}
          <div style="position:relative; width:${isSelected ? "34px" : "22px"}; height:${isSelected ? "34px" : "22px"}; border-radius:${isSelected ? "10px" : "6px"}; background:${pinBg}; border:${isSelected ? "2.5px" : "1.5px"} solid ${pinBorder}; box-shadow:${isSelected ? "0 4px 14px rgba(23,32,38,0.28)" : "0 1px 3px rgba(0,0,0,0.1)"}; display:flex; align-items:center; justify-content:center; color:${iconColor};">
            ${isSelected
              ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`
              : isEligible
              ? `<span style="font-size:10px; line-height:1;">★</span>`
              : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`
            }
          </div>
          ${isSelected
          ? `<div style="position:absolute; bottom:-48px; left:50%; transform:translateX(-50%); white-space:nowrap; background:#ffffff; color:#172026; font-family:system-ui,-apple-system,sans-serif; padding:4px 9px; border-radius:8px; box-shadow:0 4px 14px rgba(23,32,38,0.18); z-index:9999; border:1px solid #E5E3DC; pointer-events:none;">
                  <div style="font-size:11px; font-weight:700; color:#172026; display:flex; align-items:center; gap:4px; line-height:1.2;">
                    <span>🏥</span> ${shortName} <span style="color:#0F6B6D; font-weight:600;">(${hosp.distanceKm} km)</span>
                  </div>
                  <div style="font-size:9.5px; font-weight:600; color:#8C6D32; background:#FBF7EE; border:1px solid #E7DBB8; padding:1px 5px; border-radius:4px; margin-top:2px; line-height:1.2; display:inline-block;">
                    ★ ${famousFor}
                  </div>
                </div>`
          : ""
        }
        </div>
      `,
      iconSize: [isSelected ? 44 : 28, isSelected ? 44 : 28],
      iconAnchor: [isSelected ? 22 : 14, isSelected ? 22 : 14],
    });
  }

  function createPopupHtml(hosp: HospitalItem, origin?: { lat: number; lng: number } | null) {
    const famousFor = hosp.famousFor || getHospitalFamousFor(hosp);
    const googleMapsUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${hosp.latitude},${hosp.longitude}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${hosp.latitude},${hosp.longitude}`;
    const emergencyNum = hosp.emergencyPhone || hosp.phone || "108";

    return `
      <div style="font-family:system-ui,-apple-system,sans-serif; padding:8px 6px; line-height:1.4; max-width:270px; color:#172026;">
        <b style="font-size:13px; font-weight:700; color:#172026; display:block; margin-bottom:4px; line-height:1.3;">${hosp.name}</b>
        <div style="display:inline-block; margin-bottom:6px; background:#FBF7EE; color:#8C6D32; border:1px solid #E7DBB8; font-size:10px; font-weight:600; padding:2px 7px; border-radius:5px;">
          ★ ${famousFor}
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600; margin-bottom:4px; color:${hosp.isEmergency24x7 ? "#B42318" : "#0F6B6D"};">
          <span>~${hosp.distanceKm} km</span>
          <span style="color:#A8B7A1;">•</span>
          <span>${hosp.isEmergency24x7 ? "24/7 Emergency Care" : "Specialty Center"}</span>
        </div>
        <div style="color:#5A6B75; font-size:10.5px; line-height:1.35; margin-bottom:10px;">${hosp.address}</div>
        <div style="display:flex; gap:6px;">
          <a
            href="tel:${emergencyNum}"
            style="flex:1; text-align:center; background:#B42318; color:#ffffff; font-weight:600; font-size:11px; padding:7px 8px; border-radius:8px; text-decoration:none; display:inline-block;"
          >
            Call ED
          </a>
          <a
            href="${googleMapsUrl}"
            target="_blank"
            rel="noopener noreferrer"
            style="flex:1; text-align:center; background:#172026; color:#ffffff; font-weight:600; font-size:11px; padding:7px 8px; border-radius:8px; text-decoration:none; display:inline-block;"
          >
            Directions
          </a>
        </div>
      </div>
    `;
  }

  // Draw driving route from user coordinates to selected hospital
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

      // Abort previous in-flight fetch immediately
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

      // Clear previous route lines immediately
      routeLayerRef.current.clearLayers();

      const origin = { lat: patientCoords.lat, lng: patientCoords.lng };
      const destination = { lat: targetHospital.latitude, lng: targetHospital.longitude };

      // 1. INSTANT FAST PREVIEW ROAD SPLINE (0ms latency visual feedback)
      const previewPoints = generateHighwaySpline(origin, destination);
      let dist = targetHospital.distanceKm;
      let dur = calculateCalibratedDriveTime(dist);

      const previewGlowLine = L.polyline(previewPoints, {
        color: "#0F6B6D",
        weight: 7,
        opacity: 0.2,
        lineCap: "round",
        lineJoin: "round",
      });

      const previewCoreLine = L.polyline(previewPoints, {
        color: "#0F6B6D",
        weight: 4,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
        dashArray: "6, 6",
      });

      routeLayerRef.current.addLayer(previewGlowLine);
      routeLayerRef.current.addLayer(previewCoreLine);

      if (autoFrame && previewPoints.length > 1) {
        if (map.invalidateSize) map.invalidateSize();
        const bounds = L.latLngBounds([
          [origin.lat, origin.lng],
          [destination.lat, destination.lng],
        ]);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
        }
      }

      // Immediately show route stats
      setRouteInfo({
        distanceKm: dist,
        etaMinutes: dur,
        roadGeometryAvailable: false,
      });

      setIsRouting(true);

      // GUARANTEE: Safety timer ensures calculating indicator can NEVER get stuck
      safetyTimeoutRef.current = setTimeout(() => {
        if (routingRequestIdRef.current === currentId) {
          setIsRouting(false);
        }
      }, 2500);

      try {
        // 2. Fetch turn-by-turn road route from /api/route (proxying OSRM with local fallback)
        const routeUrl = `/api/route?fromLat=${origin.lat}&fromLng=${origin.lng}&toLat=${destination.lat}&toLng=${destination.lng}`;
        const res = await fetch(routeUrl, {
          signal: abortController.signal,
        });

        if (res.ok) {
          const data = await res.json();
          // Check if this request is still the most recent one
          if (routingRequestIdRef.current === currentId && data.success && Array.isArray(data.coordinates) && data.coordinates.length > 1) {
            const roadPoints: [number, number][] = data.coordinates;
            dist = data.roadDistanceKm || dist;
            dur = data.etaMinutes || dur;

            // Clear preview and draw accurate turn-by-turn geometry
            routeLayerRef.current.clearLayers();

            const roadGlow = L.polyline(roadPoints, {
              color: "#0F6B6D",
              weight: 7,
              opacity: 0.22,
              lineCap: "round",
              lineJoin: "round",
            });

            const roadCore = L.polyline(roadPoints, {
              color: "#0F6B6D",
              weight: 4.5,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            });

            routeLayerRef.current.addLayer(roadGlow);
            routeLayerRef.current.addLayer(roadCore);

            if (autoFrame && roadPoints.length > 1) {
              if (map.invalidateSize) map.invalidateSize();
              const roadBounds = L.latLngBounds(roadPoints);
              if (roadBounds.isValid()) {
                map.fitBounds(roadBounds, { padding: [60, 60], maxZoom: 15, animate: true });
              }
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
          console.warn("[InteractiveRouteMap] Road route using preview geometry:", err.message);
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

  // Renders User Location and Hospital Destination Markers
  const renderMarkers = useCallback(
    (L: any, map: any) => {
      if (!map || !markersLayerRef.current || !L) return;

      markersLayerRef.current.clearLayers();
      hospitalMarkersMapRef.current.clear();

      if (isManualPicking) return;

      // 1. USER LOCATION MARKER (Render ONLY when patientCoords is non-null and valid)
      if (patientCoords && Number.isFinite(patientCoords.lat) && Number.isFinite(patientCoords.lng)) {
        const origin = { lat: patientCoords.lat, lng: patientCoords.lng };
        const userPinIcon = L.divIcon({
          className: "custom-user-pin",
          html: `
            <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(15,107,109,0.2); animation:ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position:relative; width:20px; height:20px; border-radius:50%; background:#0F6B6D; border:2.5px solid #ffffff; box-shadow:0 2px 8px rgba(23,32,38,0.25); display:flex; align-items:center; justify-content:center;">
                <div style="width:5px; height:5px; border-radius:50%; background:#ffffff;"></div>
              </div>
              <div style="position:absolute; top:-22px; white-space:nowrap; background:#172026; color:#ffffff; font-family:sans-serif; font-size:10px; font-weight:600; padding:2px 7px; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.2); pointer-events:none;">
                Your location
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const userMarker = L.marker([origin.lat, origin.lng], { icon: userPinIcon, zIndexOffset: 1000 });
        userMarker.bindPopup(`
          <div style="font-family:sans-serif; padding:4px; line-height:1.4;">
            <b style="color:#172026; font-size:12px;">📍 Your location</b><br/>
            <span style="color:#5A6B75; font-size:11px;">${patientLocationName}</span>
          </div>
        `);
        markersLayerRef.current.addLayer(userMarker);
      }

      // Expose click helper for popup navigation
      (window as any).medvoiceSelectHospitalById = (hospId: string) => {
        const found = allHospitals.find((h) => h.id === hospId);
        if (found) onSelectHospital(found);
      };

      // 2. HOSPITAL DESTINATION MARKERS (Restrained, low noise, selected is primary)
      allHospitals.forEach((hosp) => {
        const hLat = hosp.latitude;
        const hLng = hosp.longitude;
        if (!hLat || !hLng) return;

        const isSelected = selectedHospital?.id === hosp.id;
        const hospIcon = createHospitalIcon(L, hosp, isSelected);

        const marker = L.marker([hLat, hLng], {
          icon: hospIcon,
          zIndexOffset: isSelected ? 1400 : hosp.isEligible ? 400 : 100,
        });

        const famousFor = hosp.famousFor || getHospitalFamousFor(hosp);

        // Hover tooltip
        marker.bindTooltip(
          `
          <div style="font-family:system-ui,-apple-system,sans-serif; padding:3px 5px; line-height:1.35; max-width:240px;">
            <b style="color:#172026; font-size:11px; display:block;">${hosp.name}</b>
            <div style="margin:2px 0; display:inline-block; background:#FBF7EE; color:#8C6D32; border:1px solid #E7DBB8; font-size:9.5px; font-weight:600; padding:1px 5px; border-radius:4px;">
              ★ ${famousFor}
            </div><br/>
            <span style="color:#5A6B75; font-size:9.5px;">${hosp.distanceKm} km away • ${hosp.isEmergency24x7 ? "24/7 Emergency Care" : "Specialty Center"}</span>
          </div>
        `,
          { direction: "top", offset: [0, -16], opacity: 0.96 }
        );

        // Click popup
        marker.bindPopup(createPopupHtml(hosp, patientCoords));

        // Clicking marker immediately selects this hospital and changes route
        marker.on("click", (e: any) => {
          if (L.DomEvent) L.DomEvent.stopPropagation(e);
          onSelectHospital(hosp);
        });

        hospitalMarkersMapRef.current.set(hosp.id, { marker, hosp });
        markersLayerRef.current.addLayer(marker);
      });
    },
    [patientCoords?.lat, patientCoords?.lng, patientLocationName, isManualPicking, allHospitals, onSelectHospital]
  );

  // Initialize Leaflet Map on Mount
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

      // Standard OpenStreetMap tiles (100% free, zero watermarks)
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Map click: if user clicks near any hospital marker, select it smoothly
      map.on("click", (e: any) => {
        if (isManualPicking) return;
        const clickPoint = e.layerPoint;
        let closestHosp: HospitalItem | null = null;
        let minDistancePx = 30;

        hospitalMarkersMapRef.current.forEach(({ marker, hosp }) => {
          const markerPoint = map.latLngToLayerPoint(marker.getLatLng());
          const distPx = clickPoint.distanceTo(markerPoint);
          if (distPx < minDistancePx) {
            minDistancePx = distPx;
            closestHosp = hosp;
          }
        });

        if (closestHosp) {
          onSelectHospital(closestHosp);
        }
      });

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);

      // Leaflet layout invalidation to ensure crisp rendering
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
      leafletRef.current = null;
    };
  }, []);

  // Update Markers Layer ONLY when allHospitals or patientCoords or isManualPicking changes
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    renderMarkers(leafletRef.current, mapInstanceRef.current);
  }, [renderMarkers]);

  // Update Route & Marker Selection Highlights without rebuilding layer
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    // 1. Update marker visual highlights and popup state
    hospitalMarkersMapRef.current.forEach(({ marker, hosp }) => {
      const isSelected = selectedHospital?.id === hosp.id;
      marker.setIcon(createHospitalIcon(L, hosp, isSelected));
      marker.setZIndexOffset(isSelected ? 1400 : hosp.isEligible ? 400 : 100);
      if (isSelected) {
        marker.openPopup();
      }
    });

    // 2. Draw route
    if (!patientCoords || !Number.isFinite(patientCoords.lat) || !Number.isFinite(patientCoords.lng)) {
      if (routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      }
      setIsRouting(false);
      prevCoordsRef.current = "";
      return;
    }

    const coordsKey = `${patientCoords.lat},${patientCoords.lng}`;
    const hospitalKey = selectedHospital?.id || "";

    const hasChanged =
      prevCoordsRef.current !== coordsKey || prevHospitalIdRef.current !== hospitalKey;

    if (!hasChanged) return;

    prevCoordsRef.current = coordsKey;
    prevHospitalIdRef.current = hospitalKey;

    if (selectedHospital && selectedHospital.latitude && selectedHospital.longitude) {
      drawRouteToHospital(L, map, selectedHospital, true);
    } else if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
      setIsRouting(false);
    }
  }, [selectedHospital, patientCoords?.lat, patientCoords?.lng, drawRouteToHospital]);

  // Custom Controls Handlers
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      if (patientCoords && Number.isFinite(patientCoords.lat) && Number.isFinite(patientCoords.lng)) {
        mapInstanceRef.current.flyTo([patientCoords.lat, patientCoords.lng], 14, { duration: 0.8 });
      } else if (selectedHospital) {
        mapInstanceRef.current.flyTo([selectedHospital.latitude, selectedHospital.longitude], 14, { duration: 0.8 });
      } else if (mapCenter) {
        mapInstanceRef.current.flyTo([mapCenter.lat, mapCenter.lng], 12, { duration: 0.8 });
      } else {
        mapInstanceRef.current.flyTo([20.5937, 78.9629], 5, { duration: 0.8 });
      }
    }
  };

  const handleConfirmCenterLocation = () => {
    if (mapInstanceRef.current) {
      const center = mapInstanceRef.current.getCenter();
      onConfirmManualLocation(center.lat, center.lng);
    }
  };

  const directGoogleMapsUrl =
    selectedHospital && patientCoords
      ? `https://www.google.com/maps/dir/?api=1&origin=${patientCoords.lat},${patientCoords.lng}&destination=${selectedHospital.latitude},${selectedHospital.longitude}&travelmode=driving`
      : selectedHospital
      ? `https://www.google.com/maps/search/?api=1&query=${selectedHospital.latitude},${selectedHospital.longitude}`
      : "#";

  return (
    <div className="relative w-full h-[480px] sm:h-[540px] lg:h-[580px] rounded-2xl overflow-hidden bg-slate-100">
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* ============================================================ MANUAL POSITIONING MODE OVERLAY */}
      {isManualPicking && (
        <>
          <div className="absolute top-4 left-4 right-4 z-20 mx-auto max-w-lg rounded-2xl bg-slate-950 text-white p-3.5 shadow-2xl border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white leading-tight">Move map to position your location</div>
                <div className="text-[11px] text-slate-400 truncate">Align the center marker over your location</div>
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

          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="relative flex flex-col items-center -translate-y-5">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 border-2 border-white shadow-2xl text-sky-400">
                <div className="h-3 w-3 rounded-full bg-sky-400" />
              </div>
              <div className="h-4 w-1 bg-slate-950 rounded-b shadow-sm" />
              <div className="h-2 w-4 rounded-full bg-black/30 blur-[1px] mt-0.5" />
            </div>
          </div>
        </>
      )}

      {/* ============================================================ COMPACT LIVE ROUTE PILL */}
      {!isManualPicking && patientCoords && selectedHospital && (
        <div className="absolute top-3.5 left-3.5 z-10 max-w-[270px] sm:max-w-[290px] rounded-xl bg-white/95 backdrop-blur-md border border-[#E5E3DC] shadow-xs p-2.5 text-xs text-[#172026] pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#0F6B6D] animate-pulse shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A6B75]">
                Active Route
              </span>
            </div>
            {isRouting ? (
              <span className="text-[10px] font-semibold text-[#0F6B6D] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full border border-[#0F6B6D] border-t-transparent animate-spin" />
                Updating...
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[#0F6B6D] bg-[#E8F3F3] px-2 py-0.5 rounded border border-[#C2DFDF]">
                Live
              </span>
            )}
          </div>

          <div className="font-semibold text-[#172026] truncate text-xs mt-1 leading-snug" title={selectedHospital.name}>
            {selectedHospital.name}
          </div>

          <div className="flex items-center justify-between text-[11px] mt-1.5 pt-1.5 border-t border-[#E5E3DC]">
            <span className="font-bold text-[#172026]">
              {routeInfo.distanceKm} km <span className="text-[#A8B7A1] font-normal">·</span> ~{routeInfo.etaMinutes} min
            </span>
            <a
              href={directGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F6B6D] hover:text-[#0A5254] transition-colors"
            >
              <span>Maps</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}

      {/* ============================================================ LOCATION REQUIRED OVERLAY */}
      {!isManualPicking && !patientCoords && allHospitals.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-[#172026]/10 backdrop-blur-[2px] pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#E5E3DC] shadow-sm p-6 max-w-sm text-center flex flex-col items-center gap-3 pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-[#E8F3F3] border border-[#C2DFDF] flex items-center justify-center text-[#0F6B6D]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#172026]">Find Care Near You</h3>
              <p className="text-xs text-[#5A6B75] mt-1">
                Enable GPS or select a region to view emergency hospitals, live road travel times, and on-duty specialists.
              </p>
            </div>
            {onRequestLocation && (
              <button
                onClick={onRequestLocation}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F6B6D] hover:bg-[#0A5254] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
              >
                <Locate className="w-3.5 h-3.5" />
                <span>Use my live location</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ MAP CONTROLS */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex flex-col rounded-xl bg-white/95 backdrop-blur-md border border-[#E5E3DC] shadow-xs overflow-hidden divide-y divide-[#E5E3DC]">
          <button
            onClick={handleZoomIn}
            aria-label="Zoom In"
            className="flex h-8 w-8 items-center justify-center text-[#172026] hover:bg-[#F6F5F1] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            aria-label="Zoom Out"
            className="flex h-8 w-8 items-center justify-center text-[#172026] hover:bg-[#F6F5F1] transition-colors cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRecenter}
          aria-label="Recenter on My Location"
          title="Recenter on My Location"
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 backdrop-blur-md border border-[#E5E3DC] text-[#172026] hover:bg-[#F6F5F1] hover:text-[#0F6B6D] shadow-xs transition-all cursor-pointer"
        >
          <Locate className="w-4 h-4" />
        </button>
      </div>

      {/* ============================================================ MAP LEGEND */}
      <div className="hidden sm:flex absolute bottom-3.5 left-3.5 z-10 items-center gap-2.5 rounded-lg bg-white/95 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold text-[#5A6B75] border border-[#E5E3DC] shadow-xs pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#0F6B6D] border border-white shadow-xs" />
          <span>Your location</span>
        </div>
        <span className="text-[#E5E3DC]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#B42318]" />
          <span>Selected hospital</span>
        </div>
        <span className="text-[#E5E3DC]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-3.5 bg-[#0F6B6D] rounded-full" />
          <span>Driving route</span>
        </div>
      </div>

      {/* TOP-RIGHT ROUTING NOTIFICATION */}
      {isRouting && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 text-[#172026] border border-[#C2DFDF] px-3 py-1.5 rounded-full text-xs font-semibold shadow-xs backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-[#0F6B6D] border-t-transparent animate-spin" />
          <span>Calculating live route...</span>
        </div>
      )}
    </div>
  );
}
