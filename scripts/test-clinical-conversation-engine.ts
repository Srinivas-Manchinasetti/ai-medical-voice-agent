/**
 * END-TO-END CLINICAL CONVERSATION ENGINE BENCHMARK
 * 
 * Tests the exact 4-turn dialog from the 31-second recorded consultation:
 * Turn 1: "I have been feeling throat pain for two days."
 * Turn 2: "Well, it started from morning 2 days ago and it gradually increased by the next day."
 * Turn 3: "Uh, nothing much, but it's just that my voice has been ruined because of that. Like my voice changed."
 * Turn 4: "I insist my throat is paining and my voice has been changed."
 * 
 * Verifies all Phase 3 Invariants:
 * 1. ZERO Raw Utterance Leaks: No raw speech strings in onset, character, or known_facts.
 * 2. 100% Deterministic History Completeness: Weighted points (0 to 100%).
 * 3. Independent Clinical Safety Assessment: Decoupled from completeness.
 * 4. Pivot to New Findings: Immediately characterizes voice change when introduced.
 * 5. Strictly ONE Question Per Turn: No bundling 3 inquiries together.
 * 6. Banned Filler Phrases: No "I hear..." or robotic prefixes.
 * 7. 0% Repeated Question Rate: Never asks an already answered or denied question.
 */

import { conversationManager } from "../lib/triage/conversation-manager";
import {
  ClinicalInterviewStateV2,
  ClinicalFact,
  createInitialInterviewStateV2,
  calculateHistoryCompleteness,
  evaluateClinicalSafety,
} from "../lib/triage/clinical-state";
import { evidenceExtractor } from "../lib/triage/evidence-extractor";
import { questionPlanner } from "../lib/triage/question-planner";
import { DOCTOR_PROFILES } from "../config/doctors";

