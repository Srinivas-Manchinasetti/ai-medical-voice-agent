import { INDIAN_HOSPITALS_DATASET } from "../hospitals-india-data";
import { hospitalDiscoveryService, CareOption, ClinicalSuitability } from "./hospital-discovery";
import { RoutingMode } from "./routing-service";

export interface CareFacilityCandidate {
  id: string;
  name: string;
  distanceKm: number;
  distanceDisplay: string;
  durationDisplay?: string;
  estimatedTravelMinutes?: number;
  staticDurationMinutes?: number;
  trafficDelayMinutes?: number;
  congestionLevel?: "low" | "moderate" | "heavy" | "unknown";
  routeSummary?: string;
  roadDistanceKm?: number;
  routingMode: RoutingMode;
  clinicalSuitability: ClinicalSuitability;
  freshnessLabel: string;
  ownership: "government" | "private" | "trust";
  city: string;
  address: string;
  phone: string;
  emergencyPhone: string;
  isEmergency24x7: boolean;
  specialty: string[];
  affordabilityNotes?: string;
  acceptsPublicInsurance?: boolean;
  source: string;
  lastVerified: string;
}

export interface CareNetworkQueryResult {
  facilities: CareFacilityCandidate[];
  careOptions: CareOption[];
  summaryForLLM: string;
  locationBasis: {
    type: "gps" | "city" | "default_region";
    label: string;
  };
  specialtySearched?: string;
  prioritizedAffordability: boolean;
  searchRadiusKm?: number;
}

