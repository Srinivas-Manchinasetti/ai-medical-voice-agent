/**
 * STREAMING VOICE PIPELINE & LATENCY PROFILING ENGINE
 *
 * Phase 2 Architectural Delivery:
 * Implements the 6-stage end-to-end streaming audio pipeline with mandatory chunk-level safety gating:
 *
 * Stage 1: Stream microphone audio (PCM chunks + Voice Activity Detection)
 * Stage 2: Incremental transcription (Hypothesis stability & uncertainty tracking)
 * Stage 3: Deterministic emergency screening (Runs independently; preempts conversational flow)
 * Stage 4: Stream LLM candidate text (Clause & sentence buffering)
 * Stage 5: Validate each audio-bound chunk (Safety, provenance, attribution, false reassurance gating)
 * Stage 6: Synthesize & play approved audio (Kokoro TTS + interruptible playback queue)
 *
 * Latency Budgets & Target Profiles:
 * - ASR Target: 300ms
 * - LLM First-Token Target: 400ms
 * - Kokoro TTS Chunk 0 Target: 350ms
 * - Required P95 TTFA Target: < 1,200ms (1.2s)
 * - Required P95 Full-Turn Target: < 2,000ms (2.0s)
 */

import { performance } from "perf_hooks";
import { IncrementalSpeechRecognizer, TranscriptHypothesis } from "./incremental-asr";
import { IncrementalStreamValidator, StreamValidationContext, ChunkValidationResult } from "../ai/stream-validator";
import { kokoroService, SynthesisResult } from "./kokoro-service";
import { splitIntoSpeechChunks } from "./sentence-splitter";
import { evaluateUniversalRedFlags, RedFlagResult } from "../triage/universal-red-flags";

export interface StageTimestamps {
  t_mic_first_chunk?: number;
  t_vad_speech_start?: number;
  t_vad_speech_end?: number;
  t_asr_provisional?: number;
  t_asr_final?: number;
  t_emergency_screen_start?: number;
  t_emergency_screen_end?: number;
  t_emergency_triggered?: number;
  t_llm_start?: number;
  t_llm_first_token?: number;
  t_chunk0_buffered?: number;
  t_chunk0_validated?: number;
  t_chunk0_tts_start?: number;
  t_chunk0_tts_end?: number; // Defines TTFA
  t_turn_complete?: number;   // Defines Full Turn Completion
}

export interface PipelineStageLatencies {
  vadSpeechDurationMs: number;
  asrDurationMs: number;
  emergencyScreenMs: number;
  llmFirstTokenMs: number;
  chunk0BufferingMs: number;
  chunk0ValidationMs: number;
  chunk0TtsMs: number;
  totalTtsMs: number;
  ttfaMs: number;
  fullTurnMs: number;
  audioPlaybackDurationSec: number;
}

export interface StreamingTurnTelemetry {
  timestamps: StageTimestamps;
  latencies: PipelineStageLatencies;
  isEmergency: boolean;
  emergencyPreempted: boolean;
  emergencyDirectivePlayed: boolean;
  emergencyFiredRule?: string;
  transcript: string;
  transcriptStable: boolean;
  chunksEmitted: number;
  chunksApproved: number;
  chunksRejected: number;
  rejectionReason?: string;
  rejectionCategory?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  playbackInterrupted: boolean;
  interruptReason?: string;
  ttsFailure?: boolean;
  ttsError?: string;
  model: string;
}

export interface StreamPipelineOptions {
  doctorId?: string;
  targetSubject?: "self" | "mother" | "child" | "third_party";
  primaryEmergencyNumber?: string;
  ambulanceNumber?: string;
  model?: string;
  tokenStreamSimulator?: (transcript: string) => AsyncIterable<string>;
  ttsSynthesizer?: (text: string, doctorId?: string) => Promise<SynthesisResult>;
}

/**
 * Interruptible Audio Playback Queue
 */
export class AudioPlaybackQueue {
  private queue: Array<{ id: string; buffer: Buffer; durationSec: number; text: string }> = [];
  private isInterrupted: boolean = false;
  private interruptReason: string | null = null;
  private playedBuffers: Buffer[] = [];
  private totalPlayedDurationSec: number = 0;

