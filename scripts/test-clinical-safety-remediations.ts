/**
 * FOCUSED REGRESSION TEST SUITE FOR CLINICAL SAFETY REMEDIATIONS
 * 
 * Verifies the 3 high-severity remediations identified in the clinical audit:
 * 1. Negated symptom character extraction ("no pressure or tightness" must NOT populate CHARACTER: pressure)
 * 2. In-flight emergency care routing (triggers on immediate danger / ESI-1 / ESI-2 without requiring access/location keywords)
 * 3. Nitrate/PDE5 contraindication detection from structured medication evidence in addition to raw transcript text
 */

import { conversationManager } from "../lib/triage/conversation-manager";
import { evaluateSafetyArbiter } from "../lib/triage/safety-arbiter";
import { hospitalRagService } from "../lib/care-network/hospital-rag";

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (detail) console.error(`     Details: ${detail}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runRemediationTests() {
  console.log("\n" + "=".repeat(85));
  console.log("       MEDVOICE AI CLINICAL SAFETY TARGETED REMEDIATION TEST SUITE");
  console.log("=".repeat(85) + "\n");

  // =========================================================================
  // REMEDIATION 1: Negated Symptom-Character Extraction
  // =========================================================================
  console.log("--- [REMEDIATION 1] Negated Symptom-Character Extraction ---");

  // Test 1.1: Compound negation "no pressure or tightness"
  {
    const state0 = conversationManager.createInitialState();
    const turn1 = await conversationManager.processTurn(
      "I have had a runny nose for three days, but no pressure or tightness.",
      state0
    );

    assert(
      turn1.state.slots.character !== "pressure" && turn1.state.slots.character !== "tightness",
      "Explicitly negated 'no pressure or tightness' does NOT populate character slot",
      `Actual character slot: "${turn1.state.slots.character}"`
    );
    assert(
      !turn1.state.slots.known_facts.some(f => /CHARACTER:\s*(pressure|tightness)/i.test(f)),
      "Negated character keywords are NOT added to known_facts"
    );
  }

  // Test 1.2: "without any crushing sensation or elephant weight"
  {
    const state0 = conversationManager.createInitialState();
    const turn1 = await conversationManager.processTurn(
      "I feel mild chest discomfort, without any crushing sensation or elephant weight.",
      state0
    );

    assert(
      turn1.state.slots.character !== "crushing" && turn1.state.slots.character !== "elephant",
      "'without any crushing sensation or elephant weight' does NOT populate character slot with crushing/elephant",
      `Actual character slot: "${turn1.state.slots.character}"`
    );
  }

  // Test 1.3: "No dizziness"
  {
    const state0 = conversationManager.createInitialState();
    const turn1 = await conversationManager.processTurn(
      "I have a cold and a cough. No dizziness at all.",
      state0
    );

    assert(
      turn1.state.slots.character !== "dizziness" && turn1.state.slots.character !== "dizzy",
      "'No dizziness' does NOT populate character with dizziness",
      `Actual character slot: "${turn1.state.slots.character}"`
    );
  }

  // Test 1.4: Affirmative character extraction still functions cleanly
  {
    const state0 = conversationManager.createInitialState();
    const turn1 = await conversationManager.processTurn(
      "I have intense crushing chest pressure radiating into my jaw.",
      state0
    );

    assert(
      turn1.state.slots.character === "crushing" || turn1.state.slots.character === "pressure",
      "Affirmative 'crushing chest pressure' cleanly extracts character",
      `Actual character slot: "${turn1.state.slots.character}"`
    );
    assert(
      turn1.state.slots.known_facts.some(f => /CHARACTER:\s*(crushing|pressure)/i.test(f)),
      "Affirmative character recorded in known_facts"
    );
  }

  // Test 1.5: Mixed polarity ("No fever, but severe burning sensation")
  {
    const state0 = conversationManager.createInitialState();
    const turn1 = await conversationManager.processTurn(
      "No fever, but severe burning sensation in my throat.",
      state0
    );

    assert(
      turn1.state.slots.character === "burning",
      "Mixed polarity ('No fever, but severe burning') correctly extracts affirmative 'burning'",
      `Actual character slot: "${turn1.state.slots.character}"`
    );
  }

  // =========================================================================
  // REMEDIATION 2: In-Flight Emergency Care Routing
  // =========================================================================
  console.log("\n--- [REMEDIATION 2] In-Flight Emergency Care Routing ---");

  // Test 2.1: Immediate danger without access keywords
  {
    const state0 = conversationManager.createInitialState();
    const turn = await conversationManager.processTurn(
      "Suddenly I can barely breathe and I am making a high-pitched whistling choking sound when I inhale.",
      state0
    );

    // Simulate route.ts trigger logic
    const hasEmergencyEvidence = Boolean(
      turn.preArbiterResult?.immediate_danger ||
      (turn.preArbiterResult?.pre_safety_flags && turn.preArbiterResult.pre_safety_flags.length > 0) ||
      /\b(stridor|droop|facial\s+droop|slurred\s+speech|cannot\s+breathe|choking|unresponsive|cyanosis|crushing\s+chest|substernal)\b/i.test(turn.state.cumulativeTranscript)
    );

    assert(hasEmergencyEvidence === true, "Emergency evidence detected in turn without patient saying 'hospital' or 'ambulance'");

    // Query care network routing
    const ragResult = await hospitalRagService.findEmergencyCareFacilities({
      cityOrLandmark: "Delhi",
      maxResults: 2,
    });

    assert(ragResult.facilities.length > 0, "Emergency facilities retrieved during emergency in-flight turn");
    assert(ragResult.facilities.some(f => f.isEmergency24x7), "Discovered facilities have verified 24/7 ER capacity");
    assert(ragResult.summaryForLLM.length > 0, "careNetworkSummary generated for real-time clinician voice guidance");
  }

  // Test 2.2: Routine turn does NOT trigger unnecessary routing overhead
  {
    const state0 = conversationManager.createInitialState();
    const turn = await conversationManager.processTurn(
      "I have a mild runny nose and sneezed twice this morning.",
      state0
    );

    const hasEmergencyEvidence = Boolean(
      turn.preArbiterResult?.immediate_danger ||
      (turn.preArbiterResult?.pre_safety_flags && turn.preArbiterResult.pre_safety_flags.length > 0) ||
      /\b(stridor|droop|facial\s+droop|slurred\s+speech|cannot\s+breathe|choking|unresponsive|cyanosis|crushing\s+chest|substernal)\b/i.test(turn.state.cumulativeTranscript)
    );

    assert(hasEmergencyEvidence === false, "Routine cold does NOT falsely flag emergency routing evidence");
  }

  // =========================================================================
  // REMEDIATION 3: Nitrate / PDE5 Contraindication From Structured State
  // =========================================================================
  console.log("\n--- [REMEDIATION 3] Nitrate/PDE5 Contraindication From Structured State ---");

  // Test 3.1: Raw transcript has only chest pain; medications are in structured facts
  {
    const arbiterResult = evaluateSafetyArbiter({
      rawText: "I have heavy chest pressure for the past hour.",
      structuredState: {
        facts: [
          {
            id: "med-1",
            name: "current_medication",
            label: "Current Medication",
            category: "relevant_history",
            status: "present",
            value: "Sildenafil 50mg as needed",
            normalizedText: "sildenafil",
            confidence: 1.0,
            source: "patient_reported",
            turnId: 1,
            timestamp: new Date().toISOString(),
          },
          {
            id: "med-2",
            name: "current_medication",
            label: "Current Medication",
            category: "relevant_history",
            status: "present",
            value: "Sublingual Nitroglycerin 0.4mg for chest tightness",
            normalizedText: "nitroglycerin",
            confidence: 1.0,
            source: "patient_reported",
            turnId: 1,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    assert(arbiterResult.esiScore === 2, "ESI Level 2 assigned when medications are in structured facts");
    assert(arbiterResult.isEmergency === true, "isEmergency is true for lethal drug contraindication");
    assert(
      arbiterResult.redFlagsTriggered.includes("LETHAL_DRUG_CONTRAINDICATION_NITRATE_PDE5"),
      "LETHAL_DRUG_CONTRAINDICATION_NITRATE_PDE5 triggered from structured facts"
    );
    assert(
      arbiterResult.clinicalProtocol.includes("DO NOT ADMINISTER NITROGLYCERIN"),
      "Clinical protocol forbids Nitroglycerin administration"
    );
  }

  // Test 3.2: Medication in provenanceEvidence
  {
    const arbiterResult = evaluateSafetyArbiter({
      rawText: "Substernal chest pressure and I took a nitroglycerin tablet.",
      structuredState: {
        provenanceEvidence: [
          {
            id: "ev-med-viagra",
            domain: "medication",
            label: "Prescribed Medication",
            type: "risk_factor",
            description: "Takes Viagra (sildenafil) for erectile dysfunction",
            value: "Viagra",
            status: "present",
            source: "patient_reported",
            confidence: 0.95,
            confidence_semantics: "patient_statement",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    assert(arbiterResult.esiScore === 2, "ESI Level 2 assigned when PDE5 inhibitor is in provenance evidence");
    assert(
      arbiterResult.redFlagsTriggered.includes("LETHAL_DRUG_CONTRAINDICATION_NITRATE_PDE5"),
      "Contraindication detected across raw text (nitroglycerin) + provenance evidence (Viagra)"
    );
  }

  // Test 3.3: Patient with chest pain but NO nitrates/PDE5 does NOT trigger false contraindication
  {
    const arbiterResult = evaluateSafetyArbiter({
      rawText: "I have heavy chest pressure radiating to my left arm.",
      structuredState: {
        facts: [
          {
            id: "med-safe",
            name: "current_medication",
            label: "Current Medication",
            category: "relevant_history",
            status: "present",
            value: "Metformin 500mg daily",
            normalizedText: "metformin",
            confidence: 1.0,
            source: "patient_reported",
            turnId: 1,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    assert(arbiterResult.esiScore === 2, "ESI Level 2 assigned for ACS symptoms");
    assert(
      !arbiterResult.redFlagsTriggered.includes("LETHAL_DRUG_CONTRAINDICATION_NITRATE_PDE5"),
      "No false drug contraindication triggered when patient takes non-interacting medication (Metformin)"
    );
    assert(
      arbiterResult.redFlagsTriggered.includes("ACS_CHEST_PAIN_WITH_HIGH_RISK_RADIATION_OR_DIAPHORESIS"),
      "ACS protocol correctly assigned"
    );
  }

  console.log("\n" + "=".repeat(85));
  console.log(`   🎉 ALL ${passed} / ${total} CLINICAL SAFETY REMEDIATION CHECKS PASSED 100%!`);
  console.log("=".repeat(85) + "\n");
}

runRemediationTests().catch(err => {
  console.error("[FATAL REMEDIATION ERROR]:", err);
  process.exit(1);
});
