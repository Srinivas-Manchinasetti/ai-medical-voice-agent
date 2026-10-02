/**
 * TEST HARNESS: HOSPITAL RANKING ENGINE DETERMINISM & SPECIALTY DIFFERENTIATION
 * 
 * Invariants Verified:
 * 1. Score = specialtyMatch (40) + distance (25) + rating (15) + emergency (10) + verification (10)
 * 2. Dedicated specialty centers outrank general hospitals when that specialty is selected.
 * 3. Different specialties produce DIFFERENT recommended destinations.
 * 4. Missing rating results in 0 ratingScore and never invents fake stars.
 * 5. Breakdown components match the final score.
 * 6. Ranking is deterministic: same input = same output every time.
 */

import {
  rankHospitals,
  calculateSpecialtyMatchScore,
  calculateDistanceScore,
  calculateRatingScore,
} from "../lib/care-network/hospital-ranking";
import { INDIAN_HOSPITALS_DATASET } from "../lib/hospitals-india-data";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${msg}`);
    process.exit(1);
  }
  passedTests++;
  console.log(`  ✓ ${msg}`);
}

async function runRankingEngineTests() {
  console.log("==============================================================================");
  console.log("      HOSPITAL RANKING ENGINE INVARIANTS & DIFFERENTIATION TEST               ");
  console.log("==============================================================================");

  // ─────────────────────────────────────────────────────────────────────────
  // UNIT TESTS: Individual Scoring Functions
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 1] Unit Tests: Specialty Match Scoring");
  {
    const dedicatedCardio = calculateSpecialtyMatchScore(
      { name: "Heart & Cardiac Institute", specialty: ["Cardiology"], isEmergency24x7: true },
      "cardiology"
    );
    assert(dedicatedCardio.score === 40, "Dedicated cardiac institute gets 40 pts (tier: primary_center)");
    assert(dedicatedCardio.tier === "primary_center", "Tier is primary_center");

    const multiSpecWithCardio = calculateSpecialtyMatchScore(
      { name: "City General Hospital", specialty: ["Cardiology", "Neurology", "Pediatrics"], isEmergency24x7: true },
      "cardiology"
    );
    assert(multiSpecWithCardio.score === 30, "Multi-specialty with Cardiology department gets 30 pts (accredited)");
    assert(multiSpecWithCardio.tier === "accredited_department", "Tier is accredited_department");

    const erOnly = calculateSpecialtyMatchScore(
      { name: "District Hospital", specialty: ["General Medicine"], isEmergency24x7: true },
      "cardiology"
    );
    assert(erOnly.score === 15, "Generic ER without cardiology gets 15 pts (tertiary_emergency)");
    assert(erOnly.tier === "tertiary_emergency", "Tier is tertiary_emergency");

    const unrelated = calculateSpecialtyMatchScore(
      { name: "Village Clinic", specialty: ["General Medicine"], isEmergency24x7: false },
      "cardiology"
    );
    assert(unrelated.score === 0, "Non-emergency, no cardiology gets 0 pts");
    assert(unrelated.tier === "unrelated", "Tier is unrelated");

    const allCareER = calculateSpecialtyMatchScore(
      { name: "District Hospital", specialty: ["Emergency & Trauma"], isEmergency24x7: true },
      "all"
    );
    assert(allCareER.score === 40, "24/7 ER in All Care mode gets full 40 pts");
  }

  console.log("\n[Suite 2] Unit Tests: Distance Scoring");
  {
    assert(calculateDistanceScore(0.5) === 25, "0.5 km = immediate proximity = 25 pts");
    assert(calculateDistanceScore(2.5) === 25, "2.5 km = still immediate = 25 pts");
    const d10 = calculateDistanceScore(10);
    assert(d10 > 12 && d10 < 20, `10 km distance score is between 12 and 20 (got ${d10})`);
    const d50 = calculateDistanceScore(50);
    assert(d50 >= 1 && d50 < 5, `50 km distance score is between 1 and 5 (got ${d50})`);
    assert(calculateDistanceScore(-5) === 0, "Negative distance = 0 pts");
  }

  console.log("\n[Suite 3] Unit Tests: Rating Scoring (Truth Invariant)");
  {
    assert(calculateRatingScore(undefined) === 0, "Undefined rating = 0 pts (NEVER fabricated)");
    assert(calculateRatingScore(0) === 0, "Zero rating = 0 pts");
    assert(calculateRatingScore(NaN) === 0, "NaN rating = 0 pts");
    const r49 = calculateRatingScore(4.9);
    assert(r49 > 12 && r49 <= 15, `4.9★ rating gets ${r49} pts (high range)`);
    const r35 = calculateRatingScore(3.5);
    assert(r35 > 0 && r35 < 8, `3.5★ rating gets ${r35} pts (low-mid range)`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTEGRATION TESTS: Full Ranking Pipeline on Real Dataset
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 4] Integration: Full Ranking on Guntur Region");

  const gunturCenter = { lat: 16.2985, lng: 80.4412 };
  const gunturCandidates = INDIAN_HOSPITALS_DATASET.filter((h) => h.city === "Guntur");
  console.log(`  Loaded ${gunturCandidates.length} facilities in Guntur.`);

  const allRanked = rankHospitals({
    hospitals: gunturCandidates,
    patientLocation: gunturCenter,
    careType: "all",
  });

  assert(allRanked.length > 0, "All Care produces non-empty ranked list");
  assert(allRanked[0].isTopRecommendation === true, "First result marked as top recommendation");
  assert(allRanked[0].score <= 100 && allRanked[0].score >= 0, "Score bounded [0, 100]");
  console.log(`  Top All Care: ${allRanked[0].hospital.name} (Score: ${allRanked[0].score})`);

  // Verify descending score order
  for (let i = 1; i < allRanked.length; i++) {
    assert(
      allRanked[i].score <= allRanked[i - 1].score,
      `Hospital #${i + 1} (${allRanked[i].score}) <= Hospital #${i} (${allRanked[i - 1].score})`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPECIALTY DIFFERENTIATION: Different specialties MUST produce different results
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 5] Specialty Differentiation with Synthetic Candidates");

  // Create a synthetic realistic candidate pool that covers multiple specialties
  const syntheticPool = [
    {
      id: "syn-cardiac-center", name: "Sree Cardiac Hospital",
      specialty: ["Cardiology", "Cardiac Surgery"], city: "Guntur",
      latitude: 16.300, longitude: 80.445, isEmergency24x7: true,
      rating: 4.8, sourceType: "official_registry", accreditation: ["NABH"],
    },
    {
      id: "syn-neuro-center", name: "Advanced Neuro & Stroke Institute",
      specialty: ["Neurology", "Neurosurgery", "Stroke"], city: "Guntur",
      latitude: 16.305, longitude: 80.440, isEmergency24x7: true,
      rating: 4.6, sourceType: "official_registry", accreditation: ["NABH"],
    },
    {
      id: "syn-eye-center", name: "Shankara Eye Hospital",
      specialty: ["Ophthalmology"], city: "Guntur",
      latitude: 16.295, longitude: 80.450, isEmergency24x7: false,
      rating: 4.7, sourceType: "official_registry", accreditation: [],
    },
    {
      id: "syn-ayurvedic", name: "Patanjali Ayurvedic Hospital",
      specialty: ["Ayurveda", "Traditional Medicine", "Panchakarma"], city: "Guntur",
      latitude: 16.290, longitude: 80.435, isEmergency24x7: false,
      rating: 4.2, sourceType: "verified_hospital_portal", accreditation: [],
    },
    {
      id: "syn-multispec", name: "General District Hospital",
      specialty: ["Emergency & Trauma", "Cardiology", "Neurology", "Pediatrics", "Orthopedics"],
      city: "Guntur", latitude: 16.298, longitude: 80.441,
      isEmergency24x7: true, rating: 4.5, sourceType: "official_registry",
      accreditation: ["NABH"],
    },
    {
      id: "syn-peds", name: "Rainbow Children's Hospital",
      specialty: ["Pediatrics", "NICU", "Child Health"], city: "Guntur",
      latitude: 16.302, longitude: 80.448, isEmergency24x7: true,
      rating: 4.9, sourceType: "official_registry", accreditation: ["NABH"],
    },
  ];

  const cardioResult = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "cardiology" });
  const strokeResult = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "stroke" });
  const eyeResult = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "ophthalmology" });
  const ayurvResult = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "ayurveda" });
  const pedsResult = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "pediatrics" });
  const allResult = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "all" });

  console.log(`  Cardiology → ${cardioResult[0].hospital.name}`);
  console.log(`  Stroke     → ${strokeResult[0].hospital.name}`);
  console.log(`  Eye        → ${eyeResult[0].hospital.name}`);
  console.log(`  Ayurveda   → ${ayurvResult[0].hospital.name}`);
  console.log(`  Pediatrics → ${pedsResult[0].hospital.name}`);
  console.log(`  All Care   → ${allResult[0].hospital.name}`);

  assert(cardioResult[0].hospital.id === "syn-cardiac-center", "Cardiology selects dedicated cardiac center");
  assert(strokeResult[0].hospital.id === "syn-neuro-center", "Stroke selects dedicated neuro/stroke institute");
  assert(eyeResult[0].hospital.id === "syn-eye-center", "Ophthalmology selects dedicated eye hospital");
  assert(ayurvResult[0].hospital.id === "syn-ayurvedic", "Ayurveda selects dedicated ayurvedic hospital");
  assert(pedsResult[0].hospital.id === "syn-peds", "Pediatrics selects dedicated children's hospital");

  // Core invariant: all five produce DIFFERENT destinations
  const destinations = new Set([
    cardioResult[0].hospital.id,
    strokeResult[0].hospital.id,
    eyeResult[0].hospital.id,
    ayurvResult[0].hospital.id,
    pedsResult[0].hospital.id,
  ]);
  assert(destinations.size === 5, `5 specialties produce 5 DIFFERENT destinations (got ${destinations.size})`);

  // ─────────────────────────────────────────────────────────────────────────
  // BREAKDOWN SUM INTEGRITY
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 6] Breakdown Sum Integrity");
  for (const result of [cardioResult, strokeResult, eyeResult, ayurvResult, pedsResult]) {
    for (const r of result.slice(0, 3)) {
      const sum = r.breakdown.specialtyMatch + r.breakdown.distance + r.breakdown.rating + r.breakdown.emergency + r.breakdown.verification;
      const clampedSum = Math.max(0, Math.min(100, Math.round(sum * 10) / 10));
      assert(
        Math.abs(r.score - clampedSum) < 0.2,
        `Score ${r.score} ≈ sum(breakdown) ${clampedSum} for ${r.hospital.name}`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MISSING RATING TRUTH INVARIANT
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 7] Missing Rating Truth Invariant");
  {
    const unrated = {
      id: "unrated-1", name: "Rural PHC", specialty: ["General Medicine"],
      latitude: 16.300, longitude: 80.440, isEmergency24x7: false,
    };
    const unratedResult = rankHospitals({
      hospitals: [unrated], patientLocation: gunturCenter, careType: "all",
    });
    assert(unratedResult[0].factors.rating === undefined, "Unrated hospital preserves undefined rating");
    assert(unratedResult[0].breakdown.rating === 0, "Unrated hospital gets 0 rating points");
    assert(
      !unratedResult[0].reasons.some((r: string) => r.includes("★")),
      "Unrated hospital reasons contain ZERO fabricated stars"
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISM INVARIANT
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 8] Determinism Invariant (Same input = same output)");
  {
    const run1 = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "cardiology" });
    const run2 = rankHospitals({ hospitals: syntheticPool, patientLocation: gunturCenter, careType: "cardiology" });
    assert(run1.length === run2.length, "Same number of results across runs");
    for (let i = 0; i < run1.length; i++) {
      assert(
        run1[i].hospital.id === run2[i].hospital.id && run1[i].score === run2[i].score,
        `Run1[${i}] = Run2[${i}]: ${run1[i].hospital.id} (${run1[i].score})`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSPARENT REASONS
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n[Suite 9] Transparent Reasons Generation");
  {
    const top = cardioResult[0];
    assert(top.reasons.length >= 2, `Top cardiology recommendation has >= 2 reasons (has ${top.reasons.length})`);
    assert(
      top.reasons.some((r: string) => r.toLowerCase().includes("cardiac") || r.toLowerCase().includes("cardiology")),
      "Reasons mention cardiac/cardiology specialty"
    );
    console.log(`  Reasons: ${top.reasons.join(" | ")}`);
  }

  console.log("\n==============================================================================");
  console.log(`   ✅ ALL ${passedTests}/${totalTests} HOSPITAL RANKING ENGINE INVARIANTS VERIFIED!    `);
  console.log("==============================================================================");
}

runRankingEngineTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
