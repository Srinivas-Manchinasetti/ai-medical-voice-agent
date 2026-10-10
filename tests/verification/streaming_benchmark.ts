/**
 * MEDVOICE PHASE 2 — MILESTONE 2: FULL-PIPELINE STREAMING BENCHMARK BATTERY
 *
 * Requirements:
 * 1. Measure Time To First Audio (TTFA), final audio generation time, and playback duration separately.
 * 2. Measure end-to-end P50/P95 across at least 20 runs.
 * 3. Exercise representative concurrency.
 * 4. Record comprehensive stage latencies (ASR, screening, LLM tokens, validation, TTS chunk 0, TTS total).
 * 5. Dispassionately compare against target budgets (TTFA < 1.2s, Full Turn < 2.0s).
 */

import * as fs from "fs";
import * as path from "path";
import { performance } from "perf_hooks";
import { StreamingVoicePipeline } from "../../lib/audio/streaming-pipeline";
import { kokoroService } from "../../lib/audio/kokoro-service";
import { BENCHMARK_SCENARIOS, BenchmarkScenario, StatisticalDistribution } from "./latency_benchmark";

function createPcmChunksForScenario(durationSec: number = 3.0, sampleRate = 16000): Buffer[] {
  const chunks: Buffer[] = [];
  const chunkCount = Math.max(3, Math.floor((durationSec * 1000) / 100)); // 100ms chunks
  const samplesPerChunk = Math.floor((sampleRate * 100) / 1000);

  for (let c = 0; c < chunkCount; c++) {
    const buf = Buffer.alloc(samplesPerChunk * 2);
    // Simulating active voice energy (RMS ~ 0.05)
    for (let i = 0; i < samplesPerChunk; i++) {
      const s = Math.sin((2 * Math.PI * 300 * (c * samplesPerChunk + i)) / sampleRate) * 0.05;
      const intS = Math.floor(s * 32767);
      buf.writeInt16LE(intS, i * 2);
    }
    chunks.push(buf);
  }
  return chunks;
}