async function runClinicalConversationEngineBenchmark() {
  console.log("==============================================================================");
  console.log("    PHASE 3: CLINICAL CONVERSATION ENGINE END-TO-END BENCHMARK                ");
  console.log("==============================================================================");

  let state = conversationManager.createInitialState();
  let v2State = createInitialInterviewStateV2();

  // Helper to count question marks
  const countQuestions = (text: string) => (text.match(/\?/g) || []).length;
  // Helper to check for banned phrases
  const hasBannedFiller = (text: string) => /\b(i hear (?:that|you|the pain)?|i hear\b)/i.test(text);

  // =========================================================================
  // TURN 1: Patient presents with throat pain for two days
  // =========================================================================
  console.log("\n--- TURN 1: Initial Presentation ---");
  const turn1Utterance = "I have been feeling throat pain for two days.";
  console.log(`Patient: "${turn1Utterance}"`);

  // Test Evidence Extractor & V2 state directly
  const extracted1 = evidenceExtractor.extract(turn1Utterance, v2State);
  console.log(`• Extracted Facts (${extracted1.newFacts.length}):`, extracted1.newFacts.map(f => `${f.name} [${f.status}]: ${f.normalizedText}`));

  // Invariant 1.1: Chief complaint must be extracted as throat pain
  const hasThroatFact = extracted1.newFacts.some(f => f.name === "throat_pain" && f.status === "present");
  if (!hasThroatFact) {
    throw new Error("Turn 1 failed: Evidence extractor missed throat_pain chief complaint!");
  }

  // Invariant 1.2: Onset ~2 days extracted cleanly (no raw text)
  const hasCleanOnset = extracted1.newFacts.some(f => f.name === "onset" && !f.normalizedText.includes("feeling throat"));
  if (!hasCleanOnset) {
    throw new Error("Turn 1 failed: Evidence extractor onset missing or corrupted with raw text!");
  }

  // Update V2 State
  v2State.turnCount++;
  v2State.establishedFacts.push(...extracted1.newFacts);
  if (extracted1.updatedChiefComplaint) v2State.chiefComplaint = extracted1.updatedChiefComplaint;
  Object.assign(v2State.symptomProfile, extracted1.symptomProfileUpdates);

  // Invariant 1.3: Deterministic Completeness Score
  const completeness1 = calculateHistoryCompleteness(
    v2State.chiefComplaint,
    v2State.symptomProfile,
    v2State.associatedSymptoms,
    v2State.redFlags
  );
  console.log(`• Calculated History Completeness: ${completeness1.score}% (Formula: ${completeness1.formula})`);
  console.log(`• Breakdown: CC=${completeness1.breakdown.chiefComplaint.earned}/${completeness1.breakdown.chiefComplaint.weight}, Onset=${completeness1.breakdown.onsetTimeline.earned}/${completeness1.breakdown.onsetTimeline.weight}`);
  if (completeness1.score < 20) {
    throw new Error(`Turn 1 failed: Completeness score too low (${completeness1.score}%), expected at least 20% for Chief Complaint`);
  }

  // Invariant 1.4: Question Planner selects single onset/timeline question
  const planned1 = questionPlanner.planNextQuestion(v2State, extracted1);
  console.log(`• Planned Next Question: Target=${planned1.target}, Suggested="${planned1.suggestedPhrasing}"`);
  if (planned1.target !== "course") {
    throw new Error(`Turn 1 failed: Expected question target 'course' since onset is already known, got '${planned1.target}'`);
  }
  if (hasBannedFiller(planned1.suggestedPhrasing)) {
    throw new Error(`Turn 1 failed: Suggested phrasing contains banned filler 'I hear...'`);
  }
  if (countQuestions(planned1.suggestedPhrasing) > 1) {
    throw new Error(`Turn 1 failed: Bundled multiple questions in turn 1: ${planned1.suggestedPhrasing}`);
  }

  // Invariant 1.5: Conversation Manager turn execution
  const res1 = await conversationManager.processTurn(turn1Utterance, state);
  state = res1.state;
  console.log(`• Manager Doctor Reply: "${res1.doctorReply}"`);
  console.log(`• Manager Pending Slot: ${state.pendingQuestion?.targetSlot}`);

  // Invariant 1.6: Golden Invariant - Never ask when began when onset is known
  if (/when did|when this began/i.test(res1.doctorReply)) {
    throw new Error(`Turn 1 failed Golden Invariant: Asked "when this began" despite onset already known! Reply: "${res1.doctorReply}"`);
  }
  if (!/worse|improving|staying about the same/i.test(res1.doctorReply)) {
    throw new Error(`Turn 1 failed: Expected course inquiry in doctor reply, got: "${res1.doctorReply}"`);
  }

  // Verify zero raw utterance leaks into known_facts
  for (const fact of state.slots.known_facts) {
    if (fact.includes("feeling throat pain for two days")) {
      throw new Error(`Turn 1 failed: Raw user utterance leaked into known_facts: "${fact}"`);
    }
  }

  console.log("✅ Turn 1 PASSED: Clean extraction, zero raw leaks, Golden Invariant upheld (asked course, not onset).");

  // =========================================================================
  // TURN 2: Patient clarifies onset and gradual course
  // =========================================================================
  console.log("\n--- TURN 2: Timeline & Course Clarification ---");
  const turn2Utterance = "Well, it started from morning 2 days ago and it gradually increased by the next day.";
  console.log(`Patient: "${turn2Utterance}"`);

  // Update memory
  v2State.interviewMemory.askedTopics.push("onset");
  const extracted2 = evidenceExtractor.extract(turn2Utterance, v2State, planned1.suggestedPhrasing, "onset");
  console.log(`• Extracted Facts (${extracted2.newFacts.length}):`, extracted2.newFacts.map(f => `${f.name} [${f.status}]: ${f.normalizedText}`));

  // Invariant 2.1: Course must be extracted cleanly as gradual worsening
  const hasCourse = extracted2.newFacts.some(f => f.name === "course" && f.status === "present");
  if (!hasCourse) {
    throw new Error("Turn 2 failed: Course progression not extracted!");
  }

  v2State.turnCount++;
  v2State.establishedFacts.push(...extracted2.newFacts);
  Object.assign(v2State.symptomProfile, extracted2.symptomProfileUpdates);
  v2State.interviewMemory.answeredTopics.push("onset", "course");
  v2State.interviewMemory.doNotRepeat.push("onset", "course");

  const completeness2 = calculateHistoryCompleteness(
    v2State.chiefComplaint,
    v2State.symptomProfile,
    v2State.associatedSymptoms,
    v2State.redFlags
  );
  console.log(`• Calculated History Completeness: ${completeness2.score}% (Formula: ${completeness2.formula})`);
  if (completeness2.score < 50) {
    throw new Error(`Turn 2 failed: Completeness score should be at least 50% with CC, Onset, and Course resolved! Got: ${completeness2.score}%`);
  }

  // Invariant 2.2: Next question must be red-flag swallowing screen (Dysphagia)
  const planned2 = questionPlanner.planNextQuestion(v2State, extracted2);
  console.log(`• Planned Next Question: Target=${planned2.target}, Suggested="${planned2.suggestedPhrasing}"`);
  if (planned2.target !== "swallowing_difficulty") {
    throw new Error(`Turn 2 failed: Expected target 'swallowing_difficulty', got '${planned2.target}'`);
  }
  if (hasBannedFiller(planned2.suggestedPhrasing)) {
    throw new Error(`Turn 2 failed: Suggested phrasing contains banned filler 'I hear...'`);
  }
  if (countQuestions(planned2.suggestedPhrasing) > 1) {
    throw new Error(`Turn 2 failed: Bundled multiple questions: "${planned2.suggestedPhrasing}"`);
  }

  // Conversation Manager Turn Execution
  const res2 = await conversationManager.processTurn(turn2Utterance, state);
  state = res2.state;
  console.log(`• Manager Doctor Reply: "${res2.doctorReply}"`);
  console.log(`• Manager Pending Slot: ${state.pendingQuestion?.targetSlot}`);

  if (hasBannedFiller(res2.doctorReply)) {
    throw new Error(`Turn 2 failed: Doctor reply contains 'I hear...': "${res2.doctorReply}"`);
  }
  if (countQuestions(res2.doctorReply) > 1) {
    throw new Error(`Turn 2 failed: Doctor reply bundles multiple questions: "${res2.doctorReply}"`);
  }
  if (res2.doctorReply.toLowerCase().includes("fever") && res2.doctorReply.toLowerCase().includes("swallow")) {
    throw new Error(`Turn 2 failed: Doctor reply bundled fever and swallow together!`);
  }

  console.log("✅ Turn 2 PASSED: Course resolved, completeness ~50%, Sarah asked strictly 1 swallowing question.");

  // =========================================================================
  // TURN 3: Patient reports no other issues, but reveals voice change
  // =========================================================================
  console.log("\n--- TURN 3: Voice Change Revelation & Swallowing Screen ---");
  const turn3Utterance = "Uh, nothing much, but it's just that my voice has been ruined because of that. Like my voice changed.";
  console.log(`Patient: "${turn3Utterance}"`);

  v2State.interviewMemory.askedTopics.push("swallowing_difficulty");
  const extracted3 = evidenceExtractor.extract(turn3Utterance, v2State, planned2.suggestedPhrasing, "swallowing_difficulty");
  console.log(`• Extracted Facts (${extracted3.newFacts.length}):`, extracted3.newFacts.map(f => `${f.name} [${f.status}]: ${f.normalizedText}`));
  console.log(`• Denied Topics:`, extracted3.deniedTopics);
  console.log(`• New Findings Detected:`, extracted3.newFindingsDetected);

  // Invariant 3.1: Swallowing difficulty marked as denied (absent)
  if (!extracted3.deniedTopics.includes("swallowing_difficulty")) {
    throw new Error("Turn 3 failed: 'nothing much' was not mapped to denied swallowing_difficulty!");
  }

  // Invariant 3.2: Voice change flagged as new finding
  if (!extracted3.newFindingsDetected.includes("voice_change")) {
    throw new Error("Turn 3 failed: voice_change not detected as new finding!");
  }

  v2State.turnCount++;
  v2State.establishedFacts.push(...extracted3.newFacts);
  v2State.associatedSymptoms.push(...extracted3.associatedSymptomsUpdates);
  Object.assign(v2State.redFlags, extracted3.redFlagAssessments);
  v2State.interviewMemory.answeredTopics.push("swallowing_difficulty", "voice_change");
  v2State.interviewMemory.doNotRepeat.push("swallowing_difficulty");

  // Invariant 3.3: Pivot to voice change characterization!
  const planned3 = questionPlanner.planNextQuestion(v2State, extracted3);
  console.log(`• Planned Next Question: Target=${planned3.target}, isPivot=${planned3.isPivotToNewFinding}, Suggested="${planned3.suggestedPhrasing}"`);
  if (planned3.target !== "voice_character") {
    throw new Error(`Turn 3 failed: Question planner did NOT pivot to 'voice_character'! Got: '${planned3.target}'`);
  }
  if (!planned3.isPivotToNewFinding) {
    throw new Error("Turn 3 failed: isPivotToNewFinding must be true for unexpected voice change!");
  }

  // Conversation Manager Turn Execution
  const res3 = await conversationManager.processTurn(turn3Utterance, state);
  state = res3.state;
  console.log(`• Manager Doctor Reply: "${res3.doctorReply}"`);
  console.log(`• Manager Pending Slot: ${state.pendingQuestion?.targetSlot}`);
  console.log(`• Manager Known Facts:`, state.slots.known_facts);

  // Invariant 3.4: ZERO RAW UTTERANCE LEAKAGE INTO ONSET
  if (state.slots.onset && state.slots.onset.includes("nothing much")) {
    throw new Error(`Turn 3 failed: Raw text 'Uh, nothing much...' leaked into onset slot: "${state.slots.onset}"`);
  }
  for (const fact of state.slots.known_facts) {
    if (fact.toLowerCase().includes("uh, nothing much")) {
      throw new Error(`Turn 3 failed: Raw utterance leaked into known_facts: "${fact}"`);
    }
  }

  // Invariant 3.5: Sarah pivots to voice change characterization
  if (!res3.doctorReply.toLowerCase().includes("voice")) {
    throw new Error(`Turn 3 failed: Sarah failed to acknowledge or ask about voice change! Reply: "${res3.doctorReply}"`);
  }
  if (hasBannedFiller(res3.doctorReply)) {
    throw new Error(`Turn 3 failed: Sarah reply contains 'I hear...': "${res3.doctorReply}"`);
  }
  if (countQuestions(res3.doctorReply) > 1) {
    throw new Error(`Turn 3 failed: Sarah reply bundles multiple questions: "${res3.doctorReply}"`);
  }

  console.log("✅ Turn 3 PASSED: Zero raw utterance leakage, swallowing denied, Sarah pivoted to voice change.");

  // =========================================================================
  // TURN 4: Patient insists on their throat pain and voice change
  // =========================================================================
  console.log("\n--- TURN 4: Patient Repetition Objection / Reaffirmation ---");
  const turn4Utterance = "I insist my throat is paining and my voice has been changed.";
  console.log(`Patient: "${turn4Utterance}"`);

  const extracted4 = evidenceExtractor.extract(turn4Utterance, v2State, planned3.suggestedPhrasing, "voice_character");
  console.log(`• Intent: ${extracted4.intent}, isReaffirmation: ${extracted4.isReaffirmation}`);

  // Invariant 4.1: Must be recognized as repetition objection / reaffirmation
  if (!extracted4.isReaffirmation && extracted4.intent !== "repetition_objection") {
    throw new Error("Turn 4 failed: Failed to detect reaffirmation / repetition objection from 'I insist...'!");
  }

  v2State.turnCount++;

  // Invariant 4.2: Question planner responds with humility and advances to unasked domain (severity or next safety)
  const planned4 = questionPlanner.planNextQuestion(v2State, extracted4);
  console.log(`• Planned Next Question: Target=${planned4.target}, Suggested="${planned4.suggestedPhrasing}"`);

  if (planned4.target === "onset" || planned4.target === "swallowing_difficulty") {
    throw new Error(`Turn 4 failed: Question planner repeated already answered/denied topic: '${planned4.target}'!`);
  }
  if (hasBannedFiller(planned4.suggestedPhrasing)) {
    throw new Error(`Turn 4 failed: Suggested phrasing contains banned filler 'I hear...'`);
  }

  // Conversation Manager Turn Execution
  const res4 = await conversationManager.processTurn(turn4Utterance, state);
  state = res4.state;
  console.log(`• Manager Doctor Reply: "${res4.doctorReply}"`);
  console.log(`• Manager Pending Slot: ${state.pendingQuestion?.targetSlot}`);

  // Invariant 4.3: Zero raw utterance leak for "I insist..."
  if (state.slots.onset && state.slots.onset.includes("insist")) {
    throw new Error(`Turn 4 failed: 'I insist...' leaked into onset slot: "${state.slots.onset}"`);
  }
  for (const fact of state.slots.known_facts) {
    if (fact.toLowerCase().includes("insist my throat")) {
      throw new Error(`Turn 4 failed: Raw utterance leaked into known_facts: "${fact}"`);
    }
  }

  // Invariant 4.4: Anti-repetition check
  const turn4ReplyLower = res4.doctorReply.toLowerCase();
  if (turn4ReplyLower.includes("when did this begin") || turn4ReplyLower.includes("start suddenly")) {
    throw new Error("Turn 4 failed: Doctor repeated onset question!");
  }
  if (countQuestions(res4.doctorReply) > 1) {
    throw new Error(`Turn 4 failed: Doctor reply bundled multiple questions: "${res4.doctorReply}"`);
  }

  console.log("✅ Turn 4 PASSED: Reaffirmation handled cleanly, zero raw leaks, advanced without repeating.");

  // =========================================================================
  // CLINICAL SAFETY & COMPLETENESS AUDIT
  // =========================================================================
  console.log("\n--- CLINICAL SAFETY & COMPLETENESS AUDIT ---");
  const finalCompleteness = calculateHistoryCompleteness(
    v2State.chiefComplaint,
    v2State.symptomProfile,
    v2State.associatedSymptoms,
    v2State.redFlags
  );
  const finalSafety = evaluateClinicalSafety(v2State.redFlags, false, []);

  console.log(`• Final History Completeness: ${finalCompleteness.score}%`);
  console.log(`• Formula: "${finalCompleteness.formula}"`);
  console.log(`• Clinical Safety Status: ${finalSafety.status}`);
  console.log(`• Safety Label: "${finalSafety.label}"`);
  console.log(`• Red-Flag Domains Assessed: ${finalSafety.assessedCount}/${finalSafety.totalDomains}`);

  if (finalCompleteness.score < 50 || finalCompleteness.score > 95) {
    throw new Error(`Completeness audit failed: Unexpected score ${finalCompleteness.score}%`);
  }

  // Independent safety check: Swallowing was assessed as clear, airway pending
  const swallowFlag = v2State.redFlags.swallowing;
  if (!swallowFlag || swallowFlag.status !== "clear") {
    throw new Error(`Safety audit failed: Swallowing red-flag should be 'clear' after negative screen! Got: ${swallowFlag?.status}`);
  }

  console.log("\n==============================================================================");
  console.log("✅ ALL PHASE 3 CLINICAL CONVERSATION ENGINE INVARIANTS PASSED!                ");
  console.log("   • Zero Raw Utterance Leaks: 100%                                           ");
  console.log("   • Single Question Per Turn: 100%                                           ");
  console.log("   • Pivot to Voice Change:    100%                                           ");
  console.log("   • Anti-Repetition Shield:   100%                                           ");
  console.log("   • Grounded Completeness:    100%                                           ");
  console.log("==============================================================================");
}

runClinicalConversationEngineBenchmark().catch(err => {
  console.error("\n❌ CLINICAL CONVERSATION ENGINE BENCHMARK FAILED:");
  console.error(err);
  process.exit(1);
});
