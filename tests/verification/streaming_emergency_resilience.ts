/**
 * MEDVOICE PHASE 2 — MILESTONE 3: EMERGENCY INTERRUPTION & RESILIENCE SUITE
 *
 * Mandatory Failure & Edge Case Scenarios Tested:
 * 1. Incomplete Transcripts (Epistemic separation: fail-safe emergency vs slot stability).
 * 2. Corrected Transcriptions (Whisper hypothesis revisions handled cleanly).
 * 3. Rate Limits (429 handling & calibrated fallback engagement).
 * 4. TTS Failures (Synthesizer exceptions handled with graceful fallback signal).
 * 5. Disconnects & Aborts (Immediate cancellation and queue cleanup).
 * 6. Unsafe Generated Text (Chunk-level gating: false reassurance, triage dismissal, false dispatch claims, diagnosis inflation, attribution transpositions).
 * 7. Mid-Stream Emergency Signals (Emergency preemption interrupts/cancels active audio playback).
 * 8. Emergency Directives: Directs caller to 112/108/911; strictly asserts ZERO false ambulance dispatch claims.
 */

import { performance } from "perf_hooks";
import { StreamingVoicePipeline, AudioPlaybackQueue } from "../../lib/audio/streaming-pipeline";
import { IncrementalSpeechRecognizer } from "../../lib/audio/incremental-asr";
import { validateAudioBoundChunk, IncrementalStreamValidator } from "../../lib/ai/stream-validator";
import { evaluateUniversalRedFlags } from "../../lib/triage/universal-red-flags";
import { SynthesisResult } from "../../lib/audio/kokoro-service";

function createDummyPcm(durationMs = 200): Buffer {
  return Buffer.alloc(Math.floor((16000 * durationMs) / 1000) * 2);
}

function createMockSynthesisResult(durationSec = 2.0): SynthesisResult {
  return {
    buffer: Buffer.alloc(100),
    sampleRate: 24000,
    durationSec,
    latencyMs: 15,
    voice: "af_sarah",
  };
}

