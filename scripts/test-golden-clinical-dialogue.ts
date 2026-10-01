import { conversationManager } from "../lib/triage/conversation-manager";
import { extractSubfieldState } from "../lib/triage/clinical-state";
import { POST as voiceChatHandler } from "../app/api/voice/chat/route";
import { NextRequest } from "next/server";

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

async function runGoldenDialogue() {
  console.log("===============================================================================");
  console.log("   GOLDEN CLINICAL CONVERSATIONAL REGRESSION SUITE");
  console.log("   Verifying End-to-End State Invariants Across Exact Patient Dialogue");
  console.log("===============================================================================\n");

  let interviewState = conversationManager.createInitialState();
  const history: any[] = [];

  // ---------------------------------------------------------------------------
  // TURN 1: "I've had a sore throat for two days."
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // TURN 2: "It hurts when I swallow saliva."
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // TURN 3: "No fever."
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // TURN 4: "Maybe 8 by 10."
  // ---------------------------------------------------------------------------
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
  
  // Verify UI STILL TO ESTABLISH:
  const stillToEstablish = t4Data.board?.missing_dimensions || [];
  assert(
    !stillToEstablish.includes("Pain severity (0-10)"),
    "STILL TO ESTABLISH does NOT contain 'Pain severity (0-10)'"
  );
  assert(
    stillToEstablish.includes("Symptom character / sensation"),
    "STILL TO ESTABLISH correctly requests 'Symptom character / sensation' because character is unresolved"
  );

  // ---------------------------------------------------------------------------
  // TURN 5: Answering swallowing difficulty with "Nothing with that."
  // ---------------------------------------------------------------------------
  console.log("\n--- [TURN 5] Question Association & Denial ('Nothing with that.') ---");
  console.log("Pending Question before Turn 5:", interviewState.pendingQuestion?.question);
  console.log("Pending Target Slot before Turn 5:", interviewState.pendingQuestion?.targetSlot);

  // Simulate Doctor inquiring about difficulty swallowing liquids/solids if not already target
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

  // ---------------------------------------------------------------------------
  // TURN 6: Sarah's Next Inquiry must target onset_pattern (sudden vs gradual)
  // ---------------------------------------------------------------------------
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

  console.log("\n===============================================================================");
  console.log("   ✅ ALL GOLDEN CLINICAL DIALOGUE INVARIANTS PASSED 100%!");
  console.log("===============================================================================\n");
}

runGoldenDialogue().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
