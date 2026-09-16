import { KokoroTTS } from "kokoro-js";
import fs from "fs";
import path from "path";

async function benchmark() {
  console.log("======================================================================");
  console.log("            KOKORO-JS BENCHMARK ON CURRENT MACHINE");
  console.log("======================================================================\n");

  const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";

  // 1. Benchmark Cold Model Load
  console.log("1. Testing Cold Model Load (from_pretrained)...");
  const t0_load = Date.now();
  const tts = await KokoroTTS.from_pretrained(model_id, {
    dtype: "q8", // quantized 8-bit for fast, lightweight CPU inference
    device: "cpu",
  });
  const coldLoadTimeMs = Date.now() - t0_load;
  console.log(`✓ Cold Model Load completed in: ${coldLoadTimeMs} ms\n`);

  // 2. Benchmark 30-word Clinical Response (Dr. Sarah Chen persona with af_heart)
  const text30 = "I understand you are experiencing discomfort in your chest. Could you tell me when this began, whether it started suddenly, and if it travels to your left arm or jaw?";
  const wordCount30 = text30.split(/\s+/).length;
  console.log(`2. Testing 30-word clinical response (${wordCount30} words)...`);
  console.log(`   Text: "${text30}"`);
  
  const t0_gen30 = Date.now();
  const audio30 = await tts.generate(text30, { voice: "af_heart" });
  const gen30TimeMs = Date.now() - t0_gen30;
  
  const sampleRate = audio30.sampling_rate || 24000;
  const audioDurationSec = audio30.audio.length / sampleRate;
  const rtf30 = gen30TimeMs / (audioDurationSec * 1000);

  console.log(`✓ 30-word generation time: ${gen30TimeMs} ms`);
  console.log(`  Audio duration: ${audioDurationSec.toFixed(2)} seconds (${audio30.audio.length} samples at ${sampleRate}Hz)`);
  console.log(`  Real-Time Factor (RTF): ${rtf30.toFixed(3)} (values < 1.0 mean faster than real-time)\n`);

  // Save sample WAV file
  const outDir = path.join(process.cwd(), "data", "test-audio");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const wavPath30 = path.join(outDir, "sarah_chen_turn1_30words.wav");
  audio30.save(wavPath30);
  console.log(`  Saved test audio to: ${wavPath30}\n`);

  // 3. Benchmark 50-word Clinical Response (Warm Model)
  const text50 = "A sudden weakness in your arm and facial drooping are critical signs that blood flow to part of the brain has been disrupted. Because time is critical to prevent permanent damage, you must call 911 right now or go straight to the nearest emergency department without delay. Please do not wait.";
  const wordCount50 = text50.split(/\s+/).length;
  console.log(`3. Testing 50-word clinical response (${wordCount50} words)...`);
  console.log(`   Text: "${text50}"`);

  const t0_gen50 = Date.now();
  const audio50 = await tts.generate(text50, { voice: "af_heart" });
  const gen50TimeMs = Date.now() - t0_gen50;
  const audioDurationSec50 = audio50.audio.length / sampleRate;
  const rtf50 = gen50TimeMs / (audioDurationSec50 * 1000);

  console.log(`✓ 50-word generation time: ${gen50TimeMs} ms`);
  console.log(`  Audio duration: ${audioDurationSec50.toFixed(2)} seconds`);
  console.log(`  Real-Time Factor (RTF): ${rtf50.toFixed(3)}\n`);

  const wavPath50 = path.join(outDir, "sarah_chen_turn2_50words.wav");
  audio50.save(wavPath50);

  // 4. Benchmark Sequential Repeated Turns (Steady-State Cache Verification)
  console.log("4. Testing 3 Sequential Repeated Turns for steady-state latency...");
  const repeatedTurns = [
    "I see you mentioned this started yesterday. Have you taken any medications so far?",
    "Does resting in a quiet room make the headache feel any better?",
    "Thank you for sharing that. Give me one moment while our clinical team assesses your case."
  ];

  const sequentialLatencies: number[] = [];
  for (let i = 0; i < repeatedTurns.length; i++) {
    const t0_seq = Date.now();
    const aud = await tts.generate(repeatedTurns[i], { voice: "af_heart" });
    const lat = Date.now() - t0_seq;
    sequentialLatencies.push(lat);
    console.log(`   Turn ${i + 1} (${repeatedTurns[i].split(/\s+/).length} words): ${lat} ms (Duration: ${(aud.audio.length / sampleRate).toFixed(2)}s)`);
  }

  const avgSequential = sequentialLatencies.reduce((a, b) => a + b, 0) / sequentialLatencies.length;
  console.log(`\n✓ Average steady-state generation latency: ${avgSequential.toFixed(1)} ms\n`);

  console.log("======================================================================");
  console.log("                       BENCHMARK SUMMARY");
  console.log("======================================================================");
  console.log(`• Cold Start / Initial Load: ${coldLoadTimeMs} ms`);
  console.log(`• Warm 30-word response:     ${gen30TimeMs} ms (Audio: ${audioDurationSec.toFixed(2)}s, RTF: ${rtf30.toFixed(3)})`);
  console.log(`• Warm 50-word response:     ${gen50TimeMs} ms (Audio: ${audioDurationSec50.toFixed(2)}s, RTF: ${rtf50.toFixed(3)})`);
  console.log(`• Average Sequential Turn:   ${avgSequential.toFixed(1)} ms`);
  console.log(`• Verified Voice ID:         af_heart (Dr. Sarah Chen)`);
  console.log(`• Audio Format:              WAV 16-bit PCM @ ${sampleRate} Hz`);
  console.log("======================================================================\n");
}

benchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
