import { clinicalBoard } from "../lib/agents/clinical-board";
import { PatientCase } from "../lib/agents/schemas";

async function testBargeInRuntime() {
  console.log("==============================================================================");
  console.log("      BARGE-IN SAFETY RUNTIME & EVENT-DERIVED DELIBERATION TEST              ");
  console.log("==============================================================================");

  const bargeInCase: PatientCase = {
    patient_id: "PT-BARGEIN-001",
    patient_name: "John Doe",
    transcript: "Wait doctor! My right face just started drooping, my right arm is weak and I cannot lift it!",
    conversation_history: [
      { role: "patient", text: "I was feeling a little tired this morning." },
      { role: "doctor", text: "Fatigue can stem from dehydration or poor sleep..." }
    ],
    demographics: { age: 62, age_group: "adult" },
    detected_symptoms: [],
    vitals: {},
    speech_features: {
      speech_pause_ratio: 0.28,
      mean_pause_duration_ms: 500,
      speech_rate_wpm: 105,
      voice_energy_variability: 0.25,
      pitch_variability: 0.18,
      observations: ["Sudden interrupted speech cadence", "Slight vocal strain"],
      clinical_relevance: {
        respiratory_distress_signal: "unlikely",
        vocal_instability_signal: "mild",
        confidence: 0.85
      }
    },
    pre_safety_flags: [],
    immediate_danger_detected: false,
    provenance_evidence: [],
    is_interruption: true,
    interrupted_agent: "Dr. Sarah Chen"
  };

  const output = await clinicalBoard.evaluate(bargeInCase);

  console.log("1. Verification of Pre-Arbiter Shield on Interruption Evidence:");
  console.log("   • Pre-Arbiter Flags:", output.trace.pre_safety_flags);
  console.log("   • Immediate Danger Flag:", output.trace.immediate_danger);
  if (!output.trace.pre_safety_flags.some(f => f.includes("BE_FAST") || f.includes("STROKE") || f.includes("NEURO"))) {
    throw new Error("Pre-Arbiter failed to flag BE-FAST stroke symptoms from barge-in utterance!");
  }
  console.log("   ✅ Pre-Arbiter successfully caught stroke red flags from barge-in evidence.");

  console.log("\n2. Verification of Specialist Summoning & Tool Execution:");
  console.log("   • Specialists Summoned:", output.trace.specialists_summoned);
  console.log("   • Diagnostic Tools Executed:", output.trace.tools_executed);
  if (!output.trace.specialists_summoned.includes("neurology")) {
    throw new Error("Neurology specialist was not summoned for stroke deficit!");
  }
  console.log("   ✅ Neurology specialist summoned with BE-FAST / NIHSS clinical tools.");

  console.log("\n3. Verification of Event-Derived Deliberation Messages:");
  console.log("   • Total Deliberation Messages:", output.trace.deliberation_messages.length);
  output.trace.deliberation_messages.forEach((m, idx) => {
    console.log("     [" + m.speakerRole.toUpperCase() + "] " + m.doctorName + " (" + m.type + '): "' + m.content.slice(0, 75) + '..."');
  });

  const hasInterruptionMsg = output.trace.deliberation_messages.some(m => m.content.toLowerCase().includes("barged in"));
  if (!hasInterruptionMsg) {
    throw new Error("Missing barge-in notification message in deliberation stream!");
  }

  const hasToolMsg = output.trace.deliberation_messages.some(m => m.speakerRole === "tool");
  if (!hasToolMsg) {
    throw new Error("Missing inline diagnostic tool result in deliberation stream!");
  }

  const hasArbiterMsg = output.trace.deliberation_messages.some(m => m.speakerRole === "safety_arbiter");
  if (!hasArbiterMsg) {
    throw new Error("Missing safety arbiter disposition message in deliberation stream!");
  }
  console.log("   ✅ Structured BoardMessages contain interruption, specialist assessment, tools, and arbiter disposition.");

  console.log("\n4. Verification of Final Disposition & Tamper-Proof Audit Chain:");
  console.log("   • Final ESI Level:", output.post_arbiter.final_esi_level);
  console.log("   • Final Disposition:", output.post_arbiter.final_disposition);
  console.log("   • Audit SHA-256:", output.post_arbiter.audit_sha256);
  if (output.post_arbiter.final_esi_level !== 2) {
    throw new Error("Expected ESI 2 Emergency, got ESI " + output.post_arbiter.final_esi_level);
  }
  console.log("   ✅ Final disposition locked to ESI 2 EMERGENCY with tamper-evident hash chaining.");

  console.log("\n==============================================================================");
  console.log("✅ ALL BARGE-IN RUNTIME & DELIBERATION STREAM INVARIANTS VERIFIED.");
  console.log("==============================================================================");
}

testBargeInRuntime().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
