import { KokoroTTS } from "kokoro-js";
import * as fs from "fs";
import * as path from "path";
import { floatTo16BitPCM } from "../lib/audio/kokoro-service";

interface QualityReport {
  dtype: string;
  testCase: string;
  latencyMs: number;
  durationSec: number;
  rtf: number;
  rms: number;
  peak: number;
  silentSamplePercent: number;
  hasClipping: boolean;
  wavSizeBytes: number;
}

const CLINICAL_PHRASES = [
  {
    id: "short-triage",
    phrase: "Do you have a fever?",
  },
  {
    id: "medical-entities",
    phrase: "Have you experienced any chest pressure, tachycardia, or acute dyspnea?",
  },
  {
    id: "pharmacology-terms",
    phrase: "You may consider acetaminophen or ibuprofen, but seek emergency evaluation if you have difficulty swallowing.",
  },
  {
    id: "doctor-identity",
    phrase: "I'm Dr. Sarah Chen, lead physician for MedVoice AI. I work alongside our clinical board to evaluate your symptoms safely.",
  },
];

function analyzePCM(samples: Float32Array): { rms: number; peak: number; silentSamplePercent: number; hasClipping: boolean } {
  let sumSq = 0;
  let peak = 0;
  let silentCount = 0;
  let clipCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = Math.abs(samples[i]);
    if (s > peak) peak = s;
    if (s > 0.999) clipCount++;
    if (s < 0.001) silentCount++;
    sumSq += s * s;
  }

  const rms = Math.sqrt(sumSq / samples.length);
  const silentSamplePercent = (silentCount / samples.length) * 100;

  return {
    rms: Math.round(rms * 1000) / 1000,
    peak: Math.round(peak * 1000) / 1000,
    silentSamplePercent: Math.round(silentSamplePercent * 10) / 10,
    hasClipping: clipCount > 10,
  };
}

async function runQualityEvaluation() {
  console.log("================================================================================");
  console.log("        KOKORO CLINICAL PRONUNCIATION & AUDIO QUALITY EVALUATION               ");
  console.log("================================================================================\n");

  const dtypes: Array<"q4" | "q8" | "fp32"> = ["q4", "q8", "fp32"];
  const reports: QualityReport[] = [];

  const outDir = path.join(process.cwd(), "scratch", "audio-quality-eval");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const dtype of dtypes) {
    console.log(`\nEvaluating dtype: '${dtype}' on CPU...`);
    const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype,
      device: "cpu",
    });

    for (const item of CLINICAL_PHRASES) {
      const t0 = performance.now();
      const rawAudio = await tts.generate(item.phrase, { voice: "af_sarah" as any, speed: 0.96 });
      const latencyMs = Math.round(performance.now() - t0);
      const sampleRate = rawAudio.sampling_rate || 24000;
      const durationSec = Math.round((rawAudio.audio.length / sampleRate) * 100) / 100;
      const rtf = Math.round((latencyMs / (durationSec * 1000)) * 100) / 100;

      const metrics = analyzePCM(rawAudio.audio);
      const wavBuffer = floatTo16BitPCM(rawAudio.audio, sampleRate);

      const filePath = path.join(outDir, `${dtype}_${item.id}.wav`);
      fs.writeFileSync(filePath, wavBuffer);

      reports.push({
        dtype,
        testCase: item.id,
        latencyMs,
        durationSec,
        rtf,
        rms: metrics.rms,
        peak: metrics.peak,
        silentSamplePercent: metrics.silentSamplePercent,
        hasClipping: metrics.hasClipping,
        wavSizeBytes: wavBuffer.length,
      });

      console.log(`  ✓ [${dtype}] ${item.id}: ${latencyMs}ms | Dur: ${durationSec}s | RTF: ${rtf} | RMS: ${metrics.rms} | Peak: ${metrics.peak}`);
    }
  }

  console.log("\n================================================================================");
  console.log("                        QUALITY & PRONUNCIATION SUMMARY                          ");
  console.log("================================================================================\n");

  console.table(
    reports.map((r) => ({
      DType: r.dtype,
      TestCase: r.testCase,
      "Latency (ms)": r.latencyMs,
      "Dur (s)": r.durationSec,
      RTF: r.rtf,
      RMS: r.rms,
      Peak: r.peak,
      "Silent %": `${r.silentSamplePercent}%`,
      Clipping: r.hasClipping ? "YES" : "No",
    }))
  );

  console.log("\nWAV files saved to scratch/audio-quality-eval for acoustic inspection.");
}

runQualityEvaluation().catch(console.error);
