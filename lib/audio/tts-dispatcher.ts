import {
  DOCTOR_VOICE_PROFILES,
  DoctorVoiceProfile,
  TTSProviderType,
} from "@/config/doctors";
import { AzureTTSProvider } from "./providers/azure-provider";
import { KokoroTTSProvider } from "./providers/kokoro-provider";
import { ITTSProvider, TTSDispatchResult } from "./types";

class TTSDispatcher {
  private providers: Map<TTSProviderType, ITTSProvider> = new Map();

  constructor() {
    this.registerProvider(new KokoroTTSProvider());
    this.registerProvider(new AzureTTSProvider());
  }

  public registerProvider(provider: ITTSProvider): void {
    this.providers.set(provider.name, provider);
  }

  public getProvider(name: TTSProviderType): ITTSProvider | undefined {
    return this.providers.get(name);
  }

  public resolveProfile(doctorId?: string): DoctorVoiceProfile {
    if (doctorId && DOCTOR_VOICE_PROFILES[doctorId]) {
      return DOCTOR_VOICE_PROFILES[doctorId];
    }
    return DOCTOR_VOICE_PROFILES["dr-sarah-chen"];
  }

  public async dispatch(
    text: string,
    doctorId?: string,
    speedOverride?: number
  ): Promise<TTSDispatchResult> {
    const profile = this.resolveProfile(doctorId);
    const activeProfile: DoctorVoiceProfile = {
      ...profile,
      speed: speedOverride && speedOverride > 0 ? speedOverride : profile.speed,
    };

    const provider = this.getProvider(activeProfile.provider);

    // 1. Check if provider is registered and has necessary runtime dependencies/credentials
    if (!provider || !provider.isAvailable()) {
      const reason = !provider
        ? `TTS Provider '${activeProfile.provider}' is not registered.`
        : `Provider '${activeProfile.provider}' credentials not found in environment (Development mode active).`;

      console.warn(`[TTS Dispatcher Fallback] ${reason} Requesting client development fallback for doctor ${activeProfile.doctorId}.`);

      return {
        success: false,
        fallback: {
          fallbackRequired: true,
          engine: "Browser Fallback",
          provider: activeProfile.provider,
          targetVoice: activeProfile.voiceId,
          locale: activeProfile.locale,
          accent: activeProfile.accent,
          doctorName: activeProfile.doctorId,
          reason,
        },
      };
    }

    // 2. Execute synthesis through designated provider
    try {
      console.log(
        `[TTS Dispatcher] Routing synthesis for ${activeProfile.doctorId} to provider: '${provider.name}' (Voice: ${activeProfile.voiceId}, Locale: ${activeProfile.locale})`
      );

      const audioResult = await provider.synthesize(text, activeProfile);
      return { success: true, audio: audioResult };
    } catch (err: any) {
      console.error(
        `[TTS Dispatcher Error] Provider '${provider.name}' failed for doctor ${activeProfile.doctorId}:`,
        err?.message || err
      );

      return {
        success: false,
        fallback: {
          fallbackRequired: true,
          engine: "Browser Fallback",
          provider: activeProfile.provider,
          targetVoice: activeProfile.voiceId,
          locale: activeProfile.locale,
          accent: activeProfile.accent,
          doctorName: activeProfile.doctorId,
          reason: `Provider execution failed: ${err?.message || "Unknown error"}`,
        },
      };
    }
  }

  public async warmup(doctorId?: string): Promise<{ warm: boolean; latencyMs: number }> {
    const profile = this.resolveProfile(doctorId);
    const provider = this.getProvider(profile.provider);
    if (provider && provider.warmup) {
      return provider.warmup(profile);
    }
    return { warm: true, latencyMs: 0 };
  }
}

export const ttsDispatcher = new TTSDispatcher();

export function resolveAuthoritativeVoice(doctorId?: string): string {
  const profile = ttsDispatcher.resolveProfile(doctorId);
  return profile.voiceId;
}

export function resolveAuthoritativeSpeed(doctorId?: string): number {
  const profile = ttsDispatcher.resolveProfile(doctorId);
  return profile.speed;
}
