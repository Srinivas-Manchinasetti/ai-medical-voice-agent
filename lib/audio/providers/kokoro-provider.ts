import { DoctorVoiceProfile } from "@/config/doctors";
import { kokoroService } from "../kokoro-service";
import { ITTSProvider, TTSAudioResult } from "../types";

export class KokoroTTSProvider implements ITTSProvider {
  public readonly name = "kokoro" as const;

  public isAvailable(): boolean {
    return true; // Kokoro is bundled locally with ONNX weights
  }

  public async synthesize(text: string, profile: DoctorVoiceProfile): Promise<TTSAudioResult> {
    const result = await kokoroService.synthesize(text, {
      doctorId: profile.doctorId,
      speed: profile.speed,
    });

    return {
      buffer: result.buffer,
      contentType: "audio/wav",
      sampleRate: result.sampleRate,
      durationSec: result.durationSec,
      latencyMs: result.latencyMs,
      voice: result.voice,
      provider: "kokoro",
      locale: profile.locale,
    };
  }
}
