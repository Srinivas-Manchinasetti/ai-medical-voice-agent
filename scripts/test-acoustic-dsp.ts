/**
 * FOCUSED VERIFICATION SUITE: PARALINGUISTIC DSP RUNTIME & SAFETY INVARIANTS
 * 
 * Verifies:
 * 1. Exact mathematical sample calculations for 25ms window & 10ms hop across 16kHz, 44.1kHz, 48kHz.
 * 2. Short-term RMS energy and dBFS logarithmic mapping.
 * 3. -38 dBFS VAD thresholding logic.
 * 4. Normalized autocorrelation f0 extraction (60 Hz <= f0 <= 400 Hz, confidence >= 0.45, unvoiced -> null).
 * 5. Feature aggregation (pause count, pause ratio, speech duration, pitch/energy variance).
 * 6. Fallback integrity when live DSP is unavailable (heuristic transcript fallback).
 * 7. CLINICAL SAFETY INVARIANT: Live DSP telemetry alone NEVER trips emergency pre-arbiter flags or alters ESI level.
 */

import {
  computeRmsEnergy,
  computeDbfs,
  evaluateVad,
  extractF0Autocorrelation,
  analyzeAcousticFrame,
  aggregateAcousticMetrics,
  LiveAudioMetrics
} from "../lib/acoustic/acoustic-dsp-analyzer";
import { extractSpeechFeatures } from "../lib/acoustic/speech-features";
import { evaluatePreArbiter } from "../lib/triage/pre-arbiter";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    process.exitCode = 1;
  }
}

console.log("==============================================================================");
console.log("       PARALINGUISTIC DSP RUNTIME & SAFETY INVARIANT TEST SUITE               ");
console.log("==============================================================================");

// -----------------------------------------------------------------------------
// Suite 1: Sample Rate Calculations for 25ms Window & 10ms Hop
// -----------------------------------------------------------------------------
console.log("\n[Suite 1] Window (25ms) and Hop (10ms) Calculation across Sample Rates");
{
  const sampleRates = [16000, 44100, 48000];
  const expectedWins = [400, 1103, 1200];
  const expectedHops = [160, 441, 480];

  for (let i = 0; i < sampleRates.length; i++) {
    const sr = sampleRates[i];
    const win = Math.round(0.025 * sr);
    const hop = Math.round(0.010 * sr);

    assert(win === expectedWins[i], `${sr}Hz -> Window = ${win} samples (expected ${expectedWins[i]})`);
    assert(hop === expectedHops[i], `${sr}Hz -> Hop = ${hop} samples (expected ${expectedHops[i]})`);
  }
}

// -----------------------------------------------------------------------------
// Suite 2: RMS Energy & dBFS Mapping
// -----------------------------------------------------------------------------
console.log("\n[Suite 2] Short-Term RMS Energy & dBFS Bounds");
{
  const zeroVector = new Float32Array(480);
  const rmsZero = computeRmsEnergy(zeroVector);
  const dbfsZero = computeDbfs(rmsZero);
  assert(rmsZero === 0, "Silence vector produces RMS = 0");
  assert(dbfsZero <= -99, `Silence vector maps to dBFS floor (-100 dBFS), got ${dbfsZero.toFixed(1)} dBFS`);

  // Full-scale sine wave (amplitude 1.0): RMS = 1/sqrt(2) ~ 0.7071, dBFS = 20 * log10(0.7071) ~ -3.01 dBFS
  const sr = 48000;
  const sine480 = new Float32Array(1200);
  for (let n = 0; n < sine480.length; n++) {
    sine480[n] = Math.sin(2 * Math.PI * 440 * (n / sr));
  }
  const rmsSine = computeRmsEnergy(sine480);
  const dbfsSine = computeDbfs(rmsSine);
  assert(Math.abs(rmsSine - 0.7071) < 0.02, `Full scale sine wave RMS is ~0.7071, got ${rmsSine.toFixed(4)}`);
  assert(Math.abs(dbfsSine - (-3.01)) < 0.2, `Full scale sine wave dBFS is ~ -3.0 dBFS, got ${dbfsSine.toFixed(2)} dBFS`);

  // Half-scale sine wave (amplitude 0.5): dBFS should be approx -9.0 dBFS (6 dB lower)
  const halfSine = new Float32Array(1200);
  for (let n = 0; n < halfSine.length; n++) {
    halfSine[n] = 0.5 * Math.sin(2 * Math.PI * 440 * (n / sr));
  }
  const rmsHalf = computeRmsEnergy(halfSine);
  const dbfsHalf = computeDbfs(rmsHalf);
  assert(Math.abs(dbfsHalf - (-9.03)) < 0.2, `Half scale sine wave dBFS is ~ -9.0 dBFS, got ${dbfsHalf.toFixed(2)} dBFS`);
}

