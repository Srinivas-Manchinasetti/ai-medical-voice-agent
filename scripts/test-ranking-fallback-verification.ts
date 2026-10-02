import { GET } from "../app/api/hospitals/route";
import { NextRequest } from "next/server";

async function runVerification() {
  console.log("==============================================================================");
  console.log("   HOSPITAL RANKING, MATCH TIERING & CATEGORY FALLBACK VERIFICATION SUITE   ");
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

  // TEST 1: Skin & Burns (Dermatology) in Guntur (16.3067, 80.4365)
  console.log("[Test 1] Category Fallback Verification (Skin & Burns / Dermatology)");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365&specialty=dermatology"
    );
    const res = await GET(req);
    const data = await res.json();

    assert("Status is 200 OK", res.status === 200);
    assert("Category fallback flag is true or properly set", typeof data.categoryFallback === "boolean");
    assert("Category label is Skin & Dermatology", data.categoryLabel === "Skin & Dermatology");
    assert("Category class is elective", data.categoryClass === "elective");

    if (data.categoryFallback) {
      assert("Fallback banner message is present", typeof data.fallbackBanner === "string" && data.fallbackBanner.includes("24/7 ER"));
      assert("First hospital is marked as fallback", data.hospitals[0].isFallback === true);
      assert("First hospital matchTier is 'fallback'", data.hospitals[0].matchTier === "fallback");
      assert("First hospital actionType is 'call_ed' (since it is a 24/7 ER)", data.hospitals[0].actionType === "call_ed");
      assert("First hospital has 24/7 ER enabled", data.hospitals[0].isEmergency24x7 === true);
    }
  }

  // TEST 2: Pediatrics in Guntur (GGH Guntur has pediatric / child care)
  console.log("\n[Test 2] Pediatrics Match Verification");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365&specialty=pediatrics"
    );
    const res = await GET(req);
    const data = await res.json();

    assert("Status is 200 OK", res.status === 200);
    assert("Category class is emergency", data.categoryClass === "emergency");
    assert("At least one hospital returned", data.hospitals && data.hospitals.length > 0);
    const topHosp = data.hospitals[0];
    assert("Top hospital rank is 1", topHosp.rank === 1);
    assert("Top hospital has matchReasons", Array.isArray(topHosp.matchReasons) && topHosp.matchReasons.length > 0);
    assert("Top hospital actionType is 'call_ed'", topHosp.actionType === "call_ed");
    assert("Top hospital distanceKm is finite number", Number.isFinite(topHosp.distanceKm));
    assert("Top hospital etaMinutes is finite number", Number.isFinite(topHosp.etaMinutes));
  }

  // TEST 3: Interventional Cardiology
  console.log("\n[Test 3] Cardiology Match Verification");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365&specialty=cardiology"
    );
    const res = await GET(req);
    const data = await res.json();

    assert("Status is 200 OK", res.status === 200);
    assert("Category fallback is false (verified facilities exist)", data.categoryFallback === false);
    const top = data.hospitals[0];
    assert("Top hospital is verified match", top.matchTier === "verified");
    assert("Top hospital is eligible", top.isEligible === true);
    assert("Top hospital is Aster Ramesh or cardiac center", top.name.toLowerCase().includes("ramesh") || top.name.toLowerCase().includes("heart") || top.specialty.some((s: string) => s.toLowerCase().includes("cardio")));
    assert("Top hospital actionType is 'call_ed'", top.actionType === "call_ed");
  }

  // TEST 4: Eye & Ophthalmology Elective Match
  console.log("\n[Test 4] Eye Care Elective Match Verification");
  {
    const req = new NextRequest(
      "http://localhost:3000/api/hospitals?lat=16.3067&lng=80.4365&patientLat=16.3067&patientLng=80.4365&specialty=eye"
    );
    const res = await GET(req);
    const data = await res.json();

    assert("Status is 200 OK", res.status === 200);
    assert("Category class is elective", data.categoryClass === "elective");
    const top = data.hospitals[0];
    if (!data.categoryFallback) {
      assert("Top hospital actionType is 'call_hospital' for elective eye care", top.actionType === "call_hospital");
    }
  }

  console.log("\n==============================================================================");
  console.log(`   TOTAL TESTS: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log("==============================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
