import { extractNumericSeverity, extractSubfieldState, NON_DENIABLE_SLOTS, detectQuestionTargetSlot } from "../lib/triage/clinical-state";
import { conversationManager } from "../lib/triage/conversation-manager";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log("=== 1. Testing extractNumericSeverity with Natural Language Variants ===");

const severityTestCases: Array<{ input: string; expected: string | null; isSeverityPrompt?: boolean }> = [
  { input: "Maybe 8 by 10.", expected: "8/10" },
  { input: "maybe 8 by 10", expected: "8/10" },
  { input: "8/10", expected: "8/10" },
  { input: "8 out of 10", expected: "8/10" },
  { input: "eight out of ten", expected: "8/10" },
  { input: "8 on 10", expected: "8/10" },
  { input: "I'd say an eight", expected: "8/10" },
  { input: "probably an 8", expected: "8/10" },
  { input: "it's about an 8", expected: "8/10" },
  { input: "around a 7", expected: "7/10" },
  { input: "pain is 8", expected: "8/10" },
  { input: "pain level 9", expected: "9/10" },
  { input: "severity is 6", expected: "6/10" },
  { input: "8", expected: "8/10", isSeverityPrompt: true },
  { input: "eight", expected: "8/10", isSeverityPrompt: true },
  { input: "I have had this for 2 days", expected: null },
  { input: "no other symptoms", expected: null },
];

for (const tc of severityTestCases) {
  const result = extractNumericSeverity(tc.input, tc.isSeverityPrompt);
  assert(result === tc.expected, `extractNumericSeverity("${tc.input}", ${tc.isSeverityPrompt}) === "${tc.expected}" (got "${result}")`);
}

console.log("\n=== 2. Testing extractSubfieldState with 'Maybe 8 by 10.' ===");

const subfields = extractSubfieldState(
  { onset: "2 days ago", severity: "8/10" },
  ["ONSET: 2 days ago", "SEVERITY: 8/10"]
);
assert(subfields.characterSeverity.severity === "8/10", `subfields.characterSeverity.severity should be "8/10", got "${subfields.characterSeverity.severity}"`);
assert(subfields.characterSeverity.isResolved === false, `subfields.characterSeverity.isResolved is false when only severity is established`);

const subfieldsBoth = extractSubfieldState(
  { onset: "2 days ago", severity: "8/10", character: "sharp burning" },
  ["ONSET: 2 days ago", "SEVERITY: 8/10", "CHARACTER: sharp burning"]
);
assert(subfieldsBoth.characterSeverity.isResolved === true, `subfieldsBoth.characterSeverity.isResolved is true when both character and severity are established`);

console.log("\n=== 3. Testing detectQuestionTargetSlot ===");

const targetSlotCases = [
  { question: "Are you having trouble swallowing food or liquids?", expected: "swallowing_difficulty" },
  { question: "Can you swallow liquids or are you choking?", expected: "swallowing_difficulty" },
  { question: "Did it come on suddenly, or did it gradually get worse?", expected: "onset_pattern" },
  { question: "On a scale from 0 to 10, how severe would you rate the pain?", expected: "severity" },
  { question: "Do you have any ear pain or fever?", expected: "ear_pain" },
  { question: "Have you had a fever or chills?", expected: "fever" },
  { question: "How would you describe your voice? Is it hoarse or raspy?", expected: "voice_character" },
  { question: "Has the pain been getting worse or staying about the same?", expected: "course" },
];

for (const tc of targetSlotCases) {
  const detected = detectQuestionTargetSlot(tc.question);
  assert(detected === tc.expected, `detectQuestionTargetSlot("${tc.question}") === "${tc.expected}" (got "${detected}")`);
}

console.log("\n=== 4. Testing NON_DENIABLE_SLOTS Protection ===");

for (const slot of ["onset_pattern", "onset", "course", "duration", "severity", "character", "timing_pattern"]) {
  assert(NON_DENIABLE_SLOTS.has(slot), `NON_DENIABLE_SLOTS must contain "${slot}"`);
}

console.log("\n=== 5. End-to-End Multi-Turn Integration via conversationManager ===");

async function testMultiTurn() {
  let state = conversationManager.createInitialState();

  // Turn 1: Patient reports chief complaint and timeline
  const turn1 = await conversationManager.processTurn("Voice gone from a week and throat hurts for two days", state);
  state = turn1.state;
  console.log("Turn 1 doctor reply:", turn1.doctorReply);
  assert(state.slots.known_facts.some(f => /throat/i.test(f)), "Turn 1 registers throat complaint");

  // Turn 2: Doctor asks about swallowing, patient denies with "Nothing with that."
  // Simulate doctor asking about swallowing
  state.pendingQuestion = {
    id: "test-q-swallow",
    targetSlot: "swallowing_difficulty",
    askedBy: "sarah",
    doctorName: "Dr. Sarah Chen, MD",
    patientFacingSpeaker: "sarah",
    question: "Are you having trouble swallowing food or liquids?",
    purpose: "Screen dysphagia red flag",
    required: true,
    priority: "high",
    status: "pending",
    createdAt: new Date().toISOString(),
    caseVersion: state.caseVersion,
  };

  const turn2 = await conversationManager.processTurn("Nothing with that.", state);
  state = turn2.state;
  console.log("Turn 2 doctor reply:", turn2.doctorReply);
  console.log("Turn 2 known facts:", state.slots.known_facts);
  console.log("Turn 2 denied symptoms:", state.conversationMemory?.deniedSymptoms);

  assert(!state.slots.known_facts.includes("Denied: onset_pattern"), "Turn 2 must NEVER produce 'Denied: onset_pattern'");
  assert(state.conversationMemory?.deniedSymptoms.includes("swallowing_difficulty") === true, "Turn 2 correctly registers swallowing_difficulty in deniedSymptoms");
  assert(!state.conversationMemory?.deniedSymptoms.includes("onset_pattern"), "Turn 2 must NEVER include onset_pattern in deniedSymptoms");

  // Turn 3: Doctor asks for severity, patient responds "Maybe 8 by 10."
  state.pendingQuestion = {
    id: "test-q-severity",
    targetSlot: "severity",
    askedBy: "sarah",
    doctorName: "Dr. Sarah Chen, MD",
    patientFacingSpeaker: "sarah",
    question: "On a scale of 0 to 10, how severe is the pain?",
    purpose: "Establish numeric severity",
    required: true,
    priority: "normal",
    status: "pending",
    createdAt: new Date().toISOString(),
    caseVersion: state.caseVersion,
  };

  const turn3 = await conversationManager.processTurn("Maybe 8 by 10.", state);
  state = turn3.state;
  console.log("Turn 3 doctor reply:", turn3.doctorReply);
  console.log("Turn 3 slots.severity:", state.slots.severity);

  assert(state.slots.severity === "8/10", `Turn 3 must record slots.severity as '8/10', got '${state.slots.severity}'`);

  const subfieldsTurn3 = extractSubfieldState(
    state.slots,
    state.slots.known_facts,
    state.conversationMemory
  );
  assert(subfieldsTurn3.characterSeverity.severity === "8/10", `subfieldsTurn3.characterSeverity.severity must be '8/10', got '${subfieldsTurn3.characterSeverity.severity}'`);

  console.log("\n🎉 ALL SEVERITY & NON-DENIABLE TESTS PASSED PERFECTLY!");
}

testMultiTurn().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
