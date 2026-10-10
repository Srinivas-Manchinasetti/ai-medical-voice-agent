import {
  DOCTOR_VOICE_PROFILES,
  DoctorVoiceProfile,
  TTSProviderType,
} from "@/config/doctors";
import { AzureTTSProvider } from "./providers/azure-provider";
import { KokoroTTSProvider } from "./providers/kokoro-provider";
import { SystemVoiceTTSProvider } from "./providers/system-provider";
import { emergencyAudioCache, EmergencyPromptResult } from "./emergency-audio-cache";
import { ITTSProvider, TTSAudioResult, TTSDispatchResult } from "./types";

class TTSDispatcher {
  private providers: Map<TTSProviderType, ITTSProvider> = new Map();

  constructor() {
    this.registerProvider(new KokoroTTSProvider());
    this.registerProvider(new AzureTTSProvider());
    this.registerProvider(new SystemVoiceTTSProvider());
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

  /**
   * Tiered TTS Dispatcher:
   * - Tier 0: Emergency Directives -> EmergencyAudioCache (< 5ms retrieval)
   * - Tier 1: System Voice / Client Speech (Host OS / Browser) -> Low-latency (< 20ms)
   * - Tier 2: Kokoro Neural Voice on CPU -> Server-side high-fidelity fallback
   */
  public async dispatchTiered(
    text: string,
    options?: {
      doctorId?: string;
      isEmergency?: boolean;
      primaryEmergencyNumber?: string;
      ambulanceNumber?: string;
      preferSystemVoice?: boolean;
      speedOverride?: number;
    }
  ): Promise<TTSDispatchResult> {
    const doctorId = options?.doctorId || "dr-sarah-chen";

    // Tier 0: Emergency fast-path (sub-10ms retrieval from pre-generated cache)
    if (options?.isEmergency) {
      const emergencyPrompt = emergencyAudioCache.getEmergencyPrompt({
        doctorId,
        primaryEmergencyNumber: options.primaryEmergencyNumber,
        ambulanceNumber: options.ambulanceNumber,
      });

      return {
        success: true,
        audio: {
          buffer: emergencyPrompt.buffer,
          contentType: emergencyPrompt.contentType,
          sampleRate: emergencyPrompt.sampleRate,
          durationSec: emergencyPrompt.durationSec,
          latencyMs: emergencyPrompt.retrievalLatencyMs,
          voice: resolveAuthoritativeVoice(doctorId),
          provider: "kokoro",
          locale: "en-IN",
        },
      };
    }

    // Tier 1: System Voice preferred
    if (options?.preferSystemVoice) {
      const sysProvider = this.getProvider("system-voice");
      if (sysProvider && sysProvider.isAvailable()) {
        const profile = this.resolveProfile(doctorId);
        try {
          const audio = await sysProvider.synthesize(text, profile);
          return { success: true, audio };
        } catch (err: any) {
          console.warn("[TTS Dispatcher] System voice synthesis failed, falling back to Kokoro CPU:", err?.message);
        }
      }
    }

    // Tier 2: Default profile synthesis (Kokoro CPU / Azure)
    return this.dispatch(text, doctorId, options?.speedOverride);
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
