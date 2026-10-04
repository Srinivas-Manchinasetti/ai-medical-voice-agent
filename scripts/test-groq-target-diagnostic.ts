import dotenv from "dotenv";
dotenv.config();

import { conversationManager } from "../lib/triage/conversation-manager";
import { generateDoctorTurnResponse } from "../lib/ai/clinical-llm";
import { groqClient } from "../lib/ai/groq-client";
import { getDoctorById } from "../config/doctors";
import { detectQuestionTargetSlot } from "../lib/triage/clinical-state";

interface DiagnosticRecord {
  scenarioId: string;
  patientUtterance: string;
  deterministicTarget: string;
  mustAvoidAsking: string[];
  groqGeneratedQuestion: string;
  detectedTarget: string;
  acceptedOrRejected: "ACCEPTED" | "REJECTED";
  fallbackUsed: boolean;
  rejectionReason: string;
  latencyMs: number;
}

export async function runLiveGroqDiagnostic() {
  console.log("===============================================================================");
  console.log("   LIVE GROQ CLOUD CLINICAL TARGET & RELEVANCE DIAGNOSTIC");
  console.log("   Measuring OpenAI-Compatible gpt-oss-120b Compliance Against Deterministic Targets");
  console.log("===============================================================================\n");

  if (!groqClient.isConfigured()) {
    console.log("⚠️  [DIAGNOSTIC SKIPPED] GROQ_API_KEY is not configured in environment.");
    console.log("   To run live diagnostics, supply GROQ_API_KEY in .env or environment.");
    process.exit(0);
  }

  console.log(`Provider: Groq Cloud | BaseURL: ${groqClient.getBaseUrl()} | Model: ${groqClient.getDefaultModel()}\n`);

  const doctor = getDoctorById("dr-sarah-chen")!;
  const testScenarios = [
    {
      id: "SCENARIO_1_FATIGUE_TWO_DAYS",
      message: "I have been feeling tired for two days.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_2_HEADACHE",
      message: "I've had a bad headache since this morning.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_3_SORE_THROAT",
      message: "I've had a sore throat for two days.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_4_CHEST_PAIN",
      message: "I've been feeling tight pressure in my chest for twenty minutes.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_5_DIFFICULTY_SWALLOWING",
      message: "It hurts when I swallow saliva.",
      setupState: async () => {
        let s = conversationManager.createInitialState();
        const t1 = await conversationManager.processTurn("I've had a sore throat for two days.", s);
        return t1.state;
      },
    },
    {
      id: "SCENARIO_6_FEVER",
      message: "I've had a fever of 102 degrees since last night.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_7_MIXED_SYMPTOMS",
      message: "I've had a cough and fever for three days, but no chest pain or shortness of breath.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_8_OBSERVED_FAILURE_REPRODUCTION_FATIGUE_TURN_3",
      message: "Well, it was a bit sharp, but at times it was also dull. So it was a combination of both. But sometimes it's sharp, but usually it's just dull.",
      setupState: async () => {
        let s = conversationManager.createInitialState();
        const t1 = await conversationManager.processTurn("I have been feeling tired from two days.", s);
        const t2 = await conversationManager.processTurn(
          "It came out in a span of 2 days actually. So it was like in the beginning it was just my real pain but gradually it built up for a day and suddenly the next day I woke up it was too bad.",
          t1.state
        );
        return t2.state;
      },
    },
  ];

  const records: DiagnosticRecord[] = [];

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`Evaluating [${scenario.id}]...`);
    const state = await scenario.setupState();
    const turnResult = await conversationManager.processTurn(scenario.message, state);
    const targetSlot = turnResult.state.pendingQuestion?.targetSlot || turnResult.state.responsePlan?.nextHighValueInquiry?.topic || "general_inquiry";
    const mustAvoid = turnResult.state.responsePlan?.mustAvoidAsking || [];

    let llmRes = await generateDoctorTurnResponse({
      patientUtterance: scenario.message,
      conversationHistory: [],
      interviewState: turnResult.state,
      preArbiterResult: turnResult.preArbiterResult,
      demographics: { age: null, age_group: "adult" },
      doctor,
      fallbackReply: turnResult.doctorReply,
    });

    // If rate-limited in test diagnostic, wait 6 seconds and retry once
    if (llmRes.provider === "fallback" && !llmRes.rejectionReason) {
      console.log("   (Rate limit encountered, pausing 8s for TPM window...)");
      await new Promise(r => setTimeout(r, 8000));
      llmRes = await generateDoctorTurnResponse({
        patientUtterance: scenario.message,
        conversationHistory: [],
        interviewState: turnResult.state,
        preArbiterResult: turnResult.preArbiterResult,
        demographics: { age: null, age_group: "adult" },
        doctor,
        fallbackReply: turnResult.doctorReply,
      });
    }

    const isAccepted = llmRes.provider === "groq";
    const detectedTarget = detectQuestionTargetSlot(llmRes.reply);

    records.push({
      scenarioId: scenario.id,
      patientUtterance: scenario.message,
      deterministicTarget: targetSlot,
      mustAvoidAsking: mustAvoid,
      groqGeneratedQuestion: llmRes.reply,
      detectedTarget,
      acceptedOrRejected: isAccepted ? "ACCEPTED" : "REJECTED",
      fallbackUsed: !isAccepted,
      rejectionReason: llmRes.rejectionReason || (isAccepted ? "None (Compliant)" : "Target Mismatch / Clinical Guard"),
      latencyMs: llmRes.latencyMs,
    });

    // Brief 3s pause between scenarios in test diagnostic to avoid TPM burst
    if (i < testScenarios.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log("\n===============================================================================");
  console.log("   LIVE GROQ TARGET & RELEVANCE DIAGNOSTIC REPORT");
  console.log("===============================================================================\n");

  let acceptedCount = 0;
  for (const r of records) {
    if (r.acceptedOrRejected === "ACCEPTED") acceptedCount++;
    console.log(`[${r.scenarioId}]`);
    console.log(`  Patient:              "${r.patientUtterance.slice(0, 80)}${r.patientUtterance.length > 80 ? "..." : ""}"`);
    console.log(`  Deterministic Target: ${r.deterministicTarget}`);
    console.log(`  Must Avoid Asking:    [${r.mustAvoidAsking.slice(0, 4).join(", ")}${r.mustAvoidAsking.length > 4 ? "..." : ""}]`);
    console.log(`  Doctor Question:      "${r.groqGeneratedQuestion}"`);
    console.log(`  Detected Target:      ${r.detectedTarget}`);
    console.log(`  Decision:             ${r.acceptedOrRejected} (Fallback Used: ${r.fallbackUsed})`);
    if (r.rejectionReason && r.rejectionReason !== "None (Compliant)") {
      console.log(`  Rejection Reason:     ${r.rejectionReason}`);
    }
    console.log(`  Latency:              ${r.latencyMs}ms\n`);
  }

  const acceptanceRate = ((acceptedCount / records.length) * 100).toFixed(1);
  console.log("-------------------------------------------------------------------------------");
  console.log(`Total Scenarios: ${records.length}`);
  console.log(`Accepted by Groq: ${acceptedCount} / ${records.length} (${acceptanceRate}%)`);
  console.log(`Fallback Used:    ${records.length - acceptedCount} / ${records.length} (${(100 - parseFloat(acceptanceRate)).toFixed(1)}%)`);
  console.log("-------------------------------------------------------------------------------\n");

  // Specific Verification: Scenario 8 (Fatigue Presentation Turn 3)
  const s8 = records.find(r => r.scenarioId === "SCENARIO_8_OBSERVED_FAILURE_REPRODUCTION_FATIGUE_TURN_3");
  if (s8) {
    const mentionsChest = /\b(chest|arm|jaw|neck|back)\b/i.test(s8.groqGeneratedQuestion);
    if (mentionsChest) {
      console.error("❌ FAILURE: Fatigue presentation doctor question mentioned chest or radiation!");
      process.exit(1);
    } else {
      console.log("✅ INVARIANT VERIFIED: Fatigue Turn 3 doctor question contains NO chest or radiation queries.");
      console.log(`   Question Delivered: "${s8.groqGeneratedQuestion}"`);
    }
  }

  return records;
}

if (require.main === module || process.argv[1]?.includes("test-groq-target-diagnostic")) {
  runLiveGroqDiagnostic().catch(err => {
    console.error("Diagnostic execution error:", err);
    process.exit(1);
  });
}
