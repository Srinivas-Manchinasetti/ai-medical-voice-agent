import { KokoroTTS } from "kokoro-js";
import { floatTo16BitPCM } from "../lib/audio/kokoro-service";

interface BenchmarkResult {
  dtype: string;
  device: string;
  loadTimeMs: number;
  firstSynthesisMs: number;
  secondSynthesisMs: number;
  thirdSynthesisMs: number;
  longSynthesisMs: number;
  shortAudioDurationSec: number;
  longAudioDurationSec: number;
  error?: string;
}

const SHORT_TEXT = "Do you have a fever?";
const LONG_TEXT = "Based on what you've told me, I want to ask a few more questions before we decide what level of care you need. First, are you having any difficulty breathing, swallowing liquids, or managing your saliva?";

async function benchmarkConfig(
  dtype: "q8" | "q4" | "q4f16" | "fp32" | "fp16",
  device: "cpu" | "wasm" | "webgpu"
): Promise<BenchmarkResult> {
  console.log(`\n======================================================================`);
  console.log(`Testing Config: dtype = ${dtype}, device = ${device}`);
  console.log(`======================================================================`);

  const res: BenchmarkResult = {
    dtype,
    device,
    loadTimeMs: 0,
    firstSynthesisMs: 0,
    secondSynthesisMs: 0,
    thirdSynthesisMs: 0,
    longSynthesisMs: 0,
    shortAudioDurationSec: 0,
    longAudioDurationSec: 0,
  };

  try {
    // 1. Measure Model Load Time
    console.log(`[1/5] Loading model from Hugging Face / cache...`);
    const tLoad0 = performance.now();
    const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype,
      device: device as any,
    });
    res.loadTimeMs = Math.round(performance.now() - tLoad0);
    console.log(`✓ Model loaded in ${res.loadTimeMs} ms`);

    // 2. Measure First Synthesis (Cold Inference)
    console.log(`[2/5] Running First-Ever Synthesis (Cold) on short text: "${SHORT_TEXT}"...`);
    const t1Start = performance.now();
    const out1 = await tts.generate(SHORT_TEXT, { voice: "af_sarah" as any, speed: 0.96 });
    res.firstSynthesisMs = Math.round(performance.now() - t1Start);
    res.shortAudioDurationSec = out1.audio.length / (out1.sampling_rate || 24000);
    console.log(`✓ First synthesis complete: ${res.firstSynthesisMs} ms (Audio duration: ${res.shortAudioDurationSec.toFixed(2)}s)`);

    // 3. Measure Second Synthesis (Warm Inference)
    console.log(`[3/5] Running Second Synthesis (Warm) on identical short text...`);
    const t2Start = performance.now();
    const out2 = await tts.generate(SHORT_TEXT, { voice: "af_sarah" as any, speed: 0.96 });
    res.secondSynthesisMs = Math.round(performance.now() - t2Start);
    console.log(`✓ Second synthesis complete: ${res.secondSynthesisMs} ms`);

    // 4. Measure Third Synthesis (Warm Inference)
    console.log(`[4/5] Running Third Synthesis (Warm) on identical short text...`);
    const t3Start = performance.now();
    const out3 = await tts.generate(SHORT_TEXT, { voice: "af_sarah" as any, speed: 0.96 });
    res.thirdSynthesisMs = Math.round(performance.now() - t3Start);
    console.log(`✓ Third synthesis complete: ${res.thirdSynthesisMs} ms`);

    // 5. Measure Long Utterance Synthesis
    console.log(`[5/5] Running Long Utterance Synthesis (${LONG_TEXT.split(/\s+/).length} words)...`);
    const tLongStart = performance.now();
    const outLong = await tts.generate(LONG_TEXT, { voice: "af_sarah" as any, speed: 0.96 });
    res.longSynthesisMs = Math.round(performance.now() - tLongStart);
    res.longAudioDurationSec = outLong.audio.length / (outLong.sampling_rate || 24000);
    console.log(`✓ Long utterance complete: ${res.longSynthesisMs} ms (Audio duration: ${res.longAudioDurationSec.toFixed(2)}s)`);

    // Verify audio sanity
    if (out1.audio.length === 0 || isNaN(out1.audio[0])) {
      throw new Error("Audio generation produced empty or NaN samples");
    }
  } catch (err: any) {
    console.error(`❌ Failed for ${dtype}/${device}:`, err?.message || err);
    res.error = err?.message || String(err);
  }

  return res;
}

async function main() {
  console.log("######################################################################");
  console.log("       KOKORO QUANTIZATION, HARDWARE DEVICE & COLD/WARM BENCHMARK      ");
  console.log("######################################################################");

  const results: BenchmarkResult[] = [];

  // Test 1: Current baseline: q8 on cpu
  results.push(await benchmarkConfig("q8", "cpu"));

  // Test 2: q4 on cpu
  results.push(await benchmarkConfig("q4", "cpu"));

  // Test 3: q4f16 on cpu
  results.push(await benchmarkConfig("q4f16", "cpu"));

  // Test 4: fp32 on cpu
  results.push(await benchmarkConfig("fp32", "cpu"));

  // Test 5: fp16 on cpu
  results.push(await benchmarkConfig("fp16", "cpu"));

  // Test 6: wasm device (if supported)
  results.push(await benchmarkConfig("q8", "wasm"));

  // Test 7: webgpu device (test if available in Node or error cleanly)
  results.push(await benchmarkConfig("q8", "webgpu"));

  console.log("\n\n######################################################################");
  console.log("                        FINAL BENCHMARK TABLE                         ");
  console.log("######################################################################\n");

  console.table(
    results.map((r) => ({
      Config: `${r.dtype} / ${r.device}`,
      "Model Load": r.loadTimeMs ? `${r.loadTimeMs} ms` : "FAILED",
      "1st (Cold) Short": r.firstSynthesisMs ? `${r.firstSynthesisMs} ms` : "N/A",
      "2nd (Warm) Short": r.secondSynthesisMs ? `${r.secondSynthesisMs} ms` : "N/A",
      "3rd (Warm) Short": r.thirdSynthesisMs ? `${r.thirdSynthesisMs} ms` : "N/A",
      "Long Utterance": r.longSynthesisMs ? `${r.longSynthesisMs} ms` : "N/A",
      "RTF (Warm Short)": r.secondSynthesisMs && r.shortAudioDurationSec
        ? (r.secondSynthesisMs / (r.shortAudioDurationSec * 1000)).toFixed(2)
        : "N/A",
      Status: r.error ? `Error: ${r.error.slice(0, 30)}...` : "OK",
    }))
  );
}

main().catch(console.error);
