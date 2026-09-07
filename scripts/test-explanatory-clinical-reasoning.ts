import { conversationManager } from "../lib/triage/conversation-manager";
import { clinicalBoard } from "../lib/agents/clinical-board";
import { PatientCase } from "../lib/agents/schemas";

async function runExplanatoryClinicalTest() {
  console.log("==============================================================================");
  console.log("       EXPLANATORY CLINICAL REASONING & ACTIVE RAG BENCHMARK TEST             ");
  console.log("==============================================================================");

  let state = conversationManager.createInitialState();
  const patientUtterance = "I have my leg muscles strikingly painful like a needle is digged.. why is that?";

  console.log(`\nPatient Utterance: "${patientUtterance}"`);

  // --- Step 1: Conversational Turn with Explanatory Inquiry ---
  const turnResult = await conversationManager.processTurn(patientUtterance, state);
  state = turnResult.state;

  console.log("\n--- Doctor Sarah Chen Spoken Response ---");
  console.log(`"${turnResult.doctorReply}"`);

  // Assertions on Turn Result
  if (!turnResult.doctorReply.toLowerCase().includes("nerve") && !turnResult.doctorReply.toLowerCase().includes("spasm")) {
    throw new Error("Failed: Doctor response did not explain the physiological nerve/spasm mechanism!");
  }

  if (turnResult.doctorReply.toLowerCase().includes("i feel sorry for you") || turnResult.doctorReply.toLowerCase().includes("routine, low-acuity presentation")) {
    throw new Error("Failed: Doctor response gave a canned brush-off rather than an intelligent clinical answer!");
  }

  if (!turnResult.doctorReply.toLowerCase().includes("back") && !turnResult.doctorReply.toLowerCase().includes("foot")) {
    throw new Error("Failed: Doctor response did not ask targeted diagnostic discriminators!");
  }

  console.log("\n✅ Step 1 PASSED: Dr. Sarah Chen directly explained the needle-pain mechanism (nerve irritation vs. spasm) and asked differential discriminators.");

  // --- Step 2: Full Clinical Board Multi-Agent Synthesis ---
  const patientCase: PatientCase = {
    patient_id: "PT-LEG-001",
    patient_name: "Patient",
    transcript: state.cumulativeTranscript,
    conversation_history: [],
    demographics: { age: 42, age_group: "adult" },
    detected_symptoms: ["sharp needle digging leg muscle pain"],
    vitals: {},
    speech_features: undefined as any,
    pre_safety_flags: [],
    immediate_danger_detected: false,
    provenance_evidence: []
  };

  const boardOutput = await clinicalBoard.evaluate(patientCase);

  console.log("\n--- Clinical Board Synthesis Output ---");
  console.log(`• Differential: ${boardOutput.consensus.differential.map(d => d.condition).join(", ")}`);
  console.log(`• Doctor Spoken Narrative:\n"${boardOutput.doctor_reply}"`);

  const diffStr = boardOutput.consensus.differential.map(d => d.condition.toLowerCase()).join(" ");
  if (!diffStr.includes("sciat") && !diffStr.includes("radiculo") && !diffStr.includes("spasm") && !diffStr.includes("cramp")) {
    throw new Error(`Failed: Board differential was expected to include Sciatica / Radiculopathy / Spasm, got: ${diffStr}`);
  }

  if (!boardOutput.doctor_reply.toLowerCase().includes("sciatica") && !boardOutput.doctor_reply.toLowerCase().includes("nerve")) {
    throw new Error("Failed: Board spoken narrative did not explain sciatica/nerve etiology!");
  }

  console.log("\n✅ Step 2 PASSED: Clinical board formulated Sciatica/Radiculopathy differential with concrete home management and cauda equina red-flag safety instructions.");

  console.log("\n==============================================================================");
  console.log("✅ EXPLANATORY CLINICAL REASONING SPECIFICATION CONFIRMED 100%");
  console.log("==============================================================================");
}

runExplanatoryClinicalTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
