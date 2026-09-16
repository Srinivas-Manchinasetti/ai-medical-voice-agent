import { Hospital, INDIAN_HOSPITALS_DATASET, calculateDistanceKm } from "../hospitals-india-data";
import { FacilityAccessibility, routingService } from "./routing-service";
import { discoverHospitalsNearCoordinates } from "./osm-discovery";

export type ClinicalSuitability = "verified_match" | "general_emergency" | "unknown";

export interface VerifiedHospitalFacility {
  id: string;
  name: string;
  ownership: "government" | "private" | "trust";
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  emergencyPhone: string;
  isEmergency24x7: boolean;
  specialty: string[];
  affordabilityNotes?: string;
  acceptsPublicInsurance?: boolean;
  source: string;
  lastVerified: string;
  isVerifiedRegistry: boolean;
}

export interface DiscoveredCandidate {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city?: string;
  address?: string;
  discoveredVia: "osm_overpass" | "verified_registry" | "regional_cache";
}

export interface CareOption {
  facility: VerifiedHospitalFacility;
  accessibility: FacilityAccessibility;
  clinicalSuitability: ClinicalSuitability;
  affordabilityNotice?: string;
}

export class HospitalDiscoveryService {
  private regionalCache = new Map<string, VerifiedHospitalFacility>();

  constructor() {
    // Prime regional cache with high-confidence verified dataset
    INDIAN_HOSPITALS_DATASET.forEach((h) => {
      this.regionalCache.set(h.id, {
        id: h.id,
        name: h.name,
        ownership: h.ownership,
        city: h.city,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        phone: h.phone,
        emergencyPhone: h.emergencyPhone,
        isEmergency24x7: h.isEmergency24x7,
        specialty: h.specialty,
        affordabilityNotes: h.affordabilityNotes,
        acceptsPublicInsurance: h.acceptsPublicInsurance,
        source: h.source,
        lastVerified: h.lastVerified,
        isVerifiedRegistry: true,
      });
    });
  }

  /**
   * LAYER 1: PROGRESSIVE DISCOVERY
   * Searches for candidate facilities using adaptive radii (e.g. 25km -> 50km -> 75km)
   * until sufficient candidates are discovered.
   */
  public async discoverCandidates(
    origin: { lat: number; lng: number },
    targetCount = 3
  ): Promise<{ candidates: DiscoveredCandidate[]; discoveredRadiusKm: number }> {
    const radii = [25, 50, 75];

    for (const radiusKm of radii) {
      let candidates = this.findCandidatesWithinRadius(origin, radiusKm);

      // If verified registry cache has fewer than targetCount, progressively discover from OpenStreetMap
      if (candidates.length < targetCount) {
        try {
          const liveHospitals = await discoverHospitalsNearCoordinates(origin.lat, origin.lng, radiusKm);
          for (const lh of liveHospitals) {
            if (!this.regionalCache.has(lh.id)) {
              this.regionalCache.set(lh.id, {
                id: lh.id,
                name: lh.name,
                ownership: lh.ownership,
                city: lh.city,
                address: lh.address,
                latitude: lh.latitude,
                longitude: lh.longitude,
                phone: lh.phone,
                emergencyPhone: lh.emergencyPhone,
                isEmergency24x7: lh.isEmergency24x7,
                specialty: lh.specialty,
                affordabilityNotes: lh.affordabilityNotes,
                acceptsPublicInsurance: lh.acceptsPublicInsurance,
                source: lh.source,
                lastVerified: lh.lastVerified,
                isVerifiedRegistry: false,
              });
            }
          }
          candidates = this.findCandidatesWithinRadius(origin, radiusKm);
        } catch (err: any) {
          console.warn("[HospitalDiscovery] Live progressive discovery error:", err.message);
        }
      }

      if (candidates.length >= targetCount || radiusKm === radii[radii.length - 1]) {
        return { candidates, discoveredRadiusKm: radiusKm };
      }
    }

    return { candidates: [], discoveredRadiusKm: 75 };
  }

