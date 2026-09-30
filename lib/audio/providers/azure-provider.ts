import { DoctorVoiceProfile } from "@/config/doctors";
import { ITTSProvider, TTSAudioResult } from "../types";

export class AzureTTSProvider implements ITTSProvider {
  public readonly name = "azure-speech" as const;

  public isAvailable(): boolean {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    return Boolean(key && region && key.trim() !== "" && region.trim() !== "");
  }

  public async synthesize(text: string, profile: DoctorVoiceProfile): Promise<TTSAudioResult> {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || "eastus";

    if (!key) {
      throw new Error("AZURE_SPEECH_KEY is not configured in environment variables.");
    }

    const t0 = Date.now();
    const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    const escapedText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    const ratePercent = Math.round((profile.speed - 1) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${profile.locale}'>
  <voice name='${profile.voiceId}'>
    <prosody rate='${rateStr}'>
      ${escapedText}
    </prosody>
  </voice>
</speak>`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm",
        "User-Agent": "MedVoiceAgent",
      },
      body: ssml,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Azure Speech API failed (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const latencyMs = Date.now() - t0;
    // For 24kHz 16-bit mono PCM in WAV, byte rate is 48000 bytes/sec
    const durationSec = Math.max(0.5, (buffer.length - 44) / 48000);

    return {
      buffer,
      contentType: "audio/wav",
      sampleRate: 24000,
      durationSec,
      latencyMs,
      voice: profile.voiceId,
      provider: "azure-speech",
      locale: profile.locale,
    };
  }
}
