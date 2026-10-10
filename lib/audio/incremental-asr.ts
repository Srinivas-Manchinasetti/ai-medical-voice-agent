/**
 * INCREMENTAL SPEECH RECOGNITION & PARTIAL TRANSCRIPT EPISTEMIC MANAGER
 *
 * Phase 2 Architectural Delivery:
 * 1. Stream microphone audio: short PCM chunks (50–200ms) with Voice Activity Detection (VAD).
 * 2. Incremental transcription: updates transcript and tracks stability/uncertainty.
 * 3. Dual-Track Epistemic Routing:
 *    - Track 1 (Emergency Screen): Fail-safe! Evaluates provisional hypotheses immediately for life-threat red flags.
 *    - Track 2 (Clinical Slot Promotion): Conservative! Requires hypothesis stability (>= 0.8) or finalization
 *      before promoting symptoms into confirmed clinical state.
 * 4. Hypothesis Revision Handling: Detects and accommodates Whisper chunk-based revisions.
 */

import { evaluateUniversalRedFlags, RedFlagResult } from "../triage/universal-red-flags";

export interface VadConfig {
  sampleRate: number;              // default 16000 or 24000
  frameDurationMs: number;         // default 100ms
  energyThreshold: number;         // default 0.015 RMS
  speechOnsetFrames: number;       // default 2 consecutive frames to trigger speech
  silenceHangoverFrames: number;   // default 4 consecutive frames (400ms) to trigger speech end
}

export interface VadFrameResult {
  isSpeech: boolean;
  rmsEnergy: number;
  speechState: "silence" | "speech_start" | "in_speech" | "speech_pause" | "speech_end";
  consecutiveSpeechFrames: number;
  consecutiveSilenceFrames: number;
}

export interface TranscriptHypothesis {
  text: string;
  stability: number;       // 0.0 (highly provisional) to 1.0 (confirmed/stable)
  isFinal: boolean;
  timestampMs: number;
  stablePrefix: string;
  provisionalSuffix: string;
  wordCount: number;
}

export interface ASRStreamEvent {
  type: "vad_speech_start" | "vad_speech_end" | "transcript_provisional" | "transcript_final" | "emergency_red_flag";
  timestampMs: number;
  payload: any;
}

export type ASREventListener = (event: ASRStreamEvent) => void;

export class IncrementalSpeechRecognizer {
  private config: VadConfig;
  private vadState: "silence" | "in_speech" = "silence";
  private consecutiveSpeechFrames = 0;
  private consecutiveSilenceFrames = 0;
  private totalPcmBytesReceived = 0;

  private currentHypothesis: TranscriptHypothesis = {
    text: "",
    stability: 0,
    isFinal: false,
    timestampMs: 0,
    stablePrefix: "",
    provisionalSuffix: "",
    wordCount: 0,
  };

  private hypothesisHistory: string[] = [];
  private eventListeners: ASREventListener[] = [];
  private mockTranscriptionHandler?: (audioDurationSec: number, chunkCount: number) => string;
  private whisperChunkTranscriber?: (audioBuffer: Buffer, durationSec: number) => Promise<string> | string;
  private speechAudioBuffer: Buffer[] = [];

  constructor(config?: Partial<VadConfig>) {
    this.config = {
      sampleRate: 16000,
      frameDurationMs: 100,
      energyThreshold: 0.015,
      speechOnsetFrames: 2,
      silenceHangoverFrames: 4,
      ...config,
    };
  }

  public addListener(listener: ASREventListener): void {
    this.eventListeners.push(listener);
  }

  public removeListener(listener: ASREventListener): void {
    this.eventListeners = this.eventListeners.filter((l) => l !== listener);
  }

