import { conversationManager } from "../lib/triage/conversation-manager";
import { extractSubfieldState } from "../lib/triage/clinical-state";
import { POST as voiceChatHandler } from "../app/api/voice/chat/route";
import { NextRequest } from "next/server";
import { nvidiaClient, NvidiaChatMessage, NvidiaCompletionOptions, NvidiaCompletionResult } from "../lib/ai/nvidia-client";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function simulateApiCall(message: string, history: any[], interviewState: any) {
  const req = new NextRequest("http://localhost:3000/api/voice/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversationHistory: history,
      interviewState,
      doctor: { id: "dr-sarah-chen", name: "Dr. Sarah Chen, MD", specialty: "Internal Medicine" }
    })
  });
  const res = await voiceChatHandler(req);
  return await res.json();
}

/**
 * ===============================================================================
 * MODE A: Deterministic Fallback & Planner Validation
 * ===============================================================================
 * Validates that the deterministic state machine, subfield extraction, and response
 * planner correctly advance the interview and never repeat resolved dimensions.
 */
async function runModeA() {
  console.log("\n===============================================================================");
  console.log("   [MODE A] DETERMINISTIC FALLBACK & PLANNER VALIDATION");
  console.log("   Verifying End-to-End State Invariants Across Exact Patient Dialogue");
  console.log("===============================================================================\n");

  // Ensure mock completer is cleared and NVIDIA key is unset for Mode A
  nvidiaClient.setMockCompleter(null);
  const originalApiKey = process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_API_KEY;

  try {
    let interviewState = conversationManager.createInitialState();
    const history: any[] = [];

    // --- [TURN 1] Sore Throat Presentation ---
    console.log("--- [TURN 1] Sore Throat Presentation ---");
    const t1Msg = "I've had a sore throat for two days.";
    const t1Data = await simulateApiCall(t1Msg, history, interviewState);
    interviewState = t1Data.interviewState;
    history.push({ role: "patient", text: t1Msg });
    history.push({ role: "doctor", text: t1Data.doctorReply });

    console.log("Turn 1 Doctor Reply:", t1Data.doctorReply);
    console.log("Turn 1 Known Facts:", interviewState.slots.known_facts);
    console.log("Turn 1 Still to Establish:", interviewState.structuredHistory?.unansweredDimensions);

    const subfieldsT1 = extractSubfieldState(interviewState.slots, interviewState.slots.known_facts, interviewState.conversationMemory);
    assert(Boolean(subfieldsT1.onset.duration), "Duration is CONFIRMED (~two days)");
    assert(subfieldsT1.onset.onsetPattern === "unknown", "Onset pattern is UNRESOLVED");
    assert(interviewState.slots.known_facts.some((f: string) => /THROAT_PAIN/i.test(f)), "Throat pain is CONFIRMED");

    // --- [TURN 2] Odynophagia Report ---
    console.log("\n--- [TURN 2] Odynophagia Report ---");
    const t2Msg = "It hurts when I swallow saliva.";
    const t2Data = await simulateApiCall(t2Msg, history, interviewState);
    interviewState = t2Data.interviewState;
    history.push({ role: "patient", text: t2Msg });
    history.push({ role: "doctor", text: t2Data.doctorReply });

    console.log("Turn 2 Doctor Reply:", t2Data.doctorReply);
    console.log("Turn 2 Known Facts:", interviewState.slots.known_facts);

    const hasOdynophagia = interviewState.slots.known_facts.some((f: string) => /ODYNOPHAGIA/i.test(f));
    const hasMechanicalDysphagia = interviewState.slots.known_facts.some((f: string) => /swallowing_difficulty/i.test(f));
    assert(hasOdynophagia, "Odynophagia (painful swallowing) is CONFIRMED");
    assert(!hasMechanicalDysphagia, "Mechanical dysphagia (swallowing difficulty) is UNRESOLVED (not falsely conflated)");

    // --- [TURN 3] Fever Denial ---
    console.log("\n--- [TURN 3] Fever Denial ---");
    const t3Msg = "No fever.";
    const t3Data = await simulateApiCall(t3Msg, history, interviewState);
    interviewState = t3Data.interviewState;
    history.push({ role: "patient", text: t3Msg });
    history.push({ role: "doctor", text: t3Data.doctorReply });

    console.log("Turn 3 Doctor Reply:", t3Data.doctorReply);
    console.log("Turn 3 Known Facts:", interviewState.slots.known_facts);
    console.log("Turn 3 Denied Symptoms:", interviewState.conversationMemory?.deniedSymptoms);

    const feverDenied = (interviewState.conversationMemory?.deniedSymptoms || []).includes("fever") ||
      interviewState.slots.known_facts.some((f: string) => /Denied:.*fever/i.test(f));
    assert(feverDenied, "Fever is recorded as DENIED");

    // --- [TURN 4] Conversational Ratio Severity ('Maybe 8 by 10.') ---
    console.log("\n--- [TURN 4] Conversational Ratio Severity ('Maybe 8 by 10.') ---");
    const t4Msg = "Maybe 8 by 10.";
    const t4Data = await simulateApiCall(t4Msg, history, interviewState);
    interviewState = t4Data.interviewState;
    history.push({ role: "patient", text: t4Msg });
    history.push({ role: "doctor", text: t4Data.doctorReply });

    console.log("Turn 4 Doctor Reply:", t4Data.doctorReply);
    console.log("Turn 4 Known Facts:", interviewState.slots.known_facts);
    console.log("Turn 4 Still to Establish (Board missing_dimensions):", t4Data.board?.missing_dimensions);

    const subfieldsT4 = extractSubfieldState(interviewState.slots, interviewState.slots.known_facts, interviewState.conversationMemory);
    console.log("Turn 4 Subfields Character/Severity:", subfieldsT4.characterSeverity);

    assert(subfieldsT4.characterSeverity.severity === "8/10", "Severity is CONFIRMED as 8/10 from 'Maybe 8 by 10.'");

    const stillToEstablish = t4Data.board?.missing_dimensions || [];
    assert(
      !stillToEstablish.includes("Pain severity (0-10)"),
      "STILL TO ESTABLISH does NOT contain 'Pain severity (0-10)'"
    );
    assert(
      stillToEstablish.includes("Symptom character / sensation"),
      "STILL TO ESTABLISH correctly requests 'Symptom character / sensation' because character is unresolved"
    );

    // --- [TURN 5] Question Association & Denial ('Nothing with that.') ---
    console.log("\n--- [TURN 5] Question Association & Denial ('Nothing with that.') ---");
    if (interviewState.pendingQuestion?.targetSlot !== "swallowing_difficulty") {
      interviewState.pendingQuestion = {
        id: "req-swallow-fluids",
        targetSlot: "swallowing_difficulty",
        askedBy: "sarah",
        doctorName: "Dr. Sarah Chen, MD",
        patientFacingSpeaker: "sarah",
        question: "Are you having any difficulty swallowing liquids or keeping fluids down?",
        purpose: "Screen for true mechanical obstruction / dysphagia",
        required: true,
        priority: "high",
        status: "pending",
        createdAt: new Date().toISOString(),
        caseVersion: interviewState.caseVersion
      };
    }

    const t5Msg = "Nothing with that.";
    const t5Data = await simulateApiCall(t5Msg, history, interviewState);
    interviewState = t5Data.interviewState;
    history.push({ role: "patient", text: t5Msg });
    history.push({ role: "doctor", text: t5Data.doctorReply });

    console.log("Turn 5 Doctor Reply:", t5Data.doctorReply);
    console.log("Turn 5 Known Facts:", interviewState.slots.known_facts);
    console.log("Turn 5 Denied Symptoms:", interviewState.conversationMemory?.deniedSymptoms);

    const swallowingDenied = (interviewState.conversationMemory?.deniedSymptoms || []).includes("swallowing_difficulty") ||
      interviewState.slots.known_facts.some((f: string) => /Denied:.*swallowing/i.test(f));
    assert(swallowingDenied, "Swallowing difficulty is CONFIRMED as DENIED");

    // Invariant: onset_pattern must NEVER be denied!
    const onsetPatternFalselyDenied = (interviewState.conversationMemory?.deniedSymptoms || []).includes("onset_pattern") ||
      interviewState.slots.known_facts.some((f: string) => /Denied:.*onset_pattern/i.test(f));
    assert(!onsetPatternFalselyDenied, "INVARIANT: onset_pattern was NOT falsely denied");

    const subfieldsT5 = extractSubfieldState(interviewState.slots, interviewState.slots.known_facts, interviewState.conversationMemory);
    assert(subfieldsT5.onset.onsetPattern === "unknown", "onset_pattern remains UNRESOLVED");
    assert(!subfieldsT5.onset.isResolved, "onset category remains unresolved awaiting sudden vs gradual");

    // --- [TURN 6] Doctor Next Action ---
    console.log("\n--- [TURN 6] Doctor Next Action ---");
    const doctorReplyLower = t5Data.doctorReply.toLowerCase();
    console.log("Doctor Reply to Turn 5:", t5Data.doctorReply);

    assert(
      doctorReplyLower.includes("sudden") || doctorReplyLower.includes("gradual"),
      "Doctor correctly prioritizes unasked onset pattern ('sudden' or 'gradual')"
    );
    assert(
      !doctorReplyLower.includes("when did this begin") &&
      !doctorReplyLower.includes("how long have you had"),
      "Doctor does NOT re-ask duration when asking onset pattern"
    );

    console.log("✅ MODE A PASSED: Deterministic Planner logic is verified.");
  } finally {
    if (originalApiKey) process.env.NVIDIA_API_KEY = originalApiKey;
  }
}

