import { evaluateClinicalSufficiency } from "../lib/triage/sufficiency";
import { clinicalBoard } from "../lib/agents/clinical-board";
import { PatientCase } from "../lib/agents/schemas";

async function runClinicalInterviewTest() {
  console.log("==============================================================================");
  console.log("        MULTI-TURN CLINICAL INTERVIEW & INFORMATION SUFFICIENCY TEST          ");
  console.log("==============================================================================");

  // Turn 1: Underspecified symptom
  console.log("\n--- TURN 1: Patient presents with vague chest tightness ---");
  const turn1Utterance = "I've been feeling an uncomfortable tightness in my chest.";
  const sufficiency1 = evaluateClinicalSufficiency(turn1Utterance);

  console.log(`• Sufficiency: is_sufficient = ${sufficiency1.is_sufficient} (Completeness: ${Math.round(sufficiency1.completeness_score * 100)}%)`);
  console.log(`• Phase: ${sufficiency1.phase}`);
  console.log(`• Known Facts: ${JSON.stringify(sufficiency1.dimensions.known_facts)}`);
  console.log(`• Missing Dimensions: ${JSON.stringify(sufficiency1.dimensions.missing_dimensions)}`);
  console.log(`• Inquiring Doctor: ${sufficiency1.question_source}`);
  console.log(`• Follow-Up Question: "${sufficiency1.next_question}"`);

  if (sufficiency1.is_sufficient) {
    throw new Error("Turn 1 failed: Prematurely assigned sufficiency to underspecified symptom!");
  }
  if (sufficiency1.phase !== "gathering_history") {
    throw new Error("Turn 1 failed: Expected phase to be 'gathering_history'");
  }
  console.log("✅ Turn 1 PASSED: Premature ESI prevented. Targeted onset question asked.");

  // Turn 2: Patient clarifies onset
  console.log("\n--- TURN 2: Patient clarifies onset duration ---");
  const turn2Utterance = "It started about twenty minutes ago while I was sitting down.";
  const cumulativeTranscript2 = `${turn1Utterance}. ${turn2Utterance}`;
  const sufficiency2 = evaluateClinicalSufficiency(cumulativeTranscript2);

  console.log(`• Sufficiency: is_sufficient = ${sufficiency2.is_sufficient} (Completeness: ${Math.round(sufficiency2.completeness_score * 100)}%)`);
  console.log(`• Phase: ${sufficiency2.phase}`);
  console.log(`• Known Facts: ${JSON.stringify(sufficiency2.dimensions.known_facts)}`);
  console.log(`• Missing Dimensions: ${JSON.stringify(sufficiency2.dimensions.missing_dimensions)}`);
  console.log(`• Inquiring Doctor: ${sufficiency2.question_source}`);
  console.log(`• Follow-Up Question: "${sufficiency2.next_question}"`);

  if (sufficiency2.is_sufficient) {
    throw new Error("Turn 2 failed: Prematurely assigned sufficiency before radiation/associated symptoms checked!");
  }
  if (sufficiency2.question_source !== "cardiology") {
    throw new Error("Turn 2 failed: Expected cardiology specialist Dr. Marcus Vance to request radiation clarification");
  }
  console.log("✅ Turn 2 PASSED: Marcus Vance actively requested radiation pathway clarification.");

  // Turn 3: Patient clarifies arm radiation and sweating
  console.log("\n--- TURN 3: Patient confirms arm radiation and cold sweating ---");
  const turn3Utterance = "Yes, it is radiating down into my left arm and I feel cold and clammy with sweats.";
  const cumulativeTranscript3 = `${turn1Utterance}. ${turn2Utterance}. ${turn3Utterance}`;
  const sufficiency3 = evaluateClinicalSufficiency(cumulativeTranscript3);

  console.log(`• Sufficiency: is_sufficient = ${sufficiency3.is_sufficient} (Completeness: ${Math.round(sufficiency3.completeness_score * 100)}%)`);
  console.log(`• Phase: ${sufficiency3.phase}`);
  console.log(`• Known Facts: ${JSON.stringify(sufficiency3.dimensions.known_facts)}`);

  if (!sufficiency3.is_sufficient) {
    throw new Error("Turn 3 failed: Sufficiency should be reached after full cardiac triad is established!");
  }
  if (sufficiency3.phase !== "board_decision") {
    throw new Error("Turn 3 failed: Expected phase to transition to 'board_decision'");
  }
  console.log("✅ Turn 3 Sufficiency PASSED: Clinical context complete. Transitioning to full board deliberation.");

  // Full Board Deliberation on Complete Context
  const patientCase: PatientCase = {
    patient_id: "PT-INTERVIEW-01",
    patient_name: "John Doe",
    transcript: cumulativeTranscript3,
    conversation_history: [],
    demographics: { age: 58, age_group: "adult" },
    detected_symptoms: [],
    vitals: {},
    speech_features: undefined as any,
    pre_safety_flags: [],
    immediate_danger_detected: false,
    provenance_evidence: []
  };

  const boardOutput = await clinicalBoard.evaluate(patientCase);
  console.log("\n--- BOARD CONVENED & DELIBERATION EXECUTED ---");
  console.log(`• Specialists Summoned: ${boardOutput.trace.specialists_summoned.join(", ")}`);
  console.log(`• Tools Executed: ${boardOutput.trace.tools_executed.join(", ")}`);
  console.log(`• Board Differential: ${boardOutput.consensus.differential.map(d => d.condition).join(", ")}`);
  console.log(`• Locked Acuity Level: ESI ${boardOutput.post_arbiter.final_esi_level} (${boardOutput.post_arbiter.final_esi_title})`);
  console.log(`• Spoken Doctor Guidance: "${boardOutput.doctor_reply}"`);

  if (boardOutput.post_arbiter.final_esi_level !== 2) {
    throw new Error(`Expected ESI 2 Emergency, received ESI ${boardOutput.post_arbiter.final_esi_level}`);
  }

  console.log("\n==============================================================================");
  console.log("✅ ALL MULTI-TURN CLINICAL INTERVIEW INVARIANTS VERIFIED SUCCESSFULLY.");
  console.log("==============================================================================");
}

runClinicalInterviewTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