  private emit(event: ASRStreamEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[Incremental ASR Event Error]:", err);
      }
    }
  }

  /**
   * Set custom transcription generator (e.g. for deterministic testing or Whisper bridging)
   */
  public setTranscriptionHandler(handler: (audioDurationSec: number, chunkCount: number) => string): void {
    this.mockTranscriptionHandler = handler;
  }

  /**
   * Set chunk-based Whisper transcriber (handles chunked audio inference)
   */
  public setWhisperChunkTranscriber(transcriber: (audioBuffer: Buffer, durationSec: number) => Promise<string> | string): void {
    this.whisperChunkTranscriber = transcriber;
  }

  public getSpeechAudioBuffer(): Buffer[] {
    return [...this.speechAudioBuffer];
  }

  public getCombinedSpeechPcmBuffer(): Buffer {
    return Buffer.concat(this.speechAudioBuffer);
  }

  public getSpeechDurationSec(): number {
    const totalBytes = this.speechAudioBuffer.reduce((acc, b) => acc + b.length, 0);
    return totalBytes / (this.config.sampleRate * 2);
  }

  /**
   * Computes Root-Mean-Square (RMS) signal energy of a PCM buffer
   */
  public static calculateRms(pcmBuffer: Buffer | Int16Array | Float32Array): number {
    let sumSquares = 0;
    let sampleCount = 0;

    if (pcmBuffer instanceof Buffer) {
      sampleCount = Math.floor(pcmBuffer.length / 2);
      for (let i = 0; i < pcmBuffer.length; i += 2) {
        const sample = pcmBuffer.readInt16LE(i) / 32768.0;
        sumSquares += sample * sample;
      }
    } else if (pcmBuffer instanceof Int16Array) {
      sampleCount = pcmBuffer.length;
      for (let i = 0; i < sampleCount; i++) {
        const sample = pcmBuffer[i] / 32768.0;
        sumSquares += sample * sample;
      }
    } else {
      sampleCount = pcmBuffer.length;
      for (let i = 0; i < sampleCount; i++) {
        sumSquares += pcmBuffer[i] * pcmBuffer[i];
      }
    }

    if (sampleCount === 0) return 0;
    return Math.sqrt(sumSquares / sampleCount);
  }

  /**
   * Process a single incoming PCM audio chunk (50–200ms)
   */
  public processPcmChunk(chunk: Buffer | Int16Array | Float32Array, simulatedTranscript?: string): {
    vad: VadFrameResult;
    hypothesis: TranscriptHypothesis;
    emergencyCheck: RedFlagResult | null;
  } {
    const rms = IncrementalSpeechRecognizer.calculateRms(chunk);
    const isSpeechFrame = rms >= this.config.energyThreshold;
    const now = Date.now();
    this.totalPcmBytesReceived += chunk instanceof Buffer ? chunk.length : chunk.byteLength;

    let speechState: VadFrameResult["speechState"] = "silence";

    if (isSpeechFrame) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;

      if (this.vadState === "silence") {
        if (this.consecutiveSpeechFrames >= this.config.speechOnsetFrames) {
          this.vadState = "in_speech";
          speechState = "speech_start";
          this.emit({ type: "vad_speech_start", timestampMs: now, payload: { rms } });
        }
      } else {
        speechState = "in_speech";
      }
    } else {
      this.consecutiveSilenceFrames++;
      this.consecutiveSpeechFrames = 0;

      if (this.vadState === "in_speech") {
        if (this.consecutiveSilenceFrames >= this.config.silenceHangoverFrames) {
          this.vadState = "silence";
          speechState = "speech_end";
          this.emit({ type: "vad_speech_end", timestampMs: now, payload: { rms } });
        } else {
          speechState = "speech_pause";
        }
      } else {
        speechState = "silence";
      }
    }

    const vad: VadFrameResult = {
      isSpeech: isSpeechFrame,
      rmsEnergy: rms,
      speechState,
      consecutiveSpeechFrames: this.consecutiveSpeechFrames,
      consecutiveSilenceFrames: this.consecutiveSilenceFrames,
    };

    if (isSpeechFrame || this.vadState === "in_speech") {
      const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk.buffer);
      this.speechAudioBuffer.push(buf);
    }

    // Update transcript hypothesis
    let candidateText = simulatedTranscript;
    if (candidateText === undefined && this.mockTranscriptionHandler) {
      const audioDurationSec = this.totalPcmBytesReceived / (this.config.sampleRate * 2);
      candidateText = this.mockTranscriptionHandler(audioDurationSec, this.consecutiveSpeechFrames);
    }

    if (candidateText !== undefined) {
      this.updateHypothesis(candidateText, speechState === "speech_end");
    }

    // Fail-Safe Track 1: Emergency Pre-screen on provisional text
    let emergencyCheck: RedFlagResult | null = null;
    if (this.currentHypothesis.text.trim()) {
      emergencyCheck = evaluateUniversalRedFlags({
        rawText: this.currentHypothesis.text,
      });

      if (emergencyCheck.level === "EMERGENCY_NOW") {
        this.emit({
          type: "emergency_red_flag",
          timestampMs: now,
          payload: {
            redFlag: emergencyCheck,
            transcript: this.currentHypothesis.text,
            isProvisional: !this.currentHypothesis.isFinal,
          },
        });
      }
    }

    return { vad, hypothesis: this.currentHypothesis, emergencyCheck };
  }

  /**
   * Update the internal transcript hypothesis with stability tracking
   */
  public updateHypothesis(rawText: string, isFinal: boolean): TranscriptHypothesis {
    const clean = rawText.trim().replace(/\s+/g, " ");
    const words = clean ? clean.split(" ") : [];
    const now = Date.now();

    // Stability calculation:
    // Finalized utterances are 1.0.
    // In-flight transcripts calculate overlap with recent hypothesis history.
    let stability = 0.5;
    if (isFinal) {
      stability = 1.0;
    } else {
      const prev = this.currentHypothesis.text;
      if (prev && clean.startsWith(prev)) {
        // Monotonically growing hypothesis has higher stability
        stability = Math.min(0.95, 0.6 + (words.length * 0.05));
      } else if (prev && clean !== prev) {
        // ASR revised previous words -> temporary dip in stability
        stability = 0.4;
      }
    }

    // Stable prefix vs provisional suffix
    // Typically the last 1–2 words of an in-flight ASR stream are provisional
    let stablePrefix = clean;
    let provisionalSuffix = "";

    if (!isFinal && words.length > 2) {
      stablePrefix = words.slice(0, words.length - 2).join(" ");
      provisionalSuffix = words.slice(words.length - 2).join(" ");
    } else if (!isFinal) {
      stablePrefix = "";
      provisionalSuffix = clean;
    }

    this.currentHypothesis = {
      text: clean,
      stability,
      isFinal,
      timestampMs: now,
      stablePrefix,
      provisionalSuffix,
      wordCount: words.length,
    };

    this.hypothesisHistory.push(clean);

    this.emit({
      type: isFinal ? "transcript_final" : "transcript_provisional",
      timestampMs: now,
      payload: { ...this.currentHypothesis },
    });

    return this.currentHypothesis;
  }

  public getCurrentHypothesis(): TranscriptHypothesis {
    return this.currentHypothesis;
  }

  /**
   * Track 2: Clinical Slot Promotion Gate
   * Requires stability >= threshold (default 0.8) or isFinal === true.
   */
  public isSafeForClinicalPromotion(threshold = 0.8): boolean {
    return this.currentHypothesis.isFinal || this.currentHypothesis.stability >= threshold;
  }

  public reset(): void {
    this.vadState = "silence";
    this.consecutiveSpeechFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.totalPcmBytesReceived = 0;
    this.currentHypothesis = {
      text: "",
      stability: 0,
      isFinal: false,
      timestampMs: 0,
      stablePrefix: "",
      provisionalSuffix: "",
      wordCount: 0,
    };
    this.speechAudioBuffer = [];
    this.hypothesisHistory = [];
  }
}
