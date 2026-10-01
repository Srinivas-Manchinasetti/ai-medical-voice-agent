import { conversationManager } from "../lib/triage/conversation-manager";
import { questionPlanner, validatePlannedQuestionAgainstState } from "../lib/triage/question-planner";
import { createInitialInterviewStateV2, extractSubfieldState, ClinicalInterviewStateV2 } from "../lib/triage/clinical-state";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function main() {
  console.log("===============================================================================");
  console.log("   TESTING SUB-FIELD LEVEL QUESTION GENERATOR & AMBIGUITY HARNESS");
  console.log("===============================================================================\n");

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Onset Duration Known -> Sarah Must Only Ask Sudden vs Gradual
  // ---------------------------------------------------------------------------
  console.log("--- [Test Suite 1] Onset Subfield Granularity ---");
  const state1 = conversationManager.createInitialState();
  const res1 = await conversationManager.processTurn("Voice gone from a week. Pain is 8/10.", state1);

  console.log("Turn 1 Doctor Reply:", res1.doctorReply);
  console.log("Turn 1 Known Facts:", res1.state.slots.known_facts);
  console.log("Turn 1 Pending Slot:", res1.state.pendingQuestion?.targetSlot);

  const subfields1 = extractSubfieldState(res1.state.slots, res1.state.slots.known_facts, res1.state.conversationMemory);
  console.log("Subfields Onset:", subfields1.onset);
  console.log("Subfields Severity:", subfields1.characterSeverity);

  assert(Boolean(subfields1.onset.duration), "Onset duration is extracted (~1 week)");
  assert(subfields1.onset.onsetPattern === "unknown", "Onset pattern is unresolved");
  assert(Boolean(subfields1.characterSeverity.severity), "Severity 8/10 is recorded");

  const reply1Lower = res1.doctorReply.toLowerCase();
  assert(
    reply1Lower.includes("sudden") || reply1Lower.includes("gradual"),
    "Doctor reply asks whether onset was sudden or gradual"
  );
  assert(
    !reply1Lower.includes("when did this begin") &&
    !reply1Lower.includes("how long have you had") &&
    !reply1Lower.includes("started a week"),
    "Doctor reply does NOT re-ask when it began or repeat 'started a week'"
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Onset Pattern Answered -> Advance, Zero Onset Questions
  // ---------------------------------------------------------------------------
  console.log("\n--- [Test Suite 2] Turn 2: Answering Onset Pattern ---");
  const res2 = await conversationManager.processTurn("It came on gradually.", res1.state);

  console.log("Turn 2 Doctor Reply:", res2.doctorReply);
  console.log("Turn 2 Known Facts:", res2.state.slots.known_facts);

  const subfields2 = extractSubfieldState(res2.state.slots, res2.state.slots.known_facts, res2.state.conversationMemory);
  console.log("Turn 2 Subfields Onset:", subfields2.onset);

  assert(subfields2.onset.onsetPattern === "gradual", "Onset pattern confirmed as gradual");
  assert(subfields2.onset.isResolved, "Onset category is now fully resolved (duration + pattern)");

  const reply2Lower = res2.doctorReply.toLowerCase();
  assert(
    !reply2Lower.includes("sudden") &&
    !reply2Lower.includes("gradual") &&
    !reply2Lower.includes("when did this begin"),
    "Doctor does NOT repeat another onset question after pattern is resolved"
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Question Planner Validation Against Subfield Leakage
  // ---------------------------------------------------------------------------
  console.log("\n--- [Test Suite 3] Question Planner Golden Invariant Validator ---");
  const v2: ClinicalInterviewStateV2 = createInitialInterviewStateV2();
  v2.symptomProfile.onset = {
    id: "test-onset",
    name: "onset",
    label: "Onset time",
    category: "symptom_profile",
    status: "present",
    value: "a week",
    normalizedText: "~a week",
    confidence: 0.95,
    source: "patient",
    turnId: 1,
    timestamp: new Date().toISOString()
  };
  v2.symptomProfile.severity = {
    id: "test-sev",
    name: "severity",
    label: "Severity",
    category: "symptom_profile",
    status: "present",
    value: 8,
    normalizedText: "8/10",
    confidence: 0.95,
    source: "patient",
    turnId: 1,
    timestamp: new Date().toISOString()
  };

  const candidateLeakyQuestion = {
    target: "onset",
    label: "Onset & timeline",
    clinicalRationale: "Test",
    suggestedPhrasing: "Could you tell me when this began, and whether it started suddenly or built up gradually?",
    isEmergencyIntervention: false,
    isPivotToNewFinding: false,
    priority: "high" as const,
  };

  const validation = validatePlannedQuestionAgainstState(candidateLeakyQuestion, v2);
  console.log("Validator Result for Leaky Question:", validation);
  assert(!validation.isValid, "Validator rejects question asking 'when this began' when duration is known");

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: Ambiguous Answer Clarification (Episode vs Condition Duration)
  // ---------------------------------------------------------------------------
  console.log("\n--- [Test Suite 4] Ambiguous Episode Duration Handling ---");
  const episodeState = conversationManager.createInitialState();
  episodeState.pendingQuestion = {
    id: "req-episode-dur",
    targetSlot: "duration",
    askedBy: "sarah",
    doctorName: "Dr. Sarah Chen, MD",
    patientFacingSpeaker: "sarah",
    question: "When these episodes happen, roughly how long does each one last?",
    purpose: "Establish episode duration",
    required: true,
    priority: "high",
    status: "pending",
    createdAt: new Date().toISOString(),
    caseVersion: 1
  };

  const ambigTurn = await conversationManager.processTurn("Maybe for a day or two.", episodeState);
  console.log("Ambiguous Turn Action:", ambigTurn.action);
  console.log("Ambiguous Turn Doctor Reply:", ambigTurn.doctorReply);

  assert(ambigTurn.action === "CLARIFY", "Action is classified as CLARIFY");
  assert(
    ambigTurn.doctorReply.includes("Just to clarify, do you mean you've been having these episodes for a day or two, or that each individual episode lasts a day or two?"),
    "Doctor speaks exact clinical clarification between condition duration vs single episode duration"
  );
  assert(
    ambigTurn.state.slots.duration === undefined,
    "Ambiguous response is NOT recorded as confirmed episode duration"
  );

  console.log("\n===============================================================================");
  console.log("   ✅ ALL SUB-FIELD LEVEL CLINICAL STATE & AMBIGUITY TESTS PASSED!");
  console.log("===============================================================================\n");
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