export class HospitalRagService {
  /**
   * 3-LAYER CARE DISCOVERY & ROUTING PIPELINE
   * Discovery -> Verification & Suitability Floor -> Routing Accessibility -> RAG Summary
   */
  public async findEmergencyCareFacilities(options: {
    userCoords?: { latitude: number; longitude: number };
    cityOrLandmark?: string;
    specialtyRequired?: string;
    prioritizeAffordable?: boolean;
    maxResults?: number;
  }): Promise<CareNetworkQueryResult> {
    const {
      userCoords,
      cityOrLandmark,
      specialtyRequired,
      prioritizeAffordable = false,
      maxResults = 3,
    } = options;

    // Default reference coordinates: Guntur / Vijayawada Medical Hub
    let refLat = 16.3067;
    let refLng = 80.4365;
    let locationType: "gps" | "city" | "default_region" = "default_region";
    let locationLabel = "Andhra Pradesh / Telangana Region";

    if (userCoords && !isNaN(userCoords.latitude) && !isNaN(userCoords.longitude)) {
      refLat = userCoords.latitude;
      refLng = userCoords.longitude;
      locationType = "gps";
      locationLabel = "Current Location (GPS)";
    } else if (cityOrLandmark) {
      const q = cityOrLandmark.toLowerCase().trim();
      const match = INDIAN_HOSPITALS_DATASET.find(
        (h) =>
          h.city.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          h.state.toLowerCase().includes(q)
      );
      if (match) {
        refLat = match.latitude;
        refLng = match.longitude;
        locationType = "city";
        locationLabel = match.city;
      }
    }

    // Execute 3-layer progressive discovery and floor-first routing
    const { options: careOptions, searchRadiusKm } =
      await hospitalDiscoveryService.discoverAndRouteCareOptions({
        origin: { lat: refLat, lng: refLng },
        specialtyRequired,
        prioritizeAffordable,
        maxResults,
      });

    // Map into flattened CareFacilityCandidate structure for backward compatibility
    const facilities: CareFacilityCandidate[] = careOptions.map((opt) => ({
      id: opt.facility.id,
      name: opt.facility.name,
      distanceKm: opt.accessibility.roadDistanceKm ?? opt.accessibility.straightLineDistanceKm,
      distanceDisplay: opt.accessibility.distanceDisplay,
      durationDisplay: opt.accessibility.durationDisplay,
      estimatedTravelMinutes: opt.accessibility.estimatedTravelMinutes,
      staticDurationMinutes: opt.accessibility.staticDurationMinutes,
      trafficDelayMinutes: opt.accessibility.trafficDelayMinutes,
      congestionLevel: opt.accessibility.congestionLevel,
      routeSummary: opt.accessibility.routeSummary,
      roadDistanceKm: opt.accessibility.roadDistanceKm,
      routingMode: opt.accessibility.routingMode,
      clinicalSuitability: opt.clinicalSuitability,
      freshnessLabel: opt.accessibility.freshnessLabel,
      ownership: opt.facility.ownership,
      city: opt.facility.city,
      address: opt.facility.address,
      phone: opt.facility.phone,
      emergencyPhone: opt.facility.emergencyPhone,
      isEmergency24x7: opt.facility.isEmergency24x7,
      specialty: opt.facility.specialty,
      affordabilityNotes: opt.affordabilityNotice,
      acceptsPublicInsurance: opt.facility.acceptsPublicInsurance,
      source: opt.facility.source,
      lastVerified: opt.facility.lastVerified,
    }));

    // Formulate Grounded LLM Blackboard Lines with explicit routing mode and clinical suitability
    const summaryLines = careOptions.map((opt, idx) => {
      const f = opt.facility;
      const a = opt.accessibility;
      const suitabilityText =
        opt.clinicalSuitability === "verified_match"
          ? `VERIFIED CLINICAL MATCH (${specialtyRequired || "Emergency"} & 24/7 ER)`
          : opt.clinicalSuitability === "general_emergency"
          ? `GENERAL 24/7 EMERGENCY (${specialtyRequired ? specialtyRequired + " specific unit unverified" : "24/7 ER"})`
          : "UNVERIFIED SPECIALTY STATUS";

      const routingModeText =
        a.routingMode === "traffic_aware"
          ? `TRAFFIC-AWARE LIVE ESTIMATE (${a.congestionLevel ? a.congestionLevel.toUpperCase() : "LIVE"} CONGESTION)`
          : a.routingMode === "road_network"
          ? "ROAD-NETWORK ESTIMATE (STATIC PROFILE)"
          : "STRAIGHT-LINE FALLBACK (DRIVING TIME UNAVAILABLE)";

      let durationInfo = a.estimatedTravelMinutes
        ? `~${a.estimatedTravelMinutes} min drive`
        : "Driving time unavailable";

      if (a.routingMode === "traffic_aware" && a.staticDurationMinutes && a.trafficDelayMinutes !== undefined) {
        durationInfo += ` (typical: ~${a.staticDurationMinutes} min, traffic delay: +${a.trafficDelayMinutes} min)`;
      }

      return `${idx + 1}. ${f.name}
   - Clinical Suitability: ${suitabilityText}
   - Ownership: ${f.ownership.toUpperCase()}${f.ownership === "government" ? " (Government facility)" : ""}
   - Road Distance: ${a.roadDistanceKm ? `~${a.roadDistanceKm} km` : a.distanceDisplay}
   - Travel Duration: ${durationInfo} (Routing Mode: ${routingModeText})
   - Provider / Freshness: ${a.routingProvider} (${a.freshnessLabel})
   - 24/7 ER Direct Line: ${f.emergencyPhone}
   - Provenance: ${f.source}`;
    });

    const summaryForLLM =
      careOptions.length > 0
        ? `VERIFIED CARE NETWORK CANDIDATES (Progressive Discovery & Floor-Based Routing):\n${summaryLines.join("\n")}`
        : "No emergency facilities discovered within adaptive search radius.";

    return {
      facilities,
      careOptions,
      summaryForLLM,
      locationBasis: {
        type: locationType,
        label: locationLabel,
      },
      specialtySearched: specialtyRequired,
      prioritizedAffordability: prioritizeAffordable,
      searchRadiusKm,
    };
  }
}

export const hospitalRagService = new HospitalRagService();
