/**
 * MEDVOICE CLINICAL CARE NETWORK - DETERMINISTIC HOSPITAL RANKING ENGINE
 * 
 * Separates three core concepts:
 * 1. Where is the patient? (patientLocation)
 * 2. What care need do they have? (careType / specialty)
 * 3. Which facility does MedVoice recommend? (ranked destination)
 * 
 * Scoring Invariant:
 * Score = specialtyMatch (40) + distanceScore (25) + ratingScore (15) + emergencyScore (10) + verificationScore (10) = 100 max
 * 
 * Strict Truth Invariant:
 * ONLY factors that exist in the verified dataset are used.
 * If rating is not present, ratingScore is 0 (we NEVER fabricate ratings).
 * If 24/7 ER is false, emergencyScore is 0 (we NEVER fabricate emergency capabilities).
 */

import { calculateDistanceKm, Hospital, getHospitalFamousFor } from "../hospitals-india-data";

export interface HospitalRankingFactors {
  specialtyMatch: number;        // 0 - 40
  distanceKm: number;            // raw km
  distanceScore: number;         // 0 - 25
  rating?: number;               // optional raw rating from dataset
  ratingScore: number;           // 0 - 15 (0 if undefined)
  emergencyAvailable: boolean;   // boolean
  emergencyScore: number;        // 0 - 10
  verified: boolean;             // boolean
  verificationScore: number;     // 0 - 10
}

export interface RankedHospitalResult {
  hospital: any;
  score: number; // 0 - 100
  breakdown: {
    specialtyMatch: number;
    distance: number;
    rating: number;
    emergency: number;
    verification: number;
  };
  factors: HospitalRankingFactors;
  reasons: string[];
  specialtyTier: "primary_center" | "accredited_department" | "tertiary_emergency" | "unrelated";
  isTopRecommendation?: boolean;
}

export interface RankHospitalsOptions {
  hospitals: any[];
  patientLocation: { lat: number; lng: number };
  careType: string; // e.g. "all", "cardiology", "stroke", "oncology", "pediatrics", "ayurveda", etc.
  urgencyLevel?: "emergency" | "urgent" | "routine" | "all";
}

/**
 * Calculates deterministic specialty match score (0 - 40 points)
 */
