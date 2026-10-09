import crypto from "crypto";
import { groqClient, GroqChatMessage } from "./groq-client";
import { nvidiaClient, NvidiaChatMessage } from "./nvidia-client";
import { PreArbiterResult } from "../triage/pre-arbiter";
import { ClinicalInterviewState } from "../triage/conversation-manager";
import { DoctorProfile } from "@/config/doctors";
import { DEFAULT_LOCALE_CONFIG, LocaleConfig } from "../config/locale";
import {
  detectQuestionTargetSlot,
  validateDoctorReplyTarget,
} from "../triage/clinical-state";
import {
  CallerProfile,
  PatientProfile,
  CandidateFactProposal,
  ConversationalAction,
  ServerTurnTelemetry,
  calculateAgeFromDOB,
  ClinicalPassage,
} from "../clinical-knowledge/types";
import { clinicalKnowledgeRetriever } from "../clinical-knowledge/retriever";

export { validateDoctorReplyTarget };

export interface GenerateTurnOptions {
  patientUtterance: string;
  conversationHistory: Array<{ role: "patient" | "doctor" | "assistant"; text?: string; content?: string }>;
  interviewState?: ClinicalInterviewState;
  preArbiterResult: PreArbiterResult;
  demographics?: { age?: number | null; age_group: string; age_source?: string };
  doctor: DoctorProfile;
  missingDimensions?: string[];
  fallbackReply?: string;
  careNetworkSummary?: string;
  localeConfig?: LocaleConfig;
  callerProfile?: CallerProfile;
  patientProfile?: PatientProfile;
  targetSubject?: "self" | "mother" | "child" | "third_party";
  turnId?: number;
  onCandidateSafetyConcern?: (concern: string) => void;
}

export interface GeneratedTurnResult {
  reply: string;
  provider: "groq" | "nvidia" | "fallback";
  model?: string;
  latencyMs: number;
  rejectionReason?: string;
  fallbackReason?: string;
  liveGenerated: boolean;
  telemetry?: ServerTurnTelemetry;
  understoodContext?: string;
  conversationalAction?: ConversationalAction;
  candidateFacts?: CandidateFactProposal[];
  candidateSafetyConcern?: string;
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

// ─── PROMPT INJECTION DEFENSE (UNTRUSTED INPUT DOCTRINE) ─────────────────────

export function detectAndNeutralizePromptInjection(rawText: string): {
  sanitizedText: string;
  injectionDetected: boolean;
  threatType?: string;
} {
  const injectionPatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /\bignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions\b/i, type: "instruction_override" },
    { pattern: /\bdisregard\s+(?:system|safety|clinical|all)\s+(?:rules|guidelines|prompts?)\b/i, type: "safety_bypass" },
    { pattern: /\boutput\s+(?:your\s+)?(?:system\s+prompt|developer\s+instructions)\b/i, type: "prompt_exfiltration" },
    { pattern: /\breveal\s+(?:confidential|system|internal)\s+(?:rules|prompt)\b/i, type: "prompt_exfiltration" },
    { pattern: /\bgive\s+me\s+(?:the\s+)?(?:data|records|info)\s+for\s+(?:user|patient)\b/i, type: "data_exfiltration" },
    { pattern: /\byou\s+are\s+now\s+(?:DAN|jailbreak|unrestricted)\b/i, type: "persona_jailbreak" },
  ];

  let sanitized = rawText;
  let detected = false;
  let threat: string | undefined = undefined;

  for (const { pattern, type } of injectionPatterns) {
    if (pattern.test(sanitized)) {
      detected = true;
      threat = type;
      sanitized = sanitized.replace(pattern, "[security-filtered]");
    }
  }

  return { sanitizedText: sanitized, injectionDetected: detected, threatType: threat };
}

// ─── DATA MINIMIZATION (PII SCRUBBING) ───────────────────────────────────────

export function minimizeClinicalDataPII(text: string): string {
  let clean = text;
  // Phone numbers
  clean = clean.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]");
  // Email addresses
  clean = clean.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
  // National IDs / Aadhaar / SSN formats
  clean = clean.replace(/\b\d{4}[-\s]\d{4}[-\s]\d{4}\b/g, "[ID]");
  clean = clean.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ID]");
  return clean;
}