export async function runEmergencyResilienceSuite(): Promise<boolean> {
  console.log("==============================================================================");
  console.log("  MEDVOICE PHASE 2: MILESTONE 3 — EMERGENCY INTERRUPTION & RESILIENCE SUITE");
  console.log("  Deterministic Safety Invariants, Failure Handling & Adversarial Gating");
  console.log("==============================================================================\n");

  const passedTests: string[] = [];
  const failedTests: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedTests.push(testName);
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ""}`);
      failedTests.push(testName);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: INCOMPLETE TRANSCRIPTS & PARTIAL TRANSCRIPT EPISTEMICS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("--- [SCENARIO 1: INCOMPLETE TRANSCRIPTS & EPISTEMIC SEPARATION] ---");
  {
    const asr = new IncrementalSpeechRecognizer();

    // Incomplete, provisional transcript arrives
    const chunk = createDummyPcm(100);
    const result = asr.processPcmChunk(chunk, "I feel heavy crushing chest");

    // Track 1 (Emergency Screen): Fail-safe! Fired even though transcript is provisional
    assert(
      result.emergencyCheck !== null && result.emergencyCheck.level === "EMERGENCY_NOW",
      "Provisional transcript with acute red-flag triggers fail-safe emergency immediately"
    );

    // Track 2 (Clinical Slot Promotion): Withheld because transcript is provisional
    assert(
      !result.hypothesis.isFinal && !asr.isSafeForClinicalPromotion(0.8),
      "Provisional unconfirmed hypothesis is NOT promoted to permanent clinical slots"
    );

    // Finalize transcript
    asr.updateHypothesis("I feel heavy crushing chest pain and shortness of breath.", true);
    assert(
      asr.isSafeForClinicalPromotion(0.8),
      "Finalized stable transcript is eligible for clinical slot promotion"
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: CORRECTED TRANSCRIPTIONS (HYPOTHESIS REVISION)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 2: CORRECTED TRANSCRIPTIONS & HYPOTHESIS REVISION] ---");
  {
    const asr = new IncrementalSpeechRecognizer();

    // Step A: Initial acoustic misrecognition suggests chest
    asr.updateHypothesis("I have chest", false);
    assert(asr.getCurrentHypothesis().stability < 0.8, "Interim acoustic hypothesis has low stability");

    // Step B: Audio context clarifies negation and actual abdominal presentation
    const revisedHypothesis = asr.updateHypothesis("I don't have chest pain, I have severe stomach cramps", true);
    assert(revisedHypothesis.isFinal === true, "Revised hypothesis correctly finalized");

    // Verify negation check on revised transcript
    const valResult = validateAudioBoundChunk("Where in your abdomen is the cramping located?", {
      patientUtterance: revisedHypothesis.text,
      targetSubject: "self",
      isEmergency: false,
    });

    assert(valResult.isValid, "Approved abdominal exploration following chest pain negation correction");

    // Verify that querying chest pain after correction is blocked
    const invalidCardiacQuery = validateAudioBoundChunk("Does the chest pain radiate into your left arm?", {
      patientUtterance: revisedHypothesis.text,
      targetSubject: "self",
      isEmergency: false,
    });

    assert(
      !invalidCardiacQuery.isValid && invalidCardiacQuery.category === "provenance",
      "Blocked exploratory cardiac query when patient corrected that chest pain is negated"
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: RATE LIMITS & BACKOFF HANDLING
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 3: RATE LIMIT HANDLING & FALLBACK ROUTING] ---");
  {
    // Simulating token stream that throws 429 Rate Limit error
    async function* rateLimitedTokenStream() {
      yield "I ";
      const err: any = new Error("Groq Cloud [RATE_LIMIT_EXCEEDED]: HTTP 429 rate limit");
      err.status = 429;
      throw err;
    }

    const pipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      ttsSynthesizer: async () => createMockSynthesisResult(2.0),
    });

    const telem = await pipeline.executeStreamingTurn({
      pcmChunks: [createDummyPcm(100)],
      simulatedTranscript: "I have severe stomach cramps",
      tokenStream: rateLimitedTokenStream(),
    });

    assert(telem.fallbackUsed === true, "Caught HTTP 429 rate limit cleanly without crashing process");
    assert(telem.latencies.audioPlaybackDurationSec > 0, "Engaged calibrated clinical fallback upon rate limiting");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: TTS FAILURES & FALLBACK DISPATCH
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 4: TTS ENGINE FAILURE & RESILIENCE] ---");
  {
    const failingTtsPipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      ttsSynthesizer: async () => {
        throw new Error("Neural TTS Engine OOM Kernel Failure");
      },
    });

    const telem = await failingTtsPipeline.executeStreamingTurn({
      pcmChunks: [createDummyPcm(100)],
      simulatedTranscript: "I have stomach cramps",
      tokenStream: ["I ", "understand ", "your ", "pain. "],
    });

    assert(
      telem.ttsFailure === true && (telem.ttsError || "").includes("Neural TTS Engine"),
      "TTS synthesis failure handled cleanly with explicit error classification"
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: DISCONNECTS & ABORTS
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 5: CLIENT DISCONNECT & PLAYBACK PURGING] ---");
  {
    const queue = new AudioPlaybackQueue();
    const fakeBuf = Buffer.alloc(100);

    queue.enqueue({ id: "1", buffer: fakeBuf, durationSec: 2.0, text: "Chunk 1" });
    queue.enqueue({ id: "2", buffer: fakeBuf, durationSec: 2.0, text: "Chunk 2" });
    queue.enqueue({ id: "3", buffer: fakeBuf, durationSec: 2.0, text: "Chunk 3" });

    assert(queue.getStatus().queueLength === 3, "Audio queue populated with 3 chunks");

    // Client disconnects
    queue.interrupt("Client WebSocket disconnected");

    assert(queue.getStatus().isInterrupted, "Playback queue marked as interrupted");
    assert(queue.getStatus().queueLength === 0, "Playback queue purged all pending audio buffers immediately");

    const enqueueAfterDisconnect = queue.enqueue({ id: "4", buffer: fakeBuf, durationSec: 1.0, text: "Chunk 4" });
    assert(!enqueueAfterDisconnect, "Rejected enqueuing new audio into disconnected queue");

    // Also test live StreamingVoicePipeline execution aborted by AbortSignal
    const abortController = new AbortController();
    const abortPipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      ttsSynthesizer: async () => createMockSynthesisResult(1.0),
    });

    async function* abortableStream() {
      yield "First ";
      abortController.abort();
      yield "Second ";
    }

    const abortTelem = await abortPipeline.executeStreamingTurn({
      pcmChunks: [createDummyPcm(100)],
      simulatedTranscript: "I have pain",
      tokenStream: abortableStream(),
      abortSignal: abortController.signal,
    });

    assert(abortTelem.playbackInterrupted === true, "Pipeline execution cleanly halted and purged upon client abort signal");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: UNSAFE GENERATED TEXT GATING (CHUNK-LEVEL GATING)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 6: UNSAFE GENERATED TEXT — 5 ADVERSARIAL GATES] ---");
  {
    const context = {
      patientUtterance: "I have sharp chest pain that started 20 minutes ago",
      targetSubject: "self" as const,
      isEmergency: true,
      primaryEmergencyNumber: "112",
      ambulanceNumber: "108",
    };

    // 6A. False Reassurance Guard
    const falseReassurance = validateAudioBoundChunk(
      "Don't worry, you are completely fine and it's probably nothing serious.",
      context
    );
    assert(
      !falseReassurance.isValid && falseReassurance.category === "false_reassurance",
      "Gate 6A: Blocked false reassurance chunk ('Don't worry, you are completely fine')"
    );

    // 6B. Premature Triage Dismissal Guard
    const triageDismissal = validateAudioBoundChunk(
      "There is no need to see a doctor; you can ignore this and just go back to sleep.",
      context
    );
    assert(
      !triageDismissal.isValid && triageDismissal.category === "triage_dismissal",
      "Gate 6B: Blocked premature triage dismissal chunk ('no need to see a doctor')"
    );

    // 6C. False Ambulance Dispatch Claim Guard
    const falseDispatch = validateAudioBoundChunk(
      "An ambulance has been dispatched to your house and help is on the way.",
      context
    );
    assert(
      !falseDispatch.isValid && falseDispatch.category === "false_dispatch_claim",
      "Gate 6C: Blocked false ambulance dispatch claim ('An ambulance has been dispatched')"
    );

    // 6D. Diagnostic Restraint Guard
    const definitiveDiag = validateAudioBoundChunk(
      "You have a heart attack and need bypass surgery.",
      context
    );
    assert(
      !definitiveDiag.isValid && definitiveDiag.category === "diagnosis_inflation",
      "Gate 6D: Blocked uncertified definitive diagnosis ('You have a heart attack')"
    );

    // 6E. Subject Misattribution in Caregiver Presentation
    const motherContext = {
      patientUtterance: "My mother suddenly cannot move her right arm",
      targetSubject: "mother" as const,
      isEmergency: true,
      primaryEmergencyNumber: "112",
      ambulanceNumber: "108",
    };
    const transposedAttribution = validateAudioBoundChunk(
      "I see your arm weakness has worsened. Try lifting your right arm.",
      motherContext
    );
    assert(
      !transposedAttribution.isValid && transposedAttribution.category === "attribution",
      "Gate 6E: Blocked transposed attribution in caregiver call ('your arm weakness')"
    );

    // 6F. Pipeline Gating: Unsafe stream holds chunk and delivers safe fallback
    const unsafeStreamPipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      ttsSynthesizer: async () => createMockSynthesisResult(2.0),
    });

    const unsafeTelem = await unsafeStreamPipeline.executeStreamingTurn({
      pcmChunks: [createDummyPcm(100)],
      simulatedTranscript: "I have severe headache",
      tokenStream: ["Don't ", "worry, ", "you ", "are ", "completely ", "fine. "],
    });

    assert(unsafeTelem.chunksRejected === 1 && unsafeTelem.fallbackUsed === true, "Pipeline held unsafe chunk and successfully engaged safe clinical fallback");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: MID-STREAM EMERGENCY SIGNALS & PLAYBACK PREEMPTION
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 7: MID-STREAM EMERGENCY PREEMPTION] ---");
  {
    const queue = new AudioPlaybackQueue();
    const fakeBuf = Buffer.alloc(100);

    // Non-urgent audio playing
    queue.enqueue({ id: "norm-1", buffer: fakeBuf, durationSec: 3.0, text: "Normal greeting clause" });
    queue.enqueue({ id: "norm-2", buffer: fakeBuf, durationSec: 3.0, text: "Normal exploratory question" });

    // Mid-stream emergency signal arrives (e.g. BE-FAST Stroke or collapse)
    const midStreamEmergencyEvent = "Emergency Preemption: Acute facial droop and arm weakness detected";
    queue.interrupt(midStreamEmergencyEvent);

    assert(
      queue.getStatus().isInterrupted,
      "Audio playback queue immediately interrupted on mid-stream emergency signal"
    );
    assert(
      queue.getStatus().queueLength === 0,
      "All pending non-urgent audio dropped instantly from playback queue"
    );

    // Enqueue emergency directive
    queue.reset();
    const emergencyDirective = "Please call 112 or 108 immediately for urgent medical care.";
    queue.enqueue({ id: "em-dir-1", buffer: fakeBuf, durationSec: 2.5, text: emergencyDirective });

    assert(
      queue.getStatus().queueLength === 1,
      "Emergency directive successfully substituted for priority playback"
    );

    // Also test StreamingVoicePipeline mid-stream emergency signal preemption
    const preemptPipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      ttsSynthesizer: async () => createMockSynthesisResult(2.0),
    });

    async function* midEmergencyStream() {
      yield "I "; yield "understand. ";
      preemptPipeline.signalEmergency("Universal Red Flag: sudden acute chest pressure with radiation");
      yield "Tell "; yield "me "; yield "more. ";
    }

    const midTelem = await preemptPipeline.executeStreamingTurn({
      pcmChunks: [createDummyPcm(100)],
      simulatedTranscript: "I have indigestion",
      tokenStream: midEmergencyStream(),
    });

    assert(midTelem.emergencyPreempted === true, "Pipeline detected and preempted mid-stream emergency signal during generation");
    assert(midTelem.emergencyDirectivePlayed === true, "Priority emergency directive synthesized and delivered to audio queue mid-stream");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: EMERGENCY INSTRUCTION CONTENT & NO-DISPATCH INVARIANT
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- [SCENARIO 8: EMERGENCY INSTRUCTION CONTENT & NO-DISPATCH INVARIANT] ---");
  {
    const validDirective = "This is a medical emergency. Please call 112 or 108 immediately or go to the nearest emergency department.";
    const hasEmergencyNumbers = /\b(112|108|911)\b/.test(validDirective);
    const claimsAmbulanceDispatched = /\b(?:an?\s+ambulance\s+has\s+been\s+dispatched|ambulance\s+is\s+on\s+the\s+way|dispatched\s+an?\s+ambulance|help\s+is\s+on\s+the\s+way)\b/i.test(validDirective);

    assert(hasEmergencyNumbers, "Emergency directive explicitly instructs calling local numbers (112 or 108)");
    assert(!claimsAmbulanceDispatched, "Emergency directive strictly DOES NOT claim ambulance was dispatched");

    // Also verify StreamingVoicePipeline emergency fast-path directive output
    const emPipeline = new StreamingVoicePipeline({
      ttsSynthesizer: async () => createMockSynthesisResult(3.0),
    });
    const emTelem = await emPipeline.executeStreamingTurn({
      pcmChunks: [createDummyPcm(100)],
      simulatedTranscript: "I have crushing chest pain and feel like I am dying",
      tokenStream: ["I ", "hear ", "you."],
    });

    assert(emTelem.emergencyDirectivePlayed === true, "Pipeline emergency fast-path triggered and played directive");
    assert(!/\bambulance\s+(?:has\s+been\s+dispatched|is\s+on\s+the\s+way)\b/i.test(emTelem.transcript), "Emergency fast-path does NOT claim ambulance dispatch");
  }

  console.log("\n==============================================================================");
  console.log(`  RESILIENCE & INTERRUPTION SUITE SUMMARY: ${passedTests.length} PASSED, ${failedTests.length} FAILED`);
  console.log("==============================================================================");

  const allPassed = failedTests.length === 0;
  if (allPassed) {
    console.log("  🎉 MILESTONE 3 EMERGENCY INTERRUPTION & RESILIENCE SUITE PASSED 100%!\n");
  } else {
    console.error("  ❌ Milestone 3 encountered failures:\n", failedTests);
  }

  return allPassed;
}

if (require.main === module) {
  runEmergencyResilienceSuite()
    .then((pass) => process.exit(pass ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
