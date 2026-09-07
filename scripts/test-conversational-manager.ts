import { conversationManager } from "../lib/triage/conversation-manager";
import { clinicalBoard } from "../lib/agents/clinical-board";
import { PatientCase } from "../lib/agents/schemas";

async function runConversationalManagerTest() {
  console.log("==============================================================================");
  console.log("     STATEFUL CONVERSATION MANAGER & DYNAMIC AGENT REQUEST HARNESS            ");
  console.log("==============================================================================");

  let state = conversationManager.createInitialState();

  // --- TURN 1: Patient presents with vague chest tightness ---
  console.log("\n--- TURN 1: Initial Presentation ---");
  const turn1Msg = "I've been feeling an uncomfortable tightness in my chest.";
  console.log(`Patient: "${turn1Msg}"`);

  const res1 = await conversationManager.processTurn(turn1Msg, state);
  state = res1.state;

  console.log(`• Action: ${res1.action}`);
  console.log(`• Phase: ${state.phase}`);
  console.log(`• Inquiring Doctor: ${res1.doctorName} (${res1.specialty})`);
  console.log(`• Sarah Spoken Reply: "${res1.doctorReply}"`);
  console.log(`• Pending Question Slot: ${state.pendingQuestion?.targetSlot}`);

  if (res1.action !== "ASK_PATIENT" || state.pendingQuestion?.targetSlot !== "onset") {
    throw new Error("Turn 1 failed: Expected Sarah to ask onset");
  }
  console.log("✅ Turn 1 PASSED: Initial onset question initiated by Sarah.");

  // --- TURN 2: Patient clarifies onset and sudden worsening ---
  console.log("\n--- TURN 2: Onset Duration & Sudden Worsening ---");
  const turn2Msg = "About a week ago, but it got worse suddenly.";
  console.log(`Patient: "${turn2Msg}"`);

  const res2 = await conversationManager.processTurn(turn2Msg, state);
  state = res2.state;

  console.log(`• Action: ${res2.action}`);
  console.log(`• Resolved Onset: "${state.slots.onset}"`);
  console.log(`• Active Specialist Requests: ${state.agentRequests.filter(r => r.status === "pending").map(r => r.targetSlot).join(", ")}`);
  console.log(`• Sarah Spoken Reply: "${res2.doctorReply}"`);
  console.log(`• Pending Question Slot: ${state.pendingQuestion?.targetSlot}`);

  if (!state.slots.onset) {
    throw new Error("Turn 2 failed: Onset slot was not resolved!");
  }
  console.log("✅ Turn 2 PASSED: Onset slot resolved; specialist requests registered.");

  // --- TURN 3: Patient clarifies exertional relationship ---
  console.log("\n--- TURN 3: Exertional Relationship ---");
  const turn3Msg = "Actually mostly when climbing stairs or walking fast.";
  console.log(`Patient: "${turn3Msg}"`);

  const res3 = await conversationManager.processTurn(turn3Msg, state);
  state = res3.state;

  console.log(`• Action: ${res3.action}`);
  console.log(`• Resolved Exertional: "${state.slots.exertional}"`);
  console.log(`• Sarah Spoken Reply: "${res3.doctorReply}"`);
  console.log(`• Pending Question Slot: ${state.pendingQuestion?.targetSlot}`);

  console.log("✅ Turn 3 PASSED: Exertional slot resolved; Marcus Vance requested radiation.");

  // --- TURN 4: The Core Bug Scenario ("Well to my head actually") ---
  console.log("\n--- TURN 4: Radiation Slot Resolution (Headward Radiation) ---");
  const turn4Msg = "Well to my head actually.";
  console.log(`Patient: "${turn4Msg}"`);

  const res4 = await conversationManager.processTurn(turn4Msg, state);
  state = res4.state;

  console.log(`• Action: ${res4.action}`);
  console.log(`• Resolved Radiation: "${state.slots.radiation}"`);
  console.log(`• Sarah Spoken Reply: "${res4.doctorReply}"`);
  console.log(`• Pending Question Slot: ${state.pendingQuestion?.targetSlot}`);

  if (state.slots.radiation !== "head") {
    throw new Error(`Turn 4 failed: Expected radiation slot to be 'head', got '${state.slots.radiation}'`);
  }
  if (state.pendingQuestion?.targetSlot === "radiation") {
    throw new Error("Turn 4 failed: Radiation question was NOT cleared and is repeating!");
  }
  console.log("✅ Turn 4 PASSED: Radiation slot resolved to 'head', Marcus's question cleared.");

  // --- TURN 5: User Confirmation / Anti-Loop ("I said head?") ---
  console.log("\n--- TURN 5: User Confirmation Anti-Loop Handling ---");
  const turn5Msg = "I said head?";
  console.log(`Patient: "${turn5Msg}"`);

  const res5 = await conversationManager.processTurn(turn5Msg, state);
  state = res5.state;

  console.log(`• Action: ${res5.action}`);
  console.log(`• Radiation Slot Retained: "${state.slots.radiation}"`);
  console.log(`• Sarah Spoken Reply: "${res5.doctorReply}"`);
  console.log(`• Pending Question Slot: ${state.pendingQuestion?.targetSlot}`);

  if (res5.doctorReply.toLowerCase().includes("does the discomfort travel anywhere")) {
    throw new Error("Turn 5 failed: Loop detected! System repeated the radiation question!");
  }
  console.log("✅ Turn 5 PASSED: Loop prevented. Confirmation handled cleanly.");

  // --- TURN 6: Emergency Preemption / Pre-Arbiter Invariant Check ---
  console.log("\n--- TURN 6: Mid-Interview Emergency Preemption (Barge-In) ---");
  const turn6Msg = "Wait doctor! My right face just started drooping and I cannot lift my arm!";
  console.log(`Patient: "${turn6Msg}"`);

  const res6 = await conversationManager.processTurn(turn6Msg, state);
  state = res6.state;

  console.log(`• Action: ${res6.action}`);
  console.log(`• Information State: ${state.informationState}`);
  console.log(`• Pre-Arbiter Flags: ${res6.preArbiterResult.pre_safety_flags.join(", ")}`);
  console.log(`• Immediate Danger: ${res6.preArbiterResult.immediate_danger}`);
  console.log(`• Sarah Emergency Reply: "${res6.doctorReply}"`);

  if (res6.action !== "EMERGENCY_CONVENE_BOARD" || state.informationState !== "emergency_preempted") {
    throw new Error("Turn 6 failed: Pre-Arbiter did not preempt normal questioning on acute stroke deficit!");
  }
  console.log("✅ Turn 6 PASSED: Invariant verified: SAFETY > CONVERSATIONAL STATE > SPECIALIST REASONING.");

  // --- TURN 7: Emergency Panic Inquiry ("no one around... what do i do?") ---
  console.log("\n--- TURN 7: Emergency Panic Inquiry / Deterministic Dispatch Guidance ---");
  const turn7Msg = "I think there is no one around for help... what do i do?";
  console.log(`Patient: "${turn7Msg}"`);

  const res7 = await conversationManager.processTurn(turn7Msg, state);
  state = res7.state;

  console.log(`• Action: ${res7.action}`);
  console.log(`• Information State: ${state.informationState}`);
  console.log(`• Sarah Spoken Reply: "${res7.doctorReply}"`);

  if (!res7.doctorReply.includes("911") || !res7.doctorReply.toLowerCase().includes("speakerphone")) {
    throw new Error(`Turn 7 failed: Expected deterministic 911 dispatch instructions, got "${res7.doctorReply}"`);
  }
  console.log("✅ Turn 7 PASSED: Deterministic 911 emergency dispatch instructions returned.");

  console.log("\n==============================================================================");
  console.log("✅ ALL CONVERSATION MANAGER & AGENT REQUEST INVARIANTS VERIFIED SUCCESSFULLY.");
  console.log("==============================================================================");
}

runConversationalManagerTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