  public enqueue(item: { id: string; buffer: Buffer; durationSec: number; text: string }): boolean {
    if (this.isInterrupted) {
      return false; // Reject new audio if already interrupted
    }
    this.queue.push(item);
    return true;
  }

  public interrupt(reason: string): void {
    this.isInterrupted = true;
    this.interruptReason = reason;
    this.queue = []; // Immediately drop all pending unplayed audio
  }

  public reset(): void {
    this.queue = [];
    this.isInterrupted = false;
    this.interruptReason = null;
    this.playedBuffers = [];
    this.totalPlayedDurationSec = 0;
  }

  public getStatus(): {
    queueLength: number;
    isInterrupted: boolean;
    interruptReason: string | null;
    totalPlayedDurationSec: number;
  } {
    return {
      queueLength: this.queue.length,
      isInterrupted: this.isInterrupted,
      interruptReason: this.interruptReason,
      totalPlayedDurationSec: this.totalPlayedDurationSec,
    };
  }

  public simulatePlayAll(): { totalDurationSec: number; playedCount: number } {
    let played = 0;
    while (this.queue.length > 0 && !this.isInterrupted) {
      const item = this.queue.shift()!;
      this.playedBuffers.push(item.buffer);
      this.totalPlayedDurationSec += item.durationSec;
      played++;
    }
    return { totalDurationSec: this.totalPlayedDurationSec, playedCount: played };
  }
}

/**
 * Core Streaming Voice Pipeline
 */
export class StreamingVoicePipeline {
  private asr: IncrementalSpeechRecognizer;
  private playbackQueue: AudioPlaybackQueue;
  private options: StreamPipelineOptions;

  constructor(options?: StreamPipelineOptions) {
    this.options = {
      doctorId: "dr-sarah-chen",
      targetSubject: "self",
      primaryEmergencyNumber: "112",
      ambulanceNumber: "108",
      model: "qwen/qwen3.8-27b",
      ...options,
    };
    this.asr = new IncrementalSpeechRecognizer();
    this.playbackQueue = new AudioPlaybackQueue();
  }

  public getPlaybackQueue(): AudioPlaybackQueue {
    return this.playbackQueue;
  }

  public getAsr(): IncrementalSpeechRecognizer {
    return this.asr;
  }

  /**
   * Synthesize audio helper (uses Kokoro singleton or custom mock)
   */
  private async synthesizeAudio(text: string): Promise<SynthesisResult> {
    if (this.options.ttsSynthesizer) {
      return this.options.ttsSynthesizer(text, this.options.doctorId);
    }
    return kokoroService.synthesize(text, { doctorId: this.options.doctorId });
  }

  private midStreamEmergencyReason: string | null = null;

  public signalEmergency(reason: string): void {
    this.midStreamEmergencyReason = reason;
    this.playbackQueue.interrupt(reason);
  }

  public isEmergencyPreempted(): boolean {
    return this.midStreamEmergencyReason !== null;
  }

