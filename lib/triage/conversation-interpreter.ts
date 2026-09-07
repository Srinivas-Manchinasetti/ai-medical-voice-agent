import { PendingQuestion } from "../agents/schemas";

export type PatientIntent =
  | "answer_pending_question"
  | "symptom_report"
  | "confirmation_or_correction"
  | "emergency_inquiry"
  | "explanatory_inquiry"
  | "closing"
  | "small_talk";

export interface SemanticInterpretation {
  rawUtterance: string;
  intent: PatientIntent;
  resolvedQuestionId?: string;
  resolvedSlot?: string;
  resolvedValue?: string;
  isConfirmationOrRepetition: boolean;
  isEmergencyInquiry: boolean;
  isExplanatoryInquiry?: boolean;
  newEvidence: Array<{ slot: string; value: string }>;
  ambiguities: string[];
  confidence: number;
}

export class ConversationInterpreter {
  public interpret(
    utterance: string,
    pendingQuestion: PendingQuestion | null = null,
    currentSlots: Record<string, any> = {},
    isEmergencyActive = false
  ): SemanticInterpretation {
    const text = utterance.trim();
    const lower = text.toLowerCase();

    // 1. Detect Small Talk / Greetings
    const hasClinicalKeywords = /\b(pain|tightness|pressure|ache|hurt|droop|stroke|fever|cough|breath|dizzy|numb|bleeding|nausea|vomit|symptom|chest|arm|head|stomach|belly|throat|rash|swelling)\b/i.test(lower);
    if (
      !hasClinicalKeywords &&
      (/^(hello|hi|hey|good\s+(morning|afternoon|evening)|can\s+you\s+hear\s+me|testing|greetings)[.!?\s]*$/i.test(lower) ||
       /\b(can\s+you\s+hear\s+me|mic\s+check|testing\s+one\s+two)\b/i.test(lower) ||
       /^(hello|hi|hey)\b.*?\b(doctor|dr|can\s+you\s+hear\s+me)\b/i.test(lower) ||
       (text.length <= 25 && /\b(hello|hi|hey|greetings)\b/i.test(lower)))
    ) {
      return {
        rawUtterance: text,
        intent: "small_talk",
        isConfirmationOrRepetition: false,
        isEmergencyInquiry: false,
        newEvidence: [],
        ambiguities: [],
        confidence: 0.95,
      };
    }

    // 2. Detect Closing / Thank you
    if (
      !hasClinicalKeywords &&
      (/\b(thank\s+you|thanks|thank\s+you\s+so\s+much|ok\s+thanks|bye|goodbye|have\s+a\s+good\s+(?:day|night))\b/i.test(lower) ||
       /^(thank\s+you|thanks|bye|goodbye)\b/i.test(lower))
    ) {
      return {
        rawUtterance: text,
        intent: "closing",
        isConfirmationOrRepetition: false,
        isEmergencyInquiry: false,
        newEvidence: [],
        ambiguities: [],
        confidence: 0.98,
      };
    }

    // 3. Detect Emergency Inquiries (frantic action/help questions)
    const emergencyInquiryPattern =
      /\b(what\s+(do|should)\s+i\s+do|no\s+one\s+(is\s+)?around|alone|nobody\s+here|who\s+(do|can)\s+i\s+call|should\s+i\s+(take|call)|is\s+an?\s+ambulance|help\s+me|what\s+now)\b/i;
    const isEmergencyQuestion = emergencyInquiryPattern.test(lower);

    if (isEmergencyQuestion) {
      return {
        rawUtterance: text,
        intent: "emergency_inquiry",
        isConfirmationOrRepetition: false,
        isEmergencyInquiry: true,
        newEvidence: [],
        ambiguities: [],
        confidence: 0.95,
      };
    }

    // 3.5 Detect Explanatory Inquiries ("why is that?", "what could cause this?", "why does it feel like...")
    const explanatoryPattern =
      /\b(why\s+(?:is\s+that|is\s+it|does\s+it|would\s+it|am\s+i|do\s+i)|what\s+(?:causes?|is\s+causing|could\s+(?:this|it)\s+be)|what\s+does\s+that\s+mean|could\s+this\s+be|what\s+is\s+happening)\b/i;
    const isExplanatoryQuestion = explanatoryPattern.test(lower);

    if (isExplanatoryQuestion && !isEmergencyQuestion) {
      return {
        rawUtterance: text,
        intent: "explanatory_inquiry",
        isConfirmationOrRepetition: false,
        isEmergencyInquiry: false,
        isExplanatoryInquiry: true,
        newEvidence: [],
        ambiguities: [],
        confidence: 0.94,
      };
    }

    // 4. Detect Confirmation / Repetition / Clarification of already stated fact
    const isConfirmation =
      /^(i\s+said|like\s+i\s+said|as\s+i\s+said|already\s+told\s+you|i\s+told\s+you|yes\s+head|i\s+said\s+head\??)\b/i.test(lower) ||
      /\b(i\s+said\s+[a-z]+|\bhead\?|\byes\b|\bcorrect\b|\bthats\s+right\b)/i.test(lower);

    if (isConfirmation && (currentSlots.radiation || currentSlots.onset || currentSlots.character)) {
      return {
        rawUtterance: text,
        intent: "confirmation_or_correction",
        isConfirmationOrRepetition: true,
        isEmergencyInquiry: false,
        newEvidence: [],
        ambiguities: [],
        confidence: 0.92,
      };
    }

    // 5. Detect Answers to Pending Questions
    if (pendingQuestion && pendingQuestion.status === "pending") {
      const targetSlot = pendingQuestion.targetSlot;

      // Check Radiation slot
      if (targetSlot === "radiation") {
        const radMatch = lower.match(/\b(head|arm|left\s+arm|shoulder|jaw|back|neck|chest|nowhere|no\s+radiation|stays\s+in\s+chest)\b/i);
        if (radMatch || lower.includes("to my head") || lower.includes("down my arm")) {
          const val = lower.includes("head") ? "head" : radMatch ? radMatch[1] : "arm";
          return {
            rawUtterance: text,
            intent: "answer_pending_question",
            resolvedQuestionId: pendingQuestion.id,
            resolvedSlot: "radiation",
            resolvedValue: val,
            isConfirmationOrRepetition: false,
            isEmergencyInquiry: false,
            newEvidence: [{ slot: "radiation", value: val }],
            ambiguities: [],
            confidence: 0.94,
          };
        }
      }

      // Check Exertional slot
      if (targetSlot === "exertional") {
        if (/stairs|walking|active|exercise|effort|moving/i.test(lower)) {
          return {
            rawUtterance: text,
            intent: "answer_pending_question",
            resolvedQuestionId: pendingQuestion.id,
            resolvedSlot: "exertional",
            resolvedValue: "positive (exertional: climbing stairs/active)",
            isConfirmationOrRepetition: false,
            isEmergencyInquiry: false,
            newEvidence: [{ slot: "exertional", value: "positive" }],
            ambiguities: [],
            confidence: 0.92,
          };
        }
        if (/rest|sitting|lying|relaxed|couch|tv|bed/i.test(lower)) {
          return {
            rawUtterance: text,
            intent: "answer_pending_question",
            resolvedQuestionId: pendingQuestion.id,
            resolvedSlot: "exertional",
            resolvedValue: "negative (at rest)",
            isConfirmationOrRepetition: false,
            isEmergencyInquiry: false,
            newEvidence: [{ slot: "exertional", value: "negative" }],
            ambiguities: [],
            confidence: 0.92,
          };
        }
      }

      // Check Onset slot
      if (targetSlot === "onset") {
        const onsetMatch = lower.match(/\b(\d+|twenty|thirty|ten|forty|a\s+week|few\s+days|minutes?|hours?|days?|sudden|gradual)\b/i);
        if (onsetMatch) {
          const isSudden = /sudden|abrupt|got\s+worse\s+suddenly/i.test(lower);
          const val = `${onsetMatch[0]}${isSudden ? " (acute worsening)" : ""}`;
          return {
            rawUtterance: text,
            intent: "answer_pending_question",
            resolvedQuestionId: pendingQuestion.id,
            resolvedSlot: "onset",
            resolvedValue: val,
            isConfirmationOrRepetition: false,
            isEmergencyInquiry: false,
            newEvidence: [{ slot: "onset", value: val }],
            ambiguities: [],
            confidence: 0.9,
          };
        }
      }
    }

    // 6. Generic Symptom Report
    const extracted: Array<{ slot: string; value: string }> = [];
    if (/chest|tightness|pressure|crushing|squeezing/i.test(lower)) {
      extracted.push({ slot: "character", value: "tightness/pressure" });
    }
    if (/sweat|clammy|diaphoresis/i.test(lower)) {
      extracted.push({ slot: "associated_symptoms", value: "cold sweats/diaphoresis" });
    }
    if (/droop|facial\s+droop|arm\s+weak|slur/i.test(lower)) {
      extracted.push({ slot: "neurological_signs", value: "acute unilateral weakness/droop" });
    }

    return {
      rawUtterance: text,
      intent: "symptom_report",
      isConfirmationOrRepetition: false,
      isEmergencyInquiry: false,
      newEvidence: extracted,
      ambiguities: [],
      confidence: 0.85,
    };
  }
}

export const conversationInterpreter = new ConversationInterpreter();
