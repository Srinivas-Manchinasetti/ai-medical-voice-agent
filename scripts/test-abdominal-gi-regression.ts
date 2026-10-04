/**
 * Abdominal / GI clinical-state regression tests
 *
 * Covers:
 * A. loose motions → diarrhea present
 * B. abdominal location parsing
 * C. episodic 4/10 usual + 9/10 peak
 * D. completeness never exceeds 100
 * E. planner does not re-ask generic associated symptoms after diarrhea
 */

import {
  extractGiAssociatedSymptoms,
  parseAbdominalLocations,
  extractEpisodicSeverity,
  normalizeCompletenessPercent,
  createInitialInterviewStateV2,
} from "../lib/triage/clinical-state";
import { evidenceExtractor } from "../lib/triage/evidence-extractor";
import { questionPlanner } from "../lib/triage/question-planner";
import { conversationManager } from "../lib/triage/conversation-manager";
import { responsePlanner } from "../lib/triage/response-planner";
import { evaluatePreArbiter } from "../lib/triage/pre-arbiter";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

console.log("\n=== A: GI extraction — loose motions → diarrhea ===");
const gi = extractGiAssociatedSymptoms("I've lately been having bad pooping and loose motions.");
assert(gi.some(f => f.name === "diarrhea" && f.status === "present"), 'A1: "loose motions" → diarrhea present');

const v2 = createInitialInterviewStateV2();
const extracted = evidenceExtractor.extract(
  "I've lately been having bad pooping ... loose motions.",
  v2
);
assert(
  extracted.associatedSymptomsUpdates.some(f => f.name === "diarrhea" && f.status === "present"),
  "A2: evidence extractor attaches diarrhea to associated symptoms"
);

console.log("\n=== B: Abdominal location ===");
assert(parseAbdominalLocations("it is in the right lower part").includes("right_lower"), "B1: right lower → RLQ");
assert(parseAbdominalLocations("all over my stomach").includes("diffuse"), "B2: all over → diffuse");
assert(parseAbdominalLocations("around my belly button").includes("central_periumbilical"), "B3: navel → periumbilical");
assert(parseAbdominalLocations("upper stomach").includes("upper_abdomen"), "B4: upper → upper abdomen");

const locState = createInitialInterviewStateV2();
locState.chiefComplaint = {
  id: "cc",
  name: "abdominal_pain",
  label: "Abdominal pain",
  category: "chief_complaint",
  status: "present",
  value: true,
  normalizedText: "Present (Abdominal pain)",
  confidence: 1,
  source: "patient",
  turnId: 1,
  timestamp: new Date().toISOString(),
};
const locPlan = questionPlanner.planNextQuestion(locState, evidenceExtractor.extract("I have a severe stomach ache", locState));
assert(locPlan.target === "abdominal_location", `B5: planner asks abdominal location first, got ${locPlan.target}`);

console.log("\n=== C: Episodic severity ===");
const sev = extractEpisodicSeverity("usually 4/10 but 9/10 when sharp");
assert(sev?.baseline === 4, `C1: baseline 4, got ${sev?.baseline}`);
assert(sev?.peak === 9, `C2: peak 9, got ${sev?.peak}`);
assert(sev?.pattern === "intermittent", `C3: intermittent, got ${sev?.pattern}`);
assert(sev?.display.includes("4/10") && sev?.display.includes("9/10"), `C4: display preserves both: ${sev?.display}`);

console.log("\n=== D: Completeness 0–100 ===");
assert(normalizeCompletenessPercent(0.88) === 88, "D1: 0.88 fraction → 88%");
assert(normalizeCompletenessPercent(88) === 88, "D2: 88 percent stays 88%");
assert(normalizeCompletenessPercent(8800) === 100, "D3: 8800 clamps to 100%");
assert(normalizeCompletenessPercent(0) === 0, "D4: 0 stays 0");

console.log("\n=== E: Planner moves on after diarrhea ===");
const mgr = conversationManager.createInitialState();
mgr.cumulativeTranscript = "I have a severe stomach ache from 2 days. suddenly started from when i woke up. usually dull but sharp and painful at times. I've lately been having bad pooping and loose motions.";
mgr.slots.onset = "2 days";
mgr.slots.onset_pattern = "sudden";
mgr.slots.character = "dull";
mgr.slots.known_facts = ["ONSET: 2 days", "ONSET_TYPE: sudden", "CHARACTER: dull"];
conversationManager.extractOpportunisticFacts(mgr);
assert(mgr.slots.associated_symptoms.includes("diarrhea"), `E1: opportunistic diarrhea, got ${mgr.slots.associated_symptoms.join(",")}`);
assert(!mgr.slots.known_facts.some(f => /^ONSET_AND_LOCATION:/i.test(f)), "E2: no ONSET_AND_LOCATION duplicate fact");

const pre = evaluatePreArbiter({
  patient_id: "t",
  patient_name: "t",
  transcript: mgr.cumulativeTranscript,
  conversation_history: [],
  demographics: {},
  detected_symptoms: mgr.slots.known_facts,
  vitals: {},
  speech_features: undefined as any,
  pre_safety_flags: [],
  immediate_danger_detected: false,
  provenance_evidence: [],
  case_version: 1,
});
const plan = responsePlanner.plan(
  "I've lately been having bad pooping and loose motions.",
  { rawUtterance: "loose motions", intent: "symptom_report", isConfirmationOrRepetition: false, isEmergencyInquiry: false, newEvidence: [], ambiguities: [], confidence: 0.9 } as any,
  mgr,
  pre
);
assert(plan.nextHighValueInquiry?.topic !== "associated_symptoms", `E3: not generic associated_symptoms, got ${plan.nextHighValueInquiry?.topic}`);
assert(
  plan.nextHighValueInquiry?.topic === "abdominal_location" ||
    plan.nextHighValueInquiry?.topic === "vomiting" ||
    plan.nextHighValueInquiry?.topic === "fever" ||
    plan.nextHighValueInquiry?.topic === "blood_in_stool",
  `E4: specific GI/location target, got ${plan.nextHighValueInquiry?.topic}`
);
assert(
  !/what else you've been noticing/i.test(plan.suggestedSpokenReply),
  `E5: no generic what-else prompt: ${plan.suggestedSpokenReply}`
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
