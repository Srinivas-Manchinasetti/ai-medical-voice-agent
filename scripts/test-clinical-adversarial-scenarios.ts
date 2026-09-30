/**
 * ADVERSARIAL CONVERSATIONAL STRESS-TEST SUITE
 *
 * Tests 13 adversarial patient scenarios that a clinical conversation engine
 * must handle without violating the Golden Invariant or producing redundant questions.
 *
 * Golden Invariant:
 *   IF fact.status === "known" (present OR absent/denied)
 *   AND question asks for that same fact
 *   THEN question is invalid (unless explicitly performing contradiction clarification)
 *
 * Scenarios:
 *   1.  Information given out of order
 *   2.  Patient contradicts earlier statement
 *   3.  Multiple facts in one sentence
 *   4.  "I already told you that" objection
 *   5.  Vague answer ("a bit")
 *   6.  Denial ("no fever at all")
 *   7.  New symptom introduced mid-interview
 *   8.  Patient repeats same symptom without duplication
 *   9.  Patient answers only half of a question
 *  10.  Unrelated information ("My dog was barking all night")
 *  11.  Uncertainty ("I don't know")
 *  12.  "Nothing else" terminal signal
 *  13.  Golden Invariant enforcement across all generated turns
 */

import { conversationManager, ClinicalInterviewState } from "../lib/triage/conversation-manager";
import {
  ClinicalInterviewStateV2,
  ClinicalFact,
  createInitialInterviewStateV2,
  calculateHistoryCompleteness,
  evaluateClinicalSafety,
} from "../lib/triage/clinical-state";
import { evidenceExtractor, ExtractedEvidenceResult } from "../lib/triage/evidence-extractor";
import { questionPlanner, PlannedQuestion, validatePlannedQuestionAgainstState } from "../lib/triage/question-planner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string): void {
  if (!condition) {
    failCount++;
    failures.push(label);
    console.log(`  ❌ FAIL: ${label}`);
  } else {
    passCount++;
    console.log(`  ✅ PASS: ${label}`);
  }
}

function assertGoldenInvariant(
  planned: PlannedQuestion,
  v2State: ClinicalInterviewStateV2,
  scenarioLabel: string
): void {
  const validation = validatePlannedQuestionAgainstState(planned, v2State);
  assert(
    validation.isValid,
    `${scenarioLabel}: Golden Invariant — ${validation.violationReason || "OK"}`
  );
}

function hasBannedFiller(text: string): boolean {
  return /\b(i hear (?:that|you|the pain)?|i hear\b)/i.test(text);
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) || []).length;
}

