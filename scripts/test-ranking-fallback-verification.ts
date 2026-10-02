import { GET } from "../app/api/hospitals/route";
import { NextRequest } from "next/server";
import { evaluateAndRankForSpecialty, normalizeHospitalName, deduplicateAndMergeHospitals } from "../lib/care-network/evaluator";

async function runVerification() {
  console.log("==============================================================================");
  console.log("   HOSPITAL RANKING, DEDUPLICATION & LOCAL EVALUATION VERIFICATION SUITE   ");
  console.log("==============================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: Name Normalization
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[Test 1] Canonical Name Normalization");
  {
    assert("'Vijaya Hospital' → 'vijaya'", normalizeHospitalName("Vijaya Hospital") === "vijaya");
    assert("'vijaya hospital' → 'vijaya'", normalizeHospitalName("vijaya hospital") === "vijaya");
    assert("'Vijaya Multi Speciality Hospital' → 'vijaya'", normalizeHospitalName("Vijaya Multi Speciality Hospital") === "vijaya");
    assert("'Vijaya Health Care' → 'vijaya'", normalizeHospitalName("Vijaya Health Care") === "vijaya");
    assert("'Ramesh Hospitals' → 'ramesh'", normalizeHospitalName("Ramesh Hospitals") === "ramesh");
    assert("'Aster Ramesh Hospital' → 'aster ramesh'", normalizeHospitalName("Aster Ramesh Hospital") === "aster ramesh");
    assert("'GGH Guntur' → 'ggh guntur'", normalizeHospitalName("GGH Guntur") === "ggh guntur");
    assert("Different names stay different", normalizeHospitalName("Apollo Hospital") !== normalizeHospitalName("Ramesh Hospital"));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: Deduplication
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 2] Multi-Signal Deduplication");
  {
    const dupes: any[] = [
      {
        id: "h1",
        name: "Vijaya Hospital",
        latitude: 16.3015,
        longitude: 80.4380,
        phone: "+91 863 223 4567",
        specialty: ["Cardiology"],
        isEmergency24x7: true,
        accreditation: ["NABH"],
        sourceType: "official_registry",
      },
      {
        id: "osm-node-123",
        name: "vijaya hospital",
        latitude: 16.3018,
        longitude: 80.4382,
        phone: "+91 8000 000 000",
        specialty: ["Emergency & Trauma"],
        isEmergency24x7: true,
        accreditation: ["State Health Authority"],
        sourceType: "osm",
      },
      {
        id: "h2",
        name: "Ramesh Hospitals",
        latitude: 16.3040,
        longitude: 80.4400,
        phone: "+91 863 222 3333",
        specialty: ["Cardiology"],
        isEmergency24x7: true,
        accreditation: ["NABH", "JCI"],
        sourceType: "official_registry",
      },
    ];
    const deduped = deduplicateAndMergeHospitals(dupes);
    assert("Merged 3 records into 2", deduped.length === 2);
    assert("First merged record is the curated Vijaya Hospital", deduped[0].phone === "+91 863 223 4567");
    assert("Merged specialties include both Cardiology and Emergency & Trauma",
      deduped[0].specialty.includes("Cardiology") && deduped[0].specialty.includes("Emergency & Trauma")
    );
    assert("Second record is Ramesh Hospitals", deduped[1].name === "Ramesh Hospitals");

    // Non-duplicate: same name but > 350m apart → should NOT merge
    const farDupes: any[] = [
      { id: "a", name: "Apollo Hospital", latitude: 16.30, longitude: 80.44, specialty: ["General"], phone: "123" },
      { id: "b", name: "Apollo Hospital", latitude: 16.35, longitude: 80.49, specialty: ["General"], phone: "456" },
    ];
    const farResult = deduplicateAndMergeHospitals(farDupes);
    assert("Same name but >350m apart: NOT merged (stay as 2)", farResult.length === 2);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: API returns ALL hospitals (no specialty filtering)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 3] API Returns Full Dataset (No Specialty Filtering)");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365"
    );
    const res = await GET(req);
    const data = await res.json();

    assert("Status is 200 OK", res.status === 200);
    assert("Returns hospitals array", Array.isArray(data.hospitals));
    assert("Returns > 0 hospitals", data.hospitals.length > 0);
    assert("categoryFallback is false (no specialty evaluated server-side)", data.categoryFallback === false);
    assert("categoryLabel is 'All Hospitals & 24/7 ERs'", data.categoryLabel === "All Hospitals & 24/7 ERs");

    const first = data.hospitals[0];
    assert("First hospital has distanceKm", typeof first.distanceKm === "number" && Number.isFinite(first.distanceKm));
    assert("First hospital has etaMinutes", typeof first.etaMinutes === "number" && Number.isFinite(first.etaMinutes));
    assert("First hospital has specialty array", Array.isArray(first.specialty));
    assert("First hospital has famousFor string", typeof first.famousFor === "string");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4: Client-Side Specialty Evaluation (Cardiology)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 4] Client-Side Evaluation: Cardiology");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365"
    );
    const res = await GET(req);
    const data = await res.json();
    const allHospitals = data.hospitals;

    const result = evaluateAndRankForSpecialty(allHospitals, "cardiology");
    assert("Evaluation returns ranked list", result.ranked.length > 0);
    assert("categoryLabel is Cardiology", result.categoryLabel === "Cardiology");
    assert("categoryClass is emergency", result.categoryClass === "emergency");

    const top = result.ranked[0];
    assert("Top ranked hospital has rank 1", top.rank === 1);
    assert("Top ranked hospital is a specialty match", top.isSpecialtyMatch === true);
    assert("Top ranked hospital is eligible", top.isEligible === true);
    assert("Top ranked hospital actionType is call_ed", top.actionType === "call_ed");
    assert("Top ranked hospital has matchReasons", Array.isArray(top.matchReasons) && top.matchReasons.length > 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5: Client-Side Specialty Evaluation (Dermatology → Fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 5] Client-Side Evaluation: Dermatology (Potential Fallback)");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365"
    );
    const res = await GET(req);
    const data = await res.json();
    const allHospitals = data.hospitals;

    const result = evaluateAndRankForSpecialty(allHospitals, "dermatology");
    assert("Evaluation returns results", result.ranked.length > 0);
    assert("categoryLabel is Skin & Dermatology", result.categoryLabel === "Skin & Dermatology");
    assert("categoryClass is elective", result.categoryClass === "elective");

    if (result.categoryFallback) {
      assert("Fallback banner is present", typeof result.fallbackBanner === "string" && result.fallbackBanner!.includes("24/7 ER"));
      assert("First hospital is marked as fallback", result.ranked[0].isFallback === true);
      assert("First hospital actionType is call_ed (fallback to ER)", result.ranked[0].actionType === "call_ed");
    } else {
      assert("Non-fallback: first hospital is specialty match", result.ranked[0].isSpecialtyMatch === true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 6: Client-Side Specialty Evaluation (Eye Care)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 6] Client-Side Evaluation: Eye Care (Elective)");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365"
    );
    const res = await GET(req);
    const data = await res.json();

    const result = evaluateAndRankForSpecialty(data.hospitals, "eye");
    assert("categoryLabel is Eye & Ophthalmology", result.categoryLabel === "Eye & Ophthalmology");
    assert("categoryClass is elective", result.categoryClass === "elective");

    if (!result.categoryFallback && result.ranked.length > 0) {
      assert("Top hospital actionType is call_hospital for elective eye care", result.ranked[0].actionType === "call_hospital");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 7: "All" specialty filter → every hospital is eligible
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 7] Client-Side Evaluation: 'all' filter");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365"
    );
    const res = await GET(req);
    const data = await res.json();

    const result = evaluateAndRankForSpecialty(data.hospitals, "all");
    assert("All hospitals are eligible when filter is 'all'",
      result.ranked.every((h: any) => h.isEligible === true)
    );
    assert("No fallback when filter is 'all'", result.categoryFallback === false);
    assert("categoryLabel is 'All Hospitals & 24/7 ERs'", result.categoryLabel === "All Hospitals & 24/7 ERs");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 8: Deduplication in the API response
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Test 8] API Deduplication (No Duplicate Names Within 350m)");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365"
    );
    const res = await GET(req);
    const data = await res.json();
    const hospitals = data.hospitals;

    // Check no two hospitals have the same canonical name AND are within 350m
    let foundDuplicate = false;
    for (let i = 0; i < hospitals.length; i++) {
      for (let j = i + 1; j < hospitals.length; j++) {
        const nameA = normalizeHospitalName(hospitals[i].name);
        const nameB = normalizeHospitalName(hospitals[j].name);
        if (nameA === nameB) {
          // Check distance
          const R = 6371;
          const dLat = (hospitals[j].latitude - hospitals[i].latitude) * Math.PI / 180;
          const dLon = (hospitals[j].longitude - hospitals[i].longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(hospitals[i].latitude * Math.PI / 180) * Math.cos(hospitals[j].latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist <= 0.35) {
            foundDuplicate = true;
            console.error(`    DUPLICATE FOUND: "${hospitals[i].name}" and "${hospitals[j].name}" (${dist.toFixed(3)} km)`);
          }
        }
      }
    }
    assert("No duplicate hospitals in API response (same canonical name within 350m)", !foundDuplicate);
  }

  console.log("\n==============================================================================");
  console.log(`   RESULTS: ${passed}/${total} passed`);
  console.log("==============================================================================\n");

  if (passed < total) {
    process.exit(1);
  }
}

runVerification();
