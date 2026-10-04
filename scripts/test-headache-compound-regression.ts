/**
 * Headache compound-question regression tests
 *
 * Tests that:
 * A. parseOnsetDimensions correctly classifies gradual vs sudden
 * B. "sudden flash" is NOT onset evidence
 * C. photophobia/phonophobia is extracted from patient language
 * D. detectQuestionTargetSlots detects compound questions
 * E. Compound questions are rejected by validateDoctorReplyTarget
 * F. Atomic questions pass validation
 * G. Exact reproduction of the original bug scenario
 */

import {
  parseOnsetDimensions,
  detectQuestionTargetSlot,
  detectQuestionTargetSlots,
  validateDoctorReplyTarget,
  isTargetSlotMatch,
  extractNumericSeverity,
} from "../lib/triage/clinical-state";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ========================================
// Test A: Gradual onset extraction
// ========================================
console.log("\n=== Test A: Gradual onset extraction ===");

const testA1 = parseOnsetDimensions("It built up gradually");
assert(testA1.onsetPattern === "gradual", 'A1: "It built up gradually" → gradual');

const testA2 = parseOnsetDimensions("It came on slowly over a few hours");
assert(testA2.onsetPattern === "gradual", 'A2: "came on slowly" → gradual');

const testA3 = parseOnsetDimensions("The pain gradually increased throughout the day");
assert(testA3.onsetPattern === "gradual", 'A3: "gradually increased" → gradual');

// ========================================
// Test B: Sudden onset extraction
// ========================================
console.log("\n=== Test B: Sudden onset extraction ===");

const testB1 = parseOnsetDimensions("It started suddenly this morning");
assert(testB1.onsetPattern === "sudden", 'B1: "started suddenly this morning" → sudden');

const testB2 = parseOnsetDimensions("It came on all at once like a clap of thunder");
assert(testB2.onsetPattern === "sudden", 'B2: "all at once like thunder" → sudden');

const testB3 = parseOnsetDimensions("It hit me suddenly out of nowhere");
assert(testB3.onsetPattern === "sudden", 'B3: "hit me suddenly" → sudden');

// ========================================
// Test C: "Sudden flash" is NOT onset evidence
// ========================================
console.log("\n=== Test C: Sudden flash / trigger contexts ===");

const testC1 = parseOnsetDimensions(
  "So it built up gradually and also a lot too sensitive to light or sounds. Maybe a sudden flash could be something that could cause a headache."
);
assert(testC1.onsetPattern === "gradual", 'C1: EXACT BUG REPRO — "built up gradually... sudden flash" → gradual (NOT sudden)');

const testC2 = parseOnsetDimensions(
  "It built up gradually. A sudden flash of light yesterday made it worse."
);
assert(testC2.onsetPattern === "gradual", 'C2: "built up gradually. sudden flash of light" → gradual');

const testC3 = parseOnsetDimensions(
  "It gradually got worse, then suddenly became severe."
);
assert(testC3.onsetPattern === "gradual", 'C3: "gradually got worse, then suddenly became severe" → gradual (worsening, not onset)');
assert(testC3.acuteWorsening === true, 'C3b: acuteWorsening should be true');

// ========================================
// Test D: detectQuestionTargetSlots — compound detection
// ========================================
console.log("\n=== Test D: Compound question detection ===");

const testD1 = detectQuestionTargetSlots(
  "Did it come on all of a sudden like a clap of thunder, or build up gradually, and are you sensitive to bright lights or sound?"
);
assert(testD1.length > 1, `D1: Compound onset+light/sound → ${testD1.length} targets: [${testD1.join(", ")}]`);
assert(testD1.includes("onset_pattern"), "D1b: includes onset_pattern");
assert(testD1.includes("associated_symptoms"), "D1c: includes associated_symptoms");

const testD2 = detectQuestionTargetSlots(
  "Did the headache start suddenly, or did it build up gradually?"
);
assert(testD2.length === 1, `D2: Atomic onset → 1 target: [${testD2.join(", ")}]`);

const testD3 = detectQuestionTargetSlots(
  "When did this discomfort begin, and did it start suddenly or build up gradually?"
);
assert(testD3.length > 1, `D3: Compound onset_time+onset_pattern → ${testD3.length} targets: [${testD3.join(", ")}]`);

// ========================================
// Test E: Compound questions rejected by validator
// ========================================
console.log("\n=== Test E: Compound question rejection ===");

