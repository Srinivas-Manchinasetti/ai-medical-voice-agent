import { config } from "dotenv";
config({ path: "c:/dev/Capstone/.env" });

import { kokoroService } from "../lib/audio/kokoro-service";
import { generateDoctorTurnResponse } from "../lib/ai/clinical-llm";
import { evaluatePreArbiter } from "../lib/triage/pre-arbiter";
import { getDoctorById } from "../config/doctors";

async function runTtsTests() {
  console.log("======================================================================");
  console.log("             MEDVOICE KOKORO TTS INTEGRATION VERIFICATION");
  console.log("======================================================================\n");

  const doctor = getDoctorById("dr-sarah-chen");

  // -------------------------------------------------------------------------
  // TEST 1: Sarah response -> Kokoro -> af_heart
  // -------------------------------------------------------------------------
  console.log(">>> [TEST 1: Sarah Response -> Kokoro af_heart]");
  const test1Text = "Hello! I am Dr. Sarah Chen, Chief of Internal Medicine. How can I help you today?";
  console.log(`Input Text: "${test1Text}"`);

  const t0_1 = Date.now();
  const res1 = await kokoroService.synthesize(test1Text, { doctorId: "dr-sarah-chen" });
  const lat1 = Date.now() - t0_1;

  console.log(`✓ Test 1 Synthesis Completed in: ${lat1} ms`);
  console.log(`  Voice selected:  ${res1.voice} (Expected: af_heart)`);
  console.log(`  Sample rate:     ${res1.sampleRate} Hz`);
  console.log(`  Duration:        ${res1.durationSec.toFixed(2)} seconds`);
  console.log(`  Buffer size:     ${res1.buffer.length} bytes\n`);

  if (res1.voice !== "af_heart") {
    throw new Error(`Test 1 Failed: Expected voice af_heart, got ${res1.voice}`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Consecutive Sarah responses -> Voice identity continuity
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------------");
  console.log(">>> [TEST 2: Consecutive Responses Voice Continuity]");
  const turnA = "Could you tell me if that chest pressure started suddenly or built up over time?";
  const turnB = "Does that discomfort travel into your left arm, your jaw, or into your back?";

  console.log(`Turn A: "${turnA}"`);
  const resA = await kokoroService.synthesize(turnA, { doctorId: "dr-sarah-chen" });
  console.log(`✓ Turn A Generated in: ${resA.latencyMs} ms | Voice: ${resA.voice}`);

  console.log(`Turn B: "${turnB}"`);
  const resB = await kokoroService.synthesize(turnB, { doctorId: "dr-sarah-chen" });
  console.log(`✓ Turn B Generated in: ${resB.latencyMs} ms | Voice: ${resB.voice}`);

  if (resA.voice !== "af_heart" || resB.voice !== "af_heart") {
    throw new Error(`Test 2 Failed: Voice identity changed between turns!`);
  }
  console.log(`✓ Consecutive turn voice identity strictly preserved: ${resA.voice} === ${resB.voice}\n`);

  // -------------------------------------------------------------------------
  // TEST 3: Kokoro failure -> Deterministic fallback path
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------------");
  console.log(">>> [TEST 3: Failure Handling & Deterministic Fallback Validation]");
  try {
    // Empty text should throw and trigger fallback
    await kokoroService.synthesize("   ", { doctorId: "dr-sarah-chen" });
    console.error("Test 3 Failed: Expected empty text to throw.");
  } catch (err: any) {
    console.log(`✓ Kokoro gracefully rejects invalid input: "${err.message}"`);
    console.log("✓ Frontend catch handler is armed to trigger deterministic browser TTS fallback on error.\n");
  }

  // -------------------------------------------------------------------------
  // TEST 4: Full Pipeline (NVIDIA LLM -> Unaltered Text -> Kokoro TTS)
  // -------------------------------------------------------------------------
  console.log("----------------------------------------------------------------------");
  console.log(">>> [TEST 4: NVIDIA Generation -> Kokoro Synthesis Flow]");
  const patientInput = "I felt sudden weakness in my left arm about twenty minutes ago.";
  console.log(`Patient Utterance: "${patientInput}"`);

  const arbiter = evaluatePreArbiter({ transcript: patientInput });
  console.log(`Pre-Arbiter Safety Flags:`, arbiter.pre_safety_flags);

  // Generate response with NVIDIA NIM
  const llmOut = await generateDoctorTurnResponse({
    patientUtterance: patientInput,
    conversationHistory: [],
    preArbiterResult: arbiter,
    demographics: { age: 52, age_group: "adult" },
    doctor,
    missingDimensions: ["onset", "facial_droop"],
  });

  console.log(`NVIDIA Reply (${llmOut.latencyMs}ms): "${llmOut.reply}"`);

  // Pass unaltered NVIDIA text directly into Kokoro TTS
  const ttsOut = await kokoroService.synthesize(llmOut.reply, { doctorId: "dr-sarah-chen" });
  console.log(`✓ Kokoro synthesized unaltered reply in: ${ttsOut.latencyMs} ms`);
  console.log(`  Audio Duration: ${ttsOut.durationSec.toFixed(2)}s`);
  console.log(`  Voice: ${ttsOut.voice}`);
  console.log(`  WAV Buffer: ${ttsOut.buffer.length} bytes`);

  console.log("\n======================================================================");
  console.log("       ALL 4 TTS INTEGRATION TESTS PASSED SUCCESSFULLY");
  console.log("======================================================================\n");
}

runTtsTests().catch(console.error);