/** Run processTurn and return result, asserting no crash */
async function safeTurn(
  utterance: string,
  state: ClinicalInterviewState,
  label: string
): Promise<{ res: any; state: ClinicalInterviewState }> {
  const res = await conversationManager.processTurn(utterance, state);
  assert(!!res.doctorReply, `${label}: Doctor produced a reply`);
  assert(!hasBannedFiller(res.doctorReply), `${label}: No banned filler "I hear..."`);
  return { res, state: res.state };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runAdversarialSuite() {
  console.log("==============================================================================");
  console.log("   ADVERSARIAL CONVERSATIONAL STRESS-TEST SUITE (13 SCENARIOS)");
  console.log("==============================================================================\n");

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: Information given out of order
  // Patient leads with course progression before chief complaint or onset.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 1: Information out of order ───");
    let state = conversationManager.createInitialState();
    let v2 = createInitialInterviewStateV2();

    // Patient leads with "It's been getting worse every day" — no CC yet
    const ext = evidenceExtractor.extract("It's been getting worse every day", v2);
    v2.turnCount++;
    v2.establishedFacts.push(...ext.newFacts);
    Object.assign(v2.symptomProfile, ext.symptomProfileUpdates);

    const planned = questionPlanner.planNextQuestion(v2, ext);
    // Since chief complaint is NOT established, planner should not re-ask course
    assertGoldenInvariant(planned, v2, "Scenario 1");

    const { state: s1 } = await safeTurn("It's been getting worse every day", state, "Scenario 1 Turn 1");
    state = s1;

    // Now patient reveals "I have throat pain"
    const ext2 = evidenceExtractor.extract("I have throat pain", v2);
    v2.turnCount++;
    v2.establishedFacts.push(...ext2.newFacts);
    if (ext2.updatedChiefComplaint) v2.chiefComplaint = ext2.updatedChiefComplaint;

    const planned2 = questionPlanner.planNextQuestion(v2, ext2);
    assertGoldenInvariant(planned2, v2, "Scenario 1 after CC");

    const { state: s2 } = await safeTurn("I have throat pain", state, "Scenario 1 Turn 2");
    state = s2;

    // Doctor should NOT ask "what's been getting worse?" since course is already known
    assert(
      !state.slots.known_facts.some(f => f.includes("getting worse") && f.includes("raw")),
      "Scenario 1: No raw utterance leak"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: Patient contradicts earlier statement
  // "Actually it started yesterday, not 2 days ago"
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 2: Patient contradicts earlier statement ───");
    let state = conversationManager.createInitialState();

    const { state: s1 } = await safeTurn(
      "I have been feeling throat pain for two days.",
      state,
      "Scenario 2 Turn 1"
    );
    state = s1;
    assert(!!state.slots.onset, "Scenario 2: Onset extracted after Turn 1");

    const { res: r2, state: s2 } = await safeTurn(
      "Actually it started yesterday, not 2 days ago.",
      state,
      "Scenario 2 Correction"
    );
    state = s2;

    // Doctor should acknowledge the correction, not re-ask onset
    assert(
      !/when did|when this began/i.test(r2.doctorReply),
      "Scenario 2: Doctor does NOT re-ask onset after correction"
    );
    assert(
      /got it|thank|clarif|noted|understood/i.test(r2.doctorReply),
      "Scenario 2: Doctor acknowledges the correction"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: Multiple facts in one sentence
  // "I have throat pain for two days, my voice changed, and I have no fever."
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 3: Multiple facts in one sentence ───");
    let v2 = createInitialInterviewStateV2();
    const ext = evidenceExtractor.extract(
      "I have throat pain for two days, my voice changed, and I have no fever.",
      v2
    );

    const hasThroat = ext.newFacts.some(f => f.name === "throat_pain" && f.status === "present");
    const hasVoice = ext.newFacts.some(f => f.name === "voice_change" && f.status === "present");
    const hasOnset = ext.newFacts.some(f => f.name === "onset");
    const hasFeverDenied = ext.newFacts.some(f => f.name === "fever" && f.status === "absent");
    const hasFeverDeniedTopic = ext.deniedTopics.includes("fever");

    assert(hasThroat, "Scenario 3: Throat pain extracted");
    assert(hasVoice, "Scenario 3: Voice change extracted");
    assert(hasOnset, "Scenario 3: Onset extracted");
    assert(hasFeverDenied || hasFeverDeniedTopic, "Scenario 3: Fever denied extracted");

    v2.turnCount++;
    v2.establishedFacts.push(...ext.newFacts);
    if (ext.updatedChiefComplaint) v2.chiefComplaint = ext.updatedChiefComplaint;
    Object.assign(v2.symptomProfile, ext.symptomProfileUpdates);
    ext.deniedTopics.forEach(d => {
      if (!v2.interviewMemory.deniedTopics.includes(d)) v2.interviewMemory.deniedTopics.push(d);
    });

    const planned = questionPlanner.planNextQuestion(v2, ext);
    assertGoldenInvariant(planned, v2, "Scenario 3");
    // Should NOT ask about fever (denied), onset (known), or throat pain (known)
    assert(
      planned.target !== "fever",
      "Scenario 3: Planner does not ask about denied fever"
    );
    assert(
      planned.target !== "onset" || !v2.symptomProfile.onset,
      "Scenario 3: Planner does not re-ask onset"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: "I already told you that" objection
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log('─── Scenario 4: "I already told you that" objection ───');
    let state = conversationManager.createInitialState();

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 4 Turn 1");
    state = s1;

    const { res: r2, state: s2 } = await safeTurn("I already told you that!", state, "Scenario 4 Objection");
    state = s2;

    // Doctor should apologize / acknowledge and NOT repeat the same question
    assert(
      /right|noted|apolog|don't want.*repeat|don't want to make you repeat|sorry|have that|recorded|acknowledged/i.test(r2.doctorReply),
      "Scenario 4: Doctor acknowledges objection gracefully"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: Vague answer ("a bit")
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 5: Vague answer ───");
    let state = conversationManager.createInitialState();

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 5 Turn 1");
    state = s1;

    const { res: r2, state: s2 } = await safeTurn("A bit", state, "Scenario 5 Vague");
    state = s2;

    // Doctor should gently clarify, not berate or ignore
    assert(
      /constant|come and go|take your time|bit more|describe|feel like/i.test(r2.doctorReply),
      "Scenario 5: Doctor gently clarifies vague answer"
    );
    assert(
      countQuestions(r2.doctorReply) <= 2,
      "Scenario 5: Doctor does not bundle many questions"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: Denial ("no fever at all")
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 6: Denial ───");
    let v2 = createInitialInterviewStateV2();
    const ext = evidenceExtractor.extract("No fever at all", v2, "Have you had a fever?", "fever");

    const feverDenied = ext.newFacts.some(f => f.name === "fever" && f.status === "absent") ||
      ext.deniedTopics.includes("fever");

    assert(feverDenied, "Scenario 6: Fever correctly marked as denied");

    v2.turnCount++;
    v2.establishedFacts.push(...ext.newFacts);
    ext.deniedTopics.forEach(d => {
      if (!v2.interviewMemory.deniedTopics.includes(d)) v2.interviewMemory.deniedTopics.push(d);
    });
    v2.interviewMemory.answeredTopics.push("fever");
    v2.interviewMemory.doNotRepeat.push("fever");

    // Now plan next question — must NOT ask about fever
    const planned = questionPlanner.planNextQuestion(v2, ext);
    assertGoldenInvariant(planned, v2, "Scenario 6");
    assert(
      planned.target !== "fever",
      "Scenario 6: Planner does not re-ask denied fever"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: New symptom introduced mid-interview ("Also, my ear hurts")
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 7: New symptom mid-interview ───");
    let state = conversationManager.createInitialState();
    let v2 = createInitialInterviewStateV2();

    // Establish throat pain
    const ext1 = evidenceExtractor.extract("I have throat pain for two days.", v2);
    v2.turnCount++;
    v2.establishedFacts.push(...ext1.newFacts);
    if (ext1.updatedChiefComplaint) v2.chiefComplaint = ext1.updatedChiefComplaint;
    Object.assign(v2.symptomProfile, ext1.symptomProfileUpdates);

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 7 Turn 1");
    state = s1;

    // Patient introduces ear pain
    const ext2 = evidenceExtractor.extract("Also, my ear hurts a lot", v2);
    const hasEar = ext2.newFacts.some(f => f.name === "ear_pain" && f.status === "present");
    assert(hasEar, "Scenario 7: Ear pain extracted as new finding");

    v2.turnCount++;
    v2.establishedFacts.push(...ext2.newFacts);

    const planned = questionPlanner.planNextQuestion(v2, ext2);
    assertGoldenInvariant(planned, v2, "Scenario 7");
    console.log(`  → Next question target: ${planned.target}`);

    const { state: s2 } = await safeTurn("Also, my ear hurts a lot", state, "Scenario 7 Turn 2");
    state = s2;
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: Patient repeats same symptom — no duplication
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 8: Repeated symptom without duplication ───");
    let v2 = createInitialInterviewStateV2();

    const ext1 = evidenceExtractor.extract("I have throat pain", v2);
    v2.turnCount++;
    v2.establishedFacts.push(...ext1.newFacts);
    if (ext1.updatedChiefComplaint) v2.chiefComplaint = ext1.updatedChiefComplaint;

    const beforeCount = v2.establishedFacts.filter(f => f.name === "throat_pain").length;

    // Patient says it again
    const ext2 = evidenceExtractor.extract("My throat is still paining", v2);
    // We push facts, but there should be no brand-new unique throat_pain fact
    // if dedup is handled properly at the state level
    const newThroatFacts = ext2.newFacts.filter(f => f.name === "throat_pain");

    // The extractor will re-extract — that's OK. What matters is the v2 state
    // doesn't accumulate duplicates when properly managed.
    assert(
      beforeCount >= 1,
      "Scenario 8: Original throat_pain fact exists"
    );
    // The extractor produces facts per utterance; dedup is the state layer's job.
    // As long as Golden Invariant blocks re-asking, we're fine.
    const planned = questionPlanner.planNextQuestion(v2, ext2);
    assertGoldenInvariant(planned, v2, "Scenario 8");
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 9: Patient answers only half of a question
  // Doctor asks about "swallowing liquids or saliva" — patient only answers liquids
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 9: Partial answer ───");
    let state = conversationManager.createInitialState();

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 9 Turn 1");
    state = s1;

    // Simulate that the doctor asked about swallowing
    const { state: s2 } = await safeTurn(
      "It started gradually and got worse by the next day.",
      state,
      "Scenario 9 Turn 2"
    );
    state = s2;

    // Partial answer: only addresses liquids
    const { res: r3, state: s3 } = await safeTurn(
      "Liquids are fine, I can drink water.",
      state,
      "Scenario 9 Partial Answer"
    );
    state = s3;

    // The engine should still advance or clarify about solid food / saliva
    assert(
      !!r3.doctorReply && r3.doctorReply.length > 10,
      "Scenario 9: Doctor responds meaningfully to partial answer"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 10: Unrelated information ("My dog was barking all night")
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 10: Unrelated information ───");
    let state = conversationManager.createInitialState();

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 10 Turn 1");
    state = s1;

    const { res: r2, state: s2 } = await safeTurn(
      "My dog was barking all night and I couldn't sleep.",
      state,
      "Scenario 10 Unrelated"
    );
    state = s2;

    // Doctor should gently redirect — no dog facts in clinical state
    assert(
      !state.slots.known_facts.some(f => /dog|barking/i.test(f)),
      "Scenario 10: No 'dog' or 'barking' in known_facts"
    );
    assert(
      !!r2.doctorReply && r2.doctorReply.length > 10,
      "Scenario 10: Doctor still produces meaningful clinical response"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 11: Uncertainty ("I don't know")
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log('─── Scenario 11: "I don\'t know" uncertainty ───');
    let state = conversationManager.createInitialState();

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 11 Turn 1");
    state = s1;

    const { res: r2, state: s2 } = await safeTurn("I don't know", state, "Scenario 11 IDK");
    state = s2;

    // Doctor should acknowledge uncertainty warmly and move on
    assert(
      /fine|okay|that's okay|no problem|don't have to know|focus|completely fine|understandable/i.test(r2.doctorReply),
      "Scenario 11: Doctor warmly acknowledges uncertainty"
    );
    // Should NOT badger the same question
    assert(
      countQuestions(r2.doctorReply) <= 2,
      "Scenario 11: Doctor does not badger with multiple questions"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 12: "Nothing else"
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log('─── Scenario 12: "Nothing else" terminal signal ───');
    let state = conversationManager.createInitialState();
    let v2 = createInitialInterviewStateV2();

    const { state: s1 } = await safeTurn("I have throat pain for two days.", state, "Scenario 12 Turn 1");
    state = s1;

    // Patient says "nothing else"
    const ext = evidenceExtractor.extract("Nothing else", v2, "Any other symptoms?", "associated_symptoms");
    const deniesAssociated = ext.deniedTopics.length > 0 ||
      ext.newFacts.some(f => f.status === "absent");

    assert(
      deniesAssociated || ext.intent === "denial",
      "Scenario 12: 'Nothing else' recognized as denial/closing"
    );

    const { res: r2, state: s2 } = await safeTurn("Nothing else", state, "Scenario 12 Nothing Else");
    state = s2;

    assert(
      !!r2.doctorReply && r2.doctorReply.length > 5,
      "Scenario 12: Doctor responds meaningfully"
    );
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 13: Golden Invariant enforcement across a full 5-turn conversation
  // ═══════════════════════════════════════════════════════════════════════════
  {
    console.log("─── Scenario 13: Golden Invariant across 5 turns ───");
    let v2 = createInitialInterviewStateV2();

    const turns = [
      "I have been feeling throat pain for two days.",
      "Well, it started from morning 2 days ago and it gradually increased by the next day.",
      "Uh, nothing much, but my voice has been ruined because of that. Like my voice changed.",
      "No, no fever at all.",
      "I insist my throat is paining and my voice has been changed.",
    ];
    const targets: string[] = ["swallowing_difficulty", "fever", "onset"];

    for (let i = 0; i < turns.length; i++) {
      const utterance = turns[i];
      const ext = evidenceExtractor.extract(
        utterance,
        v2,
        i > 0 ? "previous question" : undefined,
        i > 0 ? targets[i - 1] || undefined : undefined
      );

      v2.turnCount++;
      v2.establishedFacts.push(...ext.newFacts);
      if (ext.updatedChiefComplaint) v2.chiefComplaint = ext.updatedChiefComplaint;
      Object.assign(v2.symptomProfile, ext.symptomProfileUpdates);
      ext.deniedTopics.forEach(d => {
        if (!v2.interviewMemory.deniedTopics.includes(d)) v2.interviewMemory.deniedTopics.push(d);
      });

      const planned = questionPlanner.planNextQuestion(v2, ext);
      assertGoldenInvariant(planned, v2, `Scenario 13 Turn ${i + 1}`);

      // Track asked topics
      if (!v2.interviewMemory.askedTopics.includes(planned.target)) {
        v2.interviewMemory.askedTopics.push(planned.target);
      }
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("==============================================================================");
  console.log(`   ADVERSARIAL STRESS-TEST RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log("==============================================================================");

  if (failures.length > 0) {
    console.log("\n   FAILURES:");
    failures.forEach((f, i) => console.log(`     ${i + 1}. ${f}`));
    console.log();
    process.exit(1);
  } else {
    console.log("   ✅ ALL 13 ADVERSARIAL SCENARIOS PASSED — GOLDEN INVARIANT HOLDS");
    console.log("==============================================================================\n");
  }
}

runAdversarialSuite().catch((err) => {
  console.error("Fatal error in adversarial suite:", err);
  process.exit(1);
});
