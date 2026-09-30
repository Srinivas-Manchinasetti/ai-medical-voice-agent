import { evidenceExtractor } from "../lib/triage/evidence-extractor";
import { createInitialInterviewStateV2 } from "../lib/triage/clinical-state";
import { questionPlanner } from "../lib/triage/question-planner";
import { conversationManager } from "../lib/triage/conversation-manager";

async function run() {
  console.log("======================================================================");
  console.log("       TEST CLINICAL STATE EXTRACTION BUG ON SWALLOWING/FEVER/PAIN    ");
  console.log("======================================================================\n");

  const v2 = createInitialInterviewStateV2();
  const utterance = "It hurts when I swallow saliva. No fever. Pain is 6/10.";
  console.log(`Input Utterance: "${utterance}"\n`);

  // 1. Evidence Extractor Test
  const ext = evidenceExtractor.extract(utterance, v2);
  console.log("--- EVIDENCE EXTRACTOR OUTPUT ---");
  console.log("New Facts (count=" + ext.newFacts.length + "):");
  ext.newFacts.forEach(f => {
    console.log(`  • ${f.name} [status=${f.status}]: value=${JSON.stringify(f.value)} | norm="${f.normalizedText}" | src=${f.source} | conf=${f.confidence}`);
  });
  console.log("Denied Topics:", ext.deniedTopics);
  console.log("Symptom Profile Updates:", Object.keys(ext.symptomProfileUpdates));
  console.log("Red Flag Assessments:", ext.redFlagAssessments);

  // Apply updates to V2 state
  v2.establishedFacts.push(...ext.newFacts);
  if (ext.updatedChiefComplaint) v2.chiefComplaint = ext.updatedChiefComplaint;
  Object.assign(v2.symptomProfile, ext.symptomProfileUpdates);
  ext.deniedTopics.forEach(d => {
    if (!v2.interviewMemory.deniedTopics.includes(d)) v2.interviewMemory.deniedTopics.push(d);
  });

  // 2. Question Planner Test
  const planned = questionPlanner.planNextQuestion(v2, ext);
  console.log("\n--- QUESTION PLANNER OUTPUT ---");
  console.log("Planned Target:", planned.target);
  console.log("Suggested Phrasing:", planned.suggestedPhrasing);
  console.log("Clinical Rationale:", planned.clinicalRationale);

  // 3. Conversation Manager Turn Test
  console.log("\n--- CONVERSATION MANAGER TURN TEST ---");
  let mgrState = conversationManager.createInitialState();
  const turnResult = await conversationManager.processTurn(utterance, mgrState);
  console.log("Doctor Reply:", turnResult.doctorReply);
  console.log("Slots Known Facts:", turnResult.state.slots.known_facts);
  console.log("Slot Severity:", turnResult.state.slots.severity);
  console.log("Slot Duration:", turnResult.state.slots.duration);
  console.log("Slot Onset:", turnResult.state.slots.onset);
  console.log("Denied Symptoms in Memory:", turnResult.state.conversationMemory?.deniedSymptoms);
  console.log("Pending Question:", turnResult.state.pendingQuestion?.question);
}

run().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
