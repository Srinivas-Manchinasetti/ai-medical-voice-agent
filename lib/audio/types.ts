import { DoctorVoiceProfile, TTSProviderType } from "@/config/doctors";

export interface TTSAudioResult {
  buffer: Buffer;
  contentType: string; // "audio/wav" | "audio/mpeg"
  sampleRate?: number;
  durationSec: number;
  latencyMs: number;
  voice: string;
  provider: TTSProviderType;
  locale: string;
}

export interface TTSFallbackSignal {
  fallbackRequired: true;
  engine: "Browser Fallback";
  provider: TTSProviderType;
  targetVoice: string;
  locale: string;
  accent: "american" | "british" | "indian";
  doctorName?: string;
  reason: string;
}

export type TTSDispatchResult =
  | { success: true; audio: TTSAudioResult }
  | { success: false; fallback: TTSFallbackSignal };

export interface ITTSProvider {
  readonly name: TTSProviderType;
  isAvailable(): boolean;
  synthesize(text: string, profile: DoctorVoiceProfile): Promise<TTSAudioResult>;
}