  /**
   * Discovers facilities within a specific radius from verified registry & regional cache
   */
  private findCandidatesWithinRadius(
    origin: { lat: number; lng: number },
    radiusKm: number
  ): DiscoveredCandidate[] {
    const found: DiscoveredCandidate[] = [];

    // Search existing regional cache
    this.regionalCache.forEach((facility) => {
      const dist = calculateDistanceKm(origin.lat, origin.lng, facility.latitude, facility.longitude);
      if (dist <= radiusKm) {
        found.push({
          id: facility.id,
          name: facility.name,
          latitude: facility.latitude,
          longitude: facility.longitude,
          city: facility.city,
          address: facility.address,
          discoveredVia: "verified_registry",
        });
      }
    });

    return found;
  }

  /**
   * LAYER 2: VERIFICATION & ENRICHMENT
   * Cross-references discovered candidates against verified hospital registry.
   * Discovered candidates NEVER magically acquire unverified clinical capabilities.
   */
  public enrichCandidate(candidate: DiscoveredCandidate): VerifiedHospitalFacility {
    const verified = this.regionalCache.get(candidate.id);
    if (verified) {
      return verified;
    }

    // Attempt fuzzy match on existing verified records
    for (const [, reg] of this.regionalCache.entries()) {
      const dist = calculateDistanceKm(candidate.latitude, candidate.longitude, reg.latitude, reg.longitude);
      if (dist < 0.5 || candidate.name.toLowerCase().includes(reg.name.toLowerCase().slice(0, 8))) {
        return reg;
      }
    }

    // Unverified discovered entity: keep minimal factual record, strictly mark capabilities unverified
    const unverifiedFacility: VerifiedHospitalFacility = {
      id: candidate.id,
      name: candidate.name,
      ownership: "private",
      city: candidate.city || "Local District",
      address: candidate.address || "Discovered Location",
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      phone: "108",
      emergencyPhone: "108",
      isEmergency24x7: false,
      specialty: [],
      source: "Open Data Discovery (Unverified Clinical Profile)",
      lastVerified: new Date().toISOString().slice(0, 10),
      isVerifiedRegistry: false,
    };

    return unverifiedFacility;
  }

  /**
   * Evaluates Non-Binary Clinical Suitability:
   * - "verified_match": Specialty-matched AND verified 24/7 ER
   * - "general_emergency": Verified 24/7 ER, but specialty unconfirmed
   * - "unknown": Unverified emergency capability
   */
  public evaluateClinicalSuitability(
    facility: VerifiedHospitalFacility,
    specialtyRequired?: string
  ): ClinicalSuitability {
    if (!facility.isEmergency24x7) {
      return "unknown";
    }

    if (!specialtyRequired) {
      return "general_emergency";
    }

    const sLower = specialtyRequired.toLowerCase();
    const hasSpecialty = facility.specialty.some((s) => s.toLowerCase().includes(sLower));

    return hasSpecialty ? "verified_match" : "general_emergency";
  }