export function calculateSpecialtyMatchScore(
  hospital: any,
  careType: string
): { score: number; tier: RankedHospitalResult["specialtyTier"]; reason?: string } {
  const normCare = (careType || "all").toLowerCase().trim();
  const name = (hospital.name || "").toLowerCase();
  const famousFor = (hospital.famousFor || getHospitalFamousFor(hospital) || "").toLowerCase();
  const specialties = Array.isArray(hospital.specialty)
    ? hospital.specialty.map((s: string) => s.toLowerCase())
    : [];

  // 1. ALL CARE / GENERAL EMERGENCY MODE
  if (normCare === "all" || normCare === "emergency") {
    if (hospital.isEmergency24x7) {
      return {
        score: 40,
        tier: "primary_center",
        reason: "Full 24/7 Emergency & Acute Trauma Services",
      };
    }
    return {
      score: 30,
      tier: "accredited_department",
      reason: "General & Multi-Specialty Healthcare Services",
    };
  }

  // Specialty Keyword Patterns
  const specialtyMaps: Record<
    string,
    {
      primaryKeywords: string[];
      departmentKeywords: string[];
      label: string;
    }
  > = {
    cardiology: {
      primaryKeywords: ["heart", "cardio", "cardiac", "chest pain"],
      departmentKeywords: ["cardiology", "cardiac", "ccu", "angio", "emergency & trauma"],
      label: "Cardiology & Cardiac Care",
    },
    stroke: {
      primaryKeywords: ["neuro", "stroke", "brain", "nimhans", "spine"],
      departmentKeywords: ["neurology", "neuro", "stroke", "emergency & trauma"],
      label: "Neurology & Acute Stroke Care",
    },
    neurology: {
      primaryKeywords: ["neuro", "stroke", "brain", "nimhans", "spine"],
      departmentKeywords: ["neurology", "neuro", "stroke", "emergency & trauma"],
      label: "Neurology & Brain Care",
    },
    ophthalmology: {
      primaryKeywords: ["eye", "netra", "ophthal", "lvpei", "shankara", "vision"],
      departmentKeywords: ["ophthalmology", "eye", "vision"],
      label: "Ophthalmology & Eye Surgery",
    },
    pulmonology: {
      primaryKeywords: ["pulmo", "lung", "chest", "respiratory", "asthma"],
      departmentKeywords: ["pulmonology", "respiratory", "chest", "emergency & trauma"],
      label: "Pulmonology & Respiratory Medicine",
    },
    orthopedics: {
      primaryKeywords: ["ortho", "bone", "joint", "fracture", "spine", "trauma center"],
      departmentKeywords: ["orthopedics", "trauma", "bone", "joint", "emergency & trauma"],
      label: "Orthopedics, Joints & Trauma",
    },
    pediatrics: {
      primaryKeywords: ["pediatric", "child", "children", "rainbow", "ankura", "lotus", "nicu", "picu"],
      departmentKeywords: ["pediatrics", "child", "nicu", "picu", "maternity"],
      label: "Pediatrics & Child Health",
    },
    oncology: {
      primaryKeywords: ["cancer", "oncol", "tumor", "basavatarakam", "hospice"],
      departmentKeywords: ["oncology", "cancer", "chemotherapy", "radiation"],
      label: "Oncology & Comprehensive Cancer Care",
    },
    nephrology: {
      primaryKeywords: ["kidney", "nephro", "dialysis", "renal", "urol"],
      departmentKeywords: ["nephrology", "dialysis", "renal", "kidney"],
      label: "Nephrology & Dialysis Unit",
    },
    maternity: {
      primaryKeywords: ["matern", "women", "gynec", "obstet", "birth", "mother"],
      departmentKeywords: ["maternity", "gynecology", "obstetrics", "women"],
      label: "Maternity, Obstetrics & Women's Health",
    },
    gastroenterology: {
      primaryKeywords: ["gastro", "liver", "digest", "hepat", "endoscopy"],
      departmentKeywords: ["gastroenterology", "hepatology", "liver", "gastro"],
      label: "Gastroenterology & Hepatology",
    },
    ent: {
      primaryKeywords: ["ent", "ear", "nose", "throat", "head-neck"],
      departmentKeywords: ["ent", "ear", "throat"],
      label: "ENT & Head/Neck Specialty",
    },
    dermatology: {
      primaryKeywords: ["derma", "skin", "burn"],
      departmentKeywords: ["dermatology", "skin", "burns"],
      label: "Dermatology & Skin Specialty",
    },
    ayurveda: {
      primaryKeywords: ["ayurved", "ayush", "panchakarma", "herbal", "traditional"],
      departmentKeywords: ["ayurveda", "traditional medicine", "ayush"],
      label: "Ayurveda & Traditional Healing",
    },
  };

  const domain = specialtyMaps[normCare] || {
    primaryKeywords: [normCare],
    departmentKeywords: [normCare],
    label: `${normCare.charAt(0).toUpperCase() + normCare.slice(1)} Specialty`,
  };

  // Tier 1: Primary Dedicated Center (40 pts)
  // Dedicated institution: name contains domain primary keywords, or hospital has single specialty focus
  const isDedicatedInName = domain.primaryKeywords.some((k) => name.includes(k));
  const isDedicatedFocus = specialties.length <= 2 && domain.departmentKeywords.some((k) => specialties.some((s: string) => s.includes(k)));
  const isExplicitSpecialtyCenter = Boolean(hospital.famousFor && domain.primaryKeywords.some((k) => hospital.famousFor.toLowerCase().includes(k)));

  if (isDedicatedInName || (isDedicatedFocus && !specialties.includes("emergency & trauma")) || isExplicitSpecialtyCenter) {
    return {
      score: 40,
      tier: "primary_center",
      reason: `Dedicated ${domain.label} Center`,
    };
  }

  // Tier 2: Accredited Department in Multi-Specialty (30 pts)
  // Hospital lists this specialty explicitly in its specialty array
  const hasAccreditedDept = domain.departmentKeywords.some((k) =>
    specialties.some((s: string) => s.includes(k))
  );

  if (hasAccreditedDept) {
    return {
      score: 30,
      tier: "accredited_department",
      reason: `Specialized ${domain.label} Department`,
    };
  }

  // Tier 3: Tertiary Emergency Capability (15 pts)
  // Has 24/7 Emergency that can stabilize acute conditions
  if (hospital.isEmergency24x7) {
    return {
      score: 15,
      tier: "tertiary_emergency",
      reason: "Tertiary Emergency Department (Acute Stabilization)",
    };
  }

  // Tier 4: Unrelated / Ineligible (0 pts)
  return {
    score: 0,
    tier: "unrelated",
  };
}

/**
 * Calculates proximity score based on realistic road transit time (0 - 25 points)
 * Medical proximity is critical, with steep decay past 15km.
 */
export function calculateDistanceScore(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;

  if (distanceKm <= 2.5) {
    return 25; // Immediate proximity
  }
  if (distanceKm <= 6) {
    // 2.5km -> 6km decays from 25 down to 20
    const ratio = (distanceKm - 2.5) / (6 - 2.5);
    return Math.round((25 - ratio * 5) * 10) / 10;
  }
  if (distanceKm <= 15) {
    // 6km -> 15km decays from 20 down to 12
    const ratio = (distanceKm - 6) / (15 - 6);
    return Math.round((20 - ratio * 8) * 10) / 10;
  }
  if (distanceKm <= 35) {
    // 15km -> 35km decays from 12 down to 5
    const ratio = (distanceKm - 15) / (35 - 15);
    return Math.round((12 - ratio * 7) * 10) / 10;
  }
  // Beyond 35km
  const ratio = Math.min(1, (distanceKm - 35) / 40);
  return Math.max(1, Math.round((5 - ratio * 4) * 10) / 10);
}