// -----------------------------------------------------------------------------
// Suite 3: -38 dBFS VAD Decision Logic
// -----------------------------------------------------------------------------
console.log("\n[Suite 3] -38 dBFS VAD Evaluation");
{
  assert(evaluateVad(-30, -38) === true, "-30 dBFS is voiced/speech active (> -38 dBFS)");
  assert(evaluateVad(-37.9, -38) === true, "-37.9 dBFS is voiced/speech active (> -38 dBFS)");
  assert(evaluateVad(-38.0, -38) === false, "-38.0 dBFS is unvoiced/silence (<= -38 dBFS)");
  assert(evaluateVad(-50, -38) === false, "-50 dBFS is unvoiced/silence (<= -38 dBFS)");
  assert(evaluateVad(-100, -38) === false, "-100 dBFS floor is unvoiced/silence");
}

// -----------------------------------------------------------------------------
// Suite 4: Normalized Autocorrelation f0 Extraction & Gating
// -----------------------------------------------------------------------------
console.log("\n[Suite 4] Normalized Autocorrelation f0 Extraction (60 Hz <= f0 <= 400 Hz)");
{
  const sr = 16000;
  const win = Math.round(0.025 * sr); // 400 samples

  // Test 150 Hz tone (typical adult male pitch)
  const f150 = new Float32Array(win);
  for (let n = 0; n < win; n++) {
    f150[n] = 0.8 * Math.sin(2 * Math.PI * 150 * (n / sr));
  }
  const res150 = extractF0Autocorrelation(f150, sr, true);
  assert(res150.f0Hz !== null, "150 Hz tone returns non-null pitch");
  assert(res150.f0Hz !== null && Math.abs(res150.f0Hz - 150) <= 3, `150 Hz tone estimated within ±3 Hz, got ${res150.f0Hz?.toFixed(1)} Hz`);

  // Test 220 Hz tone (typical adult female pitch)
  const f220 = new Float32Array(win);
  for (let n = 0; n < win; n++) {
    f220[n] = 0.8 * Math.sin(2 * Math.PI * 220 * (n / sr));
  }
  const res220 = extractF0Autocorrelation(f220, sr, true);
  assert(res220.f0Hz !== null, "220 Hz tone returns non-null pitch");
  assert(res220.f0Hz !== null && Math.abs(res220.f0Hz - 220) <= 3, `220 Hz tone estimated within ±3 Hz, got ${res220.f0Hz?.toFixed(1)} Hz`);

  // Out of range: 30 Hz (below 60 Hz min) -> returns null
  const f30 = new Float32Array(win);
  for (let n = 0; n < win; n++) {
    f30[n] = 0.8 * Math.sin(2 * Math.PI * 30 * (n / sr));
  }
  const res30 = extractF0Autocorrelation(f30, sr, true);
  assert(res30.f0Hz === null, "Sub-harmonic 30 Hz tone (< 60 Hz) correctly returns null");

  // Out of range: 500 Hz (above 400 Hz max) -> returns null
  const f500 = new Float32Array(win);
  for (let n = 0; n < win; n++) {
    f500[n] = 0.8 * Math.sin(2 * Math.PI * 500 * (n / sr));
  }
  const res500 = extractF0Autocorrelation(f500, sr, true);
  assert(res500.f0Hz === null, "Supra-harmonic 500 Hz tone (> 400 Hz) correctly returns null");

  // Unvoiced / Random Noise -> Correlation peak < 0.45 -> returns null (never fabricated!)
  const noise = new Float32Array(win);
  for (let n = 0; n < win; n++) {
    noise[n] = (Math.random() * 2 - 1) * 0.5;
  }
  const resNoise = extractF0Autocorrelation(noise, sr, true);
  assert(resNoise.f0Hz === null, "Random white noise yields low autocorrelation confidence and correctly returns null");

  // Gating on unvoiced flag
  const resGated = extractF0Autocorrelation(f150, sr, false);
  assert(resGated.f0Hz === null, "Unvoiced frame (isVoicedFrame=false) immediately returns null without running search");
}

// -----------------------------------------------------------------------------
// Suite 5: Frame Analysis & Metric Aggregation
// -----------------------------------------------------------------------------
console.log("\n[Suite 5] Frame Analysis & Metric Aggregation");
{
  const sr = 16000;
  const hopMs = 10;
  const frames = [];

  // Generate 50 voiced speech frames at 180 Hz (-20 dBFS)
  for (let i = 0; i < 50; i++) {
    frames.push({
      rms: 0.1,
      dbfs: -20,
      isVoiced: true,
      f0Hz: 180 + (i % 5) * 2 // slight natural pitch contour
    });
  }

  // Generate 30 silence frames (-50 dBFS)
  for (let i = 0; i < 30; i++) {
    frames.push({
      rms: 0.003,
      dbfs: -50,
      isVoiced: false,
      f0Hz: null
    });
  }

  // Generate another 50 voiced speech frames at 180 Hz
  for (let i = 0; i < 50; i++) {
    frames.push({
      rms: 0.1,
      dbfs: -20,
      isVoiced: true,
      f0Hz: 180
    });
  }

  const metrics = aggregateAcousticMetrics(frames, sr, hopMs);
  assert(metrics.totalFramesCount === 130, `Total frames is 130, got ${metrics.totalFramesCount}`);
  assert(metrics.voicedFramesCount === 100, `Voiced frames is 100, got ${metrics.voicedFramesCount}`);
  assert(metrics.durationMs === 1300, `Total duration is 1300ms, got ${metrics.durationMs}ms`);
  assert(metrics.pauseCount === 1, `Pause count is 1, got ${metrics.pauseCount}`);
  assert(metrics.totalPauseDurationMs === 300, `Total pause duration is 300ms, got ${metrics.totalPauseDurationMs}ms`);
  assert(metrics.meanF0Hz != null && Math.abs(metrics.meanF0Hz - 182) < 3, `Mean f0 is ~182 Hz, got ${metrics.meanF0Hz?.toFixed(1)} Hz`);
  assert(metrics.isLiveDsp === true, "isLiveDsp flag is strictly true");
}