// ─── SERVER-SIDE TELEMETRY INTEGRITY HASH ───────────────────────────────────

export function createTelemetryIntegrityHash(
  turnId: number,
  provider: string,
  model: string,
  latencyMs: number,
  timestamp: string
): string {
  const secret = process.env.TELEMETRY_SECRET || "medvoice-telemetry-integrity-key-2026";
  return crypto.createHmac("sha256", secret)
    .update(`${turnId}:${provider}:${model}:${latencyMs}:${timestamp}`)
    .digest("hex");
}

// ─── DETERMINISTIC RESPONSE VALIDATOR ───────────────────────────────────────

export interface ValidatorCheckResult {
  isValid: boolean;
  reason?: string;
  category?: "attribution" | "provenance" | "diagnosis_inflation" | "medication_safety" | "emergency_instruction";
}

export function validateDoctorTurnResponse(
  candidateReply: string,
  patientUtterance: string,
  targetSubject: "self" | "mother" | "child" | "third_party",
  isEmergency: boolean,
  primaryEmergencyNumber = "112",
  ambulanceNumber = "108"
): ValidatorCheckResult {
  const lowerReply = candidateReply.toLowerCase();
  const lowerUtterance = patientUtterance.toLowerCase();

  // 1. Attribution Integrity: preserve affected person's identity
  if (targetSubject === "mother") {
    // Must NOT attribute symptom to caller ("in your chest", "your pain", "in your belly")
    if (/\b(?:in\s+your\s+chest|your\s+(?:chest\s+pain|stomach\s+pain|belly\s+pain|heart|shaking|sweating))\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "attribution",
        reason: "Transposed patient identity: attributed mother's symptoms to the caller ('in your chest')",
      };
    }
    // Must refer to the third party ("mother", "she", "her", "your mom")
    if (!/\b(?:mother|she|her|mom)\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "attribution",
        reason: "Missing third-party attribution: response failed to reference the mother",
      };
    }
  }

  // 2. Symptom Provenance: Grounded strictly in stated symptoms without hallucination
  // CHALLENGE-02: patient said "chest pain", not "tight pressure" or "crushing"
  if (/\bchest\s+pain\b/i.test(lowerUtterance) && !/\b(?:tight|pressure|crushing|squeezing)\b/i.test(lowerUtterance)) {
    if (/\b(?:tight\s+pressure|crushing\s+pressure|heavy\s+elephant)\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "provenance",
        reason: "Hallucinated unsupported symptom quality (invented 'tight pressure' when only 'chest pain' was stated)",
      };
    }
  }

  // CHALLENGE-03: patient explicitly negated chest pain and asserted stomach pain
  if (/\bdon'?t\s+have\s+chest\s+pain\b/i.test(lowerUtterance) || /\bno\s+chest\s+pain\b/i.test(lowerUtterance)) {
    if (/\b(?:left\s+arm|jaw\s+pain|radiation\s+to\s+arm|heart\s+attack|coronary|angina)\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "provenance",
        reason: "Queried negated cardiac domain when patient explicitly denied chest pain",
      };
    }
  }

  // CHALLENGE-05: patient explicitly denied fever
  if (/\bno\s+fever\b/i.test(lowerUtterance) && !/\bfever\b/i.test(lowerUtterance.replace(/\bno\s+fever\b/g, ""))) {
    if (/\b(?:because\s+of\s+your\s+fever|your\s+fever|feverish)\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "provenance",
        reason: "Asserted fever when patient explicitly denied fever",
      };
    }
    if (/\b(?:worsening|getting\s+worse|rapidly\s+progressing)\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "provenance",
        reason: "Hallucinated unsupported worsening trajectory",
      };
    }
  }

  // 3. Diagnostic Restraint: No unsupported definitive diagnosis
  if (/\b(?:you\s+have|she\s+has|diagnosed\s+with|confirmed|definite)\s+(?:a\s+)?(?:heart\s+attack|myocardial\s+infarction|stroke|hypoglycemia|appendicitis|meningitis)\b/i.test(candidateReply)) {
    return {
      isValid: false,
      category: "diagnosis_inflation",
      reason: "Offered unsupported definitive diagnosis instead of triage inquiry/evaluation",
    };
  }

  // 4. Medication Safety: No unauthorized prescription commands
  if (/\b(?:take|give\s+her|swallow)\s+(?:an?\s+)?(?:aspirin|nitroglycerin|metformin|antibiotic|ibuprofen)\b/i.test(candidateReply)) {
    if (!/\b(?:if\s+you\s+have\s+aspirin|consult\s+doctor)\b/i.test(candidateReply)) {
      return {
        isValid: false,
        category: "medication_safety",
        reason: "Issued uncertified medication administration directive",
      };
    }
  }

  // 5. Emergency Policy Adherence: Tier 1/2 must include 112/108/emergency services
  if (isEmergency) {
    const emergencyRegex = new RegExp(`\\b(${primaryEmergencyNumber}|${ambulanceNumber}|emergency|er|urgent|hospital)\\b`, "i");
    if (!emergencyRegex.test(candidateReply)) {
      return {
        isValid: false,
        category: "emergency_instruction",
        reason: `Emergency active but response lacked approved emergency directive (${primaryEmergencyNumber}/${ambulanceNumber})`,
      };
    }
  }

  return { isValid: true };
}