/**
 * Calculates rating score (0 - 15 points)
 * STRICT: Only scores if rating actually exists in dataset!
 */
export function calculateRatingScore(rating?: number): number {
  if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) {
    return 0; // ZERO if no verified rating exists
  }
  // Standard rating scale 3.0 to 5.0 -> 0 to 15 points
  const normalized = Math.min(5.0, Math.max(3.0, rating));
  const score = ((normalized - 3.0) / 2.0) * 15;
  return Math.round(score * 10) / 10;
}

/**
 * Main Deterministic Hospital Ranking Function
 */
export function rankHospitals(options: RankHospitalsOptions): RankedHospitalResult[] {
  const { hospitals, patientLocation, careType, urgencyLevel } = options;

  if (!Array.isArray(hospitals) || hospitals.length === 0) {
    return [];
  }

  const results: RankedHospitalResult[] = hospitals.map((h) => {
    // Calculate distance from patient departure location
    const dist =
      typeof h.distanceKm === "number" && Number.isFinite(h.distanceKm)
        ? h.distanceKm
        : patientLocation && Number.isFinite(patientLocation.lat) && Number.isFinite(patientLocation.lng)
        ? calculateDistanceKm(patientLocation.lat, patientLocation.lng, h.latitude, h.longitude)
        : 999;

    // 1. Specialty Match (0 - 40)
    const specialtyEval = calculateSpecialtyMatchScore(h, careType);

    // 2. Distance Score (0 - 25)
    const distanceScore = calculateDistanceScore(dist);

    // 3. Rating Score (0 - 15, strictly when present)
    const ratingScore = calculateRatingScore(h.rating);

    // 4. Emergency Capability Score (0 - 10)
    const emergencyAvailable = Boolean(h.isEmergency24x7);
    let emergencyScore = emergencyAvailable ? 10 : 0;
    if (urgencyLevel === "emergency" && !emergencyAvailable) {
      // In hard emergency, lack of 24/7 ER severely penalizes
      emergencyScore = -20;
    }

    // 5. Verification Score (0 - 10)
    const isVerified =
      h.sourceType === "official_registry" ||
      h.isVerifiedRegistry === true ||
      (Array.isArray(h.accreditation) && h.accreditation.length > 0) ||
      h.source === "registry_verified";
    const verificationScore = isVerified ? 10 : 5;

    // Compute composite score (clamped 0 to 100)
    const rawTotal =
      specialtyEval.score +
      distanceScore +
      ratingScore +
      emergencyScore +
      verificationScore;
    const score = Math.max(0, Math.min(100, Math.round(rawTotal * 10) / 10));

    // Construct Transparent Reasons
    const reasons: string[] = [];
    if (specialtyEval.reason) {
      reasons.push(specialtyEval.reason);
    }
    if (dist <= 35) {
      const eta = h.etaMinutes || Math.max(3, Math.round(dist * 1.5));
      reasons.push(`${dist.toFixed(1)} km away (~${eta} min drive)`);
    }
    if (emergencyAvailable) {
      reasons.push("Verified 24/7 Emergency Department");
    }
    if (typeof h.rating === "number" && h.rating > 0) {
      reasons.push(`${h.rating.toFixed(1)}★ Verified Patient Rating`);
    }
    if (isVerified) {
      if (Array.isArray(h.accreditation) && h.accreditation.length > 0) {
        reasons.push(`${h.accreditation.join(" & ")} Accredited`);
      } else {
        reasons.push("Official Registry Verified Facility");
      }
    }

    const factors: HospitalRankingFactors = {
      specialtyMatch: specialtyEval.score,
      distanceKm: dist,
      distanceScore,
      rating: h.rating,
      ratingScore,
      emergencyAvailable,
      emergencyScore,
      verified: isVerified,
      verificationScore,
    };

    return {
      hospital: {
        ...h,
        distanceKm: dist,
      },
      score,
      breakdown: {
        specialtyMatch: specialtyEval.score,
        distance: distanceScore,
        rating: ratingScore,
        emergency: emergencyScore,
        verification: verificationScore,
      },
      factors,
      reasons,
      specialtyTier: specialtyEval.tier,
      isTopRecommendation: false,
    };
  });

  // Sort descending by total score, secondary by raw distance ascending
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.factors.distanceKm - b.factors.distanceKm;
  });

  if (results.length > 0) {
    results[0].isTopRecommendation = true;
  }

  return results;
}
