import { NextResponse } from "next/server";
import { INDIAN_HOSPITALS_DATASET, ALL_REGION_PRESETS, calculateDistanceKm, Hospital, getHospitalFamousFor } from "@/lib/hospitals-india-data";
import { discoverHospitalsNearCoordinates } from "@/lib/care-network/osm-discovery";

export function calculateRealisticDriveTime(distanceKm: number): number {
  if (distanceKm <= 4) {
    // Dense city traffic: ~18 km/h + signal buffer
    return Math.max(4, Math.round((distanceKm / 18) * 60));
  } else if (distanceKm <= 12) {
    // Mixed urban/arterial: ~25 km/h
    return Math.max(6, Math.round((distanceKm / 25) * 60));
  } else if (distanceKm <= 50) {
    // Suburban / ring road: ~45 km/h
    return Math.max(10, Math.round(13 + ((distanceKm - 4) / 45) * 60));
  } else {
    // Inter-city National Highway: ~65 km/h
    return Math.max(25, Math.round(30 + ((distanceKm - 15) / 65) * 60));
  }
}

export interface CategoryRule {
  class: "emergency" | "elective";
  label: string;
  mustHaveKeywords: string[];
  boostKeywords: string[];
  actionType: "call_ed" | "call_hospital";
}

export const CATEGORY_RULES: Record<string, CategoryRule> = {
  cardiology: {
    class: "emergency",
    label: "Cardiology",
    mustHaveKeywords: ["cardio", "heart", "cath lab", "chest pain", "angioplasty"],
    boostKeywords: ["cath lab", "icu", "coronary care", "24/7 er"],
    actionType: "call_ed",
  },
  neurology: {
    class: "emergency",
    label: "Neurology & Stroke",
    mustHaveKeywords: ["neuro", "stroke", "brain", "paralysis", "nimhans", "spine", "neurosurgery"],
    boostKeywords: ["ct scan", "mri", "neuro icu", "thrombolysis", "be-fast"],
    actionType: "call_ed",
  },
  pediatrics: {
    class: "emergency",
    label: "Pediatrics & Child Care",
    mustHaveKeywords: ["pediatric", "child", "children", "nicu", "picu", "infant", "newborn", "rainbow", "ankura"],
    boostKeywords: ["nicu", "picu", "pediatric emergency"],
    actionType: "call_ed",
  },
  pulmonology: {
    class: "emergency",
    label: "Pulmonology & Respiratory",
    mustHaveKeywords: ["pulmo", "respiratory", "lung", "asthma", "copd", "pneumonia"],
    boostKeywords: ["ventilator", "respiratory icu", "24/7 er"],
    actionType: "call_ed",
  },
  dermatology: {
    class: "elective",
    label: "Skin & Dermatology",
    mustHaveKeywords: ["derma", "skin", "burns", "plastic surgery", "allergy", "cosmetic"],
    boostKeywords: ["opd", "dermatology clinic", "skin specialist"],
    actionType: "call_hospital",
  },
  burns: {
    class: "emergency",
    label: "Burns & Trauma",
    mustHaveKeywords: ["burn", "burns", "plastic surgery", "trauma"],
    boostKeywords: ["burn unit", "icu", "trauma er"],
    actionType: "call_ed",
  },
  eye: {
    class: "elective",
    label: "Eye & Ophthalmology",
    mustHaveKeywords: ["eye", "ophthal", "netra", "vision", "cataract", "retina", "lvpei", "glaucoma"],
    boostKeywords: ["lasik", "retina clinic", "eye hospital"],
    actionType: "call_hospital",
  },
  dental: {
    class: "elective",
    label: "Dental & Maxillofacial",
    mustHaveKeywords: ["dental", "tooth", "teeth", "maxillofacial", "oral", "dentist"],
    boostKeywords: ["dental clinic", "oral surgery"],
    actionType: "call_hospital",
  },
  ayurveda: {
    class: "elective",
    label: "Ayurveda & Traditional",
    mustHaveKeywords: ["ayurved", "panchakarma", "herbal", "ayush", "naturopathy", "homeo"],
    boostKeywords: ["panchakarma unit", "ayurvedic hospital"],
    actionType: "call_hospital",
  },
  diabetes: {
    class: "elective",
    label: "Diabetes & Endocrinology",
    mustHaveKeywords: ["diabet", "endocrin", "insulin", "thyroid", "sugar"],
    boostKeywords: ["diabetic foot care", "endocrinology opd"],
    actionType: "call_hospital",
  },
  cancer: {
    class: "elective",
    label: "Oncology & Cancer Care",
    mustHaveKeywords: ["cancer", "oncol", "tumor", "chemo", "radiation", "surgical oncology"],
    boostKeywords: ["surgical oncology", "pet-ct", "radiation bunker", "tumor board"],
    actionType: "call_hospital",
  },
  orthopedics: {
    class: "emergency",
    label: "Orthopedics & Joint Trauma",
    mustHaveKeywords: ["ortho", "bone", "fracture", "joint", "trauma", "spine"],
    boostKeywords: ["joint replacement", "trauma er", "icu"],
    actionType: "call_ed",
  },
  maternity: {
    class: "emergency",
    label: "Maternity & Obstetrics",
    mustHaveKeywords: ["matern", "gynec", "obstet", "delivery", "pregnancy", "labor", "nicu"],
    boostKeywords: ["nicu", "labor delivery suite", "high-risk obstetrics"],
    actionType: "call_ed",
  },
  kidney: {
    class: "emergency",
    label: "Kidney & Dialysis",
    mustHaveKeywords: ["kidney", "renal", "dialysis", "nephro", "urol"],
    boostKeywords: ["hemodialysis", "nephrology icu"],
    actionType: "call_ed",
  },
  gastroenterology: {
    class: "elective",
    label: "Gastroenterology & Liver",
    mustHaveKeywords: ["gastro", "liver", "digestive", "endoscopy", "stomach", "hepat"],
    boostKeywords: ["endoscopy suite", "liver transplant"],
    actionType: "call_hospital",
  },
  ent: {
    class: "elective",
    label: "ENT & Head-Neck",
    mustHaveKeywords: ["ent", "ear", "nose", "throat", "audiol", "sinus"],
    boostKeywords: ["audiology", "micro-ear surgery"],
    actionType: "call_hospital",
  },
  emergency: {
    class: "emergency",
    label: "Emergency & Trauma",
    mustHaveKeywords: ["emergency", "trauma", "critical", "resuscitation", "casualty", "icu"],
    boostKeywords: ["level-1 trauma", "24/7 er", "resuscitation bay"],
    actionType: "call_ed",
  },
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLat = searchParams.get("lat");
    const rawLng = searchParams.get("lng");
    const userLat = rawLat !== null ? parseFloat(rawLat) : null;
    const userLng = rawLng !== null ? parseFloat(rawLng) : null;

    // Patient departure coordinates (where user is physically located)
    const patientLatParam = searchParams.get("patientLat") ? parseFloat(searchParams.get("patientLat")!) : null;
    const patientLngParam = searchParams.get("patientLng") ? parseFloat(searchParams.get("patientLng")!) : null;

    const specialtyFilter = searchParams.get("specialty")?.toLowerCase().trim() || "";
    const searchFilter = searchParams.get("query")?.toLowerCase().trim() || "";
    const cityFilter = searchParams.get("city")?.toLowerCase().trim() || "";
    const urgencyLevel = searchParams.get("urgency")?.toLowerCase().trim() || "all";

    const latProvided = rawLat !== null && rawLat.trim() !== "";
    const lngProvided = rawLng !== null && rawLng.trim() !== "";
    const hasCitySearch = Boolean(cityFilter || searchFilter);

    // Validate coordinates if provided
    if (latProvided || lngProvided) {
      if (
        userLat === null ||
        userLng === null ||
        !Number.isFinite(userLat) ||
        !Number.isFinite(userLng) ||
        userLat < -90 ||
        userLat > 90 ||
        userLng < -180 ||
        userLng > 180
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid coordinates provided: latitude must be between -90 and 90, longitude between -180 and 180.",
            hospitals: [],
          },
          { status: 400 }
        );
      }
    }

    // Require either explicit coordinates or explicit city search
    if (!latProvided && !lngProvided && !hasCitySearch) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required location: valid latitude and longitude coordinates or explicit city parameter are required.",
          hospitals: [],
        },
        { status: 400 }
      );
    }

    let refLat: number;
    let refLng: number;
    let locationContext: { type: "gps" | "city"; label: string };

    if (latProvided && lngProvided && userLat !== null && userLng !== null) {
      refLat = userLat;
      refLng = userLng;
      locationContext = { type: "gps", label: "Live Location" };
    } else {
      const q = (cityFilter || searchFilter).toLowerCase().trim();
      const matchedCity =
        ALL_REGION_PRESETS.find((p) => p.name.toLowerCase() === q || p.label.toLowerCase().includes(q)) ||
        INDIAN_HOSPITALS_DATASET.find(
          (h) => h.city.toLowerCase() === q || h.address.toLowerCase().includes(q)
        );

      if (matchedCity) {
        if ("lat" in matchedCity) {
          refLat = matchedCity.lat;
          refLng = matchedCity.lng;
          locationContext = {
            type: "city",
            label: `City Center (${matchedCity.name})`,
          };
        } else {
          refLat = (matchedCity as Hospital).latitude;
          refLng = (matchedCity as Hospital).longitude;
          locationContext = {
            type: "city",
            label: `City Center (${(matchedCity as Hospital).city})`,
          };
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `Unknown city or region '${cityFilter || searchFilter}'. Please provide valid coordinates or an accredited city name.`,
            hospitals: [],
          },
          { status: 400 }
        );
      }
    }

    // True origin coords for calculating distance & driving time from where the patient is
    const hasPatientOrigin =
      patientLatParam !== null &&
      Number.isFinite(patientLatParam) &&
      patientLngParam !== null &&
      Number.isFinite(patientLngParam);
    const originLat = hasPatientOrigin ? patientLatParam! : refLat;
    const originLng = hasPatientOrigin ? patientLngParam! : refLng;

    // DYNAMIC POI DISCOVERY: Discover real local hospitals around any coordinate worldwide
    let localCandidates: Hospital[] = [];
    if (Number.isFinite(refLat) && Number.isFinite(refLng)) {
      try {
        const liveDiscovered = await discoverHospitalsNearCoordinates(refLat, refLng, 40);
        if (liveDiscovered && liveDiscovered.length > 0) {
          localCandidates = liveDiscovered;
        }
      } catch (err: any) {
        console.warn("[HospitalsAPI] Dynamic OSM discovery failed, using registry:", err.message);
      }
    }

    // Blend with any verified offline registry hospitals that are within reach (<= 65km)
    const nearbyRegistry = INDIAN_HOSPITALS_DATASET.filter((h) => {
      const d = calculateDistanceKm(refLat, refLng, h.latitude, h.longitude);
      return d <= 65;
    });

    const existingNames = new Set(localCandidates.map((h) => h.name.toLowerCase().trim()));
    const freshRegistry = nearbyRegistry.filter((h) => !existingNames.has(h.name.toLowerCase().trim()));

    // Combine local discovered + nearby registry
    let hospitals = [...localCandidates, ...freshRegistry];

    // Fallback: If no facilities found within 65km (e.g. rural area or rate limit), use closest regional hubs
    if (hospitals.length === 0) {
      const sortedByProximity = [...INDIAN_HOSPITALS_DATASET].sort((a, b) => {
        const da = calculateDistanceKm(refLat, refLng, a.latitude, a.longitude);
        const db = calculateDistanceKm(refLat, refLng, b.latitude, b.longitude);
        return da - db;
      });
      hospitals = sortedByProximity.slice(0, 10);
    }

    // STEP 1: CATEGORY SPEC EVALUATION & MUST-HAVE MATCHING
    const rule = specialtyFilter && specialtyFilter !== "all" ? CATEGORY_RULES[specialtyFilter] : null;
    const isCategoryFilterActive = Boolean(rule);

    interface EvaluatedHospital extends Hospital {
      dist: number;
      etaMinutes: number;
      isSpecialtyMatch: boolean;
      specialtyScore: number;
      matchTier: "verified" | "inferred" | "fallback";
      matchedCategory: string;
      isFallback: boolean;
      actionType: "call_ed" | "call_hospital";
      matchReasons: string[];
    }

    const evaluatedHospitals: EvaluatedHospital[] = hospitals.map((h) => {
      const dist = calculateDistanceKm(originLat, originLng, h.latitude, h.longitude);
      const etaMinutes = calculateRealisticDriveTime(dist);
      const matchReasons: string[] = [];

      const hospName = h.name.toLowerCase();
      const hospSpecs = (h.specialty || []).map((s) => s.toLowerCase());
      const famousFor = ((h as any).famousFor || getHospitalFamousFor(h)).toLowerCase();
      const capabilities = ((h as any).capabilities || []).map((c: string) => c.toLowerCase());
      const allText = `${hospName} ${hospSpecs.join(" ")} ${famousFor} ${capabilities.join(" ")}`;

      let isSpecialtyMatch = false;
      let specialtyScore = 0;

      if (rule) {
        // Must-have keyword verification
        const hasMustHave = rule.mustHaveKeywords.some((kw) => allText.includes(kw));

        if (hasMustHave) {
          isSpecialtyMatch = true;
          specialtyScore = 40;

          // Check boost keywords (e.g. ICU, Cath Lab, NICU, Ventilator, etc.)
          for (const bkw of rule.boostKeywords) {
            if (allText.includes(bkw)) {
              specialtyScore += 5;
            }
          }

          matchReasons.push(`Matched: ${rule.label}`);
        }
      } else {
        // When filter is "all", all 24/7 ERs and accredited hospitals match general care
        isSpecialtyMatch = true;
        specialtyScore = h.isEmergency24x7 ? 30 : 20;
        matchReasons.push(h.isEmergency24x7 ? "24/7 Emergency Care" : "Specialty Care");
      }

      // Check tier
      let matchTier: "verified" | "inferred" | "fallback" = "inferred";
      if (!isSpecialtyMatch && isCategoryFilterActive) {
        matchTier = "fallback";
      } else if (h.sourceType === "official_registry" || (h.accreditation && h.accreditation.length > 0)) {
        matchTier = "verified";
      }

      const isFallback = isCategoryFilterActive && !isSpecialtyMatch;
      const actionType = rule ? rule.actionType : (h.isEmergency24x7 ? "call_ed" : "call_hospital");

      if (h.isEmergency24x7) {
        matchReasons.push("24/7 Emergency Department");
      }
      if (h.accreditation && h.accreditation.length > 0) {
        matchReasons.push(`${h.accreditation.join(" & ")} Accredited`);
      }
      matchReasons.push(`${dist.toFixed(1)} km away · ~${etaMinutes}m drive`);
      if (h.acceptsPublicInsurance) {
        matchReasons.push("Ayushman / PM-JAY Empanelled");
      }

      return {
        ...h,
        dist,
        etaMinutes,
        isSpecialtyMatch,
        specialtyScore,
        matchTier,
        matchedCategory: isFallback ? "Nearest 24/7 ER (Emergency Fallback)" : (rule ? rule.label : "General Care"),
        isFallback,
        actionType,
        matchReasons,
      };
    });

    // STEP 2: CATEGORY FALLBACK DETECTION & RANKING
    let matchedFacilities = evaluatedHospitals.filter((h) => h.isSpecialtyMatch);
    const nonMatchedFacilities = evaluatedHospitals.filter((h) => !h.isSpecialtyMatch);

    let categoryFallback = false;
    let fallbackBanner: string | null = null;

    if (isCategoryFilterActive && matchedFacilities.length === 0) {
      categoryFallback = true;
      fallbackBanner = `No verified ${rule!.label} facility confirmed nearby. Showing nearest accredited 24/7 ERs for emergency care.`;
      
      // Fallback ranking: prioritize 24/7 ERs by distance
      matchedFacilities = nonMatchedFacilities.map((h) => ({
        ...h,
        isFallback: true,
        matchTier: "fallback" as const,
        matchedCategory: "Nearest 24/7 ER",
        actionType: "call_ed" as const,
        matchReasons: [
          `No confirmed ${rule!.label} facility nearby`,
          "Nearest 24/7 emergency facility for stabilization",
        ],
      }));
    }

    // Rank matching facilities
    if (rule?.class === "elective") {
      // Elective care: sort by specialtyScore (desc), rating (desc), then distance (asc)
      matchedFacilities.sort((a, b) => {
        if (b.specialtyScore !== a.specialtyScore) return b.specialtyScore - a.specialtyScore;
        const rA = a.rating || 4.0;
        const rB = b.rating || 4.0;
        if (rB !== rA) return rB - rA;
        return a.dist - b.dist;
      });
    } else {
      // Emergency care: prioritize 24/7 ER first, then proximity
      matchedFacilities.sort((a, b) => {
        const erA = a.isEmergency24x7 ? 1 : 0;
        const erB = b.isEmergency24x7 ? 1 : 0;
        if (erA !== erB) return erB - erA;
        return a.dist - b.dist;
      });
    }

    // Secondary non-matching facilities sorted by distance
    nonMatchedFacilities.sort((a, b) => a.dist - b.dist);

    const orderedPool = categoryFallback
      ? matchedFacilities
      : [...matchedFacilities, ...nonMatchedFacilities];

    const sortedHospitals = orderedPool.map((h, idx) => {
      const rank = idx + 1;
      const famousFor = (h as any).famousFor || getHospitalFamousFor(h);

      let matchLabel = "FACILITY DIRECTORY";
      if (h.isFallback) {
        matchLabel = "24/7 ER FALLBACK";
      } else if (rank === 1) {
        matchLabel = "BEST MATCH";
      } else if (h.isSpecialtyMatch) {
        matchLabel = "SPECIALTY MATCH";
      }

      return {
        id: h.id,
        name: h.name,
        specialty: h.specialty,
        famousFor,
        city: h.city,
        state: h.state,
        address: h.address,
        phone: h.phone,
        emergencyPhone: h.emergencyPhone,
        latitude: h.latitude,
        longitude: h.longitude,
        ownership: h.ownership || "private",
        affordabilityNotes: h.affordabilityNotes,
        acceptsPublicInsurance: h.acceptsPublicInsurance,
        isEmergency24x7: h.isEmergency24x7,
        rating: h.rating,
        accreditation: h.accreditation,
        cancerSpecialistsAvailable: h.cancerSpecialistsAvailable,
        distanceKm: h.dist,
        etaMinutes: h.etaMinutes,
        hasDistanceContext: true,
        distanceSource: locationContext.type,
        isEligible: !h.isFallback,
        rank,
        matchTier: h.matchTier,
        matchedCategory: h.matchedCategory,
        isFallback: h.isFallback,
        actionType: h.actionType,
        matchLabel,
        matchReasons: h.matchReasons,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${encodeURIComponent(
          `${h.name}, ${h.address}`
        )}`,
      };
    });

    return NextResponse.json({
      status: "success",
      count: sortedHospitals.length,
      categoryFallback,
      fallbackBanner,
      categoryClass: rule ? rule.class : "emergency",
      categoryLabel: rule ? rule.label : "All Hospitals & 24/7 ERs",
      locationContext,
      userLocationDetected: latProvided && lngProvided,
      userCoordinates: { lat: refLat, lng: refLng },
      hospitals: sortedHospitals,
    });
  } catch (error: any) {
    console.error("[HospitalsRouteError]", error);
    return NextResponse.json(
      {
        status: "error",
        message: process.env.NODE_ENV === "production" ? "Failed to retrieve healthcare facilities directory" : (error?.message || "Failed to fetch hospital care routing data"),
      },
      { status: 500 }
    );
  }
}