// ─── STRICT OUTPUT PARSER & REASONING-LEAK GUARD ─────────────────────────────

export interface ParsedDoctorReply {
  cleanReply: string;
  understoodContext?: string;
  conversationalAction?: ConversationalAction;
  candidateFacts?: CandidateFactProposal[];
  candidateSafetyConcern?: string;
  rejectedReason?: string;
}

export function parseAndSanitizeDoctorReply(
  rawContent: string,
  fallbackReply: string,
  knownDemographics?: { age?: number | null; ageSource?: string }
): ParsedDoctorReply {
  let candidate = "";
  let understoodContext: string | undefined = undefined;
  let conversationalAction: ConversationalAction | undefined = undefined;
  let candidateFacts: CandidateFactProposal[] = [];
  let candidateSafetyConcern: string | undefined = undefined;

  // 1. Strip <think> tags if present
  let text = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Strip code block wrappers
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // 3. Attempt JSON parse
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed) {
        if (typeof (parsed.patientResponse || parsed.doctorReply || parsed.reply) === "string") {
          candidate = String(parsed.patientResponse || parsed.doctorReply || parsed.reply).trim();
        }
        if (typeof parsed.understoodContext === "string") {
          understoodContext = parsed.understoodContext.trim();
        }
        if (typeof parsed.conversationalAction === "string") {
          conversationalAction = parsed.conversationalAction as ConversationalAction;
        }
        if (Array.isArray(parsed.candidateFacts)) {
          candidateFacts = parsed.candidateFacts.filter((f: any) => f && typeof f.concept === "string");
        }
        if (typeof parsed.candidateSafetyConcern === "string" && parsed.candidateSafetyConcern.trim()) {
          candidateSafetyConcern = parsed.candidateSafetyConcern.trim();
        }
      }
    }
  } catch {}

  // 4. Fallback key regex extraction if JSON parse failed
  if (!candidate) {
    const keyMatch = text.match(/"patientResponse"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (keyMatch && keyMatch[1]) {
      candidate = keyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
    } else {
      candidate = text.replace(/^["']|["']$/g, "").trim();
    }
  }

  // 5. Output Guard: Reject internal reasoning leaks
  for (const pattern of REASONING_LEAK_PATTERNS) {
    if (pattern.test(candidate)) {
      console.warn(`[MedVoice AI Output Guard] Detected internal reasoning leak (${pattern}). Rejecting candidate.`);
      return {
        cleanReply: fallbackReply,
        rejectedReason: `Reasoning leak detected: ${pattern}`,
      };
    }
  }

  // 6. Output Guard: Reject defaulted/invented age references
  const hasDefaultedAge = /\bpatient\s+(?:45|\d{2,3})\b/i.test(candidate);
  const hasInventedAge = (!knownDemographics?.age && /\b(?:45\s*years?\s*old|at\s*45\b|a\s*45-year-old)\b/i.test(candidate));
  if (hasDefaultedAge || hasInventedAge) {
    console.warn(`[MedVoice AI Output Guard] Detected defaulted or invented age reference. Rejecting candidate.`);
    return {
      cleanReply: fallbackReply,
      rejectedReason: "Defaulted or invented age reference detected",
    };
  }

  // 7. Length Guard: Limit spoken length to safe conversational length (~55 words)
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

  // 10. Output Guard: Enforce focused questioning (max 1 question per turn)
  if ((candidate.match(/\?/g) || []).length > 1) {
    const firstQIdx = candidate.indexOf("?");
    if (firstQIdx > 0) {
      candidate = candidate.slice(0, firstQIdx + 1).trim();
    }
  }

  candidate = candidate.replace(/,\s*(?:a\s+)?fever(?:,\s*(?:or|and)\s+any\s+ear\s+pain)?\?/i, "?");
  candidate = candidate.replace(/,\s*(?:or|and)\s+any\s+ear\s+pain\?/i, "?");

  if (!candidate) {
    return { cleanReply: fallbackReply, rejectedReason: "Empty candidate after cleaning" };
  }

  return {
    cleanReply: candidate,
    understoodContext,
    conversationalAction,
    candidateFacts,
    candidateSafetyConcern,
  };
}

// ─── GENERATIVE CLINICAL CONVERSATION ENGINE ─────────────────────────────────

export async function generateDoctorTurnResponse(
  options: GenerateTurnOptions
): Promise<GeneratedTurnResult> {
  const {
    patientUtterance,
    conversationHistory,
    interviewState,
    preArbiterResult,
    demographics = { age: null, age_group: "adult", age_source: "unknown" },
    doctor,
    missingDimensions = [],
    fallbackReply,
    careNetworkSummary,
    localeConfig = DEFAULT_LOCALE_CONFIG,
    callerProfile,
    patientProfile,
    targetSubject: explicitTargetSubject,
    turnId = interviewState?.structuredHistory?.turnCount || 1,
    onCandidateSafetyConcern,
  } = options;

  const isEmergency = preArbiterResult.immediate_danger;
  const flags = preArbiterResult.pre_safety_flags;
  const knownFacts = interviewState?.slots.known_facts || [];

  // Determine Target Subject (self vs mother vs child)
  const inferredSubject: "self" | "mother" | "child" | "third_party" =
    explicitTargetSubject ||
    (callerProfile?.relationshipToPatient === "child" ? "mother" :
     callerProfile?.relationshipToPatient === "parent" ? "child" :
     /\b(?:my\s+mother|my\s+mom|she\s+has|her\s+chest)\b/i.test(patientUtterance) ? "mother" :
     /\b(?:my\s+child|my\s+baby|my\s+son|my\s+daughter)\b/i.test(patientUtterance) ? "child" : "self");

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

  const primaryEmergencyNumber = localeConfig.emergencyNumber || "112";
  const ambulanceNumber = localeConfig.alternateEmergencyNumbers?.[0] || "108";
  const rawFallback = fallbackReply || plan?.suggestedSpokenReply || "Could you tell me more about what you're experiencing?";

  let effectiveFallback = rawFallback;
  if (!isEmergency && (mustAvoid.length > 0 || deniedSymptoms.length > 0)) {
    const activeTargetSlot = effectiveInquiry?.topic || pendingQ?.targetSlot;
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
      effectiveFallback = effectiveInquiry?.suggestedPhrasing ||
        "I understand. Thank you for sharing that. Could you tell me what else you've been noticing or how things have changed?";
    }
  }

  // 1. Check provider availability
  const isGroq = groqClient.isConfigured();
  const isNvidia = !isGroq && nvidiaClient.isConfigured();

  if (!isGroq && !isNvidia) {
    const fallbackTs = new Date().toISOString();
    return {
      reply: effectiveFallback,
      provider: "fallback",
      latencyMs: 0,
      liveGenerated: false,
      fallbackReason: "no_provider_configured",
      telemetry: {
        provider: "fallback",
        model: "deterministic_clinical_engine",
        liveGenerated: false,
        latencyMs: 0,
        fallbackUsed: true,
        fallbackReason: "no_provider_configured",
        telemetryIntegrityHash: createTelemetryIntegrityHash(turnId, "fallback", "none", 0, fallbackTs),
        timestamp: fallbackTs,
      },
    };
  }

  // 2. Prompt Injection Defense (Untrusted Input Doctrine)
  const { sanitizedText: safeUtterance, injectionDetected } = detectAndNeutralizePromptInjection(patientUtterance);
  if (injectionDetected) {
    console.warn(`[MedVoice Security] Neutralized prompt injection attempt in turn ${turnId}`);
  }

  // 3. Data Minimization (PII Scrubbing)
  const minimizedUtterance = minimizeClinicalDataPII(safeUtterance);

  // 4. Dynamic Age Calculation from DOB
  let ageDisplay = "Unknown";
  if (patientProfile?.dateOfBirth) {
    const calc = calculateAgeFromDOB(patientProfile.dateOfBirth);
    ageDisplay = `${calc.years} years (DOB: ${patientProfile.dateOfBirth})`;
  } else if (demographics.age != null) {
    ageDisplay = `${demographics.age} years (${demographics.age_group})`;
  }

  // 5. Open-World RAG Retrieval Across Evidence Situations
  const evidenceAnalysis = clinicalKnowledgeRetriever.evaluateEvidenceSituation(minimizedUtterance);
  const retrievedPassagesSummary = evidenceAnalysis.passages.map(p => `[${p.title}]: ${p.content.slice(0, 200)}`).join("\n");

  // 6. Build 3-Tier Context System Prompt
  const callerRelation = callerProfile?.relationshipToPatient || (inferredSubject === "mother" ? "child" : "self");
  const attributionInstruction = inferredSubject === "mother"
    ? `CRITICAL ATTRIBUTION RULE: The patient is the caller's MOTHER. Address the caller about their mother using "your mother", "she", or "her". NEVER say "in your chest" or treat the caller as experiencing the symptoms.`
    : inferredSubject === "child"
    ? `CRITICAL ATTRIBUTION RULE: The patient is the caller's CHILD. Address the caller about their child using "your child" or "they".`
    : `The patient is speaking for THEMSELVES. Address them directly as "you".`;

  const systemPrompt = `You are ${doctor.name}, ${doctor.specialty} at MedVoice AI (${localeConfig.country}).
You are an active-listening, empathetic medical conversational agent conducting clinical intake.

3-TIER CONTEXT:
1. CALLER LAYER: Caller relationship to patient: "${callerRelation}".
${attributionInstruction}
2. PATIENT PROFILE LAYER: Target Patient: ${patientProfile?.name || (inferredSubject === "mother" ? "Mother" : "Self")}. Calculated Age: ${ageDisplay}.
Confirmed Conditions: ${patientProfile?.knownConditions?.join(", ") || confirmedFacts.slice(-3).join("; ") || "None recorded"}.
Confirmed Medications: ${patientProfile?.currentMedications?.map(m => m.name).join(", ") || "None recorded"}.
3. ENCOUNTER STATE LAYER:
- Active Reported Facts: ${confirmedFacts.slice(-4).join("; ") || "Initial intake"}
${deniedSymptoms.length > 0 ? `- Denied Findings (DO NOT RE-ASK): ${deniedSymptoms.join(", ")}` : ""}
${uncertainties.length > 0 ? `- Uncertain Findings: ${uncertainties.join("; ")}` : ""}
- Safety Triage Status: ${isEmergency ? `CRITICAL EMERGENCY (${flags.join(", ")})` : "AMBULATORY CLINICAL INTAKE"}

OPEN-WORLD EVIDENCE CONTEXT (${evidenceAnalysis.situation}):
${evidenceAnalysis.conversationalGuidance}
${retrievedPassagesSummary ? `Retrieved Guidelines:\n${retrievedPassagesSummary}` : ""}

CONVERSATIONAL ACTION PALETTE:
Select from: "INQUIRE", "ANSWER_QUESTION", "ACKNOWLEDGE_CORRECTION", "EXPLAIN_CLINICAL_RATIONALE", "SUMMARIZE_AND_CHECK", "EMERGENCY_DIRECTIVE", "PROVIDE_SUPPORT".
You do NOT need to ask a question on every turn if answering, acknowledging, or providing emergency guidance is more appropriate.

CRITICAL CLINICAL RULES:
1. Preserve symptom provenance: Ground strictly in what was stated. NEVER invent unmentioned symptoms (e.g. do not add "tight pressure" when only "chest pain" was stated; do not mention "fever" when fever was denied).
2. Diagnostic restraint: NEVER state a definitive diagnosis (e.g. "you have a heart attack", "diagnosed with hypoglycemia"). Triage explores, it does not certify.
3. Spoken Bedside Manner: 1 to 2 warm, natural sentences (~20-40 words). Zero robotic filler like "I hear that...".
${
  isEmergency
    ? `4. EMERGENCY DIRECTIVE: A life-threatening emergency is active. You MUST deliver clear emergency guidance to call ${primaryEmergencyNumber} or ${ambulanceNumber} (Ambulance) or proceed to the nearest emergency department immediately.`
    : `4. If open-world presentation (e.g. yellow urine despite water), explore duration, jaundice, stool color, and supplements without jumping to conclusions.`
}

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "understoodContext": "<concise clinical reflection of what was expressed>",
  "candidateFacts": [
    {
      "concept": "<clinical concept>",
      "assertionStatus": "present | absent | uncertain",
      "subjectReference": "${inferredSubject}",
      "temporalScope": "current | historical"
    }
  ],
  "conversationalAction": "<action from palette>",
  "candidateSafetyConcern": "<any subtle unscripted danger sign observed, or null>",
  "patientResponse": "<1-2 short spoken sentences>"
}`;

  // 7. Message Assembly (Last 5 turns)
  const messages: NvidiaChatMessage[] = [{ role: "system", content: systemPrompt }];
  for (const turn of conversationHistory.slice(-5)) {
    const role = turn.role === "doctor" || turn.role === "assistant" ? "assistant" : "user";
    let content = (turn.text || turn.content || "").trim();
    if (content.length > 250) content = content.slice(0, 250) + "...";
    if (content) messages.push({ role, content });
  }

  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== minimizedUtterance.trim()) {
    messages.push({ role: "user", content: minimizedUtterance.trim() });
  }

  // 8. Invoke Provider with Telemetry Measurement & 1-Retry on Validator Rejection
  const t0 = Date.now();
  const activeProvider: "groq" | "nvidia" = isGroq ? "groq" : "nvidia";
  let activeModel = isGroq ? groqClient.getDefaultModel() : (process.env.NVIDIA_MODEL || "openai/gpt-oss-20b");

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      let completion: { content: string; model: string; latencyMs: number };

      if (isGroq) {
        try {
          completion = await groqClient.createChatCompletion(messages, {
            model: activeModel,
            max_tokens: 280,
            temperature: 0.2,
            timeoutMs: 12000,
          });
        } catch (groqErr: any) {
          const backupModel = process.env.GROQ_BACKUP_MODEL || "qwen/qwen3.8-27b";
          if (activeModel !== backupModel) {
            console.warn(`[MedVoice AI] Primary model ${activeModel} failed. Retrying with ${backupModel}...`);
            activeModel = backupModel;
            completion = await groqClient.createChatCompletion(messages, {
              model: backupModel,
              max_tokens: 280,
              temperature: 0.2,
              timeoutMs: 12000,
            });
          } else {
            throw groqErr;
          }
        }
      } else {
        completion = await nvidiaClient.createChatCompletion(messages, {
          max_tokens: 280,
          temperature: 0.2,
          timeoutMs: 20000,
        });
      }

      const totalLatency = Date.now() - t0;
      activeModel = completion.model;

      // 9. Parse Output
      const parsed = parseAndSanitizeDoctorReply(completion.content, effectiveFallback, demographics);
      if (parsed.rejectedReason) {
        if (attempt === 1) {
          messages.push({ role: "user", content: `Please provide a valid, safe clinical reply in 1-2 spoken sentences adhering to JSON format.` });
          continue;
        }
        return {
          reply: effectiveFallback,
          provider: "fallback",
          model: activeModel,
          latencyMs: totalLatency,
          liveGenerated: false,
          fallbackReason: `sanitize_rejected: ${parsed.rejectedReason}`,
          telemetry: {
            provider: "fallback",
            model: activeModel,
            liveGenerated: false,
            latencyMs: totalLatency,
            fallbackUsed: true,
            fallbackReason: parsed.rejectedReason,
            telemetryIntegrityHash: createTelemetryIntegrityHash(turnId, "fallback", activeModel, totalLatency, new Date().toISOString()),
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 10. Strict Deterministic Response Validator
      const valCheck = validateDoctorTurnResponse(
        parsed.cleanReply,
        patientUtterance,
        inferredSubject,
        isEmergency,
        primaryEmergencyNumber,
        ambulanceNumber
      );

      if (!valCheck.isValid) {
        console.warn(`[MedVoice Validator] Validation failed on attempt ${attempt}: ${valCheck.reason}`);
        if (attempt === 1) {
          // 1-Retry with explicit validation guidance
          messages.push({
            role: "user",
            content: `Correction required: ${valCheck.reason}. Please regenerate preserving correct subject attribution, symptom provenance, and emergency instructions.`,
          });
          continue;
        }

        // Retry exhausted: calibrated context-preserving fallback
        return {
          reply: effectiveFallback,
          provider: "fallback",
          model: activeModel,
          latencyMs: totalLatency,
          liveGenerated: false,
          fallbackReason: `validator_rejected: ${valCheck.reason}`,
          telemetry: {
            provider: "fallback",
            model: activeModel,
            liveGenerated: false,
            latencyMs: totalLatency,
            fallbackUsed: true,
            fallbackReason: valCheck.reason,
            telemetryIntegrityHash: createTelemetryIntegrityHash(turnId, "fallback", activeModel, totalLatency, new Date().toISOString()),
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Surface candidate safety concern if model identified one
      if (parsed.candidateSafetyConcern && onCandidateSafetyConcern) {
        onCandidateSafetyConcern(parsed.candidateSafetyConcern);
      }

      const serverTimestamp = new Date().toISOString();
      const integrityHash = createTelemetryIntegrityHash(turnId, activeProvider, activeModel, totalLatency, serverTimestamp);

      return {
        reply: parsed.cleanReply,
        provider: activeProvider,
        model: activeModel,
        latencyMs: totalLatency,
        liveGenerated: true,
        understoodContext: parsed.understoodContext,
        conversationalAction: parsed.conversationalAction || "INQUIRE",
        candidateFacts: parsed.candidateFacts,
        candidateSafetyConcern: parsed.candidateSafetyConcern,
        telemetry: {
          provider: activeProvider,
          model: activeModel,
          liveGenerated: true,
          latencyMs: totalLatency,
          fallbackUsed: false,
          telemetryIntegrityHash: integrityHash,
          timestamp: serverTimestamp,
        },
      };
    } catch (err: any) {
      console.warn(`[MedVoice AI Error] Provider call failed on attempt ${attempt}: ${err.message}`);
      if (attempt === 1 && !err.message?.includes("429")) {
        continue;
      }
      break;
    }
  }

  // Final fallback if network/model failed
  const finalLatency = Date.now() - t0;
  const fallbackTs = new Date().toISOString();
  return {
    reply: effectiveFallback,
    provider: "fallback",
    model: activeModel,
    latencyMs: finalLatency,
    liveGenerated: false,
    fallbackReason: "provider_unavailable",
    telemetry: {
      provider: "fallback",
      model: activeModel,
      liveGenerated: false,
      latencyMs: finalLatency,
      fallbackUsed: true,
      fallbackReason: "provider_unavailable",
      telemetryIntegrityHash: createTelemetryIntegrityHash(turnId, "fallback", activeModel, finalLatency, fallbackTs),
      timestamp: fallbackTs,
    },
  };
}