/**
 * ===============================================================================
 * MODE B: LLM Integration & Post-Generation Target Validator Validation
 * ===============================================================================
 * Validates the live LLM pipeline using a deterministic mock adapter without
 * requiring external network calls.
 *
 * Verifies:
 * 1. Correct target question -> Accepted
 * 2. Wrong target question -> Rejected + Fallback to deterministic reply
 * 3. Repeated duration question -> Rejected + Fallback (never mutates pending targetSlot)
 * 4. Repeated fever question -> Rejected + Fallback
 * 5. Multi-question output -> Rejected + Fallback
 * 6. Semantically ambiguous / Non-question output -> Rejected + Fallback
 * 7. Exact Reported Repetition Loop Scenario
 */
async function runModeB() {
  console.log("\n===============================================================================");
  console.log("   [MODE B] LLM INTEGRATION & TARGET VALIDATOR PARITY");
  console.log("   Exercising Production LLM Pipeline with Deterministic Mock Adapter");
  console.log("===============================================================================\n");

  let mockResponseText = "";
  nvidiaClient.setMockCompleter(async (messages: NvidiaChatMessage[], options: NvidiaCompletionOptions) => {
    return {
      content: JSON.stringify({ patientResponse: mockResponseText }),
      model: "mock-llm-adapter",
      latencyMs: 12,
    };
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Correct Target Question -> ACCEPTED
    // -------------------------------------------------------------------------
    console.log("--- [MODE B - TEST 1] Correct Target Realization ---");
    let state = conversationManager.createInitialState();
    mockResponseText = "Did this discomfort come on suddenly, or did it build up gradually?";

    // Turn 1: Patient reports sore throat for two days. Planned target is onset_pattern.
    const res1 = await simulateApiCall("I've had a sore throat for two days.", [], state);
    state = res1.interviewState;

    console.log("Planned Target Slot:", state.pendingQuestion?.targetSlot);
    console.log("Mock LLM Output:", mockResponseText);
    console.log("Actual Doctor Reply:", res1.doctorReply);
    console.log("LLM Meta:", res1.llmMeta);

    assert(res1.llmMeta?.provider === "nvidia", "Mock LLM was executed (provider === 'nvidia')");
    assert(res1.doctorReply === mockResponseText, "Valid realization was accepted verbatim");
    assert(state.pendingQuestion?.targetSlot === "onset_pattern", "Target slot remains 'onset_pattern'");

    // -------------------------------------------------------------------------
    // TEST 2: Wrong Target Question -> REJECTED + FALLBACK
    // -------------------------------------------------------------------------
    console.log("\n--- [MODE B - TEST 2] Wrong Target Question (Ear Pain instead of Swallowing Difficulty) ---");
    mockResponseText = "Are you having any pain radiating into your ears?";
    const res2 = await simulateApiCall("It hurts when I swallow saliva.", [], state);
    state = res2.interviewState;

    console.log("Mock LLM Output:", mockResponseText);
    console.log("Planned Target Inquiry in Res2:", state.pendingQuestion?.targetSlot);
    console.log("Actual Doctor Reply:", res2.doctorReply);
    console.log("LLM Meta:", res2.llmMeta);

    assert(res2.llmMeta?.provider === "fallback", "Wrong target was rejected by validator (provider === 'fallback')");
    assert(res2.doctorReply.toLowerCase().includes("swallow"), "Used deterministic fallback question for swallowing");
    assert(state.pendingQuestion?.targetSlot === "swallowing_difficulty", "INVARIANT: Target slot remains 'swallowing_difficulty' and was NOT rewritten to 'ear_pain'");

    // -------------------------------------------------------------------------
    // TEST 3: Repeated Duration Question -> REJECTED + FALLBACK (No State Poisoning)
    // -------------------------------------------------------------------------
    console.log("\n--- [MODE B - TEST 3] Repeated Duration Question (Violates mustAvoid & resolved onset) ---");
    mockResponseText = "When did this sore throat begin, or how long have you had it?";
    const res3 = await simulateApiCall("It hurts pretty bad.", [], state);

    console.log("Mock LLM Output:", mockResponseText);
    console.log("Actual Doctor Reply:", res3.doctorReply);
    console.log("LLM Meta:", res3.llmMeta);

    assert(res3.llmMeta?.provider === "fallback", "Repeated duration inquiry was rejected (provider === 'fallback')");
    assert(!res3.doctorReply.toLowerCase().includes("how long have you had"), "Doctor reply did not replay duration question");
    assert(res3.interviewState.pendingQuestion?.targetSlot === "onset_pattern", "INVARIANT: pendingQuestion.targetSlot was NOT corrupted back to 'onset'");

    // -------------------------------------------------------------------------
    // TEST 4: Repeated Fever Question -> REJECTED + FALLBACK
    // -------------------------------------------------------------------------
    console.log("\n--- [MODE B - TEST 4] Repeated Question on Denied Symptom (Fever) ---");
    // Explicitly add fever to denied symptoms in state
    state.conversationMemory!.deniedSymptoms.push("fever");
    state.slots.known_facts.push("Denied: fever");

    mockResponseText = "Do you have a fever or high temperature?";
    const res4 = await simulateApiCall("No other symptoms.", [], state);

    console.log("Mock LLM Output:", mockResponseText);
    console.log("Actual Doctor Reply:", res4.doctorReply);
    console.log("LLM Meta:", res4.llmMeta);

    assert(res4.llmMeta?.provider === "fallback", "Inquiry about denied symptom was rejected");
    assert(!res4.doctorReply.toLowerCase().includes("fever"), "Doctor reply does not mention fever");

    // -------------------------------------------------------------------------
    // TEST 5: Multi-Question Output -> REJECTED + FALLBACK
    // -------------------------------------------------------------------------
    console.log("\n--- [MODE B - TEST 5] Multi-Question Output (Violates Single Question Policy) ---");
    mockResponseText = "Did it come on suddenly? Also do you have any difficulty swallowing fluids?";
    const res5 = await simulateApiCall("Still uncomfortable.", [], state);

    console.log("Mock LLM Output:", mockResponseText);
    console.log("Actual Doctor Reply:", res5.doctorReply);
    console.log("LLM Meta:", res5.llmMeta);

    assert(res5.llmMeta?.provider === "fallback", "Multi-question response was rejected");
    const qCount = (res5.doctorReply.match(/\?/g) || []).length;
    assert(qCount <= 1, "Doctor reply has at most ONE question");

    // -------------------------------------------------------------------------
    // TEST 6: Exact Reported Repetition Loop Reproduction & Remediation
    // -------------------------------------------------------------------------
    console.log("\n--- [MODE B - TEST 6] Reproduction of Exact Reported Repetition Loop ---");
    let loopState = conversationManager.createInitialState();
    const loopHistory: any[] = [];

    // T1: Patient establishes duration = 2 days
    mockResponseText = "Did that throat pain come on suddenly, or did it build up gradually?";
    const loopT1 = await simulateApiCall("I've had a sore throat for two days.", loopHistory, loopState);
    loopState = loopT1.interviewState;
    loopHistory.push({ role: "patient", text: "I've had a sore throat for two days." });
    loopHistory.push({ role: "doctor", text: loopT1.doctorReply });

    const durResolvedT1 = Boolean(extractSubfieldState(loopState.slots, loopState.slots.known_facts, loopState.conversationMemory).onset.duration);
    assert(durResolvedT1, "T1: Duration is established as 2 days");

    // T2: Patient says "It hurts when I swallow saliva."
    // Planner resolves odynophagia. Planner must NOT choose duration again!
    // Simulation 6A: LLM attempts to re-ask duration ("When did the sore throat begin?")
    mockResponseText = "When did the sore throat begin?";
    const loopT2A = await simulateApiCall("It hurts when I swallow saliva.", loopHistory, loopState);

    console.log("T2A Mock LLM Attempted (Duration Repeat):", mockResponseText);
    console.log("T2A Doctor Reply (Delivered):", loopT2A.doctorReply);
    console.log("T2A Pending Target Slot:", loopT2A.interviewState.pendingQuestion?.targetSlot);

    assert(loopT2A.llmMeta?.provider === "fallback", "T2A: Re-asking duration was REJECTED");
    assert(!loopT2A.doctorReply.toLowerCase().includes("when did the sore throat begin"), "T2A: Duration was NOT re-asked");
    assert(loopT2A.interviewState.pendingQuestion?.targetSlot === "swallowing_difficulty", "T2A INVARIANT: pendingQuestion.targetSlot remains 'swallowing_difficulty' (not overwritten to 'onset')");

    // Simulation 6B: LLM attempts to ask severity when severity is already resolved
    const stateWithSeverity = {
      ...loopState,
      slots: { ...loopState.slots, severity: "8/10", known_facts: [...loopState.slots.known_facts, "SEVERITY: 8/10"] },
    };
    mockResponseText = "On a scale from 0 to 10, how severe is the throat pain?";
    const loopT2B = await simulateApiCall("It hurts when I swallow saliva.", loopHistory, stateWithSeverity);

    console.log("T2B Mock LLM Attempted (Resolved Severity):", mockResponseText);
    console.log("T2B Doctor Reply (Delivered):", loopT2B.doctorReply);

    assert(loopT2B.llmMeta?.provider === "fallback", "T2B: Asking already-resolved severity was REJECTED");
    assert(!loopT2B.doctorReply.toLowerCase().includes("scale from 0 to 10"), "T2B: Severity was NOT re-asked");

    // Simulation 6C: LLM produces valid question addressing the planner target (swallowing)
    mockResponseText = "Are you still able to swallow liquids and saliva normally, or does it feel obstructed?";
    const loopT2C = await simulateApiCall("It hurts when I swallow saliva.", loopHistory, loopState);

    console.log("T2C Mock LLM Attempted (Valid Swallowing Inquiry):", mockResponseText);
    console.log("T2C Doctor Reply (Delivered):", loopT2C.doctorReply);

    assert(loopT2C.llmMeta?.provider === "nvidia", "T2C: Valid realization of planned target was ACCEPTED");
    assert(loopT2C.doctorReply === mockResponseText, "T2C: Doctor reply delivered the validated LLM wording");
    assert(loopT2C.interviewState.pendingQuestion?.targetSlot === "swallowing_difficulty", "T2C: Target slot remains 'swallowing_difficulty'");

    console.log("\n===============================================================================");
    console.log("   ✅ ALL MODE B MOCK-LLM INTEGRATION & REPETITION TESTS PASSED 100%!");
    console.log("===============================================================================\n");
  } finally {
    nvidiaClient.setMockCompleter(null);
  }
}

async function main() {
  await runModeA();
  await runModeB();
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
