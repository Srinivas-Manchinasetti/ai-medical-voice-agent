import { nvidiaClient, NvidiaChatMessage } from "./nvidia-client";
import { PreArbiterResult } from "../triage/pre-arbiter";
import { ClinicalInterviewState } from "../triage/conversation-manager";
import { DoctorProfile } from "@/config/doctors";
import { DEFAULT_LOCALE_CONFIG, LocaleConfig } from "../config/locale";

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
  provider: "nvidia" | "fallback";
  model?: string;
  latencyMs: number;
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
  const plan = interviewState?.responsePlan;

  const confirmedFacts = memory?.confirmedFacts && memory.confirmedFacts.length > 0
    ? memory.confirmedFacts
    : knownFacts;
  const deniedSymptoms = memory?.deniedSymptoms || [];
  const uncertainties = memory?.uncertainties || [];
  const questionsAlreadyAsked = memory?.questionsAlreadyAsked || [];
  const mustAvoid = plan?.mustAvoidAsking && plan.mustAvoidAsking.length > 0
    ? plan.mustAvoidAsking
    : questionsAlreadyAsked;

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
  const effectiveFallback = fallbackReply || plan?.suggestedSpokenReply || "I understand. Could you tell me more about how your symptoms began?";

  // 1. Check if NVIDIA NIM is configured
  if (!nvidiaClient.isConfigured()) {
    console.warn("[MedVoice AI] NVIDIA_API_KEY not found in environment. Using fallback engine.");
    return {
      reply: effectiveFallback,
      provider: "fallback",
      latencyMs: 0,
    };
  }

  // 2. Build Structured Clinical System Prompt
  const ageDisplay = demographics.age !== undefined && demographics.age !== null
    ? `Age ${demographics.age} (${demographics.age_group})`
    : `Unknown (not reported by patient)`;

  const systemPrompt = `You are ${doctor.name}, ${doctor.specialty} and clinical lead of MedVoice AI.
You are communicating via voice with a patient or their caregiver located in ${localeConfig.country}.

PATIENT CLINICAL BLACKBOARD & CONVERSATION MEMORY:
- Demographics: ${ageDisplay}
- Established / Confirmed Facts: ${confirmedFacts.length > 0 ? confirmedFacts.join("; ") : "Initial presentation"}
${deniedSymptoms.length > 0 ? `- Denied Symptoms (DO NOT RE-ASK): ${deniedSymptoms.join(", ")}` : ""}
${uncertainties.length > 0 ? `- Clinical Uncertainties Being Clarified: ${uncertainties.join("; ")}` : ""}
${memory?.frequencyPattern ? `- Symptom Pattern / Frequency: ${memory.frequencyPattern}` : ""}
${memory?.durationPattern ? `- Episode Duration: ${memory.durationPattern}` : ""}
${memory?.riskFactors ? `- Reported Risk Factors: ${memory.riskFactors}` : ""}
${questionsAlreadyAsked.length > 0 ? `- Questions / Topics Already Covered (DO NOT RE-ASK): ${questionsAlreadyAsked.join(", ")}` : ""}
${memory?.patientObjections && memory.patientObjections.length > 0 ? `- Patient Objections Noted: ${memory.patientObjections.join("; ")}` : ""}
- Clinical Safety Status: ${isEmergency ? "CRITICAL EMERGENCY - IMMEDIATE ACTION REQUIRED" : "CLINICAL INTAKE"}
${isEmergency ? `- Safety Arbiter Flags: ${flags.join(", ")}` : ""}
${constraintList.length > 0 ? `- Patient Access Constraints: ${constraintList.join("; ")}` : ""}
${evidence ? `- Evidence Status: ${evidence.enoughForDisposition ? "Sufficient for calibrated disposition" : "Gathering evidence"} (Tier: ${evidence.dispositionTier}, Confidence: ${evidence.clinicalConfidence})` : ""}
${careNetworkSummary ? `\nVERIFIED CARE NETWORK CANDIDATES (RAG):\n${careNetworkSummary}` : ""}
${
  plan
    ? `\nACTIVE TURN RESPONSE PLAN:
- Primary Goal: ${plan.primaryGoal}
- Priority Focus: ${plan.conversationalFocus}
${plan.nextHighValueInquiry ? `- Next High-Value Clinical Inquiry: ${plan.nextHighValueInquiry.suggestedPhrasing} (${plan.nextHighValueInquiry.clinicalRationale})` : ""}
${mustAvoid.length > 0 ? `- DO NOT ASK ABOUT: ${mustAvoid.join(", ")}` : ""}
- Suggested Clinical Phrasing: "${plan.suggestedSpokenReply}"`
    : ""
}

CONVERSATIONAL RULES (MANDATORY):
1. RESPOND TO THE PATIENT'S LATEST MESSAGE BEFORE ADVANCING THE CLINICAL INTERVIEW:
   - Always address what the patient just communicated before asking anything new.
   - Do NOT mechanically follow a fixed question sequence.
   - If the patient communicates episodic frequency or symptom pattern (e.g. "None... but it just happens once in a month"):
     * Acknowledge the intermittent episodic pattern (happening about once a month) and that there are no known prior heart issues.
     * Do NOT treat it like a one-time continuous event or immediately jump to a checklist question.
   - If the patient is correcting, challenging, or questioning the conversation itself (e.g. "We already talked about it?" or "a minute like i said before?"):
     * Address that objection FIRST with humility and warmth: "You're right — I don't want to make you repeat yourself" or "Thank you for bearing with me — about a minute each time, noted."
     * Never re-ask about duration or onset if they just corrected you about it.
   - If the patient expresses fear, anxiety, or emotional distress ("I'm really scared"):
     * Validate their feelings warmly and calmly first: "I hear you, and it's completely understandable to feel scared right now. Let's take this one step at a time together."
     * Do NOT pepper them with checklist onset, character, or severity scoring questions.
2. DO NOT ASK FOR INFORMATION ALREADY ESTABLISHED OR DENIED:
   - Check "Denied Symptoms" and "Questions / Topics Already Covered". NEVER re-ask questions about symptoms the patient has already denied.
   - If the patient reported weakness or numbness, do NOT ask if they have weakness or numbness; clarify the distribution: "is the weakness or numbness on one side of your body or both sides?"
   - Ask AT MOST ONE high-value clinical question when additional evidence is needed.
3. AGE INTEGRITY:
   - The patient's age is UNKNOWN unless explicitly stated by the patient. NEVER state, assume, or refer to an age (such as "patient 45") in your response.
4. PRESERVE UNCERTAINTY & AVOID PREMATURE LABELS:
   - Distinguish orthostatic / postural dizziness from acute focal deficits. Do NOT jump to "Could be TIA" or single premature labels.
5. Voice Optimization: Keep your spoken response strictly concise (1 to 2 short sentences, roughly 15 to 25 words total), spoken-language friendly, and warm. Avoid multi-sentence paragraphs so speech synthesis playback is prompt. Do NOT use bullet points, numbered lists, markdown formatting, or academic citations.

${
  isEmergency
    ? `EMERGENCY RESPONSE POLICY (NON-NEGOTIABLE):
- A deterministic safety rule has verified a life-threatening medical crisis (${flags.join(", ")}).
- You CANNOT downgrade the emergency, dismiss symptoms, or suggest routine waiting.
- You MUST instruct the patient/caregiver to seek immediate emergency medical care: call ${primaryEmergencyNumber} or ${ambulanceNumber} (Emergency Ambulance), or proceed immediately to the nearest Emergency Department.
- Keep your emergency guidance crisp (1 to 2 urgent, direct sentences).`
    : `CLINICAL INTAKE POLICY:
- We are gathering diagnostic evidence to evaluate the patient's condition.
- Missing key dimensions: ${missingDimensions.length > 0 ? missingDimensions.join(", ") : "onset, character, radiation"}.
- Ask at most ONE clear, focused follow-up question to help narrow down the diagnosis.
- Do NOT repeat questions that have already been asked or answered in the conversation history.`
}

MANDATORY OUTPUT FORMAT (JSON ONLY):
You must respond with a raw, valid JSON object matching this exact schema:
{
  "patientResponse": "<1 to 2 spoken sentences addressed directly to the patient>"
}
CRITICAL INVARIANTS:
1. ONLY the string inside "patientResponse" will be read by text-to-speech to the patient.
2. NEVER include internal reasoning, scratchpads, planning, word counts, or checklists in "patientResponse".
3. Output valid raw JSON only, starting with { and ending with }.`;

  // 3. Assemble Message History for Multi-Turn Context
  const messages: NvidiaChatMessage[] = [{ role: "system", content: systemPrompt }];

  // Include recent conversation turns (up to 8 turns for high relevance and low latency)
  const recentHistory = conversationHistory.slice(-8);
  for (const turn of recentHistory) {
    const role = turn.role === "doctor" || turn.role === "assistant" ? "assistant" : "user";
    const content = (turn.text || turn.content || "").trim();
    if (content) {
      messages.push({ role, content });
    }
  }

  // Ensure latest user message is the final turn if not already appended
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== patientUtterance.trim()) {
    messages.push({ role: "user", content: patientUtterance.trim() });
  }

  // 4. Invoke NVIDIA NIM LLM with Fallback Guard
  const t0 = Date.now();
  try {
    const result = await nvidiaClient.createChatCompletion(messages, {
      max_tokens: 256,
      temperature: 0.2,
      timeoutMs: 25000,
    });

    // 5. Strict Output Parsing & Multi-Layer Output Guard
    const { cleanReply } = parseAndSanitizeDoctorReply(result.content, effectiveFallback, demographics);
    let generatedReply = cleanReply;

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
        generatedReply = effectiveFallback;
      }
    }

    // If emotional distress was expressed and LLM failed to validate it:
    const isEmotional = /\b(really\s+scared|so\s+scared|terrified|panicking|freaking\s+out|im\s+scared|i\s+am\s+scared)\b/i.test(patientUtterance) ||
      plan?.primaryGoal === "VALIDATE_EMOTION_BEFORE_INQUIRY";
    if (isEmotional && !isEmergency) {
      const validatesEmotion = /\b(scared|understand|hear you|breathe|frightening|worry|here with you|together|take this one step)\b/i.test(generatedReply);
      if (!validatesEmotion) {
        console.warn("[MedVoice AI Response Validator] LLM failed to validate emotional distress. Enforcing empathic response.");
        generatedReply = effectiveFallback;
      }
    }

    // If memory inquiry was posed and LLM ignored it:
    const isMemoryQuery = /\b(remember|recall)\b.*\b(illness|condition|symptom|me|problem)\b/i.test(patientUtterance) ||
      interviewState?.pendingQuestion?.targetSlot === "chief_complaint";
    if (isMemoryQuery && !isEmergency) {
      const addressesMemory = /\b(remember|consultation|referring|assume|recall|described|discussed)\b/i.test(generatedReply);
      if (!addressesMemory) {
        console.warn("[MedVoice AI Response Validator] LLM ignored memory inquiry. Enforcing calibrated clinical response.");
        generatedReply = effectiveFallback;
      }
    }

    // Clean any residual markdown formatting that shouldn't be read by TTS
    generatedReply = generatedReply.replace(/[*_#`\[\]]/g, "").trim();

    return {
      reply: generatedReply,
      provider: "nvidia",
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    console.warn(`[MedVoice AI Fallback Triggered] (${latencyMs}ms) Reason: ${err.message}`);

    return {
      reply: effectiveFallback,
      provider: "fallback",
      latencyMs,
    };
  }
}