  /**
   * Executes a full streaming turn with all 6 stages and stage timestamps.
   */
  public async executeStreamingTurn(params: {
    pcmChunks: Buffer[];
    simulatedTranscript: string;
    tokenStream: AsyncIterable<string> | string[];
    onAudioChunkReady?: (chunk: { buffer: Buffer; durationSec: number; text: string; isFirst: boolean }) => void;
    onInterruption?: (reason: string) => void;
    abortSignal?: AbortSignal;
    emergencySignal?: Promise<string>;
    checkMidStreamEmergency?: () => string | null;
  }): Promise<StreamingTurnTelemetry> {
    const timestamps: StageTimestamps = {};
    const t0 = performance.now();
    timestamps.t_mic_first_chunk = t0;

    let emergencyPreempted = false;
    let emergencyDirectivePlayed = false;
    let emergencyFiredRule: string | undefined;
    let isEmergency = false;

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1 & 2: STREAM MICROPHONE AUDIO & INCREMENTAL TRANSCRIPTION
    // ─────────────────────────────────────────────────────────────────────────
    let lastHypothesis: TranscriptHypothesis = this.asr.getCurrentHypothesis();
    let speechDetected = false;

    for (let i = 0; i < params.pcmChunks.length; i++) {
      const chunk = params.pcmChunks[i];
      const isLastChunk = i === params.pcmChunks.length - 1;

      // Incremental simulation of words as chunks arrive
      const words = params.simulatedTranscript.split(" ");
      const wordsForChunk = isLastChunk
        ? params.simulatedTranscript
        : words.slice(0, Math.max(1, Math.min(words.length, Math.floor((i + 1) * (words.length / params.pcmChunks.length))))).join(" ");

      const result = this.asr.processPcmChunk(chunk, wordsForChunk);
      lastHypothesis = result.hypothesis;

      if (!timestamps.t_vad_speech_start && (result.vad.speechState === "speech_start" || result.vad.isSpeech)) {
        timestamps.t_vad_speech_start = performance.now();
        speechDetected = true;
      }
      if (speechDetected && !timestamps.t_asr_provisional && lastHypothesis.text) {
        timestamps.t_asr_provisional = performance.now();
      }

      // ───────────────────────────────────────────────────────────────────────
      // STAGE 3: DETERMINISTIC EMERGENCY SCREENING (FAIL-SAFE PARALLEL)
      // ───────────────────────────────────────────────────────────────────────
      if (result.emergencyCheck && result.emergencyCheck.level === "EMERGENCY_NOW") {
        isEmergency = true;
        emergencyPreempted = true;
        emergencyFiredRule = result.emergencyCheck.firedRules[0]?.ruleId;
        timestamps.t_emergency_triggered = performance.now();
        break; // Immediate preemption!
      }
    }

    if (!timestamps.t_vad_speech_start) {
      timestamps.t_vad_speech_start = performance.now();
    }
    if (!timestamps.t_asr_provisional) {
      timestamps.t_asr_provisional = performance.now();
    }

    timestamps.t_vad_speech_end = performance.now();
    this.asr.updateHypothesis(params.simulatedTranscript, true);
    timestamps.t_asr_final = performance.now();

    // Final emergency screen if not already tripped
    if (!emergencyPreempted) {
      timestamps.t_emergency_screen_start = performance.now();
      const finalRedFlag = evaluateUniversalRedFlags({ rawText: params.simulatedTranscript });
      timestamps.t_emergency_screen_end = performance.now();

      if (finalRedFlag.level === "EMERGENCY_NOW") {
        isEmergency = true;
        emergencyPreempted = true;
        emergencyFiredRule = finalRedFlag.firedRules[0]?.ruleId;
        timestamps.t_emergency_triggered = performance.now();
      }
    }

    const primaryNum = this.options.primaryEmergencyNumber || "112";
    const ambNum = this.options.ambulanceNumber || "108";

    // ─────────────────────────────────────────────────────────────────────────
    // EMERGENCY FAST-PATH PREEMPTION
    // ─────────────────────────────────────────────────────────────────────────
    if (emergencyPreempted) {
      // 1. Cancel / drop any non-urgent playback
      this.playbackQueue.interrupt(`Emergency preempted by universal red-flag rule: ${emergencyFiredRule}`);
      if (params.onInterruption) {
        params.onInterruption(`Emergency preempted by rule ${emergencyFiredRule}`);
      }

      // 2. Synthesize approved emergency directive (Never claim ambulance dispatched!)
      const emergencyDirectiveText = `This is a life-threatening medical emergency. Please call ${primaryNum} or ${ambNum} immediately or proceed to the nearest emergency department right now.`;

      const tEmergencyTtsStart = performance.now();
      timestamps.t_chunk0_tts_start = tEmergencyTtsStart;
      const emAudioResult = await this.synthesizeAudio(emergencyDirectiveText);
      const tEmergencyTtsEnd = performance.now();
      timestamps.t_chunk0_tts_end = tEmergencyTtsEnd;
      timestamps.t_turn_complete = tEmergencyTtsEnd;

      this.playbackQueue.reset();
      this.playbackQueue.enqueue({
        id: "emergency-directive-0",
        buffer: emAudioResult.buffer,
        durationSec: emAudioResult.durationSec,
        text: emergencyDirectiveText,
      });

      if (params.onAudioChunkReady) {
        params.onAudioChunkReady({
          buffer: emAudioResult.buffer,
          durationSec: emAudioResult.durationSec,
          text: emergencyDirectiveText,
          isFirst: true,
        });
      }

      const totalPlayback = this.playbackQueue.simulatePlayAll();

      const latencies: PipelineStageLatencies = {
        vadSpeechDurationMs: Math.round((timestamps.t_vad_speech_end || t0) - (timestamps.t_vad_speech_start || t0)),
        asrDurationMs: Math.round((timestamps.t_asr_final || t0) - (timestamps.t_vad_speech_start || t0)),
        emergencyScreenMs: Math.round((timestamps.t_emergency_triggered || t0) - (timestamps.t_vad_speech_start || t0)),
        llmFirstTokenMs: 0, // Bypassed
        chunk0BufferingMs: 0,
        chunk0ValidationMs: 0,
        chunk0TtsMs: Math.round(tEmergencyTtsEnd - tEmergencyTtsStart),
        totalTtsMs: Math.round(tEmergencyTtsEnd - tEmergencyTtsStart),
        ttfaMs: Math.round(tEmergencyTtsEnd - t0),
        fullTurnMs: Math.round(tEmergencyTtsEnd - t0),
        audioPlaybackDurationSec: totalPlayback.totalDurationSec,
      };

      return {
        timestamps,
        latencies,
        isEmergency: true,
        emergencyPreempted: true,
        emergencyDirectivePlayed: true,
        emergencyFiredRule,
        transcript: params.simulatedTranscript,
        transcriptStable: true,
        chunksEmitted: 1,
        chunksApproved: 1,
        chunksRejected: 0,
        fallbackUsed: false,
        playbackInterrupted: false,
        model: this.options.model || "emergency_bypass",
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 4, 5, 6: TOKEN STREAMING, INCREMENTAL VALIDATION & AUDIO SYNTHESIS
    // ─────────────────────────────────────────────────────────────────────────
    timestamps.t_llm_start = performance.now();
    const validatorContext: StreamValidationContext = {
      patientUtterance: params.simulatedTranscript,
      targetSubject: this.options.targetSubject || "self",
      isEmergency: false,
      primaryEmergencyNumber: primaryNum,
      ambulanceNumber: ambNum,
    };
    const validator = new IncrementalStreamValidator(validatorContext);

    let tokenBuffer = "";
    let chunksEmitted = 0;
    let chunksApproved = 0;
    let chunksRejected = 0;
    let fallbackUsed = false;
    let fallbackReason: string | undefined;
    let rejectionCategory: string | undefined;
    let totalTtsMs = 0;
    let ttsFailure = false;
    let ttsError: string | undefined;

    // Convert array to async iterable if needed
    const tokenIterable: AsyncIterable<string> = Symbol.asyncIterator in params.tokenStream
      ? (params.tokenStream as AsyncIterable<string>)
      : (async function* () {
          for (const token of params.tokenStream as string[]) {
            yield token;
          }
        })();

    try {
      for await (const token of tokenIterable) {
        // 1. Check client disconnect / abort signal
        if (params.abortSignal?.aborted) {
          this.playbackQueue.interrupt("Client aborted / disconnected");
          if (params.onInterruption) {
            params.onInterruption("Client aborted / disconnected");
          }
          break;
        }

        // 2. Check mid-stream emergency signal arriving during generation
        const midReason = this.midStreamEmergencyReason || params.checkMidStreamEmergency?.();
        if (midReason) {
          isEmergency = true;
          emergencyPreempted = true;
          emergencyFiredRule = midReason;
          this.playbackQueue.interrupt(midReason);
          if (params.onInterruption) {
            params.onInterruption(midReason);
          }
          break;
        }

        if (!timestamps.t_llm_first_token) {
          timestamps.t_llm_first_token = performance.now();
        }

        tokenBuffer += token;

        // Check if buffered text forms a sufficiently complete clause or sentence
        const wordCount = tokenBuffer.trim().split(/\s+/).length;
        const hasTerminator = /[.?!]\s*$/.test(tokenBuffer.trim());
        const hasClauseBoundary =
          (chunksEmitted === 0 && wordCount >= 8 && /[,;:]\s*$/.test(tokenBuffer.trim())) ||
          (chunksEmitted > 0 && wordCount >= 16 && /[,;:]\s*$/.test(tokenBuffer.trim()));

        if (hasTerminator || (chunksEmitted === 0 && (hasClauseBoundary || wordCount >= 12)) || (chunksEmitted > 0 && wordCount >= 20)) {
          const candidateChunk = tokenBuffer.trim();
          tokenBuffer = ""; // Reset buffer for next clause
          chunksEmitted++;

          if (chunksEmitted === 1) {
            timestamps.t_chunk0_buffered = performance.now();
          }

          // ─────────────────────────────────────────────────────────────────────
          // STAGE 5: VALIDATE AUDIO-BOUND CHUNK
          // ─────────────────────────────────────────────────────────────────────
          const tValStart = performance.now();
          const valResult = validator.evaluateNextChunk(candidateChunk, false);
          const tValEnd = performance.now();

          if (chunksEmitted === 1) {
            timestamps.t_chunk0_validated = tValEnd;
          }

          if (valResult.isValid && valResult.action === "APPROVE_FOR_SYNTHESIS") {
            chunksApproved++;
            // ───────────────────────────────────────────────────────────────────
            // STAGE 6: SYNTHESIZE APPROVED AUDIO CHUNK
            // ───────────────────────────────────────────────────────────────────
            const tTtsStart = performance.now();
            if (chunksEmitted === 1) {
              timestamps.t_chunk0_tts_start = tTtsStart;
            }

            try {
              const audioRes = await this.synthesizeAudio(valResult.approvedText!);
              const tTtsEnd = performance.now();
              const ttsDuration = Math.round(tTtsEnd - tTtsStart);
              totalTtsMs += ttsDuration;

              if (chunksEmitted === 1) {
                timestamps.t_chunk0_tts_end = tTtsEnd;
              }

              this.playbackQueue.enqueue({
                id: `chunk-${chunksEmitted}`,
                buffer: audioRes.buffer,
                durationSec: audioRes.durationSec,
                text: valResult.approvedText!,
              });

              if (params.onAudioChunkReady) {
                params.onAudioChunkReady({
                  buffer: audioRes.buffer,
                  durationSec: audioRes.durationSec,
                  text: valResult.approvedText!,
                  isFirst: chunksEmitted === 1,
                });
              }
            } catch (synthErr: any) {
              ttsFailure = true;
              ttsError = synthErr.message || "TTS engine error";
              console.warn(`[Streaming Voice Pipeline] TTS synthesis exception on chunk ${chunksEmitted}: ${synthErr.message}`);
              if (chunksEmitted === 1) {
                timestamps.t_chunk0_tts_end = performance.now();
              }
            }
          } else {
            // CHUNK REJECTED BY VALIDATOR: HOLD CHUNK & ENGAGE SAFE FALLBACK!
            chunksRejected++;
            fallbackUsed = true;
            fallbackReason = valResult.reason;
            rejectionCategory = valResult.category;

            console.warn(`[Streaming Validator Intercept] Rejected unsafe chunk: "${candidateChunk}" [Reason: ${valResult.reason}]`);

            // Synthesize approved deterministic fallback
            const fallbackText = valResult.fallbackReply || `Can you tell me more about where your symptoms feel strongest?`;
            const tFallbackTtsStart = performance.now();
            if (chunksEmitted === 1) {
              timestamps.t_chunk0_tts_start = tFallbackTtsStart;
            }

            try {
              const fallbackAudioRes = await this.synthesizeAudio(fallbackText);
              const tFallbackTtsEnd = performance.now();
              totalTtsMs += Math.round(tFallbackTtsEnd - tFallbackTtsStart);

              if (chunksEmitted === 1) {
                timestamps.t_chunk0_tts_end = tFallbackTtsEnd;
              }

              this.playbackQueue.enqueue({
                id: `fallback-chunk-${chunksEmitted}`,
                buffer: fallbackAudioRes.buffer,
                durationSec: fallbackAudioRes.durationSec,
                text: fallbackText,
              });

              if (params.onAudioChunkReady) {
                params.onAudioChunkReady({
                  buffer: fallbackAudioRes.buffer,
                  durationSec: fallbackAudioRes.durationSec,
                  text: fallbackText,
                  isFirst: chunksEmitted === 1,
                });
              }
            } catch (synthErr: any) {
              ttsFailure = true;
              ttsError = synthErr.message || "TTS engine error";
            }

            // Abort downstream generation on this rejected branch
            break;
          }
        }
      }
    } catch (streamErr: any) {
      console.warn(`[Streaming Voice Pipeline] Caught upstream stream exception: ${streamErr.message}`);
      fallbackUsed = true;
      fallbackReason = `Stream exception: ${streamErr.message}`;

      // Engage calibrated clinical fallback on rate limits (429) or stream aborts
      const streamFallbackText = "I understand you are experiencing discomfort. Can you describe where it hurts most and when it began?";
      const tFbStart = performance.now();
      if (!timestamps.t_chunk0_tts_start) {
        timestamps.t_chunk0_tts_start = tFbStart;
      }

      try {
        const fbAudio = await this.synthesizeAudio(streamFallbackText);
        const tFbEnd = performance.now();
        totalTtsMs += Math.round(tFbEnd - tFbStart);
        if (!timestamps.t_chunk0_tts_end) {
          timestamps.t_chunk0_tts_end = tFbEnd;
        }

        chunksEmitted++;
        this.playbackQueue.enqueue({
          id: `rate-limit-fallback-${chunksEmitted}`,
          buffer: fbAudio.buffer,
          durationSec: fbAudio.durationSec,
          text: streamFallbackText,
        });

        if (params.onAudioChunkReady) {
          params.onAudioChunkReady({
            buffer: fbAudio.buffer,
            durationSec: fbAudio.durationSec,
            text: streamFallbackText,
            isFirst: chunksEmitted === 1,
          });
        }
      } catch (synthErr: any) {
        ttsFailure = true;
        ttsError = synthErr.message;
      }
    }

    // Mid-stream emergency directive execution if tripped during token generation
    if (emergencyPreempted && !emergencyDirectivePlayed) {
      const emergencyDirectiveText = `This is a life-threatening medical emergency. Please call ${primaryNum} or ${ambNum} immediately or proceed to the nearest emergency department right now.`;
      const tEmergencyTtsStart = performance.now();
      try {
        const emAudioResult = await this.synthesizeAudio(emergencyDirectiveText);
        const tEmergencyTtsEnd = performance.now();
        totalTtsMs += Math.round(tEmergencyTtsEnd - tEmergencyTtsStart);
        this.playbackQueue.reset();
        this.playbackQueue.enqueue({
          id: "emergency-directive-midstream",
          buffer: emAudioResult.buffer,
          durationSec: emAudioResult.durationSec,
          text: emergencyDirectiveText,
        });
        emergencyDirectivePlayed = true;

        if (params.onAudioChunkReady) {
          params.onAudioChunkReady({
            buffer: emAudioResult.buffer,
            durationSec: emAudioResult.durationSec,
            text: emergencyDirectiveText,
            isFirst: true,
          });
        }
      } catch (synthErr: any) {
        ttsFailure = true;
        ttsError = synthErr.message;
      }
    }

    // Flush any residual token buffer if not yet validated, not in fallback, and not interrupted
    if (tokenBuffer.trim() && !fallbackUsed && !this.playbackQueue.getStatus().isInterrupted && !emergencyPreempted) {
      chunksEmitted++;
      const valResult = validator.evaluateNextChunk(tokenBuffer.trim(), true);
      if (valResult.isValid && valResult.approvedText) {
        chunksApproved++;
        const tTtsStart = performance.now();
        if (chunksEmitted === 1) {
          timestamps.t_chunk0_tts_start = tTtsStart;
        }
        try {
          const audioRes = await this.synthesizeAudio(valResult.approvedText);
          const tTtsEnd = performance.now();
          totalTtsMs += Math.round(tTtsEnd - tTtsStart);

          if (chunksEmitted === 1) {
            timestamps.t_chunk0_tts_end = tTtsEnd;
          }

          this.playbackQueue.enqueue({
            id: `chunk-${chunksEmitted}`,
            buffer: audioRes.buffer,
            durationSec: audioRes.durationSec,
            text: valResult.approvedText,
          });

          if (params.onAudioChunkReady) {
            params.onAudioChunkReady({
              buffer: audioRes.buffer,
              durationSec: audioRes.durationSec,
              text: valResult.approvedText,
              isFirst: chunksEmitted === 1,
            });
          }
        } catch (synthErr: any) {
          ttsFailure = true;
          ttsError = synthErr.message;
        }
      } else {
        chunksRejected++;
        fallbackUsed = true;
        fallbackReason = valResult.reason;
        rejectionCategory = valResult.category;

        const fallbackText = valResult.fallbackReply || `Can you tell me more about where your symptoms feel strongest?`;
        const tFallbackTtsStart = performance.now();
        if (chunksEmitted === 1) {
          timestamps.t_chunk0_tts_start = tFallbackTtsStart;
        }

        try {
          const fallbackAudioRes = await this.synthesizeAudio(fallbackText);
          const tFallbackTtsEnd = performance.now();
          totalTtsMs += Math.round(tFallbackTtsEnd - tFallbackTtsStart);

          if (chunksEmitted === 1) {
            timestamps.t_chunk0_tts_end = tFallbackTtsEnd;
          }

          this.playbackQueue.enqueue({
            id: `fallback-chunk-${chunksEmitted}`,
            buffer: fallbackAudioRes.buffer,
            durationSec: fallbackAudioRes.durationSec,
            text: fallbackText,
          });

          if (params.onAudioChunkReady) {
            params.onAudioChunkReady({
              buffer: fallbackAudioRes.buffer,
              durationSec: fallbackAudioRes.durationSec,
              text: fallbackText,
              isFirst: chunksEmitted === 1,
            });
          }
        } catch (synthErr: any) {
          ttsFailure = true;
          ttsError = synthErr.message;
        }
      }
    }

    timestamps.t_turn_complete = performance.now();
    if (!timestamps.t_chunk0_tts_end && timestamps.t_chunk0_tts_start) {
      timestamps.t_chunk0_tts_end = timestamps.t_turn_complete;
    }
    if (!timestamps.t_chunk0_tts_start) {
      timestamps.t_chunk0_tts_start = timestamps.t_llm_start || t0;
      timestamps.t_chunk0_tts_end = timestamps.t_turn_complete;
    }

    const totalPlayback = this.playbackQueue.simulatePlayAll();

    const ttfaMs = timestamps.t_chunk0_tts_end
      ? Math.round(timestamps.t_chunk0_tts_end - t0)
      : Math.round((timestamps.t_turn_complete || performance.now()) - t0);

    const fullTurnMs = Math.round((timestamps.t_turn_complete || performance.now()) - t0);

    const latencies: PipelineStageLatencies = {
      vadSpeechDurationMs: Math.round((timestamps.t_vad_speech_end || t0) - (timestamps.t_vad_speech_start || t0)),
      asrDurationMs: Math.round((timestamps.t_asr_final || t0) - (timestamps.t_vad_speech_start || t0)),
      emergencyScreenMs: Math.round((timestamps.t_emergency_screen_end || timestamps.t_emergency_triggered || t0) - (timestamps.t_emergency_screen_start || timestamps.t_vad_speech_end || t0)),
      llmFirstTokenMs: timestamps.t_llm_first_token ? Math.round(timestamps.t_llm_first_token - (timestamps.t_llm_start || t0)) : 0,
      chunk0BufferingMs: timestamps.t_chunk0_buffered ? Math.round(timestamps.t_chunk0_buffered - (timestamps.t_llm_start || t0)) : 0,
      chunk0ValidationMs: timestamps.t_chunk0_validated && timestamps.t_chunk0_buffered ? Math.round(timestamps.t_chunk0_validated - timestamps.t_chunk0_buffered) : 0,
      chunk0TtsMs: timestamps.t_chunk0_tts_end && timestamps.t_chunk0_tts_start ? Math.round(timestamps.t_chunk0_tts_end - timestamps.t_chunk0_tts_start) : 0,
      totalTtsMs,
      ttfaMs,
      fullTurnMs,
      audioPlaybackDurationSec: totalPlayback.totalDurationSec,
    };

    return {
      timestamps,
      latencies,
      isEmergency,
      emergencyPreempted,
      emergencyDirectivePlayed,
      emergencyFiredRule,
      transcript: params.simulatedTranscript,
      transcriptStable: true,
      chunksEmitted,
      chunksApproved,
      chunksRejected,
      rejectionReason: fallbackReason,
      rejectionCategory,
      fallbackUsed,
      fallbackReason,
      playbackInterrupted: this.playbackQueue.getStatus().isInterrupted,
      interruptReason: this.playbackQueue.getStatus().interruptReason || undefined,
      ttsFailure,
      ttsError,
      model: this.options.model || "qwen/qwen3.8-27b",
    };
  }
}