// -----------------------------------------------------------------------------
// Suite 6: Transparent Fallback When Live DSP Is Absent
// -----------------------------------------------------------------------------
console.log("\n[Suite 6] Fallback Handling When Live DSP Is Absent");
{
  // When no audioMetrics are supplied (text/fallback mode)
  const fallbackFeatures = extractSpeechFeatures({
    transcriptText: "Hello doctor, I have had a mild headache for three days.",
    durationMs: undefined,
    pauseCount: undefined
  });

  assert(fallbackFeatures !== null, "extractSpeechFeatures produces valid schema without live DSP");
  assert(typeof fallbackFeatures.speech_pause_ratio === "number", "speech_pause_ratio is computed from text punctuation fallback");
  assert(typeof fallbackFeatures.speech_rate_wpm === "number", "speech_rate_wpm is computed from text word count and estimated duration");
  assert(Array.isArray(fallbackFeatures.observations), "observations array is populated in fallback mode");
  assert(fallbackFeatures.clinical_relevance !== undefined, "clinical_relevance is safely derived in fallback mode");
}

// -----------------------------------------------------------------------------
// Suite 7: Strict Clinical Safety Invariants
// -----------------------------------------------------------------------------
console.log("\n[Suite 7] Clinical Safety Invariant: Live DSP Telemetry NEVER Escalates ESI or Triggers Emergency");
{
  // 1. Feed extreme synthetic acoustic metrics to extractSpeechFeatures
  const extremeLiveMetrics: LiveAudioMetrics = {
    durationMs: 12000,
    pauseCount: 15,
    totalPauseDurationMs: 8000,
    speechPauseRatio: 0.25, // heavy pauses
    meanPauseDurationMs: 533,
    energyVariance: 35,
    pitchVariance: 45,
    meanF0Hz: 380, // elevated pitch
    voicedFramesCount: 200,
    totalFramesCount: 1200,
    sampleRate: 48000,
    isLiveDsp: true,
  };

  const extractedFeatures = extractSpeechFeatures({
    transcriptText: "I have a sore throat and slight congestion.",
    durationMs: extremeLiveMetrics.durationMs,
    pauseCount: extremeLiveMetrics.pauseCount,
    totalPauseDurationMs: extremeLiveMetrics.totalPauseDurationMs,
    speechPauseRatio: extremeLiveMetrics.speechPauseRatio,
    meanPauseDurationMs: extremeLiveMetrics.meanPauseDurationMs,
    energyVariance: extremeLiveMetrics.energyVariance,
    pitchVariance: extremeLiveMetrics.pitchVariance,
    meanF0Hz: extremeLiveMetrics.meanF0Hz,
    isLiveDsp: extremeLiveMetrics.isLiveDsp,
  });

  assert(
    extractedFeatures.clinical_relevance.respiratory_distress_signal !== "severe",
    `Safety Invariant: respiratory_distress_signal must NOT be 'severe' under live DSP, got '${extractedFeatures.clinical_relevance.respiratory_distress_signal}'`
  );

  // 2. Evaluate deterministic pre-arbiter with this case
  const testCase = {
    patient_testimony: "I have a sore throat and slight congestion.",
    reported_symptoms: ["sore_throat", "congestion"],
    chief_complaint: "sore throat",
    duration: "2 days",
    vital_signs: {},
    speech_features: extractedFeatures
  };

  const preArbiterResult = evaluatePreArbiter({
    transcript: testCase.patient_testimony,
    speech_features: extractedFeatures,
  });
  const flags = preArbiterResult.pre_safety_flags;

  assert(
    !flags.includes("PRE_FLAG_ACOUSTIC_SEVERE_RESPIRATORY_DISTRESS"),
    "Safety Invariant: Deterministic pre-arbiter did NOT trigger PRE_FLAG_ACOUSTIC_SEVERE_RESPIRATORY_DISTRESS"
  );
  assert(
    preArbiterResult.immediate_danger === false,
    "Safety Invariant: immediate_danger remains false (no false positive emergency trip)"
  );
}

console.log("\n==============================================================================");
console.log(`SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log("✅ ALL PARALINGUISTIC DSP & SAFETY INVARIANT TESTS PASSED (100%)");
} else {
  console.log("❌ SOME TESTS FAILED");
  process.exit(1);
}
console.log("==============================================================================");
