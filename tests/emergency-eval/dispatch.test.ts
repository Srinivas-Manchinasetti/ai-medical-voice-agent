import {
  computeClinicalAuditHash,
  verifyClinicalAuditHash,
  generatePreArrivalDirectives,
} from "../../lib/emergency/dispatch";

function runDispatchAndAuditTests() {
  console.log("==============================================================================");
  console.log("       HOSPITAL ED PRE-ARRIVAL DISPATCH & SHA-256 AUDIT HARNESS               ");
  console.log("==============================================================================");

  const canonicalCase = {
    consultationId: "MED-CONSULT-8831",
    patientId: "P-1002",
    timestamp: "2026-09-04T12:30:00.000Z",
    esiScore: 2,
    triageLevel: "emergency",
    icd10Codes: ["I20.9", "I21.9"],
    chiefComplaint: "Substernal chest pressure radiating to left arm with diaphoresis",
  };

  // 1. Test hash computation
  console.log("\n[1/4] Computing Cryptographic SHA-256 Clinical Audit Hash:");
  const originalHash = computeClinicalAuditHash(canonicalCase);
  console.log(`  ✓ Canonical SHA-256: ${originalHash}`);
  if (!originalHash || originalHash.length !== 64) {
    throw new Error("Audit hash must be a valid 64-character SHA-256 hex string");
  }

  // 2. Test positive verification
  console.log("\n[2/4] Testing Tamper-Evident Verification (Positive Match):");
  const isValid = verifyClinicalAuditHash(canonicalCase, originalHash);
  console.log(`  ✓ Hash Integrity Check: ${isValid ? "PASS (Authentic Record)" : "FAIL"}`);
  if (!isValid) throw new Error("Verification of unmodified payload must pass");

  // 3. Test negative verification (Tamper detection)
  console.log("\n[3/4] Testing Anti-Tampering Shield (Simulating Malicious Payload Alteration):");
  const tamperedCase = {
    ...canonicalCase,
    triageLevel: "routine", // Malicious downgrade of emergency
  };
  const isTamperedValid = verifyClinicalAuditHash(tamperedCase, originalHash);
  console.log(`  ✓ Tamper Detected: ${!isTamperedValid ? "PASS (Alteration Flagged)" : "FAIL"}`);
  if (isTamperedValid) throw new Error("Tampered record must be rejected by verification engine");

  // 4. Test Pre-Arrival Directives Generation for Key Categories
  console.log("\n[4/4] Validating Clinical Emergency Bay Directives & Specialty Pathways:");
  
  // ACS Cardiac Case
  const cardiacDirectives = generatePreArrivalDirectives(2, ["ACS_CHEST_PAIN_WITH_HIGH_RISK_RADIATION_OR_DIAPHORESIS"]);
  console.log(`  ✓ Cardiac Pathway -> Bay: "${cardiacDirectives.bay}" | Directives: ${cardiacDirectives.directives.length}`);
  if (!cardiacDirectives.bay.includes("Cardiac")) throw new Error("Expected Cardiac Bay for ACS case");

  // Stroke Case
  const strokeDirectives = generatePreArrivalDirectives(2, ["BE_FAST_ACUTE_ISCHEMIC_STROKE_SYMPTOMS"]);
  console.log(`  ✓ Stroke Pathway  -> Bay: "${strokeDirectives.bay}" | Directives: ${strokeDirectives.directives.length}`);
  if (!strokeDirectives.bay.includes("Neuro")) throw new Error("Expected Neuro Bay for Stroke case");

  // Airway Case
  const airwayDirectives = generatePreArrivalDirectives(1, ["IMMEDIATE_AIRWAY_OR_HEMODYNAMIC_COLLAPSE"]);
  console.log(`  ✓ Airway Pathway  -> Bay: "${airwayDirectives.bay}" | Directives: ${airwayDirectives.directives.length}`);
  if (!airwayDirectives.bay.includes("Resuscitation")) throw new Error("Expected Resuscitation Bay for Airway case");

  console.log("\n==============================================================================");
  console.log("✅ ALL HOSPITAL DISPATCH & CRYPTOGRAPHIC AUDIT TESTS PASSED (100% SECURE)");
  console.log("==============================================================================\n");
}

runDispatchAndAuditTests();
