import { ConversationManager } from "../lib/triage/conversation-manager";
import { buildProvenanceEvidenceFromClinicalState } from "../lib/agents/provenance";
import { clinicalBoard } from "../lib/agents/clinical-board";
import { PatientCase } from "../lib/agents/schemas";

async function runConversationalDemographicsE2E() {
  console.log("===============================================================================");
  console.log("   E2E INTEGRATION TEST: CONVERSATIONAL DEMOGRAPHICS & PROVENANCE PIPELINE");
  console.log("===============================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Unprofiled Older Adult Diabetic with Epigastric Burning + Sweating
  // Conversational demographics: "I am 62 years old and diabetic"
  // Spec Rule: UNI-CAR-02 (Atypical ACS in older adult/diabetic)
  // Expected:
  // - Emergency Convene Board triggered immediately
  // - Patient profile age = 62, condition = diabetes
  // - Universal red flag UNI-CAR-02 fired
  // - Provenance evidence captures age and comorbidity as patient_reported
  // - SOAP Subjective includes "Patient Context & History"
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 1: Unprofiled 62yo Diabetic with Atypical ACS ---");
  const cm1 = new ConversationManager();
  const state1_0 = cm1.createInitialState();

  const turn1 = await cm1.processTurn(
    "I am 62 years old and diabetic. I have burning in my upper stomach and I am sweating.",
    state1_0
  );

  assert(
    turn1.action === "EMERGENCY_CONVENE_BOARD",
    "Turn 1 triggers EMERGENCY_CONVENE_BOARD",
    `got ${turn1.action}`
  );
  assert(
    turn1.state.patientProfile?.age === 62,
    "Patient age (62) extracted into state.patientProfile",
    `got ${turn1.state.patientProfile?.age}`
  );
  assert(
    Boolean(turn1.state.patientProfile?.conditions?.includes("diabetes") ||
    turn1.state.patientProfile?.conditions?.includes("diabetic")),
    "Diabetes comorbidity extracted into state.patientProfile",
    `conditions: ${JSON.stringify(turn1.state.patientProfile?.conditions)}`
  );
  assert(
    turn1.preArbiterResult.pre_safety_flags.includes("UNI-CAR-02"),
    "Pre-arbiter flags include UNI-CAR-02 (Atypical ACS)",
    `flags: ${JSON.stringify(turn1.preArbiterResult.pre_safety_flags)}`
  );

  // Generate Provenance & SOAP for Scenario 1
  const prov1 = buildProvenanceEvidenceFromClinicalState({
    state: turn1.state,
    speechFeatures: undefined,
  });

  const ageEvidence = prov1.find(e => e.domain === "patient_age");
  const diabetesEvidence = prov1.find(e => e.domain === "comorbidity" && /diabet/i.test(e.description));

  assert(
    Boolean(ageEvidence && ageEvidence.source === "patient_reported" && ageEvidence.value === 62),
    "Age 62 captured in provenance evidence with patient_reported source"
  );
  assert(
    Boolean(diabetesEvidence && diabetesEvidence.source === "patient_reported"),
    "Diabetes captured in provenance evidence with patient_reported source"
  );

  const patientCase1: PatientCase = {
    patient_id: "PT-TEST-DEMO-62",
    patient_name: "Caller",
    transcript: turn1.state.cumulativeTranscript,
    conversation_history: [
      { role: "patient", text: "I am 62 years old and diabetic. I have burning in my upper stomach and I am sweating.", timestamp: new Date().toISOString() },
      { role: "doctor", text: turn1.doctorReply, timestamp: new Date().toISOString() },
    ],
    detected_symptoms: turn1.state.slots.known_facts,
    provenance_evidence: prov1,
    demographics: {
      age: turn1.state.patientProfile?.age,
      age_group: "older_adult",
    },
    pre_safety_flags: turn1.preArbiterResult.pre_safety_flags,
    vitals: {},
    speech_features: {} as any,
    immediate_danger_detected: true,
    case_version: turn1.state.caseVersion,
  };

  const boardResult1 = await clinicalBoard.evaluate(patientCase1);
  assert(
    boardResult1.soap_note.subjective.includes("Patient Context & History:"),
    "SOAP note Subjective includes Patient Context & History section"
  );
  assert(
    boardResult1.soap_note.subjective.includes("62"),
    "SOAP note mentions age 62"
  );
  assert(
    boardResult1.post_arbiter.final_disposition.toLowerCase().includes("emergency") ||
    boardResult1.post_arbiter.final_triage_level === "emergency",
    "Board disposition enforces emergency triage for atypical ACS"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Pregnant Caller with Preeclampsia Symptoms
  // Conversational demographics: "I am 8 months pregnant and I have a severe headache and blurry vision"
  // Spec Rule: UNI-PRG-01 (Preeclampsia / Eclampsia)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 2: Unprofiled 8 Months Pregnant Caller (Preeclampsia) ---");
  const cm2 = new ConversationManager();
  const state2_0 = cm2.createInitialState();

  const turn2 = await cm2.processTurn(
    "I am 8 months pregnant and I have a severe headache and blurry vision.",
    state2_0
  );

  assert(
    turn2.action === "EMERGENCY_CONVENE_BOARD",
    "Turn 2 triggers EMERGENCY_CONVENE_BOARD for preeclampsia",
    `got ${turn2.action}`
  );
  assert(
    turn2.state.patientProfile?.pregnancy?.isPregnant === true,
    "Pregnancy status extracted into state.patientProfile",
    `isPregnant: ${turn2.state.patientProfile?.pregnancy?.isPregnant}`
  );
  assert(
    turn2.preArbiterResult.pre_safety_flags.includes("UNI-PRG-01"),
    "Pre-arbiter flags include UNI-PRG-01",
    `flags: ${JSON.stringify(turn2.preArbiterResult.pre_safety_flags)}`
  );

  const prov2 = buildProvenanceEvidenceFromClinicalState({
    state: turn2.state,
  });
  const pregEvidence = prov2.find(e => e.domain === "pregnancy");
  assert(
    Boolean(pregEvidence && pregEvidence.source === "patient_reported" && pregEvidence.value === true),
    "Pregnancy status captured in provenance with patient_reported source"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Febrile Infant under 3 Months (Pediatric Red Flag)
  // Conversational demographics: "my six week old baby has a fever"
  // Spec Rule: UNI-PED-01 (Infant < 3 months with fever)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 3: Febrile 6-Week-Old Infant ---");
  const cm3 = new ConversationManager();
  const state3_0 = cm3.createInitialState();

  const turn3 = await cm3.processTurn(
    "my six week old baby has a fever and is crying constantly",
    state3_0
  );

  assert(
    turn3.action === "EMERGENCY_CONVENE_BOARD",
    "Turn 3 triggers EMERGENCY_CONVENE_BOARD for febrile neonate/infant",
    `got ${turn3.action}`
  );
  assert(
    turn3.preArbiterResult.pre_safety_flags.includes("UNI-PED-01"),
    "Pre-arbiter flags include UNI-PED-01",
    `flags: ${JSON.stringify(turn3.preArbiterResult.pre_safety_flags)}`
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Natural Multi-Turn Conversation Preserving Demographic Context
  // Turn 1: "I am a 65 year old man with high blood pressure."
  // Turn 2: "Now I have sudden back pain and feel like I am going to pass out."
  // Spec Rule: UNI-ABD-04 (Ruptured AAA / Dissection)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 4: Multi-Turn Demographic Context Preservation ---");
  const cm4 = new ConversationManager();
  const state4_0 = cm4.createInitialState();

  const turn4_1 = await cm4.processTurn(
    "I am a 65 year old man with high blood pressure.",
    state4_0
  );

  assert(
    turn4_1.state.patientProfile?.age === 65,
    "Turn 1 extracts age 65",
    `age: ${turn4_1.state.patientProfile?.age}`
  );
  assert(
    Boolean(turn4_1.state.patientProfile?.conditions?.some(c => /hypertension|blood pressure/i.test(c))),
    "Turn 1 extracts hypertension comorbidity"
  );

  // Turn 2: emergency escalation occurs in context of previously extracted demographics
  const turn4_2 = await cm4.processTurn(
    "Now I have sudden back pain and feel like I am going to pass out.",
    turn4_1.state
  );

  assert(
    turn4_2.action === "EMERGENCY_CONVENE_BOARD",
    "Turn 2 triggers EMERGENCY_CONVENE_BOARD",
    `got ${turn4_2.action}`
  );
  assert(
    turn4_2.state.patientProfile?.age === 65,
    "Turn 2 preserves age 65 in state.patientProfile",
    `age: ${turn4_2.state.patientProfile?.age}`
  );
  assert(
    turn4_2.preArbiterResult.pre_safety_flags.includes("UNI-ABD-04") ||
    turn4_2.preArbiterResult.immediate_danger === true,
    "Turn 2 triggers emergency red-flag with multi-turn demographic persistence"
  );

  console.log("\n===============================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runConversationalDemographicsE2E().catch(err => {
  console.error("Unhandled error in E2E demographics test:", err);
  process.exit(1);
});
