import { conversationManager } from "../lib/triage/conversation-manager";
import { extractSubfieldState, parseOnsetDimensions, validateDoctorReplyTarget } from "../lib/triage/clinical-state";
import { POST as voiceChatHandler } from "../app/api/voice/chat/route";
import { NextRequest } from "next/server";
import { groqClient } from "../lib/ai/groq-client";
import { nvidiaClient } from "../lib/ai/nvidia-client";

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

async function runScreenshotReproductionTests() {
  console.log("\n===============================================================================");
  console.log("   MEDVOICE AI REPETITION REPRODUCTION & SAFETY VALIDATION HARNESS");
  console.log("   Validating Root-Cause Fixes, Negation, Indic Transliteration & Safety Channel");
  console.log("===============================================================================\n");

  groqClient.setMockCompleter(null);
  nvidiaClient.setMockCompleter(null);
  const originalGroqKey = process.env.GROQ_API_KEY;
  const originalNvidiaKey = process.env.NVIDIA_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.NVIDIA_API_KEY;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Screenshot 1 Replay — Post-Decision 'ok' & Red Flag Pre-Scan
    // -------------------------------------------------------------------------
    console.log("--- [TEST 1] Screenshot 1 Replay: Sufficiency, Deliberation & 'ok' ---");
    const decidedState = conversationManager.createInitialState();
    decidedState.phase = "decided";
    decidedState.informationState = "sufficient_for_decision";
    decidedState.caseVersion = 5;
    decidedState.slots.onset = "two days";
    decidedState.slots.onset_pattern = "gradual";
    decidedState.slots.duration = "two days";
    decidedState.slots.associated_symptoms = ["odynophagia"];
    decidedState.slots.known_facts = [
      "ONSET: two days",
      "ONSET_TYPE: gradual",
      "THROAT_PAIN: present",
      "SEVERITY: 7/10",
      "ODYNOPHAGIA: painful swallowing",
      "Denied: fever",
      "Denied: swallowing_difficulty"
    ];

    // 1A. Normal 'ok' after routine decision
    const res1A = await simulateApiCall("ok", [], decidedState);
    console.log("1A Doctor Reply to 'ok':", res1A.doctorReply);
    assert(
      !res1A.doctorReply.includes("give me just a moment while I consult with our clinical specialists"),
      "1A: Doctor does NOT repeat consultation placeholder on 'ok'"
    );
    assert(
      res1A.doctorReply.includes("welcome") || res1A.doctorReply.includes("Take care"),
      "1A: Doctor delivers warm post-consultation closing guidance"
    );

    // 1B. P0 Safety Scan: 'ok but my chest hurts now' MUST trigger emergency preemption
    console.log("\n--- [TEST 1B] P0 Red-Flag Pre-Scan: 'ok but my chest hurts now' ---");
    const res1B = await simulateApiCall("ok but my chest hurts now", [], decidedState);
    console.log("1B Doctor Reply to 'ok but my chest hurts now':", res1B.doctorReply);
    assert(
      res1B.phase !== "closing",
      "1B: Utterance containing 'ok' with chest pain is NOT swallowed by closing handler"
    );
    assert(
      res1B.doctorReply.toLowerCase().includes("chest") ||
      res1B.doctorReply.toLowerCase().includes("emergency") ||
      res1B.doctorReply.toLowerCase().includes("108") ||
      res1B.doctorReply.toLowerCase().includes("hospital"),
      "1B: Red-flag pre-scan catches acute chest discomfort immediately"
    );

    // 1C. Acuity-Aware Closing: 'ok' after Emergency Decision
    console.log("\n--- [TEST 1C] Acuity-Aware Closing: 'ok' after Emergency Decision ---");
    const emergencyDecidedState = {
      ...decidedState,
      informationState: "emergency_preempted",
      slots: {
        ...decidedState.slots,
        known_facts: [...decidedState.slots.known_facts, "EMERGENCY: ESI LEVEL 2 CRITICAL ISCHEMIA"]
      }
    };
    const res1C = await simulateApiCall("ok", [], emergencyDecidedState);
    console.log("1C Doctor Reply to 'ok' after Emergency:", res1C.doctorReply);
    assert(
      res1C.doctorReply.includes("emergency") && (res1C.doctorReply.includes("108") || res1C.doctorReply.includes("department")),
      "1C: Doctor restates urgent emergency directive on 'ok' after emergency decision (never mild 'rest at home')"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Screenshot 2 Replay — Gradual Onset Answering & Negation
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2] Screenshot 2 Replay: Gradual Onset & Negation ---");
    let interviewState = conversationManager.createInitialState();
    const history: any[] = [];

    // T1: Patient states sore throat
    const t1Data = await simulateApiCall("I've had a sore throat for two days.", history, interviewState);
    interviewState = t1Data.interviewState;
    history.push({ role: "patient", text: "I've had a sore throat for two days." });
    history.push({ role: "doctor", text: t1Data.doctorReply });

    // Doctor asks: "Did it come on suddenly, or did it gradually get worse?"
    console.log("T1 Doctor Reply (Asking Onset):", t1Data.doctorReply);

    // T2: Patient replies: "it started to build up gradually" (Exact Screenshot 2 phrase)
    const t2Msg = "it started to build up gradually";
    const t2Data = await simulateApiCall(t2Msg, history, interviewState);
    interviewState = t2Data.interviewState;
    console.log("T2 Doctor Reply to 'it started to build up gradually':", t2Data.doctorReply);
    console.log("T2 Known Facts:", interviewState.slots.known_facts);

    const subfieldsT2 = extractSubfieldState(interviewState.slots, interviewState.slots.known_facts, interviewState.conversationMemory);
    assert(subfieldsT2.onset.onsetPattern === "gradual", "T2: Onset pattern resolved as 'gradual'");
    assert(subfieldsT2.onset.isResolved, "T2: Onset subfield is completely resolved");
    assert(
      !t2Data.doctorReply.toLowerCase().includes("started suddenly") &&
      !t2Data.doctorReply.toLowerCase().includes("come on suddenly"),
      "T2: Doctor does NOT repeat compound onset question after 'it started to build up gradually'"
    );

    // -------------------------------------------------------------------------
    // TEST 2B: Exact headache / compound-answer failure shown in the consultation
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 2B] Headache Compound-Answer Regression ---");
    let headacheState = conversationManager.createInitialState();
    const headacheHistory: any[] = [];
    const headacheT1 = await simulateApiCall("I've had a headache.", headacheHistory, headacheState);
    headacheState = headacheT1.interviewState;
    assert(
      (headacheT1.doctorReply.toLowerCase().includes("all at once") || headacheT1.doctorReply.toLowerCase().includes("when did you first notice")) &&
      !headacheT1.doctorReply.toLowerCase().includes("light") &&
      !headacheT1.doctorReply.toLowerCase().includes("sound") &&
      !/when.+(?:sudden|gradual)|(?:sudden|gradual).+when/i.test(headacheT1.doctorReply),
      "T2B: Headache opener asks only one atomic onset dimension"
    );

    headacheHistory.push({ role: "patient", text: "I've had a headache." });
    headacheHistory.push({ role: "doctor", text: headacheT1.doctorReply });
    const screenshotAnswer = "So it built up gradually and I'm very sensitive to bright lights or loud sounds. Maybe a sudden flash could be something that could cause a headache.";
    const headacheT2 = await simulateApiCall(screenshotAnswer, headacheHistory, headacheState);
    headacheState = headacheT2.interviewState;
    const headacheSubfields = extractSubfieldState(headacheState.slots, headacheState.slots.known_facts, headacheState.conversationMemory);
    console.log("T2B Headache Reply:", headacheT2.doctorReply);
    console.log("T2B Next Target:", headacheState.pendingQuestion?.targetSlot, headacheState.responsePlan?.nextHighValueInquiry?.topic);
    console.log("T2B Headache Facts:", headacheState.slots.known_facts);
    assert(headacheSubfields.onset.onsetPattern === "gradual", "T2B: 'sudden flash' does not overwrite gradual headache onset");
    assert(!headacheState.slots.known_facts.some((f: string) => /ONSET_TYPE:\s*sudden/i.test(f)), "T2B: No false sudden-onset fact is stored");
    assert(headacheState.slots.associated_symptoms.includes("photophobia"), "T2B: Light sensitivity resolves to photophobia");
    assert(headacheState.slots.associated_symptoms.includes("phonophobia"), "T2B: Sound sensitivity resolves to phonophobia");
    assert(
      !/sudden|gradual|bright\s+light|loud\s+sound/i.test(headacheT2.doctorReply),
      "T2B: Next question does not repeat resolved onset or light/sound sensitivity"
    );

    const compoundValidation = validateDoctorReplyTarget(
      "Did it start suddenly or gradually, and are you sensitive to bright lights or sound?",
      { nextHighValueInquiry: { topic: "onset_pattern", clinicalRationale: "test", suggestedPhrasing: "test" } }
    );
    assert(!compoundValidation.isValid && Boolean(compoundValidation.reason?.includes("LLM_MULTIPLE_CLINICAL_TARGETS")), "T2B: Validator rejects a compound onset + associated-symptom question");

    // -------------------------------------------------------------------------
    // TEST 3: Negation of Suddenness ("It wasn't sudden" & "didn't come on suddenly")
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 3] Negation Handling for Suddenness ---");
    const neg1 = parseOnsetDimensions("it wasn't sudden");
    assert(neg1.onsetPattern === "gradual", "Negation: 'it wasn't sudden' resolves to gradual (NOT sudden)");
    assert(neg1.acuteWorsening === false, "Negation: 'it wasn't sudden' has acuteWorsening: false");

    const neg2 = parseOnsetDimensions("didn't come on suddenly, it was slow");
    assert(neg2.onsetPattern === "gradual", "Negation: 'didn't come on suddenly' resolves to gradual");

    const neg3 = parseOnsetDimensions("it is not sudden");
    assert(neg3.onsetPattern === "gradual", "Negation: 'it is not sudden' resolves to gradual");

    const aff1 = parseOnsetDimensions("it came on all of a sudden out of nowhere");
    assert(aff1.onsetPattern === "sudden", "Affirmative: 'sudden out of nowhere' resolves to sudden");
    assert(aff1.acuteWorsening === true, "Affirmative: acuteWorsening is true");

    // -------------------------------------------------------------------------
    // TEST 4: Timeline vs Pattern Separation ("yesterday" answers when, not sudden/gradual)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 4] Timeline vs Pattern Separation ---");
    const timeOnly = parseOnsetDimensions("yesterday");
    assert(timeOnly.onsetTime === "yesterday", "Timeline: 'yesterday' captured as onsetTime");
    assert(timeOnly.onsetPattern === undefined, "Timeline: 'yesterday' does NOT resolve onsetPattern (remains undefined)");

    const compound = parseOnsetDimensions("started yesterday, built up gradually");
    assert(compound.onsetTime === "yesterday", "Compound: onsetTime is 'yesterday'");
    assert(compound.onsetPattern === "gradual", "Compound: onsetPattern is 'gradual'");

    // -------------------------------------------------------------------------
    // TEST 5: Indic Multilingual & Transliteration (Hinglish & Telugu)
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 5] Indic Multilingual & Transliteration ---");
    // Hinglish
    const hiGradual = parseOnsetDimensions("dheere dheere start hua");
    assert(hiGradual.onsetPattern === "gradual", "Hinglish: 'dheere dheere start hua' resolves to gradual");

    const hiSudden = parseOnsetDimensions("achanak se dard shuru hua");
    assert(hiSudden.onsetPattern === "sudden", "Hinglish: 'achanak se' resolves to sudden");

    const hiTime = parseOnsetDimensions("kal se dard ho raha hai");
    assert(hiTime.onsetTime === "kal se", "Hinglish: 'kal se' captured as onset timeline");

    // Telugu transliterated
    const teGradual = parseOnsetDimensions("mellaga start aindi konchem konchem");
    assert(teGradual.onsetPattern === "gradual", "Telugu: 'mellaga start aindi' resolves to gradual");

    const teSudden = parseOnsetDimensions("ventane vachindi chala sudden ga");
    assert(teSudden.onsetPattern === "sudden", "Telugu: 'ventane vachindi' resolves to sudden");

    const teTime = parseOnsetDimensions("ninna nunchi badha ga undi");
    assert(teTime.onsetTime === "ninna nunchi", "Telugu: 'ninna nunchi' captured as onset timeline");

    // -------------------------------------------------------------------------
    // TEST 6: Generic Slot Repetition Guard & Rephrasing
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 6] Generic Slot Repetition Guard ---");
    let guardState = conversationManager.createInitialState();
    guardState.slots.known_facts.push("THROAT_PAIN: present", "ONSET: 2 days", "ONSET_TYPE: gradual", "ODYNOPHAGIA: painful swallowing", "COURSE: gradually worsening");
    guardState.slots.associated_symptoms.push("throat pain", "painful swallowing");
    
    // Turn 1: Slot asked once
    guardState.conversationMemory = {
      confirmedFacts: ["throat pain", "onset: 2 days"],
      deniedSymptoms: [],
      questionsAlreadyAsked: [],
      patientCorrections: [],
      patientObjections: [],
      patientConcerns: [],
      accessConstraints: [],
      uncertainties: [],
      slotAskCount: { swallowing_difficulty: 1 } // Already asked once unfilled
    };

    // Call response planner when swallowing_difficulty was asked once
    const planRephrase = await simulateApiCall("I am just uncomfortable.", [], guardState);
    console.log("Rephrased Question (AskCount=1):", planRephrase.doctorReply);
    assert(
      planRephrase.doctorReply.includes("Just to make sure I have this completely right") ||
      planRephrase.doctorReply.includes("normally"),
      "Slot Guard: Question is rephrased on 2nd attempt with calibrated phrasing"
    );

    // When slot is asked twice unfilled, guard marks it exhausted and advances
    guardState.conversationMemory.slotAskCount = { swallowing_difficulty: 2 };
    const planExhausted = await simulateApiCall("Still just feeling general discomfort.", [], guardState);
    console.log("Advanced Question (AskCount=2):", planExhausted.doctorReply);
    assert(
      !planExhausted.doctorReply.toLowerCase().includes("swallow"),
      "Slot Guard: After 2 unfilled asks, system marks slot exhausted and advances to next dimension (does NOT loop)"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Dedicated Safety Channel Precedence
    // -------------------------------------------------------------------------
    console.log("\n--- [TEST 7] Dedicated Safety Channel Precedence ---");
    const emergencyState = conversationManager.createInitialState();
    const emergencyRes = await simulateApiCall("I have crushing chest pressure radiating down my left arm and cold sweat.", [], emergencyState);
    console.log("Emergency Safety Channel Reply:", emergencyRes.doctorReply);
    assert(
      emergencyRes.doctorReply.toLowerCase().includes("108") ||
      emergencyRes.doctorReply.toLowerCase().includes("emergency") ||
      emergencyRes.doctorReply.toLowerCase().includes("ambulance") ||
      emergencyRes.doctorReply.toLowerCase().includes("hospital"),
      "Safety Channel: Emergency dispatch instruction is strictly delivered on life threats"
    );

    console.log("\n===============================================================================");
    console.log("   🎉 ALL REPETITION REPRODUCTION & SAFETY VALIDATION TESTS PASSED (100%)!");
    console.log("===============================================================================\n");
  } finally {
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
    if (originalNvidiaKey) process.env.NVIDIA_API_KEY = originalNvidiaKey;
  }
}

runScreenshotReproductionTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
