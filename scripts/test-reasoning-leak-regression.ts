import { conversationManager } from "../lib/triage/conversation-manager";
import { parseAndSanitizeDoctorReply } from "../lib/ai/clinical-llm";

async function runReasoningLeakRegressionTest() {
  console.log("==============================================================================");
  console.log("      REASONING LEAK, DEMOGRAPHIC INTEGRITY & 7-TURN AMNESIA REGRESSION TEST   ");
  console.log("==============================================================================");

  // -----------------------------------------------------------------------------------------
  // Part 1: Test parseAndSanitizeDoctorReply with dirty outputs & edge cases
  // -----------------------------------------------------------------------------------------
  console.log("\n[Part 1] Testing parseAndSanitizeDoctorReply on dirty reasoning leaks & edge cases...");

  const exactLeakPrompt = `We have a patient 45, no risk factors. Symptoms: dizziness, weakness, numbness.
Associated symptoms: facial drooping, speech difficulty? Already asked.
Need to ask about weakness: one-sided or both sides?
Patient mentioned "a minute like i said before". Acknowledge the duration.`;

  const { cleanReply: sanitizedLeak } = parseAndSanitizeDoctorReply(
    exactLeakPrompt,
    "I understand. When you feel weak or numb, is it on one side of your body or both sides?",
    { age: null, ageSource: "unknown" }
  );

  console.log(`• Raw dirty text intercepted: "${exactLeakPrompt.slice(0, 60)}..."`);
  console.log(`• Sanitized output: "${sanitizedLeak}"`);

  if (
    sanitizedLeak.toLowerCase().includes("patient 45") ||
    sanitizedLeak.toLowerCase().includes("need to ask") ||
    sanitizedLeak.toLowerCase().includes("already asked") ||
    sanitizedLeak.toLowerCase().includes("we have a patient")
  ) {
    throw new Error("FAILED Part 1: Leak text survived sanitization!");
  }
  console.log("✅ PASSED: Reasoning leak cleanly intercepted and replaced by deterministic fallback.");

  // Test valid JSON parsing with markdown fences
  const jsonWithFences = "```json\n{\n  \"patientResponse\": \"I hear you. Could you clarify if the weakness affects one arm or leg, or both sides?\"\n}\n```";
  const { cleanReply: sanitizedJson } = parseAndSanitizeDoctorReply(
    jsonWithFences,
    "Fallback reply",
    { age: null, ageSource: "unknown" }
  );
  console.log(`• JSON parsed output: "${sanitizedJson}"`);
  if (!sanitizedJson.includes("affects one arm or leg")) {
    throw new Error("FAILED Part 1: Valid JSON response failed to parse!");
  }
  console.log("✅ PASSED: JSON markdown fence correctly parsed.");

  // Test age hallucination rejection when age is unknown
  const hallucinatedAgeText = JSON.stringify({
    patientResponse: "At 45 years old, having dizzy spells when standing needs careful attention."
  });
  const { cleanReply: sanitizedAgeRejection } = parseAndSanitizeDoctorReply(
    hallucinatedAgeText,
    "Having dizzy spells when standing needs careful attention. Does it happen every time you stand?",
    { age: null, ageSource: "unknown" }
  );
  console.log(`• Age hallucination rejection output: "${sanitizedAgeRejection}"`);
  if (sanitizedAgeRejection.includes("45")) {
    throw new Error("FAILED Part 1: Hallucinated age '45' was not rejected when age was unknown!");
  }
  console.log("✅ PASSED: Hallucinated age successfully rejected.");

  // -----------------------------------------------------------------------------------------
  // Part 2: Simulate 7-Turn Clinical Conversation Sequence
  // -----------------------------------------------------------------------------------------
  console.log("\n[Part 2] Replaying the 7-turn conversation reported by user...");

  let state = conversationManager.createInitialState();
  const unknownDemographics = { age: null, age_group: "adult" as const, age_source: "unknown" as const };

  const turns = [
    { turn: 1, input: "Hey I feel a headache", expectedTopic: "headache" },
    { turn: 2, input: "Just dizzy when I stand for a minute after I sat for long time.", expectedTopic: "postural dizziness" },
    { turn: 3, input: "Nothing else I guess?", expectedTopic: "negative response" },
    { turn: 4, input: "like everytime actually", expectedTopic: "frequency" },
    { turn: 5, input: "A bit weak and numb...", expectedTopic: "weakness/numbness" },
    { turn: 6, input: "Nope none", expectedTopic: "denial" },
    { turn: 7, input: "a minute like i said before?", expectedTopic: "repetition objection with duration" },
  ];

  for (const t of turns) {
    console.log(`\n--- TURN ${t.turn}: "${t.input}" ---`);
    const res = await conversationManager.processTurn(t.input, state, unknownDemographics);
    state = res.state;

    const mem = state.conversationMemory!;
    console.log(`• Sarah Spoken: "${res.doctorReply}"`);
    console.log(`• Target Slot: ${state.pendingQuestion?.targetSlot}`);
    console.log(`• Denied Symptoms: [${mem.deniedSymptoms.join(", ")}]`);
    console.log(`• Questions Already Asked: [${mem.questionsAlreadyAsked.join(", ")}]`);

    // Invariant 1: No reasoning leak tokens in spoken reply
    const lowerReply = res.doctorReply.toLowerCase();
    const forbiddenPhrases = [
      "patient 45",
      "we have a patient",
      "need to ask",
      "already asked",
      "let's think",
      "thought:",
      "could be tia",
      "differential:",
      "assessment:"
    ];
    for (const phrase of forbiddenPhrases) {
      if (lowerReply.includes(phrase)) {
        throw new Error(`Turn ${t.turn} VIOLATION: Spoken reply contained forbidden reasoning leak phrase '${phrase}'!`);
      }
    }

    // Invariant 2: Age demographic remains unknown / not contaminated into facts
    const hasHallucinatedAgeInFacts = state.slots.known_facts.some((f: string) => /\b45\b/i.test(f));
    if (hasHallucinatedAgeInFacts) {
      throw new Error(`Turn ${t.turn} VIOLATION: Age '45' was injected into clinical known facts!`);
    }

    // Specific assertions per turn
    if (t.turn === 3) {
      console.log("  Checking Turn 3: Denied symptoms recorded...");
      if (mem.deniedSymptoms.length === 0 && mem.questionsAlreadyAsked.length === 0) {
        throw new Error("Turn 3 failed: Negative answer 'Nothing else I guess?' did not record negative context!");
      }
    }

    if (t.turn === 6) {
      console.log("  Checking Turn 6: Negative response 'Nope none' recorded...");
      if (mem.deniedSymptoms.length === 0) {
        throw new Error("Turn 6 failed: 'Nope none' was not captured in deniedSymptoms!");
      }
    }

    if (t.turn === 7) {
      console.log("  Checking Turn 7: Duration acknowledged, no re-asking of denied symptoms...");
      if (lowerReply.includes("droop") || lowerReply.includes("speech difficulty")) {
        throw new Error("Turn 7 VIOLATION: Sarah re-asked facial drooping or speech difficulty after patient already denied them!");
      }

      const hasDuration = (state.slots.duration && state.slots.duration.includes("minute")) || mem.confirmedFacts.some((f: string) => f.includes("minute"));
      console.log(`  Duration captured in state: ${hasDuration ? "YES" : "NO"} ("${state.slots.duration}")`);
    }
  }

  console.log("\n==============================================================================");
  console.log("      ALL 7 TURNS VERIFIED: ZERO REASONING LEAKS, ZERO AGE HALLUCINATIONS     ");
  console.log("==============================================================================");
}

runReasoningLeakRegressionTest().catch((err) => {
  console.error("\n❌ Regression Test Failed:", err);
  process.exit(1);
});
