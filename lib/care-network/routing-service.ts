import { calculateDistanceKm } from "../hospitals-india-data";

export type RoutingMode = "traffic_aware" | "road_network" | "haversine_fallback";
export type CongestionLevel = "low" | "moderate" | "heavy" | "unknown";

export interface FacilityAccessibility {
  roadDistanceKm?: number;
  estimatedTravelMinutes?: number;
  staticDurationMinutes?: number;
  trafficDelayMinutes?: number;
  congestionLevel?: CongestionLevel;
  routeSummary?: string;
  straightLineDistanceKm: number;
  routingMode: RoutingMode;
  distanceDisplay: string;
  durationDisplay: string;
  routingProvider: string;
  calculatedAt: string;
  freshnessLabel: string;
}

interface CacheEntry {
  accessibility: FacilityAccessibility;
  timestamp: number;
}

export class RoutingService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly TIMEOUT_MS = 2500; // 2.5 seconds timeout guard

  /**
   * Generates a stable cache key with 4 decimal places (~11m resolution)
   */
  private getCacheKey(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): string {
    const oLat = origin.lat.toFixed(4);
    const oLng = origin.lng.toFixed(4);
    const dLat = dest.lat.toFixed(4);
    const dLng = dest.lng.toFixed(4);
    return `${oLat},${oLng}->${dLat},${dLng}`;
  }

  /**
   * Computes realistic travel accessibility between origin and hospital destination.
   * Enforces the 3-tier routing hierarchy:
   * 1. Traffic-aware provider (if configured)
   * 2. OSRM road-network geometry (OpenStreetMap)
   * 3. Haversine straight-line distance fallback
   */
  public async calculateAccessibility(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<FacilityAccessibility> {
    const straightLineDistanceKm = calculateDistanceKm(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng
    );

    const cacheKey = this.getCacheKey(origin, destination);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.accessibility;
    }

    const calculatedAt = new Date().toISOString();

    // 1. Pluggable Industry Traffic Providers
    // A: Google Routes API (TRAFFIC_AWARE_OPTIMAL / TRAFFIC_AWARE)
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ROUTES_API_KEY;
    if (googleApiKey) {
      try {
        const gResult = await this.queryGoogleRoutes(origin, destination, googleApiKey);
        if (gResult) {
          const accessibility: FacilityAccessibility = {
            roadDistanceKm: gResult.roadDistanceKm,
            estimatedTravelMinutes: gResult.durationMinutes,
            staticDurationMinutes: gResult.staticDurationMinutes,
            trafficDelayMinutes: gResult.trafficDelayMinutes,
            congestionLevel: gResult.congestionLevel,
            routeSummary: gResult.routeSummary,
            straightLineDistanceKm,
            routingMode: "traffic_aware",
            distanceDisplay: `~${gResult.roadDistanceKm.toFixed(1)} km by road`,
            durationDisplay: `~${Math.round(gResult.durationMinutes)} min drive`,
            routingProvider: "Google Routes API (Live Traffic)",
            calculatedAt,
            freshnessLabel: `Traffic-aware · ${gResult.congestionLevel.toUpperCase()} congestion`,
          };
          this.cache.set(cacheKey, { accessibility, timestamp: Date.now() });
          return accessibility;
        }
      } catch (err: any) {
        console.warn("[RoutingService] Google Routes query failed, trying next provider:", err.message);
      }
    }

    // B: Mapbox Directions API (mapbox/driving-traffic)
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_API_KEY;
    if (mapboxToken) {
      try {
        const mResult = await this.queryMapboxRoutes(origin, destination, mapboxToken);
        if (mResult) {
          const accessibility: FacilityAccessibility = {
            roadDistanceKm: mResult.roadDistanceKm,
            estimatedTravelMinutes: mResult.durationMinutes,
            staticDurationMinutes: mResult.staticDurationMinutes,
            trafficDelayMinutes: mResult.trafficDelayMinutes,
            congestionLevel: mResult.congestionLevel,
            routeSummary: mResult.routeSummary,
            straightLineDistanceKm,
            routingMode: "traffic_aware",
            distanceDisplay: `~${mResult.roadDistanceKm.toFixed(1)} km by road`,
            durationDisplay: `~${Math.round(mResult.durationMinutes)} min drive`,
            routingProvider: "Mapbox Directions (driving-traffic)",
            calculatedAt,
            freshnessLabel: `Traffic-aware · ${mResult.congestionLevel.toUpperCase()} congestion`,
          };
          this.cache.set(cacheKey, { accessibility, timestamp: Date.now() });
          return accessibility;
        }
      } catch (err: any) {
        console.warn("[RoutingService] Mapbox query failed, trying next provider:", err.message);
      }
    }

    // C: Generic Custom Traffic Webhook Endpoint (e.g. TomTom / HERE microservice)
    const trafficEndpoint = process.env.ROUTING_TRAFFIC_API_URL;
    if (trafficEndpoint) {
      try {
        const trafficResult = await this.queryTrafficProvider(origin, destination, trafficEndpoint);
        if (trafficResult) {
          const accessibility: FacilityAccessibility = {
            roadDistanceKm: trafficResult.roadDistanceKm,
            estimatedTravelMinutes: trafficResult.durationMinutes,
            staticDurationMinutes: trafficResult.staticDurationMinutes,
            trafficDelayMinutes: trafficResult.trafficDelayMinutes,
            congestionLevel: trafficResult.congestionLevel || "moderate",
            straightLineDistanceKm,
            routingMode: "traffic_aware",
            distanceDisplay: `~${trafficResult.roadDistanceKm.toFixed(1)} km by road`,
            durationDisplay: `~${Math.round(trafficResult.durationMinutes)} min drive`,
            routingProvider: trafficResult.providerName || "Traffic-Aware Matrix",
            calculatedAt,
            freshnessLabel: "Traffic-aware estimate · calculated just now",
          };
          this.cache.set(cacheKey, { accessibility, timestamp: Date.now() });
          return accessibility;
        }
      } catch (err: any) {
        console.warn("[RoutingService] Traffic provider failed, falling back to road network:", err.message);
      }
    }

    // 2. OpenStreetMap OSRM Road-Network Routing (Zero-Key, Public Global Infrastructure)
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${destination.lng},${destination.lat};${origin.lng},${origin.lat}?overview=false`;
      
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const res = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.code === "Ok" && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const roadDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
          const durationMinutes = Math.max(1, Math.round(route.duration / 60));

          const accessibility: FacilityAccessibility = {
            roadDistanceKm,
            estimatedTravelMinutes: durationMinutes,
            staticDurationMinutes: durationMinutes,
            trafficDelayMinutes: 0,
            congestionLevel: "unknown",
            straightLineDistanceKm,
            routingMode: "road_network",
            distanceDisplay: `~${roadDistanceKm} km by road`,
            durationDisplay: `~${durationMinutes} min drive`,
            routingProvider: "OpenStreetMap (OSRM)",
            calculatedAt,
            freshnessLabel: "Road-network estimate · static profile",
          };
          this.cache.set(cacheKey, { accessibility, timestamp: Date.now() });
          return accessibility;
        }
      }
    } catch (err: any) {
      console.warn("[RoutingService] OSRM route lookup failed/timed out, using straight-line fallback:", err.message);
    }

    // 3. Fallback: Honest Straight-Line Haversine Distance (Driving time unavailable)
    const fallbackAccessibility: FacilityAccessibility = {
      straightLineDistanceKm,
      routingMode: "haversine_fallback",
      distanceDisplay: `~${straightLineDistanceKm} km straight-line`,
      durationDisplay: "Driving time unavailable",
      routingProvider: "Haversine Fallback",
      calculatedAt,
      freshnessLabel: "Straight-line fallback",
    };

    return fallbackAccessibility;
  }

  /**
   * Google Routes API: Computes traffic-aware route with TRAFFIC_AWARE preference
   */
  private async queryGoogleRoutes(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    apiKey: string
  ): Promise<{
    roadDistanceKm: number;
    durationMinutes: number;
    staticDurationMinutes?: number;
    trafficDelayMinutes?: number;
    congestionLevel: CongestionLevel;
    routeSummary?: string;
  } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const url = "https://routes.googleapis.com/directions/v2:computeRoutes";
      const payload = {
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        extraComputations: ["TRAFFIC_ON_POLYLINE"],
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters,routes.description",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) return null;

      const route = data.routes[0];
      const roadDistanceKm = Math.round(((route.distanceMeters || 0) / 1000) * 10) / 10;
      // Google durations come as strings like "1860s"
      const parseSeconds = (s?: string) => (s ? parseInt(s.replace("s", ""), 10) : 0);
      const durationSec = parseSeconds(route.duration);
      const staticSec = parseSeconds(route.staticDuration) || durationSec;

      const durationMinutes = Math.max(1, Math.round(durationSec / 60));
      const staticDurationMinutes = Math.max(1, Math.round(staticSec / 60));
      const trafficDelayMinutes = Math.max(0, durationMinutes - staticDurationMinutes);

      const delayRatio = durationSec / (staticSec || 1);
      const congestionLevel: CongestionLevel =
        delayRatio > 1.35 ? "heavy" : delayRatio > 1.1 ? "moderate" : "low";

      return {
        roadDistanceKm,
        durationMinutes,
        staticDurationMinutes,
        trafficDelayMinutes,
        congestionLevel,
        routeSummary: route.description,
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Mapbox Directions API: Computes route with mapbox/driving-traffic profile
   */
  private async queryMapboxRoutes(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    accessToken: string
  ): Promise<{
    roadDistanceKm: number;
    durationMinutes: number;
    staticDurationMinutes?: number;
    trafficDelayMinutes?: number;
    congestionLevel: CongestionLevel;
    routeSummary?: string;
  } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?annotations=congestion&access_token=${accessToken}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) return null;
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) return null;

      const route = data.routes[0];
      const roadDistanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const durationMinutes = Math.max(1, Math.round(route.duration / 60));

      // Examine segment congestion annotations if available
      let congestionLevel: CongestionLevel = "low";
      const legs = route.legs || [];
      const congestions: string[] = legs.flatMap((l: any) => l.annotation?.congestion || []);
      if (congestions.length > 0) {
        const heavyCount = congestions.filter((c) => c === "heavy" || c === "severe").length;
        const modCount = congestions.filter((c) => c === "moderate").length;
        const ratio = (heavyCount + modCount * 0.5) / congestions.length;
        if (ratio > 0.35) congestionLevel = "heavy";
        else if (ratio > 0.15) congestionLevel = "moderate";
      }

      return {
        roadDistanceKm,
        durationMinutes,
        staticDurationMinutes: durationMinutes,
        trafficDelayMinutes: 0,
        congestionLevel,
        routeSummary: route.legs?.[0]?.summary,
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Helper for custom traffic providers (e.g. generic traffic webhook)
   */
  private async queryTrafficProvider(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number },
    endpoint: string
  ): Promise<{
    roadDistanceKm: number;
    durationMinutes: number;
    staticDurationMinutes?: number;
    trafficDelayMinutes?: number;
    congestionLevel?: CongestionLevel;
    providerName: string;
  } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
    try {
      const url = `${endpoint}?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${dest.lat}&destLng=${dest.lng}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        roadDistanceKm: data.roadDistanceKm,
        durationMinutes: data.durationMinutes,
        staticDurationMinutes: data.staticDurationMinutes,
        trafficDelayMinutes: data.trafficDelayMinutes,
        congestionLevel: data.congestionLevel,
        providerName: data.provider || "Traffic Provider",
      };
    } catch {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Computes accessibility for multiple hospital candidates.
   * Uses Google Compute Route Matrix API (1-to-N batching in a single HTTP POST)
   * if GOOGLE_MAPS_API_KEY is configured, falling back to parallel OSRM/Haversine.
   */
  public async calculateHospitalBatch(
    origin: { lat: number; lng: number },
    destinations: Array<{ id: string; latitude: number; longitude: number }>
  ): Promise<Map<string, FacilityAccessibility>> {
    const results = new Map<string, FacilityAccessibility>();
    if (destinations.length === 0) return results;

    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ROUTES_API_KEY;
    if (googleApiKey) {
      try {
        const matrixResults = await this.queryGoogleRouteMatrix(origin, destinations, googleApiKey);
        if (matrixResults && matrixResults.size > 0) {
          matrixResults.forEach((acc, id) => results.set(id, acc));
          // If all destinations resolved via Route Matrix, return immediately
          if (results.size === destinations.length) {
            return results;
          }
        }
      } catch (err: any) {
        console.warn("[RoutingService] Google Route Matrix query failed, falling back to individual router:", err.message);
      }
    }

    // Fallback: Compute individually in parallel using standard calculateAccessibility (OSRM / Haversine)
    const promises = destinations.map(async (d) => {
      if (!results.has(d.id)) {
        const acc = await this.calculateAccessibility(origin, { lat: d.latitude, lng: d.longitude });
        results.set(d.id, acc);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Google Compute Route Matrix API:
   * Computes 1 origin to N destinations in a single request with TRAFFIC_AWARE preference.
   * Fully compliant with Google Maps ToS (temporary in-memory caching only).
   */
  private async queryGoogleRouteMatrix(
    origin: { lat: number; lng: number },
    destinations: Array<{ id: string; latitude: number; longitude: number }>,
    apiKey: string
  ): Promise<Map<string, FacilityAccessibility> | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT_MS * 1.5);

    try {
      const url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
      const payload = {
        origins: [
          {
            waypoint: {
              location: {
                latLng: { latitude: origin.lat, longitude: origin.lng },
              },
            },
          },
        ],
        destinations: destinations.map((d) => ({
          waypoint: {
            location: {
              latLng: { latitude: d.latitude, longitude: d.longitude },
            },
          },
        })),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) return null;
      const elements = await res.json();
      if (!Array.isArray(elements)) return null;

      const matrixMap = new Map<string, FacilityAccessibility>();
      const calculatedAt = new Date().toISOString();

      elements.forEach((elem: any) => {
        const destIdx = elem.destinationIndex;
        if (destIdx !== undefined && destIdx < destinations.length) {
          const dest = destinations[destIdx];
          const straightLineDistanceKm = calculateDistanceKm(origin.lat, origin.lng, dest.latitude, dest.longitude);

          if (elem.status && elem.status.code !== 0 && elem.status.code !== undefined) {
            return; // Route not found or error for this specific destination
          }

          const parseSec = (s?: string) => (s ? parseInt(s.replace("s", ""), 10) : 0);
          const durationSec = parseSec(elem.duration);
          const staticSec = parseSec(elem.staticDuration) || durationSec;

          const roadDistanceKm = Math.round(((elem.distanceMeters || 0) / 1000) * 10) / 10;
          const durationMinutes = Math.max(1, Math.round(durationSec / 60));
          const staticDurationMinutes = Math.max(1, Math.round(staticSec / 60));
          const trafficDelayMinutes = Math.max(0, durationMinutes - staticDurationMinutes);

          const delayRatio = durationSec / (staticSec || 1);
          const congestionLevel: CongestionLevel =
            delayRatio > 1.35 ? "heavy" : delayRatio > 1.1 ? "moderate" : "low";

          const accessibility: FacilityAccessibility = {
            roadDistanceKm,
            estimatedTravelMinutes: durationMinutes,
            staticDurationMinutes,
            trafficDelayMinutes,
            congestionLevel,
            straightLineDistanceKm,
            routingMode: "traffic_aware",
            distanceDisplay: `~${roadDistanceKm} km by road`,
            durationDisplay: `~${durationMinutes} min drive`,
            routingProvider: "Google Route Matrix (Live Traffic)",
            calculatedAt,
            freshnessLabel: `Traffic-aware · ${congestionLevel.toUpperCase()} congestion`,
          };

          const cacheKey = this.getCacheKey(origin, { lat: dest.latitude, lng: dest.longitude });
          this.cache.set(cacheKey, { accessibility, timestamp: Date.now() });
          matrixMap.set(dest.id, accessibility);
        }
      });

      return matrixMap;
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
}

export const routingService = new RoutingService();
