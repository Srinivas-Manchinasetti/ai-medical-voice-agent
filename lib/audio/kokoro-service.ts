import { KokoroTTS } from "kokoro-js";

/**
 * Deterministic Doctor Profile to Kokoro Voice Mapping
 * Primary Invariant:
 * Dr. Sarah Chen is the SOLE audible patient-facing clinician voice (af_heart).
 */
export const DOCTOR_KOKORO_VOICES: Record<string, string> = {
  "dr-sarah-chen": "af_heart", // Empathetic, clear, warm female voice (Grade A)
  "dr-marcus-vance": "am_michael", // Authoritative, focused male cardiologist
  "dr-elena-rostova": "af_bella", // Gentle, compassionate pediatrician
  "dr-arthur-pendelton": "bm_george", // Methodical British neurologist
  "dr-priya-patel": "af_nicole", // Crisp, friendly dermatologist
};

export const DEFAULT_PATIENT_FACING_VOICE = "af_heart";

export interface SynthesisResult {
  buffer: Buffer;
  sampleRate: number;
  durationSec: number;
  latencyMs: number;
  voice: string;
}

/**
 * Convert Float32Array PCM samples to a standard 16-bit PCM WAV Buffer
 */
export function floatTo16BitPCM(float32Array: Float32Array, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = float32Array.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk Descriptor
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // "fmt " Sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample (16-bit)

  // "data" Sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, offset);
    offset += 2;
  }

  return buffer;
}

/**
 * Server-Side Kokoro TTS Model Singleton
 */
class KokoroService {
  private ttsInstance: KokoroTTS | null = null;
  private loadingPromise: Promise<KokoroTTS> | null = null;

  public async getModel(): Promise<KokoroTTS> {
    if (this.ttsInstance) {
      return this.ttsInstance;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    console.log("[Kokoro TTS Singleton] Initializing Kokoro-82M model in-memory cache...");
    const t0 = Date.now();

    this.loadingPromise = KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
      device: "cpu",
    }).then((model) => {
      this.ttsInstance = model;
      console.log(`[Kokoro TTS Singleton] Kokoro-82M model ready in ${Date.now() - t0}ms`);
      return model;
    });

    return this.loadingPromise;
  }

  /**
   * Synthesize text into a standard 24kHz 16-bit WAV buffer
   */
  public async synthesize(
    text: string,
    options: { voice?: string; doctorId?: string; speed?: number } = {}
  ): Promise<SynthesisResult> {
    // 1. Clean markdown and non-spoken artifacts
    const cleanText = text
      .replace(/[*_#`\[\]]/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) {
      throw new Error("Text is empty after sanitization.");
    }

    // 2. Deterministic Voice Selection
    // Primary invariant: Patient-facing clinician is Dr. Sarah Chen (af_heart)
    let selectedVoice = DEFAULT_PATIENT_FACING_VOICE;
    if (options.voice) {
      selectedVoice = options.voice;
    } else if (options.doctorId && DOCTOR_KOKORO_VOICES[options.doctorId]) {
      selectedVoice = DOCTOR_KOKORO_VOICES[options.doctorId];
    }

    const tts = await this.getModel();
    const t0 = Date.now();

    console.log(
      `[Kokoro TTS Synthesis] Synthesizing ${cleanText.split(/\s+/).length} words for doctor: ${
        options.doctorId || "dr-sarah-chen"
      } | Voice: ${selectedVoice}`
    );

    const rawAudio = await tts.generate(cleanText, {
      voice: selectedVoice as any,
      speed: options.speed || 1.0,
    });

    const latencyMs = Date.now() - t0;
    const sampleRate = rawAudio.sampling_rate || 24000;
    const durationSec = rawAudio.audio.length / sampleRate;

    console.log(
      `[Kokoro TTS Success] Generated ${durationSec.toFixed(2)}s audio in ${latencyMs}ms (RTF: ${(
        latencyMs /
        (durationSec * 1000)
      ).toFixed(3)})`
    );

    const wavBuffer = floatTo16BitPCM(rawAudio.audio, sampleRate);

    return {
      buffer: wavBuffer,
      sampleRate,
      durationSec,
      latencyMs,
      voice: selectedVoice,
    };
  }
}

export const kokoroService = new KokoroService();
