import { groqClient, GroqChatMessage } from "./groq-client";
import { nvidiaClient, NvidiaChatMessage } from "./nvidia-client";
import { PreArbiterResult } from "../triage/pre-arbiter";
import { ClinicalInterviewState } from "../triage/conversation-manager";
import { DoctorProfile } from "@/config/doctors";
import { DEFAULT_LOCALE_CONFIG, LocaleConfig } from "../config/locale";
import { detectQuestionTargetSlot, validateDoctorReplyTarget } from "../triage/clinical-state";
export { validateDoctorReplyTarget };

export interface GenerateTurnOptions {
  patientUtterance: string;
  conversationHistory: Array<{ role: "patient" | "doctor" | "assistant"; text?: string; content?: string }>;
  interviewState?: ClinicalInterviewState;
  preArbiterResult: PreArbiterResult;
  demographics: { age?: number | null; age_group: string; age_source?: string };
  doctor: DoctorProfile;
  missingDimensions?: string[];
  fallbackReply?: string;
  careNetworkSummary?: string;
  localeConfig?: LocaleConfig;
}

export interface GeneratedTurnResult {
  reply: string;
  provider: "groq" | "nvidia" | "fallback";
  model?: string;
  latencyMs: number;
  rejectionReason?: string;
  fallbackReason?: string;
}

export const REASONING_LEAK_PATTERNS = [
  /\bwe have a patient\b/i,
  /\bthe patient has\b/i,
  /\bpatient\s+\d+\b/i,
  /\bneed to ask\b/i,
  /\balready asked\b/i,
  /\blet'?s think\b/i,
  /\bwe need to\b/i,
  /\bthe user asks\b/i,
  /\bhigh-yield question\b/i,
  /\bclinical state\b/i,
  /\bsystem prompt\b/i,
  /\bthought:\b/i,
  /\bthinking:\b/i,
  /\bscratchpad:\b/i,
  /\bword count:\b/i,
  /\bcount words\b/i,
  /\bensure \d+-\d+ words\b/i,
  /\bassistantresponse\b/i,
  /\bdiagnostic hypothesis\b/i,
  /\bdifferential diagnosis\b/i,
  /\bcould be tia\b/i,
  /\btia-shaped\b/i,
  /\bchecklist\b/i,
];

/**
 * STRICT OUTPUT PARSER & REASONING-LEAK GUARD
 * 
 * Invariants:
 * 1. Strictly extracts "patientResponse" from JSON output.
 * 2. Intercepts and rejects ANY model internal reasoning leaks or scratchpad deliberations.
 * 3. Rejects defaulted/invented ages (e.g. "patient 45").
 * 4. Limits response length to avoid 700-word hallucinations.
 * 5. Falls back to deterministic clinical plan on any violation.
 */