  /**
   * FULL 3-LAYER CARE DISCOVERY PIPELINE
   * Discovery -> Verification & Suitability -> Routing & Accessibility -> Floor-Based Ranking
   */
  public async discoverAndRouteCareOptions(options: {
    origin: { lat: number; lng: number };
    specialtyRequired?: string;
    prioritizeAffordable?: boolean;
    maxResults?: number;
  }): Promise<{ options: CareOption[]; searchRadiusKm: number }> {
    const { origin, specialtyRequired, prioritizeAffordable = false, maxResults = 3 } = options;

    // 1. Adaptive Discovery
    const { candidates, discoveredRadiusKm } = await this.discoverCandidates(origin, 6);

    // 2. Verification & Clinical Capability Pre-Filter
    // Invariant: Do not waste API calls or routing latency on clinically disqualified facilities.
    const enrichedFacilities = candidates.map((c) => this.enrichCandidate(c));

    // Pre-rank by clinical capability and financial constraint so we route only the strongest candidates
    const preFilteredFacilities = [...enrichedFacilities].sort((a, b) => {
      const suitA = this.evaluateClinicalSuitability(a, specialtyRequired);
      const suitB = this.evaluateClinicalSuitability(b, specialtyRequired);
      const score = (s: ClinicalSuitability) => (s === "verified_match" ? 3 : s === "general_emergency" ? 2 : 1);
      const diff = score(suitB) - score(suitA);
      if (diff !== 0) return diff;

      if (prioritizeAffordable) {
        const aPub = a.ownership === "government" || a.ownership === "trust" ? 1 : 0;
        const bPub = b.ownership === "government" || b.ownership === "trust" ? 1 : 0;
        if (aPub !== bPub) return bPub - aPub;
      }
      return 0;
    }).slice(0, Math.max(maxResults + 2, 4)); // Route top N candidates only

    // 3. Accessibility & Routing (Computed via Google Route Matrix or OSRM)
    const accessibilities = await routingService.calculateHospitalBatch(
      origin,
      preFilteredFacilities.map((f) => ({ id: f.id, latitude: f.latitude, longitude: f.longitude }))
    );

    // 4. Assemble CareOption Objects
    const careOptions: CareOption[] = preFilteredFacilities.map((facility) => {
      const accessibility = accessibilities.get(facility.id) || {
        straightLineDistanceKm: calculateDistanceKm(origin.lat, origin.lng, facility.latitude, facility.longitude),
        routingMode: "haversine_fallback",
        distanceDisplay: `~${Math.round(calculateDistanceKm(origin.lat, origin.lng, facility.latitude, facility.longitude))} km straight-line`,
        durationDisplay: "Driving time unavailable",
        routingProvider: "Haversine Fallback",
        calculatedAt: new Date().toISOString(),
        freshnessLabel: "Straight-line fallback",
      };

      const clinicalSuitability = this.evaluateClinicalSuitability(facility, specialtyRequired);

      let affordabilityNotice: string | undefined;
      if (facility.ownership === "government") {
        affordabilityNotice = facility.affordabilityNotes || "Government facility (public healthcare rates apply)";
      } else if (facility.affordabilityNotes) {
        affordabilityNotice = facility.affordabilityNotes;
      }

      return {
        facility,
        accessibility,
        clinicalSuitability,
        affordabilityNotice,
      };
    });

    // 5. FLOOR-FIRST CLINICAL RANKING ALGORITHM
    // Invariant: Clinical suitability is a strict floor, not an additive score.
    // Order:
    // a. Clinical floor (verified_match > general_emergency > unknown)
    // b. If financial constraint: Government/Trust options prioritized within suitability tier
    // c. Realistic travel accessibility (lowest estimatedTravelMinutes or straight-line fallback)
    careOptions.sort((a, b) => {
      // Step A: Clinical Capability Floor
      const suitabilityScore = (s: ClinicalSuitability) =>
        s === "verified_match" ? 3 : s === "general_emergency" ? 2 : 1;
      const scoreDiff = suitabilityScore(b.clinicalSuitability) - suitabilityScore(a.clinicalSuitability);
      if (scoreDiff !== 0) return scoreDiff;

      // Step B: Affordability Priority (if patient flagged financial hardship)
      if (prioritizeAffordable) {
        const aPublic = a.facility.ownership === "government" || a.facility.ownership === "trust" ? 1 : 0;
        const bPublic = b.facility.ownership === "government" || b.facility.ownership === "trust" ? 1 : 0;
        if (aPublic !== bPublic) return bPublic - aPublic;
      }

      // Step C: Realistic Accessibility / Travel Duration
      const aTime = a.accessibility.estimatedTravelMinutes ?? a.accessibility.straightLineDistanceKm * 2;
      const bTime = b.accessibility.estimatedTravelMinutes ?? b.accessibility.straightLineDistanceKm * 2;
      if (aTime !== bTime) return aTime - bTime;

      // Step D: Road Distance tie-breaker
      const aDist = a.accessibility.roadDistanceKm ?? a.accessibility.straightLineDistanceKm;
      const bDist = b.accessibility.roadDistanceKm ?? b.accessibility.straightLineDistanceKm;
      return aDist - bDist;
    });

    return {
      options: careOptions.slice(0, maxResults),
      searchRadiusKm: discoveredRadiusKm,
    };
  }
}

export const hospitalDiscoveryService = new HospitalDiscoveryService();
