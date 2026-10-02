import dotenv from "dotenv";
dotenv.config();

import { conversationManager } from "../lib/triage/conversation-manager";
import { generateDoctorTurnResponse } from "../lib/ai/clinical-llm";
import { nvidiaClient } from "../lib/ai/nvidia-client";
import { getDoctorById } from "../config/doctors";
import { detectQuestionTargetSlot, isTargetSlotMatch } from "../lib/triage/clinical-state";

interface DiagnosticRecord {
  testId: string;
  patientUtterance: string;
  targetSlot: string;
  mustAvoid: string[];
  deliveredReply: string;
  detectedTarget: string;
  status: "ACCEPTED" | "REJECTED (FALLBACK)";
  rejectionReason: string;
  latencyMs: number;
}

async function runLiveNvidiaDiagnostic() {
  console.log("===============================================================================");
  console.log("   LIVE NVIDIA NIM CLINICAL TARGET DRIFT DIAGNOSTIC");
  console.log("   Measuring Real Provider Compliance Against Deterministic Targets");
  console.log("===============================================================================\n");

  if (!nvidiaClient.isConfigured()) {
    console.log("⚠️  [DIAGNOSTIC SKIPPED] NVIDIA_API_KEY is not configured in environment.");
    console.log("   To run live diagnostics, supply NVIDIA_API_KEY in .env or environment.");
    process.exit(0);
  }

  console.log(`Provider: NVIDIA NIM | BaseURL: ${nvidiaClient.getBaseUrl()} | Model: ${nvidiaClient.getDefaultModel()}\n`);

  const doctor = getDoctorById("dr-sarah-chen")!;
  const testScenarios = [
    {
      id: "SCENARIO_1_SORE_THROAT_ONSET_PATTERN",
      message: "I've had a sore throat for two days.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_2_ODYNOPHAGIA_SWALLOWING",
      message: "It hurts when I swallow saliva.",
      setupState: async () => {
        let s = conversationManager.createInitialState();
        const t1 = await conversationManager.processTurn("I've had a sore throat for two days.", s);
        return t1.state;
      },
    },
    {
      id: "SCENARIO_3_FEVER_DENIAL_COURSE",
      message: "No fever at all.",
      setupState: async () => {
        let s = conversationManager.createInitialState();
        const t1 = await conversationManager.processTurn("I've had a sore throat for two days.", s);
        const t2 = await conversationManager.processTurn("It hurts when I swallow saliva.", t1.state);
        return t2.state;
      },
    },
    {
      id: "SCENARIO_4_SEVERITY_RATING_CHARACTER",
      message: "Maybe 8 out of 10.",
      setupState: async () => {
        let s = conversationManager.createInitialState();
        const t1 = await conversationManager.processTurn("I've had a sore throat for two days.", s);
        const t2 = await conversationManager.processTurn("It hurts when I swallow saliva.", t1.state);
        const t3 = await conversationManager.processTurn("No fever.", t2.state);
        return t3.state;
      },
    },
    {
      id: "SCENARIO_5_CHEST_DISCOMFORT_CHARACTER",
      message: "I've been noticing discomfort in my chest since this morning.",
      setupState: () => conversationManager.createInitialState(),
    },
    {
      id: "SCENARIO_6_CHEST_ONSET_PATTERN",
      message: "It feels like a tight heavy pressure.",
      setupState: async () => {
        let s = conversationManager.createInitialState();
        const t1 = await conversationManager.processTurn("I've had chest pressure for about twenty minutes.", s);
        return t1.state;
      },
    },
    {
      id: "SCENARIO_7_NEURO_WEAKNESS_DISTRIBUTION",
      message: "My arm feels weak and numb.",
      setupState: () => conversationManager.createInitialState(),
    },
  ];

  const records: DiagnosticRecord[] = [];

  for (const scenario of testScenarios) {
    console.log(`Running: ${scenario.id}...`);
    const state = await scenario.setupState();
    const turnResult = await conversationManager.processTurn(scenario.message, state);
    const targetSlot = turnResult.state.pendingQuestion?.targetSlot || turnResult.state.responsePlan?.nextHighValueInquiry?.topic || "general_inquiry";
    const mustAvoid = turnResult.state.responsePlan?.mustAvoidAsking || [];

    const llmRes = await generateDoctorTurnResponse({
      patientUtterance: scenario.message,
      conversationHistory: [],
      interviewState: turnResult.state,
      preArbiterResult: turnResult.preArbiterResult,
      demographics: { age: null, age_group: "adult" },
      doctor,
      fallbackReply: turnResult.doctorReply,
    });

    const isAccepted = llmRes.provider === "nvidia";
    const detectedTarget = detectQuestionTargetSlot(llmRes.reply);

    records.push({
      testId: scenario.id,
      patientUtterance: scenario.message,
      targetSlot,
      mustAvoid,
      deliveredReply: llmRes.reply,
      detectedTarget,
      status: isAccepted ? "ACCEPTED" : "REJECTED (FALLBACK)",
      rejectionReason: llmRes.rejectionReason || (isAccepted ? "None (Valid)" : "Target Mismatch / Invariant"),
      latencyMs: llmRes.latencyMs,
    });
  }

  console.log("\n===============================================================================");
  console.log("   DIAGNOSTIC SUMMARY REPORT");
  console.log("===============================================================================\n");

  let acceptedCount = 0;
  for (const r of records) {
    if (r.status === "ACCEPTED") acceptedCount++;
    console.log(`[${r.testId}]`);
    console.log(`  Target Slot:     ${r.targetSlot}`);
    console.log(`  Must Avoid:      [${r.mustAvoid.slice(0, 4).join(", ")}${r.mustAvoid.length > 4 ? "..." : ""}]`);
    console.log(`  Doctor Reply:    "${r.deliveredReply}"`);
    console.log(`  Detected Target: ${r.detectedTarget}`);
    console.log(`  Status:          ${r.status} ${r.rejectionReason ? `(${r.rejectionReason})` : ""}`);
    console.log(`  Latency:         ${r.latencyMs}ms\n`);
  }

  const acceptanceRate = ((acceptedCount / records.length) * 100).toFixed(1);
  console.log("-------------------------------------------------------------------------------");
  console.log(`Total Prompts:   ${records.length}`);
  console.log(`Accepted by LLM: ${acceptedCount} / ${records.length} (${acceptanceRate}%)`);
  console.log(`Fallback Used:   ${records.length - acceptedCount} / ${records.length} (${(100 - parseFloat(acceptanceRate)).toFixed(1)}%)`);
  console.log("-------------------------------------------------------------------------------\n");
}

runLiveNvidiaDiagnostic().catch(err => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