export function parseAndSanitizeDoctorReply(
  rawContent: string,
  fallbackReply: string,
  knownDemographics?: { age?: number | null; ageSource?: string }
): { cleanReply: string; rejectedReason?: string } {
  let candidate = "";

  // 1. Strip <think> tags if present
  let text = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip code block wrappers
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 3. Attempt JSON parse
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof (parsed.patientResponse || parsed.doctorReply || parsed.reply) === "string") {
        candidate = String(parsed.patientResponse || parsed.doctorReply || parsed.reply).trim();
      }
    }
  } catch {}

  // 4. Fallback key regex extraction if JSON parse failed
  if (!candidate) {
    const keyMatch = text.match(/"patientResponse"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (keyMatch && keyMatch[1]) {
      candidate = keyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    } else {
      // If no JSON format found, check if text has outer quotes
      candidate = text.replace(/^["']|["']$/g, "").trim();
    }
  }

  // 5. Output Guard: Reject internal reasoning leaks
  for (const pattern of REASONING_LEAK_PATTERNS) {
    if (pattern.test(candidate)) {
      console.warn(`[MedVoice AI Output Guard] Detected internal reasoning leak (${pattern}). Rejecting candidate: "${candidate.slice(0, 100)}..."`);
      return {
        cleanReply: fallbackReply,
        rejectedReason: `Reasoning leak detected: ${pattern}`,
      };
    }
  }

  // 6. Output Guard: Reject defaulted/invented age references (e.g. "patient 45", "at 45 years old")
  const hasDefaultedAge = /\bpatient\s+(?:45|\d{2,3})\b/i.test(candidate);
  const hasInventedAge = (!knownDemographics?.age && /\b(?:45\s*years?\s*old|at\s*45\b|a\s*45-year-old)\b/i.test(candidate));
  if (hasDefaultedAge || hasInventedAge) {
    console.warn(`[MedVoice AI Output Guard] Detected defaulted or invented age reference in response. Rejecting candidate: "${candidate}"`);
    return {
      cleanReply: fallbackReply,
      rejectedReason: "Defaulted or invented age reference detected",
    };
  }

  // 7. Length Guard: Limit spoken length to ~55 words / 2 sentences
  const wordCount = candidate.split(/\s+/).filter(Boolean).length;
  if (wordCount > 60 || candidate.length > 380) {
    console.warn(`[MedVoice AI Output Guard] Response exceeded safe conversational length (${wordCount} words). Truncating.`);
    const sentences = candidate.match(/[^.!?]+[.!?]+/g);
    if (sentences && sentences.length >= 1 && sentences.slice(0, 2).join(" ").split(/\s+/).length <= 45) {
      candidate = sentences.slice(0, 2).join(" ").trim();
    } else {
      return {
        cleanReply: fallbackReply,
        rejectedReason: "Excessive response length",
      };
    }
  }

  // 8. Clean residual markdown formatting
  candidate = candidate.replace(/[*_#`\[\]]/g, "").trim();

  // 9. Output Guard: Strip robotic 'I hear...' template filler openings
  candidate = candidate.replace(/^I hear\s+(?:that\s+)?(?:you're|your|the|you\s+have|it\s+started)\s+[^.!?]+[.!?]\s*/i, "").trim();

  // 10. Output Guard: Enforce single question per turn (never bundle multiple questions)
  if ((candidate.match(/\?/g) || []).length > 1) {
    const firstQIdx = candidate.indexOf("?");
    if (firstQIdx > 0) {
      candidate = candidate.slice(0, firstQIdx + 1).trim();
    }
  }

  // Strip bundled list questions like ", a fever, or any ear pain?"
  candidate = candidate.replace(/,\s*(?:a\s+)?fever(?:,\s*(?:or|and)\s+any\s+ear\s+pain)?\?/i, "?");
  candidate = candidate.replace(/,\s*(?:or|and)\s+any\s+ear\s+pain\?/i, "?");

  if (!candidate) {
    return { cleanReply: fallbackReply, rejectedReason: "Empty candidate after cleaning" };
  }

  return { cleanReply: candidate };
}

/**
 * GENERATIVE CLINICAL CONVERSATION ENGINE (NVIDIA NIM)
 * 
 * Invariants:
 * 1. Pre-Arbiter Emergency Invariant: If Pre-Arbiter flags immediate danger,
 *    the LLM is strictly constrained to the Emergency Response Policy and CANNOT
 *    downgrade the emergency tier or suggest waiting.
 * 2. Directly acknowledges and answers the patient's LATEST utterance first.
 * 3. Strict JSON output contract: only "patientResponse" enters chat or TTS.
 * 4. Multi-layer output guard neutralizes reasoning leaks, defaulted ages, and slop.
 * 5. Resilient fallback to local clinical engine if network or generation fails.
 */
export async function generateDoctorTurnResponse(
  options: GenerateTurnOptions
): Promise<GeneratedTurnResult> {
  const {
    patientUtterance,
    conversationHistory,
    interviewState,
    preArbiterResult,
    demographics,
    doctor,
    missingDimensions = [],
    fallbackReply,
    careNetworkSummary,
    localeConfig = DEFAULT_LOCALE_CONFIG,
  } = options;

  const isEmergency = preArbiterResult.immediate_danger;
  const flags = preArbiterResult.pre_safety_flags;
  const knownFacts = interviewState?.slots.known_facts || [];

  // Ingest conversation memory and response plan
  const memory = interviewState?.conversationMemory;
  const rawPlan = interviewState?.responsePlan;
  const pendingQ = interviewState?.pendingQuestion;

  const confirmedFacts = memory?.confirmedFacts && memory.confirmedFacts.length > 0
    ? memory.confirmedFacts
    : knownFacts;
  const deniedSymptoms = memory?.deniedSymptoms || [];
  const uncertainties = memory?.uncertainties || [];
  const questionsAlreadyAsked = memory?.questionsAlreadyAsked || [];
  const mustAvoid = rawPlan?.mustAvoidAsking && rawPlan.mustAvoidAsking.length > 0
    ? rawPlan.mustAvoidAsking
    : questionsAlreadyAsked;

  // Authoritative turn response plan (ingested from planner or pendingQuestion)
  const effectiveInquiry = rawPlan?.nextHighValueInquiry || (pendingQ?.targetSlot ? {
    topic: pendingQ.targetSlot,
    clinicalRationale: pendingQ.purpose || `Inquire about ${pendingQ.targetSlot}`,
    suggestedPhrasing: fallbackReply || pendingQ.question,
  } : undefined);

  const plan = {
    primaryGoal: rawPlan?.primaryGoal || "ADVANCE_CLINICAL_INTAKE",
    conversationalFocus: rawPlan?.conversationalFocus || pendingQ?.purpose || `Inquire about ${pendingQ?.targetSlot || "clinical symptoms"}`,
    mustAvoidAsking: rawPlan?.mustAvoidAsking && rawPlan.mustAvoidAsking.length > 0 ? rawPlan.mustAvoidAsking : mustAvoid,
    nextHighValueInquiry: effectiveInquiry,
    suggestedSpokenReply: rawPlan?.suggestedSpokenReply || fallbackReply || pendingQ?.question || "Could you tell me more about what you're experiencing?",
  };

  // Track access constraints and evidence status
  const constraints = interviewState?.structuredHistory?.accessConstraints;
  const constraintList: string[] = [];
  if (constraints?.financial) constraintList.push("Financial hardship / cannot afford expensive private care");
  if (constraints?.remoteLocation) constraintList.push("Remote location / outskirts");
  if (constraints?.transportation === "unavailable") constraintList.push("No personal vehicle / cannot drive");
  if (constraints?.caregiverAvailable === false) constraintList.push("Patient is alone");
  if (constraints?.caregiverAvailable === true) constraintList.push("Caregiver / family member present");

  const evidence = interviewState?.structuredHistory?.evidenceStatus;
  const primaryEmergencyNumber = localeConfig.emergencyNumber || "112";
  const ambulanceNumber = localeConfig.alternateEmergencyNumbers?.[0] || "108";
  const rawFallback = fallbackReply || plan?.suggestedSpokenReply || "Could you tell me more about what you're experiencing?";

  // Validate that fallback reply doesn't violate mustAvoidAsking or re-ask denied symptoms.
  // IMPORTANT: The planner's own target slot is excluded from avoidance — the avoidance list
  // prevents LLM drift, not the planner's deliberate re-ask of an unresolved slot.
  const safeGenericReply = "I understand. Thank you for sharing that. Could you tell me what else you've been noticing or how things have changed?";
  let effectiveFallback = rawFallback;
  if (!isEmergency && (mustAvoid.length > 0 || deniedSymptoms.length > 0)) {
    const activeTargetSlot = effectiveInquiry?.topic || pendingQ?.targetSlot;
    // A response plan can be stale when a specialist request supersedes it in
    // the same turn. The deterministic fallback itself is authoritative for
    // this check, so never reject it merely because its own target appears in
    // the carry-forward avoidance list.
    const fallbackTargetSlot = detectQuestionTargetSlot(rawFallback, activeTargetSlot);
    const permittedFallbackTargets = new Set([activeTargetSlot, fallbackTargetSlot].filter(Boolean).map(target => target!.toLowerCase()));
    const fallbackMustAvoid = mustAvoid.filter(item => !permittedFallbackTargets.has(item.toLowerCase()));
    const fallbackValidation = validateDoctorReplyTarget(
      rawFallback,
      { mustAvoidAsking: fallbackMustAvoid },
      interviewState?.slots,
      memory,
      confirmedFacts,
      deniedSymptoms
    );
    if (!fallbackValidation.isValid) {
      console.warn(`[MedVoice AI Fallback Guard] Deterministic fallback also violates rules (${fallbackValidation.reason}). Using safe generic reply.`);
      effectiveFallback = safeGenericReply;
    }
  }

  // 1. Check generative provider availability (Groq primary, NVIDIA secondary fallback if configured)
  const isGroq = groqClient.isConfigured();
  const isNvidia = !isGroq && nvidiaClient.isConfigured();

  if (!isGroq && !isNvidia) {
    console.warn("[MedVoice AI] No generative LLM provider configured (GROQ_API_KEY missing). Using deterministic fallback engine.");
    return {
      reply: effectiveFallback,
      provider: "fallback",
      latencyMs: 0,
      fallbackReason: "no_provider_configured",
    };
  }

  // 2. Build Structured Clinical System Prompt (Compact for Token Efficiency)
  const ageDisplay = demographics.age !== undefined && demographics.age !== null
    ? `Age ${demographics.age} (${demographics.age_group})`
    : `Unknown`;

  const systemPrompt = `You are ${doctor.name}, ${doctor.specialty} at MedVoice AI (${localeConfig.country}).
CLINICAL CONTEXT:
- Demographics: ${ageDisplay}
- Confirmed Facts: ${confirmedFacts.slice(-4).join("; ") || "Initial presentation"}
${deniedSymptoms.length > 0 ? `- Denied (DO NOT ASK): ${deniedSymptoms.join(", ")}` : ""}
${questionsAlreadyAsked.length > 0 ? `- Already Covered: ${questionsAlreadyAsked.slice(-5).join(", ")}` : ""}
- Safety Status: ${isEmergency ? `CRITICAL EMERGENCY (${flags.join(", ")})` : "CLINICAL INTAKE"}
${constraintList.length > 0 ? `- Patient Constraints: ${constraintList.join("; ")}` : ""}
${careNetworkSummary ? `- Facility Context: ${careNetworkSummary.slice(0, 150)}` : ""}
${
  plan?.nextHighValueInquiry
    ? `TARGET INQUIRY (MANDATORY): "${plan.nextHighValueInquiry.topic}" (${plan.nextHighValueInquiry.clinicalRationale})\nSuggested phrasing: "${plan.nextHighValueInquiry.suggestedPhrasing}"`
    : ""
}
${mustAvoid.length > 0 ? `FORBIDDEN TOPICS (DO NOT ASK): ${mustAvoid.join(", ")}` : ""}

RULES:
1. Ground strictly in the patient's symptoms. Verbalize ONLY the designated target slot: "${plan?.nextHighValueInquiry?.topic || "inquiry"}". NEVER introduce unmentioned symptoms (e.g. do not ask chest pain for fatigue).
2. Ask exactly 1 focused question in 15-25 words. Warm and natural bedside manner. No "I hear that..." filler. Never bundle multiple questions.
3. If the patient already denied or answered a symptom, NEVER re-ask it. If the patient objects or corrects, acknowledge warmly first.
${
  isEmergency
    ? `4. EMERGENCY CONVERSATION DIRECTIVE:
A critical emergency is active.
- Weave in instructions to call ${primaryEmergencyNumber} or ${ambulanceNumber} (Ambulance) or proceed to the nearest emergency department immediately.
- AVOID REPETITION: You MUST NOT repeat the identical sentence as previous turns. Address the patient's immediate statement directly (e.g. exertional onset, squeezing pressure, jaw/arm ache, aspirin status, or driving preference) and provide practical pre-arrival guidance (remain completely seated and still, unlock the front door, keep caregiver close).`
    : `4. Phrase the designated target slot naturally. Do NOT switch to a different clinical topic.`
}

OUTPUT FORMAT (JSON ONLY):
{"patientResponse": "<1-2 short spoken sentences>"}`;

  // 3. Assemble Message History for Multi-Turn Context (Trimmed to last 5 turns)
  const messages: NvidiaChatMessage[] = [{ role: "system", content: systemPrompt }];

  const recentHistory = conversationHistory.slice(-5);
  for (const turn of recentHistory) {
    const role = turn.role === "doctor" || turn.role === "assistant" ? "assistant" : "user";
    let content = (turn.text || turn.content || "").trim();
    if (content.length > 250) {
      content = content.slice(0, 250) + "...";
    }
    if (content) {
      messages.push({ role, content });
    }
  }

  // Ensure latest user message is the final turn if not already appended
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== patientUtterance.trim()) {
    messages.push({ role: "user", content: patientUtterance.trim() });
  }

  // 4. Invoke Primary LLM Provider (Groq Cloud) with Fallback Guard
  const t0 = Date.now();
  const activeProvider: "groq" | "nvidia" = isGroq ? "groq" : "nvidia";
  try {
    let result: { content: string; model: string; latencyMs: number };

    if (isGroq) {
      try {
        result = await groqClient.createChatCompletion(messages, {
          model: groqClient.getDefaultModel(),
          max_tokens: 256,
          temperature: 0.2,
          timeoutMs: 15000,
        });
      } catch (primaryErr: any) {
        const backupModel = process.env.GROQ_BACKUP_MODEL || "llama-3.3-70b-versatile";
        console.warn(`[MedVoice AI Fallback Chain] Primary model ${groqClient.getDefaultModel()} failed (${primaryErr.message}). Retrying with secondary model ${backupModel}...`);
        result = await groqClient.createChatCompletion(messages, {
          model: backupModel,
          max_tokens: 256,
          temperature: 0.2,
          timeoutMs: 15000,
        });
      }
    } else {
      result = await nvidiaClient.createChatCompletion(messages, {
        max_tokens: 256,
        temperature: 0.2,
        timeoutMs: 25000,
      });
    }

    // 5. Strict Output Parsing & Multi-Layer Output Guard
    const { cleanReply, rejectedReason } = parseAndSanitizeDoctorReply(result.content, effectiveFallback, demographics);
    if (rejectedReason) {
      console.warn(`[MedVoice AI Output Guard] Rejected: ${rejectedReason}`);
      return {
        reply: effectiveFallback,
        provider: "fallback",
        model: result.model,
        latencyMs: Date.now() - t0,
        rejectionReason: rejectedReason,
        fallbackReason: `sanitize_rejected: ${rejectedReason}`,
      };
    }

    let generatedReply = cleanReply;

    // 5.5 Strict Post-Generation Clinical Target & Invariant Validator
    if (!isEmergency) {
      const targetValidation = validateDoctorReplyTarget(
        generatedReply,
        plan,
        interviewState?.slots,
        memory,
        confirmedFacts,
        deniedSymptoms
      );

      if (!targetValidation.isValid) {
        console.warn(`[MedVoice AI Response Validator] ${activeProvider.toUpperCase()} output rejected (${targetValidation.reason}). Falling back to deterministic clinical planner reply.`);
        return {
          reply: effectiveFallback,
          provider: "fallback",
          model: result.model,
          latencyMs: Date.now() - t0,
          rejectionReason: targetValidation.reason,
          fallbackReason: `validator_rejected: ${targetValidation.reason}`,
        };
      }
    }

    // 6. Response Validator
    // If emergency was detected by Pre-Arbiter, verify that emergency guidance is present
    if (isEmergency) {
      const emergencyRegex = new RegExp(`\\b(${primaryEmergencyNumber}|${ambulanceNumber}|emergency|er|urgent|immediate|hospital)\\b`, "i");
      const hasEmergencyDirective = emergencyRegex.test(generatedReply);
      if (!hasEmergencyDirective) {
        console.warn("[MedVoice AI Response Validator] LLM response lacked explicit emergency directive. Appending safety instruction.");
        generatedReply = `${generatedReply} Because of these symptoms, please call ${primaryEmergencyNumber} or ${ambulanceNumber}, or proceed to the nearest emergency department immediately.`;
      }
    }

    // If repetition objection was posed and LLM failed to acknowledge it:
    const isRepetitionObjection = /\b(we\s+already\s+(?:talked|spoke|discussed|said)|i\s+already\s+(?:said|told)|already\s+answered|you\s+already\s+asked|like\s+i\s+said)\b/i.test(patientUtterance) ||
      plan?.primaryGoal === "RESOLVE_OBJECTION_REPETITION";
    if (isRepetitionObjection && !isEmergency) {
      const acknowledgesRepetition = /\b(repeat|retread|noted|already|apologize|understand|bearing with me|minute)\b/i.test(generatedReply);
      if (!acknowledgesRepetition) {
        console.warn("[MedVoice AI Response Validator] LLM ignored repetition objection. Enforcing calibrated clinical response.");
        return {
          reply: effectiveFallback,
          provider: "fallback",
          model: result.model,
          latencyMs: Date.now() - t0,
          rejectionReason: "repetition_objection_ignored",
          fallbackReason: "validator_rejected: repetition_objection_ignored",
        };
      }
    }

    // If emotional distress was expressed and LLM failed to validate it:
    const isEmotional = /\b(really\s+scared|so\s+scared|terrified|panicking|freaking\s+out|im\s+scared|i\s+am\s+scared)\b/i.test(patientUtterance) ||
      plan?.primaryGoal === "VALIDATE_EMOTION_BEFORE_INQUIRY";
    if (isEmotional && !isEmergency) {
      const validatesEmotion = /\b(scared|understand|hear you|breathe|frightening|worry|here with you|together|take this one step)\b/i.test(generatedReply);
      if (!validatesEmotion) {
        console.warn("[MedVoice AI Response Validator] LLM failed to validate emotional distress. Enforcing empathic response.");
        return {
          reply: effectiveFallback,
          provider: "fallback",
          model: result.model,
          latencyMs: Date.now() - t0,
          rejectionReason: "emotion_distress_ignored",
          fallbackReason: "validator_rejected: emotion_distress_ignored",
        };
      }
    }

    // If memory inquiry was posed and LLM ignored it:
    const isMemoryQuery = /\b(remember|recall)\b.*\b(illness|condition|symptom|me|problem)\b/i.test(patientUtterance) ||
      interviewState?.pendingQuestion?.targetSlot === "chief_complaint";
    if (isMemoryQuery && !isEmergency) {
      const addressesMemory = /\b(remember|consultation|referring|assume|recall|described|discussed)\b/i.test(generatedReply);
      if (!addressesMemory) {
        console.warn("[MedVoice AI Response Validator] LLM ignored memory inquiry. Enforcing calibrated clinical response.");
        return {
          reply: effectiveFallback,
          provider: "fallback",
          model: result.model,
          latencyMs: Date.now() - t0,
          rejectionReason: "memory_inquiry_ignored",
          fallbackReason: "validator_rejected: memory_inquiry_ignored",
        };
      }
    }

    // Clean any residual markdown formatting that shouldn't be read by TTS
    generatedReply = generatedReply.replace(/[*_#`\[\]]/g, "").trim();

    // 7. Anti-Repetition Guard: Never return verbatim duplicate of previous doctor line
    const lastDoctorTurn = conversationHistory.filter(t => t.role === "doctor" || t.role === "assistant").slice(-1)[0];
    const lastDoctorText = (lastDoctorTurn?.text || lastDoctorTurn?.content || "").trim();
    if (lastDoctorText && generatedReply.trim().toLowerCase() === lastDoctorText.toLowerCase()) {
      console.warn("[MedVoice AI Response Validator] LLM generated verbatim duplicate of previous turn. Providing calibrated clinical variation.");
      if (effectiveFallback && effectiveFallback.toLowerCase() !== lastDoctorText.toLowerCase()) {
        generatedReply = effectiveFallback;
      } else if (isEmergency) {
        generatedReply = "While the ambulance is on the way, please continue sitting completely still, take slow steady breaths, and keep someone by your side.";
      } else {
        generatedReply = "Thank you for bearing with me. Could you describe how these symptoms are affecting your day-to-day energy right now?";
      }
    }

    return {
      reply: generatedReply,
      provider: activeProvider,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    const isRateLimit = err.status === 429 || err.message?.includes("429") || err.category === "RATE_LIMIT_EXCEEDED" || err.message?.includes("Rate limit");
    const fallbackReason = isRateLimit ? "rate_limit_429" : `error: ${err.message || "unknown"}`;
    console.warn(`[MedVoice AI Fallback Triggered] (${activeProvider.toUpperCase()} error after ${latencyMs}ms) Reason: ${fallbackReason}`);

    return {
      reply: effectiveFallback,
      provider: "fallback",
      latencyMs,
      fallbackReason,
    };
  }
}
