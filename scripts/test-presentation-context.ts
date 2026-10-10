/**
 * CLINICAL PRESENTATION CONTEXT & DIMENSION REGISTRY EVALUATION SUITE (PHASE 2)
 *
 * Verifies:
 * 1. Multi-presentation syndrome classification (co-activation of comorbid presentations)
 * 2. Dimension satisfaction evaluation against ClinicalState as single source of truth
 * 3. Multi-turn question sequencing across primary and supporting presentations
 * 4. Anti-repetition across co-active presentations (e.g. diarrhea reported opportunistically)
 * 5. Safety screens distinction: prompt dimensions vs confirmed red flags
 * 6. Multilingual presentation triggering (English, Hinglish, Telugu transliterations)
 */

import { presentationClassifier } from "../lib/clinical-knowledge/presentation-classifier";
import {
  evaluatePresentationDimensions,
  ABDOMINAL_PAIN_PRESENTATION,
  ACUTE_DIARRHEA_PRESENTATION,
} from "../lib/clinical-knowledge/presentation-registry";
import { conversationManager } from "../lib/triage/conversation-manager";
import { responsePlanner } from "../lib/triage/response-planner";
import { evaluatePreArbiter } from "../lib/triage/pre-arbiter";
import { evaluateSafetyArbiter } from "../lib/triage/safety-arbiter";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${label}`);
    failed++;
  }
}

console.log("==============================================================================");
console.log("     CLINICAL PRESENTATION CONTEXT & DIMENSION REGISTRY EVALUATION (PHASE 2)  ");
console.log("==============================================================================");

async function runTests() {
  // ==============================================================================
  // TEST 1: Multi-Presentation Classification (Co-Activation)
  // ==============================================================================
  console.log("\n[TEST 1] Multi-Presentation Co-Activation");
  const utterance1 = "I have severe stomach pain since yesterday and loose motions.";
  const pContext = presentationClassifier.classify(utterance1, "", []);

  assert(pContext.active.length >= 2, "Both presentations co-activated (active.length >= 2)");
  assert(
    pContext.active.some((p) => p.id === "ABDOMINAL_PAIN"),
    "ABDOMINAL_PAIN is active"
  );
  assert(
    pContext.active.some((p) => p.id === "ACUTE_DIARRHEA"),
    "ACUTE_DIARRHEA is active"
  );
  assert(
    pContext.primary === "ABDOMINAL_PAIN" || pContext.primary === "ACUTE_DIARRHEA",
    `Primary presentation assigned: ${pContext.primary}`
  );
  assert(
    pContext.supporting.includes("ACUTE_DIARRHEA") || pContext.supporting.includes("ABDOMINAL_PAIN"),
    "Supporting presentation list preserves comorbid syndrome"
  );

  // ==============================================================================
  // TEST 2: Dimension Satisfaction Evaluation against ClinicalState
  // ==============================================================================
  console.log("\n[TEST 2] Dimension Evaluation against ClinicalState (Single Source of Truth)");
  const testSlots = {
    onset: "yesterday",
    severity: "severe (8/10)",
    associated_symptoms: ["diarrhea"],
    known_facts: [
      "ONSET: yesterday",
      "SEVERITY: severe (8/10)",
      "Associated: Diarrhea / loose stools",
      "Denied: fever",
    ],
  };
  const testDenied = ["fever"];

  const abdominalEvaluations = evaluatePresentationDimensions(
    "ABDOMINAL_PAIN",
    testSlots,
    testSlots.known_facts,
    testDenied
  );

  const onsetEval = abdominalEvaluations.find((e) => e.dimension.id === "onset");
  const severityEval = abdominalEvaluations.find((e) => e.dimension.id === "severity");
  const diarrheaEval = abdominalEvaluations.find((e) => e.dimension.id === "diarrhea");
  const feverEval = abdominalEvaluations.find((e) => e.dimension.id === "fever");
  const locationEval = abdominalEvaluations.find((e) => e.dimension.id === "location");
  const characterEval = abdominalEvaluations.find((e) => e.dimension.id === "character");
  const vomitEval = abdominalEvaluations.find((e) => e.dimension.id === "vomiting");

  assert(onsetEval?.status === "answered", `onset is answered (got ${onsetEval?.status})`);
  assert(severityEval?.status === "answered", `severity is answered (got ${severityEval?.status})`);
  assert(diarrheaEval?.status === "answered", `diarrhea is answered from associated symptoms (got ${diarrheaEval?.status})`);
  assert(feverEval?.status === "denied", `fever is denied (got ${feverEval?.status})`);
  assert(locationEval?.status === "unresolved", `location is unresolved (got ${locationEval?.status})`);
  assert(characterEval?.status === "unresolved", `character is unresolved (got ${characterEval?.status})`);
  assert(vomitEval?.status === "unresolved", `vomiting is unresolved (got ${vomitEval?.status})`);

  // ==============================================================================
  // TEST 3: Multi-Turn Question Sequencing Across Co-Active Presentations
  // ==============================================================================
  console.log("\n[TEST 3] Multi-Turn Sequential Inquiry & Anti-Repetition");
  let mgr = conversationManager.createInitialState();

  // Turn 1: Initial Presentation
  const turn1Result = await conversationManager.processTurn(
    "I have severe stomach pain since yesterday and loose motions.",
    mgr
  );
  mgr = turn1Result.state;

  assert(
    mgr.presentationContext?.active.some((p) => p.id === "ABDOMINAL_PAIN") ?? false,
    "Turn 1: ABDOMINAL_PAIN context active in state"
  );
  assert(
    mgr.presentationContext?.active.some((p) => p.id === "ACUTE_DIARRHEA") ?? false,
    "Turn 1: ACUTE_DIARRHEA context active in state"
  );
  assert(
    turn1Result.state.pendingQuestion?.targetSlot === "abdominal_location" ||
      turn1Result.state.pendingQuestion?.targetSlot === "location",
    `Turn 1: Sarah asks location first (got ${turn1Result.state.pendingQuestion?.targetSlot})`
  );

  // Turn 2: Patient answers location
  const turn2Result = await conversationManager.processTurn(
    "It is around my belly button.",
    mgr
  );
  mgr = turn2Result.state;

  assert(
    Boolean((mgr.slots.location && mgr.slots.location.includes("periumbilical")) || mgr.slots.known_facts.some(f => /periumbilical/i.test(f))),
    `Turn 2: Location resolved to periumbilical in slots or facts (got '${mgr.slots.location}', facts: ${mgr.slots.known_facts.join('; ')})`
  );
  assert(
    turn2Result.state.pendingQuestion?.targetSlot === "onset_pattern",
    `Turn 2: Sarah asks onset pattern next (got ${turn2Result.state.pendingQuestion?.targetSlot})`
  );

  // Turn 3: Patient answers onset pattern
  const turn3Result = await conversationManager.processTurn(
    "It built up gradually throughout the day.",
    mgr
  );
  mgr = turn3Result.state;

  assert(
    mgr.slots.onset_pattern === "gradual",
    `Turn 3: Onset pattern resolved to gradual (got '${mgr.slots.onset_pattern}')`
  );
  assert(
    turn3Result.state.pendingQuestion?.targetSlot === "character",
    `Turn 3: Sarah asks pain character next (got ${turn3Result.state.pendingQuestion?.targetSlot})`
  );

  // Turn 4: Patient answers character
  const turn4Result = await conversationManager.processTurn(
    "It feels like cramping.",
    mgr
  );
  mgr = turn4Result.state;

  assert(
    mgr.slots.character === "cramping" || Boolean(mgr.slots.character),
    `Turn 4: Character resolved (got '${mgr.slots.character}')`
  );
  assert(
    turn4Result.state.pendingQuestion?.targetSlot === "severity",
    `Turn 4: Sarah asks severity to quantify core history (got ${turn4Result.state.pendingQuestion?.targetSlot})`
  );

  // Turn 5: Patient answers severity
  const turn5Result = await conversationManager.processTurn(
    "It is about 7 out of 10.",
    mgr
  );
  mgr = turn5Result.state;

  assert(
    Boolean(mgr.slots.severity && mgr.slots.severity.includes("7")),
    `Turn 5: Severity resolved to 7/10 (got '${mgr.slots.severity}')`
  );
  assert(
    turn5Result.state.pendingQuestion?.targetSlot === "vomiting",
    `Turn 5: Sarah advances to vomiting screen (got ${turn5Result.state.pendingQuestion?.targetSlot})`
  );

  // Turn 6: Patient denies vomiting
  const turn6Result = await conversationManager.processTurn(
    "No vomiting at all.",
    mgr
  );
  mgr = turn6Result.state;

  assert(
    mgr.conversationMemory?.deniedSymptoms.includes("vomiting") ?? false,
    "Turn 6: Vomiting recorded in deniedSymptoms"
  );

  // Anti-Repetition invariant: Diarrhea was already reported in Turn 1 ("loose motions")
  assert(
    turn6Result.state.pendingQuestion?.targetSlot !== "diarrhea",
    "Turn 6: Sarah does NOT re-ask whether patient has diarrhea"
  );
  assert(
    !/loose\s+or\s+watery/i.test(turn6Result.doctorReply),
    "Turn 6: Reply does NOT ask if stools are loose or watery"
  );
  // System advances to fever, blood in stool, or diarrhea frequency
  assert(
    ["fever", "blood_in_stool", "stool_frequency"].includes(
      turn6Result.state.pendingQuestion?.targetSlot || ""
    ),
    `Turn 6: Sarah advances to next unasked dimension: ${turn6Result.state.pendingQuestion?.targetSlot}`
  );

  // ==============================================================================
  // TEST 4: Safety Screen Distinction (Screening Concepts vs Confirmed Red Flags)
  // ==============================================================================
  console.log("\n[TEST 4] Safety Screen Distinction: Dimension vs Confirmed Red Flag");
  // Dimension definition includes safety screens: rigid_abdomen, syncope_collapse, hematemesis
  const safetyScreens = ABDOMINAL_PAIN_PRESENTATION.dimensions.filter(
    (d) => d.type === "safety_screen"
  );
  assert(safetyScreens.length >= 3, `Abdominal presentation defines ${safetyScreens.length} safety screens`);

  // Case A: Screening dimension exists in registry, but patient has NOT reported any red flag
  const baselineSafety = evaluateSafetyArbiter({
    rawText: "I have stomach cramps and diarrhea",
  });

  assert(
    !baselineSafety.isEmergency,
    "Presence of safety-screen definitions does not falsely trigger emergency"
  );
  assert(
    baselineSafety.esiScore >= 3,
    `Baseline abdominal pain triaged non-critically (ESI ${baselineSafety.esiScore})`
  );

  // Case B: Patient actively reports red-flag safety finding (rigid abdomen / vomiting blood)
  const redFlagSafety = evaluateSafetyArbiter({
    rawText: "My stomach is rigid like a board and I'm vomiting coffee ground blood",
  });

  assert(
    redFlagSafety.isEmergency,
    "Confirmed red-flag finding escalates to isEmergency = true"
  );
  assert(
    redFlagSafety.esiScore <= 2,
    `Confirmed surgical abdomen triaged critically (ESI ${redFlagSafety.esiScore})`
  );

// ==============================================================================
// TEST 5: Multilingual Clinical Transliteration Co-Activation
// ==============================================================================
console.log("\n[TEST 5] Multilingual Presentation Classification (Hinglish & Telugu)");
const hinglishContext = presentationClassifier.classify(
  "Mujhe pet dard ho raha hai aur bahut dast bhi hai",
  "",
  []
);
assert(
  hinglishContext.active.some((p) => p.id === "ABDOMINAL_PAIN"),
  "Hinglish 'pet dard' activates ABDOMINAL_PAIN"
);
assert(
  hinglishContext.active.some((p) => p.id === "ACUTE_DIARRHEA"),
  "Hinglish 'dast' activates ACUTE_DIARRHEA"
);

const teluguContext = presentationClassifier.classify(
  "Naaku kadupu noppi mariyu virochanalu aithunnayi",
  "",
  []
);
assert(
  teluguContext.active.some((p) => p.id === "ABDOMINAL_PAIN"),
  "Telugu 'kadupu noppi' activates ABDOMINAL_PAIN"
);
assert(
  teluguContext.active.some((p) => p.id === "ACUTE_DIARRHEA"),
  "Telugu 'virochanalu' activates ACUTE_DIARRHEA"
);

// ==============================================================================
// TEST 6: Supporting Presentation Specific Dimension Inquiry
// ==============================================================================
console.log("\n[TEST 6] Supporting Presentation Specific Dimension Inquiry");
const ptWithFullAbdominalCore = conversationManager.createInitialState();
ptWithFullAbdominalCore.slots.location = "periumbilical";
ptWithFullAbdominalCore.slots.onset = "yesterday";
ptWithFullAbdominalCore.slots.onset_pattern = "gradual";
ptWithFullAbdominalCore.slots.character = "cramping";
ptWithFullAbdominalCore.slots.severity = "6/10";
ptWithFullAbdominalCore.slots.associated_symptoms = ["diarrhea"];
ptWithFullAbdominalCore.slots.known_facts = [
  "Abdominal location: periumbilical",
  "ONSET: yesterday",
  "ONSET_TYPE: gradual",
  "CHARACTER: cramping",
  "SEVERITY: 6/10",
  "Associated: Diarrhea / loose stools",
];
ptWithFullAbdominalCore.conversationMemory!.deniedSymptoms = ["vomiting", "fever", "blood_in_stool"];
ptWithFullAbdominalCore.presentationContext = {
  active: [
    { id: "ABDOMINAL_PAIN", confidence: 1.0, triggeredBy: ["stomach pain"] },
    { id: "ACUTE_DIARRHEA", confidence: 0.9, triggeredBy: ["loose motions"] },
  ],
  primary: "ABDOMINAL_PAIN",
  supporting: ["ACUTE_DIARRHEA"],
};

const pre = evaluatePreArbiter({
  patient_id: "t",
  patient_name: "t",
  transcript: "stomach cramps and loose motions",
  conversation_history: [],
  demographics: { age_group: "adult" },
  detected_symptoms: ptWithFullAbdominalCore.slots.known_facts,
  vitals: {},
  speech_features: {
    speech_pause_ratio: 0.15,
    mean_pause_duration_ms: 350,
    speech_rate_wpm: 130,
    voice_energy_variability: 0.1,
    pitch_variability: 0.12,
    observations: [],
    clinical_relevance: {
      respiratory_distress_signal: "unlikely",
      vocal_instability_signal: "none",
      confidence: 0.5,
    },
  },
  pre_safety_flags: [],
  immediate_danger_detected: false,
  provenance_evidence: [],
  case_version: 1,
});

const supportingPlan = responsePlanner.plan(
  "No blood in stool either.",
  { rawUtterance: "no blood", intent: "symptom_report", isConfirmationOrRepetition: false, isEmergencyInquiry: false, newEvidence: [], ambiguities: [], confidence: 0.9 } as any,
  ptWithFullAbdominalCore,
  pre
);

assert(
  supportingPlan.nextHighValueInquiry?.topic === "stool_frequency" ||
    supportingPlan.nextHighValueInquiry?.topic === "hydration",
  `Primary abdominal dimensions resolved -> Planner queries supporting ACUTE_DIARRHEA dimensions: ${supportingPlan.nextHighValueInquiry?.topic}`
);
assert(
  Boolean(supportingPlan.evaluatedDimensions && supportingPlan.evaluatedDimensions.length > 0),
  "ResponsePlan includes evaluatedDimensions for complete explainability"
);

  // ==============================================================================
  // TEST 7: Febrile Illness + Dengue Warning Signs (rash_bleeding safety screen)
  // ==============================================================================
  console.log("\n[TEST 7] Febrile Illness & Petechiae/Bleeding Screen (MoHFW Dengue Protocol)");
  const feverClassified = presentationClassifier.classify("High fever and body ache for 3 days with chills", "", []);
  assert(
    feverClassified.active.some(a => a.id === "FEBRILE_ILLNESS"),
    "FEBRILE_ILLNESS activated for fever and chills"
  );

  const feverState = conversationManager.createInitialState();
  feverState.slots.duration = "3 days";
  feverState.slots.onset = "3 days ago";
  feverState.slots.known_facts = [
    "Duration: 3 days",
    "ONSET: 3 days ago",
    "FEVER: present",
    "CHILLS: present",
    "temperature_pattern: continuous"
  ];
  feverState.presentationContext = feverClassified;

  const feverEvaluated = evaluatePresentationDimensions(
    "FEBRILE_ILLNESS",
    feverState.slots,
    feverState.slots.known_facts,
    []
  );
  const rashBleedDim = feverEvaluated.find(d => d.dimension.id === "rash_bleeding");
  assert(rashBleedDim?.status === "unresolved", "rash_bleeding dimension unresolved initially");

  // Simulate patient reporting petechiae/red spots
  const turnBleed = await conversationManager.processTurn("I have red spots on my legs and bleeding gums.", feverState);
  assert(
    turnBleed.state.slots.known_facts.some(f => /BLEEDING_TENDENCY|petechiae|bleeding gums/i.test(f)),
    "Dengue bleeding tendency recorded into known_facts"
  );
  const feverEvaluatedPost = evaluatePresentationDimensions(
    "FEBRILE_ILLNESS",
    turnBleed.state.slots,
    turnBleed.state.slots.known_facts,
    []
  );
  const rashBleedPost = feverEvaluatedPost.find(d => d.dimension.id === "rash_bleeding");
  assert(rashBleedPost?.status === "answered", "rash_bleeding dimension resolved as answered after patient report");

  // ==============================================================================
  // TEST 8: Pharyngitis + Odynophagia with Centor Criteria & Trismus Screen
  // ==============================================================================
  console.log("\n[TEST 8] Pharyngitis + Odynophagia with Centor Criteria & Trismus Screen");
  const soreThroatClassified = presentationClassifier.classify("Severe sore throat and painful to swallow", "", []);
  assert(
    soreThroatClassified.active.some(a => a.id === "PHARYNGITIS_ODYNOPHAGIA"),
    "PHARYNGITIS_ODYNOPHAGIA activated"
  );

  const pharyngitisState = conversationManager.createInitialState();
  pharyngitisState.slots.onset = "two days";
  pharyngitisState.slots.onset_pattern = "gradual";
  pharyngitisState.slots.severity = "8/10";
  pharyngitisState.slots.known_facts = [
    "Duration: approx. two days",
    "ONSET: two days",
    "THROAT_PAIN: present",
    "ODYNOPHAGIA: painful swallowing",
    "SEVERITY: 8/10",
    "Denied: fever"
  ];
  pharyngitisState.conversationMemory!.deniedSymptoms = ["fever", "swallowing_difficulty"];
  pharyngitisState.presentationContext = soreThroatClassified;

  const pharyngitisEvaluated = evaluatePresentationDimensions(
    "PHARYNGITIS_ODYNOPHAGIA",
    pharyngitisState.slots,
    pharyngitisState.slots.known_facts,
    pharyngitisState.conversationMemory!.deniedSymptoms
  );
  const trismusDim = pharyngitisEvaluated.find(d => d.dimension.id === "trismus");
  assert(trismusDim?.status === "unresolved", "trismus airway screen unresolved");

  // Verify response planner selects unresolved clinical dimension (course, cough, or voice_change)
  const throatPlan = responsePlanner.plan(
    "No trouble swallowing fluids.",
    { rawUtterance: "No trouble", intent: "symptom_report", isConfirmationOrRepetition: false, isEmergencyInquiry: false, newEvidence: [], ambiguities: [], confidence: 0.9 } as any,
    pharyngitisState,
    pre
  );
  assert(
    throatPlan.nextHighValueInquiry?.topic === "course" || throatPlan.nextHighValueInquiry?.topic === "cough" || throatPlan.nextHighValueInquiry?.topic === "voice_change",
    `Planner selects Centor / deep neck screen dimension: ${throatPlan.nextHighValueInquiry?.topic}`
  );

  // ==============================================================================
  // TEST 9: Headache Presentation (Thunderclap vs Photophobia / Phonophobia)
  // ==============================================================================
  console.log("\n[TEST 9] Headache Presentation (Thunderclap vs Migraine Features)");
  const headacheClassified = presentationClassifier.classify("Severe throbbing headache on right side", "", []);
  assert(
    headacheClassified.active.some(a => a.id === "HEADACHE"),
    "HEADACHE presentation activated"
  );

  const headacheState = conversationManager.createInitialState();
  headacheState.slots.onset = "this morning";
  headacheState.slots.onset_pattern = "gradual";
  headacheState.slots.severity = "9/10";
  headacheState.slots.character = "throbbing";
  headacheState.slots.location = "right side";
  headacheState.slots.known_facts = [
    "ONSET: this morning",
    "ONSET_TYPE: gradual",
    "SEVERITY: 9/10",
    "CHARACTER: throbbing",
    "LOCATION: right side",
    "Denied: thunderclap_onset"
  ];
  headacheState.presentationContext = headacheClassified;

  const headacheEvaluated = evaluatePresentationDimensions(
    "HEADACHE",
    headacheState.slots,
    headacheState.slots.known_facts,
    ["thunderclap_onset"]
  );
  const photoDim = headacheEvaluated.find(d => d.dimension.id === "photophobia");
  assert(photoDim?.status === "unresolved", "photophobia dimension unresolved initially");

  // Verify patient reporting light sensitivity satisfies dimension
  headacheState.slots.known_facts.push("Associated: photophobia (light sensitivity)");
  const headacheEvaluated2 = evaluatePresentationDimensions(
    "HEADACHE",
    headacheState.slots,
    headacheState.slots.known_facts,
    ["thunderclap_onset"]
  );
  const photoDimPost = headacheEvaluated2.find(d => d.dimension.id === "photophobia");
  assert(photoDimPost?.status === "answered", "photophobia resolved after reporting light sensitivity");

  // ==============================================================================
  // BENCHMARK SUMMARY
  // ==============================================================================
  console.log("\n==============================================================================");
  console.log(`PHASE 2 EVALUATION SUMMARY: ${passed}/${passed + failed} tests passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

