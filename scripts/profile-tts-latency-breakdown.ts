import { kokoroService, floatTo16BitPCM } from "../lib/audio/kokoro-service";
import { splitIntoSpeechChunks } from "../lib/audio/sentence-splitter";
import { KokoroTTS } from "kokoro-js";

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

const SAMPLE_TEXTS = {
  words5: "Do you have a fever?",
  words10: "I understand you are having severe discomfort in your chest.",
  words16: "Based on what you have told me, let us go through a few more quick questions.",
  words22: "Based on what you have told me, I want to ask a few more questions before we decide what level of care you need.",
  words28: "I understand that you have been experiencing throat discomfort for the past two days, and I want to ask you a few targeted questions to make sure everything is safe.",
  words40: "A sudden weakness in your arm or facial drooping are critical signs that blood flow to part of the brain has been disrupted. Because time is critical to prevent permanent damage, you must seek emergency medical care right now without delay."
};

async function runProfiler() {
  console.log("================================================================================");
  console.log("           MEDVOICE TTS LATENCY & TTFA PROFILING DECOMPOSITION                  ");
  console.log("================================================================================\n");

  // -------------------------------------------------------------------------
  // 1. EXPERIMENT C: COLD VS PREWARMED BREAKDOWN
  // -------------------------------------------------------------------------
  console.log(">>> [EXPERIMENT C] Model Loading & Cold vs Warmup State Profiling...");
  const tLoad0 = performance.now();
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q4",
    device: "cpu",
  });
  const modelLoadTimeMs = Math.round(performance.now() - tLoad0);
  console.log(`  • Model from_pretrained (q4 / CPU): ${modelLoadTimeMs} ms`);

  // First synthesis ever (Cold ONNX graph compilation + voice loading)
  const tCold0 = performance.now();
  const outCold = await tts.generate("ready", { voice: "af_sarah" as any, speed: 0.96 });
  const coldInferenceMs = Math.round(performance.now() - tCold0);
  console.log(`  • Cold First Inference ("ready" - 1 word): ${coldInferenceMs} ms`);

  // Prewarmed dummy run
  const tWarm0 = performance.now();
  await tts.generate("ready", { voice: "af_sarah" as any, speed: 0.96 });
  const warmDummyMs = Math.round(performance.now() - tWarm0);
  console.log(`  • Subsequent Warm Inference ("ready"): ${warmDummyMs} ms\n`);

  // Ensure kokoroService singleton is warmed up
  await kokoroService.warmup("dr-sarah-chen");

  // -------------------------------------------------------------------------
  // 2. EXPERIMENT A: LATENCY DECOMPOSITION ACROSS WORD COUNTS
  // -------------------------------------------------------------------------
  console.log(">>> [EXPERIMENT A] Profiling Granular Pipeline Stages Across Word Counts (10 runs each)...");

  const wordCountEntries = Object.entries(SAMPLE_TEXTS);
  const decompositionTable: any[] = [];

  for (const [key, text] of wordCountEntries) {
    const wordCount = text.split(/\s+/).length;
    const chunkTimes: number[] = [];
    const ttsInferenceTimes: number[] = [];
    const pcmConversionTimes: number[] = [];
    const totalTimes: number[] = [];
    const durationsSec: number[] = [];
    const rtfs: number[] = [];

    // Run 10 trials
    for (let i = 0; i < 10; i++) {
      // Step 1: Chunking latency
      const tChunk0 = performance.now();
      const chunks = splitIntoSpeechChunks(text, 24);
      const chunk0Text = chunks[0];
      const chunkMs = performance.now() - tChunk0;

      // Step 2: Kokoro inference latency
      const tInfer0 = performance.now();
      const rawAudio = await tts.generate(chunk0Text, { voice: "af_sarah" as any, speed: 0.96 });
      const inferMs = performance.now() - tInfer0;

      // Step 3: PCM Float32 to 16-bit WAV Buffer conversion
      const tPcm0 = performance.now();
      const sampleRate = rawAudio.sampling_rate || 24000;
      floatTo16BitPCM(rawAudio.audio, sampleRate);
      const pcmMs = performance.now() - tPcm0;

      const durSec = rawAudio.audio.length / sampleRate;
      const totalMs = chunkMs + inferMs + pcmMs;

      chunkTimes.push(chunkMs);
      ttsInferenceTimes.push(inferMs);
      pcmConversionTimes.push(pcmMs);
      totalTimes.push(totalMs);
      durationsSec.push(durSec);
      rtfs.push(inferMs / (durSec * 1000));
    }

    const avgChunk = Number((chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length).toFixed(3));
    const avgInfer = Math.round(ttsInferenceTimes.reduce((a, b) => a + b, 0) / ttsInferenceTimes.length);
    const avgPcm = Number((pcmConversionTimes.reduce((a, b) => a + b, 0) / pcmConversionTimes.length).toFixed(2));
    const avgTotal = Math.round(totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length);
    const p50Total = Math.round(percentile(totalTimes, 50));
    const p95Total = Math.round(percentile(totalTimes, 95));
    const avgDur = Number((durationsSec.reduce((a, b) => a + b, 0) / durationsSec.length).toFixed(2));
    const avgRtf = Number((rtfs.reduce((a, b) => a + b, 0) / rtfs.length).toFixed(3));

    decompositionTable.push({
      "Words": wordCount,
      "Chunking (ms)": avgChunk,
      "ONNX Infer (ms)": avgInfer,
      "PCM Conv (ms)": avgPcm,
      "TTFA P50 (ms)": p50Total,
      "TTFA P95 (ms)": p95Total,
      "Audio Dur (s)": avgDur,
      "RTF": avgRtf,
    });
  }

  console.table(decompositionTable);

  // -------------------------------------------------------------------------
  // 3. EXPERIMENT B: FIRST-CHUNK OPTIMIZATION STRATEGY
  // -------------------------------------------------------------------------
  console.log("\n>>> [EXPERIMENT B] Simulating First-Chunk Sizing & Buffer Lead Time...");
  console.log("Doctor Response: 'Based on what you have told me, I want to ask a few more questions before we decide what level of care you need.' (22 words)\n");

  const strategies = [
    {
      name: "Current 24-Word Single Chunk",
      chunks: [
        "Based on what you have told me, I want to ask a few more questions before we decide what level of care you need."
      ]
    },
    {
      name: "Adaptive: 7-word Intro + 15-word Body",
      chunks: [
        "Based on what you have told me,",
        "I want to ask a few more questions before we decide what level of care you need."
      ]
    },
    {
      name: "Adaptive: 11-word Intro + 11-word Body",
      chunks: [
        "Based on what you have told me, I want to ask,",
        "a few more questions before we decide what level of care you need."
      ]
    }
  ];

  for (const strat of strategies) {
    console.log(`-- Strategy: ${strat.name} --`);
    let cumulativePlayTimeMs = 0;
    let starvationGapMs = 0;

    for (let cIdx = 0; cIdx < strat.chunks.length; cIdx++) {
      const chunkText = strat.chunks[cIdx];
      const wordCount = chunkText.split(/\s+/).length;
      const t0 = performance.now();
      const rawAudio = await tts.generate(chunkText, { voice: "af_sarah" as any, speed: 0.96 });
      const latMs = Math.round(performance.now() - t0);
      const sampleRate = rawAudio.sampling_rate || 24000;
      const durSec = rawAudio.audio.length / sampleRate;
      const durMs = Math.round(durSec * 1000);

      if (cIdx === 0) {
        console.log(`   [Chunk 0] (${wordCount} words): TTFA = ${latMs} ms | Audio Duration = ${durSec.toFixed(2)}s (${durMs} ms)`);
        cumulativePlayTimeMs = latMs + durMs;
      } else {
        // Chunk 1 starts synthesis when Chunk 0 completes synthesis (at t = lat0)
        // Chunk 1 finishes synthesis at t = lat0 + lat1
        // Chunk 0 playback finishes at t = lat0 + dur0
        // Buffer lead = (lat0 + dur0) - (lat0 + lat1) = dur0 - lat1
        const chunk0Lat = decompositionTable.find(d => d.Words === strat.chunks[0].split(/\s+/).length)?.["ONNX Infer (ms)"] || 500;
        const chunk0DurMs = Math.round((strat.chunks[0].split(/\s+/).length / 2.7) * 1000);
        const leadMs = chunk0DurMs - latMs;
        console.log(`   [Chunk ${cIdx}] (${wordCount} words): Synthesized in ${latMs} ms | Audio Duration = ${durSec.toFixed(2)}s`);
        console.log(`             Buffer Lead Time = ${leadMs >= 0 ? `+${leadMs} ms (Seamless)` : `${leadMs} ms (STARVATION)`}`);
      }
    }
    console.log("");
  }

  console.log("================================================================================");
  console.log("                        PROFILING COMPLETE                                      ");
  console.log("================================================================================\n");
}

runProfiler().catch((err) => {
  console.error("Profiler failed:", err);
  process.exit(1);
});