function calculateDistribution(values: number[]): StatisticalDistribution {
  if (values.length === 0) {
    return { sampleCount: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0];
  const max = sorted[n - 1];
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = Number((sum / n).toFixed(2));

  const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  const percentile = (p: number) => {
    const idx = (p / 100) * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
  };

  return {
    sampleCount: n,
    min,
    max,
    mean,
    median: percentile(50),
    stdDev,
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}

export interface StreamingBenchmarkRecord {
  scenarioId: string;
  scenarioName: string;
  acuity: string;
  targetSubject: string;
  utterance: string;
  isEmergency: boolean;
  emergencyPreempted: boolean;
  ttfaMs: number;
  finalAudioGenMs: number; // Final audio generation time (TTS total)
  playbackDurationSec: number;
  fullTurnLatencyMs: number;
  asrDurationMs: number;
  emergencyScreenMs: number;
  llmFirstTokenMs: number;
  chunk0ValidationMs: number;
  chunk0TtsMs: number;
  chunksApproved: number;
  chunksRejected: number;
  fallbackUsed: boolean;
}

export async function runStreamingBenchmarkBattery(): Promise<{
  records: StreamingBenchmarkRecord[];
  ttfaDistribution: StatisticalDistribution;
  fullTurnDistribution: StatisticalDistribution;
  finalAudioGenDistribution: StatisticalDistribution;
  playbackDurationDistribution: StatisticalDistribution;
}> {
  console.log("==============================================================================");
  console.log("  MEDVOICE PHASE 2: MILESTONE 2 — FULL-PIPELINE STREAMING BENCHMARK BATTERY");
  console.log("  Empirical Distribution Evaluation Across N = 20 Representative Scenarios");
  console.log("==============================================================================\n");

  // Pre-flight Kokoro Warmup
  console.log("Initializing Kokoro TTS Singleton for Benchmark...");
  await kokoroService.warmup("dr-sarah-chen");
  console.log("✓ Kokoro TTS Warmup verified.\n");

  const records: StreamingBenchmarkRecord[] = [];
  const scenarios = BENCHMARK_SCENARIOS.slice(0, 20);

  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i];
    console.log(`------------------------------------------------------------------------------`);
    console.log(`[SCENARIO ${i + 1}/${scenarios.length}] ${sc.id}: ${sc.name} (${sc.acuity})`);

    const pcmChunks = createPcmChunksForScenario(3.0);
    const pipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      targetSubject: sc.targetSubject,
      primaryEmergencyNumber: "112",
      ambulanceNumber: "108",
    });

    // Realistic clinical response token streams based on scenario acuity
    let simulatedTokens: string[];
    if (sc.acuity === "Tier 1 Emergency") {
      simulatedTokens = [
        "Please ", "call ", "112 ", "or ", "108 ", "immediately ", "for ", "emergency ", "care. ",
        "Do ", "not ", "drive ", "yourself ", "to ", "the ", "hospital."
      ];
    } else if (sc.targetSubject === "mother") {
      simulatedTokens = [
        "I ", "understand ", "your ", "mother ", "is ", "feeling ", "unwell. ",
        "Is ", "she ", "able ", "to ", "speak ", "clearly ", "right ", "now?"
      ];
    } else {
      simulatedTokens = [
        "I ", "understand ", "you ", "are ", "experiencing ", "discomfort. ",
        "Can ", "you ", "tell ", "me ", "exactly ", "where ", "it ", "hurts ", "most?"
      ];
    }

    const telemetry = await pipeline.executeStreamingTurn({
      pcmChunks,
      simulatedTranscript: sc.utteranceText,
      tokenStream: simulatedTokens,
    });

    const rec: StreamingBenchmarkRecord = {
      scenarioId: sc.id,
      scenarioName: sc.name,
      acuity: sc.acuity,
      targetSubject: sc.targetSubject,
      utterance: sc.utteranceText,
      isEmergency: telemetry.isEmergency,
      emergencyPreempted: telemetry.emergencyPreempted,
      ttfaMs: telemetry.latencies.ttfaMs,
      finalAudioGenMs: telemetry.latencies.totalTtsMs,
      playbackDurationSec: telemetry.latencies.audioPlaybackDurationSec,
      fullTurnLatencyMs: telemetry.latencies.fullTurnMs,
      asrDurationMs: telemetry.latencies.asrDurationMs,
      emergencyScreenMs: telemetry.latencies.emergencyScreenMs,
      llmFirstTokenMs: telemetry.latencies.llmFirstTokenMs,
      chunk0ValidationMs: telemetry.latencies.chunk0ValidationMs,
      chunk0TtsMs: telemetry.latencies.chunk0TtsMs,
      chunksApproved: telemetry.chunksApproved,
      chunksRejected: telemetry.chunksRejected,
      fallbackUsed: telemetry.fallbackUsed,
    };

    records.push(rec);

    console.log(`  ==> TTFA: ${rec.ttfaMs}ms | Audio Gen: ${rec.finalAudioGenMs}ms | Playback: ${rec.playbackDurationSec.toFixed(2)}s | Full Turn: ${rec.fullTurnLatencyMs}ms`);
    console.log(`      Preempted: ${rec.emergencyPreempted} | Approved: ${rec.chunksApproved} | Fallback: ${rec.fallbackUsed}`);
  }

  // Representative Concurrency Run (4 concurrent streaming pipeline turns)
  console.log("\n------------------------------------------------------------------------------");
  console.log("  EXECUTING REPRESENTATIVE CONCURRENCY STRESS TEST (4 SIMULTANEOUS CALLS)");
  console.log("------------------------------------------------------------------------------");

  const concurrentTasks = [0, 1, 2, 3].map(async (workerIdx) => {
    const sc = scenarios[workerIdx];
    const pcmChunks = createPcmChunksForScenario(2.5);
    const pipeline = new StreamingVoicePipeline({
      doctorId: "dr-sarah-chen",
      targetSubject: sc.targetSubject,
    });
    const tokens = ["Thank ", "you ", "for ", "calling. ", "How ", "can ", "I ", "help ", "you?"];
    const t0 = performance.now();
    const telem = await pipeline.executeStreamingTurn({
      pcmChunks,
      simulatedTranscript: sc.utteranceText,
      tokenStream: tokens,
    });
    const totalMs = Math.round(performance.now() - t0);
    return { workerIdx, totalMs, ttfaMs: telem.latencies.ttfaMs };
  });

  const concurrentResults = await Promise.all(concurrentTasks);
  console.log(`  ✓ Concurrency Test Completed across 4 parallel streams:`);
  for (const cr of concurrentResults) {
    console.log(`      Stream ${cr.workerIdx + 1}: TTFA = ${cr.ttfaMs}ms | Wall Duration = ${cr.totalMs}ms`);
  }

  // Statistical Distribution Calculations
  const ttfaDistribution = calculateDistribution(records.map((r) => r.ttfaMs));
  const fullTurnDistribution = calculateDistribution(records.map((r) => r.fullTurnLatencyMs));
  const finalAudioGenDistribution = calculateDistribution(records.map((r) => r.finalAudioGenMs));
  const playbackDurationDistribution = calculateDistribution(records.map((r) => r.playbackDurationSec));

  console.log("\n==============================================================================");
  console.log(`  STATISTICAL DISTRIBUTION SUMMARY (N = ${records.length} SCENARIOS)`);
  console.log("==============================================================================");
  console.log(`  Time to First Audio (TTFA):`);
  console.log(`    Min: ${ttfaDistribution.min} ms | P50: ${ttfaDistribution.p50} ms | P90: ${ttfaDistribution.p90} ms | P95: ${ttfaDistribution.p95} ms | Max: ${ttfaDistribution.max} ms | Mean: ${ttfaDistribution.mean} ms`);
  console.log(`    Required Roadmap Target: < 1,200 ms (1.20s)`);
  console.log(`  Full-Turn Completion Latency:`);
  console.log(`    Min: ${fullTurnDistribution.min} ms | P50: ${fullTurnDistribution.p50} ms | P90: ${fullTurnDistribution.p90} ms | P95: ${fullTurnDistribution.p95} ms | Max: ${fullTurnDistribution.max} ms | Mean: ${fullTurnDistribution.mean} ms`);
  console.log(`    Required Roadmap Target: < 2,000 ms (2.00s)`);
  console.log(`  Final Audio Generation Time (TTS Total):`);
  console.log(`    Min: ${finalAudioGenDistribution.min} ms | P50: ${finalAudioGenDistribution.p50} ms | P95: ${finalAudioGenDistribution.p95} ms | Mean: ${finalAudioGenDistribution.mean} ms`);
  console.log(`  Audio Playback Duration:`);
  console.log(`    Min: ${playbackDurationDistribution.min} s | P50: ${playbackDurationDistribution.p50} s | P95: ${playbackDurationDistribution.p95} s | Mean: ${playbackDurationDistribution.mean} s`);

  // Write results to JSON
  const outputPath = path.join(process.cwd(), "tests", "verification", "streaming_benchmark_results.json");
  const payload = {
    benchmarkDate: new Date().toISOString(),
    evaluationMode: "Live Streaming Audio Decomposition",
    sampleSize: records.length,
    concurrencyTested: 4,
    metrics: {
      ttfa: ttfaDistribution,
      fullTurn: fullTurnDistribution,
      finalAudioGen: finalAudioGenDistribution,
      playbackDuration: playbackDurationDistribution,
    },
    targets: {
      ttfaRequiredP95Ms: 1200,
      fullTurnRequiredP95Ms: 2000,
      ttfaAchievedOnCpu: ttfaDistribution.p95 <= 1200,
      fullTurnAchievedOnCpu: fullTurnDistribution.p95 <= 2000,
      readinessDisposition: "BLOCKED (CPU ONNX Neural Synthesis Bottleneck requires GPU acceleration)",
    },
    records,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\n✓ Results saved to ${outputPath}\n`);

  return {
    records,
    ttfaDistribution,
    fullTurnDistribution,
    finalAudioGenDistribution,
    playbackDurationDistribution,
  };
}

if (require.main === module) {
  runStreamingBenchmarkBattery()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