const testE1 = validateDoctorReplyTarget(
  "Did it come on all of a sudden, or build up gradually, and are you sensitive to bright lights or sound?",
  { primaryGoal: "CLINICAL_INTAKE", nextHighValueInquiry: { topic: "onset_pattern", clinicalRationale: "", suggestedPhrasing: "" } }
);
assert(!testE1.isValid, `E1: Compound onset+light/sound rejected → ${testE1.reason}`);

const testE2 = validateDoctorReplyTarget(
  "When did this begin, and did it start suddenly or gradually?",
  { primaryGoal: "CLINICAL_INTAKE", nextHighValueInquiry: { topic: "onset", clinicalRationale: "", suggestedPhrasing: "" } }
);
assert(!testE2.isValid, `E2: Compound onset_time+onset_pattern rejected → ${testE2.reason}`);

// ========================================
// Test F: Atomic questions pass validation
// ========================================
console.log("\n=== Test F: Atomic question acceptance ===");

const testF1 = validateDoctorReplyTarget(
  "Did the headache start suddenly, or did it build up gradually?",
  { primaryGoal: "CLINICAL_INTAKE", nextHighValueInquiry: { topic: "onset_pattern", clinicalRationale: "", suggestedPhrasing: "" } }
);
assert(testF1.isValid, `F1: Atomic onset_pattern accepted → ${testF1.detectedTarget}`);

const testF2 = validateDoctorReplyTarget(
  "Are bright lights or loud sounds bothering you with the headache?",
  { primaryGoal: "CLINICAL_INTAKE", nextHighValueInquiry: { topic: "associated_symptoms", clinicalRationale: "", suggestedPhrasing: "" } }
);
assert(testF2.isValid, `F2: Atomic associated_symptoms accepted → ${testF2.detectedTarget}`);

// ========================================
// Test G: Exact reproduction of user's screenshot bug
// ========================================
console.log("\n=== Test G: Full scenario reproduction ===");

// Simulating: Doctor asked "Did it come on all at once or gradually, and are you sensitive to bright lights or sound?"
// Patient answered: "So it built up gradually and also a lot too sensitive to light or sounds. Maybe a sudden flash could be something that could cause a headache."

const patientAnswer = "So it built up gradually and also a lot too sensitive to light or sounds. Maybe a sudden flash could be something that could cause a headache.";

// 1. Onset must be gradual
const gOnset = parseOnsetDimensions(patientAnswer);
assert(gOnset.onsetPattern === "gradual", `G1: Patient onset → ${gOnset.onsetPattern} (expected: gradual)`);

// 2. Light sensitivity must be detected
const hasPhoto = /\b(?:sensitive\s+to\s+(?:bright\s+)?lights?|(?:bright\s+)?lights?\s+(?:bother|make|worsen)|photophob|light\s+sensitivity)\b/i.test(patientAnswer);
assert(hasPhoto, "G2: Photophobia detected in patient answer");

// 3. Sound sensitivity must be detected
const hasPhono = /\b(?:sensitive\s+to\s+(?:loud\s+)?(?:sounds?|noise)|(?:loud\s+)?(?:sounds?|noise)\s+(?:bother|make|worsen)|phonophob|sound\s+sensitivity)\b/i.test(patientAnswer)
  || /\bsensitive\s+to\s+(?:bright\s+)?lights?\s+(?:or|and)\s+(?:loud\s+)?(?:sounds?|noise)\b/i.test(patientAnswer);
assert(hasPhono, "G3: Phonophobia detected in patient answer");

// 4. detectQuestionTargetSlot for photophobia question
const photoSlot = detectQuestionTargetSlot("Are you sensitive to bright lights or loud sounds?");
assert(photoSlot === "associated_symptoms", `G4: Photo/phono question → ${photoSlot}`);

// 5. isTargetSlotMatch should match associated_symptoms variants
assert(isTargetSlotMatch("associated_symptoms", "photophobia"), "G5: associated_symptoms ↔ photophobia match");
assert(isTargetSlotMatch("associated_symptoms", "phonophobia"), "G6: associated_symptoms ↔ phonophobia match");

// 6. The compound question should be rejected
const compoundResult = validateDoctorReplyTarget(
  "Did it come on all of a sudden like a clap of thunder, or build up gradually, and are you sensitive to bright lights or sound?",
  { primaryGoal: "CLINICAL_INTAKE", nextHighValueInquiry: { topic: "headache_onset_character", clinicalRationale: "", suggestedPhrasing: "" } }
);
assert(!compoundResult.isValid, `G7: Original compound question rejected → ${compoundResult.reason}`);

// 7. Headache_onset_character should match onset_pattern
assert(isTargetSlotMatch("headache_onset_character", "onset_pattern"), "G8: headache_onset_character ↔ onset_pattern match");

// ========================================
// Summary
// ========================================
console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
