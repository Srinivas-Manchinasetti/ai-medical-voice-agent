import { SpeechFeatures } from "../agents/schemas";

export interface RawAudioAnalysisInput {
  durationMs?: number;
  pauseCount?: number;
  totalPauseDurationMs?: number;
  wordCount?: number;
  energyVariance?: number;
  pitchVariance?: number;
  transcriptText?: string;
}

/**
 * PARALINGUISTIC & SPEECH FEATURE EXTRACTION ENGINE
 * 
 * Invariant: Audio features are measured physiological signals and observed speech characteristics;
 * they are treated as supporting evidence, NOT standalone autonomous diagnostic authorities.
 * 
 * Pipeline: Audio Telemetry -> Measured Features -> Observed Speech Characteristics -> Possible Signal
 */
export function extractSpeechFeatures(input: RawAudioAnalysisInput): SpeechFeatures {
  const text = (input.transcriptText || "").trim();
  const wordCount = input.wordCount || (text ? text.split(/\s+/).length : 1);
  const durationMs = input.durationMs || Math.max(1000, wordCount * 450);

  // 1. Measured Features
  const pauseCount = input.pauseCount !== undefined ? input.pauseCount : (text.match(/[,\.\.\?\!\-]/g) || []).length;
  const totalPauseDurationMs = input.totalPauseDurationMs !== undefined ? input.totalPauseDurationMs : pauseCount * 420;
  
  const speech_pause_ratio = Math.min(1.0, Math.max(0.0, Number((totalPauseDurationMs / durationMs).toFixed(2))));
  const mean_pause_duration_ms = pauseCount > 0 ? Math.round(totalPauseDurationMs / pauseCount) : 250;
  
  const minutes = durationMs / 60000;
  const speech_rate_wpm = minutes > 0 ? Math.round(wordCount / minutes) : 120;
  
  const voice_energy_variability = input.energyVariance !== undefined ? Number(input.energyVariance.toFixed(2)) : 0.14;
  const pitch_variability = input.pitchVariance !== undefined ? Number(input.pitchVariance.toFixed(2)) : 0.16;

  // 2. Observed Speech Characteristics
  const observations: string[] = [];
  
  if (speech_pause_ratio > 0.35) {
    observations.push("Frequent conversational pauses with elevated pause-to-speech ratio");
  }
  if (mean_pause_duration_ms > 750) {
    observations.push("Prolonged inter-phrase latency / pauses exceeding 750ms");
  }
  if (speech_rate_wpm < 85) {
    observations.push("Substantially reduced speech rate (< 85 WPM)");
  } else if (speech_rate_wpm > 180) {
    observations.push("Rapid, pressured speech cadence (> 180 WPM)");
  }
  if (voice_energy_variability > 0.30 || pitch_variability > 0.30) {
    observations.push("Acoustic energy volatility and pitch instability noted");
  }

  // Check text indicators of respiratory pauses
  const hasGaspingWords = /\b(gasp|pant|cannot\s+breathe|hard\s+to\s+breathe|out\s+of\s+breath)\b/i.test(text);
  if (hasGaspingWords) {
    observations.push("Patient explicitly references respiratory difficulty");
  }

  // 3. Clinical Relevance Signal (Carefully bounded, not overclaimed)
  let respiratory_distress_signal: "unlikely" | "possible" | "probable" | "severe" = "unlikely";
  let vocal_instability_signal: "none" | "mild" | "pronounced" = "none";
  let confidence = 0.55;

  if (speech_pause_ratio > 0.45 && (hasGaspingWords || speech_rate_wpm < 70)) {
    respiratory_distress_signal = "severe";
    confidence = 0.88;
  } else if (speech_pause_ratio > 0.32 || hasGaspingWords) {
    respiratory_distress_signal = "probable";
    confidence = 0.74;
  } else if (speech_pause_ratio > 0.22) {
    respiratory_distress_signal = "possible";
    confidence = 0.62;
  }

  if (pitch_variability > 0.35 || voice_energy_variability > 0.35) {
    vocal_instability_signal = "pronounced";
  } else if (pitch_variability > 0.22 || voice_energy_variability > 0.22) {
    vocal_instability_signal = "mild";
  }

  return {
    speech_pause_ratio,
    mean_pause_duration_ms,
    speech_rate_wpm,
    voice_energy_variability,
    pitch_variability,
    observations,
    clinical_relevance: {
      respiratory_distress_signal,
      vocal_instability_signal,
      confidence
    }
  };
}
