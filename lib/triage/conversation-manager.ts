import { AgentRequest, PendingQuestion, PatientCase } from "../agents/schemas";
import { evaluatePreArbiter } from "./pre-arbiter";
import { CardiologyAgent } from "../agents/specialists/cardiology-agent";
import { NeurologyAgent } from "../agents/specialists/neurology-agent";
import { PediatricsAgent } from "../agents/specialists/pediatrics-agent";
import { ConversationInterpreter } from "./conversation-interpreter";
import { LocaleConfig, DEFAULT_LOCALE_CONFIG, getEmergencyDispatchInstructions } from "../config/locale";

export interface DomainSufficiencyStatus {
  status: "inactive" | "gathering" | "sufficient";
  missing: string[];
}

export interface ClinicalInterviewState {
  phase: "dormant" | "active_inquiring" | "deliberating" | "decided";
  informationState: "insufficient" | "sufficient_for_specialist" | "sufficient_for_decision" | "emergency_preempted";
  caseVersion: number;
  slots: {
    onset?: string;
    duration?: string;
    acute_worsening?: boolean;
    character?: string;
    location?: string;
    radiation?: string;
    exertional?: boolean | string;
    severity?: string;
    associated_symptoms: string[];
    neurological_signs: string[];
    pediatric_signs: string[];
    known_facts: string[];
  };
  pendingQuestion: PendingQuestion | null;
  agentRequests: AgentRequest[];
  resolvedQuestions: Array<{
    questionId: string;
    askedBy: string;
    question: string;
    patientAnswer: string;
    resolvedSlot: string;
    slotValue: string;
  }>;
  domainSufficiency: {
    general: DomainSufficiencyStatus;
    cardiology: DomainSufficiencyStatus;
    neurology: DomainSufficiencyStatus;
    pediatrics: DomainSufficiencyStatus;
  };
  cumulativeTranscript: string;
}

export interface ConversationTurnResult {
  action: "ASK_PATIENT" | "CLARIFY" | "CONVENE_BOARD" | "EMERGENCY_CONVENE_BOARD";
  doctorReply: string;
  doctorName: string;
  specialty: string;
  doctorAvatar?: string;
  activeAgentRequest?: AgentRequest;
  state: ClinicalInterviewState;
  preArbiterResult: any;
}

/**
 * CONVERSATIONAL STATE MANAGER & TRAFFIC CONTROLLER
 * Invariants:
 * 1. Pre-Arbiter runs on EVERY turn (Safety > Conversational State > Specialist Reasoning).
 * 2. Specialists emit AgentRequests; Sarah remains the sole patient-facing voice.
 * 3. Pending questions are resolved semantically; confirmations ("I said head?") never loop.
 * 4. Case version propagates and invalidates stale questions on emergency shifts.
 */
export class ConversationManager {
  private cardiology = new CardiologyAgent();
  private neurology = new NeurologyAgent();
  private pediatrics = new PediatricsAgent();
  private interpreter = new ConversationInterpreter();

  /**
   * Initialize a fresh interview state
   */
  public createInitialState(): ClinicalInterviewState {
    return {
      phase: "dormant",
      informationState: "insufficient",
      caseVersion: 1,
      slots: {
        associated_symptoms: [],
        neurological_signs: [],
        pediatric_signs: [],
        known_facts: []
      },
      pendingQuestion: null,
      agentRequests: [],
      resolvedQuestions: [],
      domainSufficiency: {
        general: { status: "gathering", missing: ["onset", "character"] },
        cardiology: { status: "inactive", missing: [] },
        neurology: { status: "inactive", missing: [] },
        pediatrics: { status: "inactive", missing: [] }
      },
      cumulativeTranscript: ""
    };
  }

  /**
   * Semantic interpretation of patient utterance against pending question and clinical context.
   */
  public interpretUtterance(
    utterance: string,
    pendingQuestion: PendingQuestion | null,
    state: ClinicalInterviewState
  ): {
    intent: "answer_question" | "confirmation" | "ambiguous" | "unrelated";
    resolvedSlot?: string;
    resolvedValue?: any;
    clarificationNeeded?: string;
  } {
    const text = utterance.trim();
    const textLower = text.toLowerCase();

    // 1. Detect Confirmation / Reiteration Intent ("I said head?", "I told you head", "Yeah my head")
    const isConfirmation =
      /^is+(?:alreadys+)?(?:said|tolds+you)s+(.+?)[.!?s]*$/i.test(textLower) ||
      /(?:is+said|likes+is+said)/i.test(textLower) ||
      (text.endsWith("?") && pendingQuestion && state.slots[pendingQuestion.targetSlot as keyof typeof state.slots]);

    if (isConfirmation && pendingQuestion && state.slots[pendingQuestion.targetSlot as keyof typeof state.slots]) {
      return {
        intent: "confirmation",
        resolvedSlot: pendingQuestion.targetSlot,
        resolvedValue: state.slots[pendingQuestion.targetSlot as keyof typeof state.slots]
      };
    }

    // 2. Resolve based on Pending Question Target Slot
    if (pendingQuestion) {
      const slot = pendingQuestion.targetSlot;

      // A. RADIATION
      if (slot === "radiation") {
        // Head / Atypical
        if (/\b(?:head|my\s+head|to\s+my\s+head|into\s+my\s+head|up\s+to\s+my\s+head)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "radiation", resolvedValue: "head" };
        }
        // Arm / Shoulder
        if (/\b(?:(?:(?:left|right)\s+)?arm|shoulder|bicep|hand|elbow)\b/i.test(textLower)) {
          const isLeft = /\bleft\b/i.test(textLower);
          return { intent: "answer_question", resolvedSlot: "radiation", resolvedValue: isLeft ? "left arm" : "arm" };
        }
        // Jaw / Neck / Throat
        if (/\b(?:jaw|neck|throat|teeth|chin)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "radiation", resolvedValue: "jaw / neck" };
        }
        // Back / Scapula
        if (/\b(?:back|between\s+(?:my\s+)?shoulder\s+blades|spine)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "radiation", resolvedValue: "back / interscapular" };
        }
        // None / Localized
        if (/\b(?:no|nowhere|stays?\s+(?:right\s+)?there|doesn't\s+(?:spread|travel|move)|only\s+(?:in\s+my\s+)?chest|none)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "radiation", resolvedValue: "none (localized)" };
        }
        // Ambiguous upward
        if (/\b(?:up|upward|higher|above)\b/i.test(textLower) && !/\b(?:head|jaw|neck|arm)\b/i.test(textLower)) {
          return {
            intent: "ambiguous",
            clarificationNeeded: "When you say it moves upward, does it reach into your jaw, your neck, or up into your head?"
          };
        }
      }

      // B. ONSET & DURATION
      if (slot === "onset") {
        const hasSudden = /\b(?:sudden(?:ly)?|abrupt(?:ly)?|out\s+of\s+nowhere|all\s+at\s+once)\b/i.test(textLower);
        const hasGradual = /\b(?:gradual(?:ly)?|slowly|built\s+up|over\s+time)\b/i.test(textLower);
        const timeMatch = textLower.match(/\b(\d+\s*(?:minutes?|hours?|days?|weeks?|mins?|hrs?)|an?\s+hour|twenty\s+minutes|thirty\s+minutes|this\s+morning|yesterday|a\s+week)\b/i);

        let onsetVal = timeMatch ? timeMatch[0] : (hasSudden ? "sudden" : hasGradual ? "gradual" : text);
        const acuteWorsening = /\b(?:worse|worsened|got\s+worse|severe\s+today|worse\s+suddenly)\b/i.test(textLower);

        return {
          intent: "answer_question",
          resolvedSlot: "onset",
          resolvedValue: onsetVal + (acuteWorsening ? " (acute worsening)" : "")
        };
      }

      // C. EXERTIONAL RELATIONSHIP
      if (slot === "exertional") {
        if (/\b(?:stair|stairs|climb|walk|walking|exercise|active|activity|working\s+out|moving)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "exertional", resolvedValue: "positive (exertional: climbing stairs/active)" };
        }
        if (/\b(?:rest|resting|sitting|couch|bed|sleep|out\s+of\s+nowhere|doing\s+nothing)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "exertional", resolvedValue: "negative (occurs at rest)" };
        }
      }

      // D. CHARACTER / QUALITY
      if (slot === "character") {
        const charMatch = textLower.match(/\b(crushing|pressure|tightness|heavy|squeezing|sharp|stabbing|burning|throbbing|ache|dull|elephant)\b/i);
        if (charMatch) {
          return { intent: "answer_question", resolvedSlot: "character", resolvedValue: charMatch[0] };
        }
        return { intent: "answer_question", resolvedSlot: "character", resolvedValue: text };
      }

      // E. ASSOCIATED SYMPTOMS
      if (slot === "associated_symptoms") {
        const found: string[] = [];
        if (/\b(sweat|cold\s+sweats|clammy|diaphoresis)\b/i.test(textLower)) found.push("cold sweats");
        if (/\b(breath|shortness|dyspnea|gasp)\b/i.test(textLower)) found.push("shortness of breath");
        if (/\b(nausea|vomit|queasy|sick)\b/i.test(textLower)) found.push("nausea");
        if (/\b(dizz|lightheaded|faint|presyncope|syncope|black\s*out)\b/i.test(textLower)) found.push("dizziness");
        if (/\b(headache|head\s+hurts)\b/i.test(textLower)) found.push("headache");

        if (found.length > 0) {
          return { intent: "answer_question", resolvedSlot: "associated_symptoms", resolvedValue: found };
        }
        if (/\b(no|none|neither|nothing\s+else)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "associated_symptoms", resolvedValue: ["none reported"] };
        }
      }

      // F. NEUROLOGICAL SIGNS
      if (slot === "neurological_signs") {
        const signs: string[] = [];
        if (/\b(droop|face|asymmetry)\b/i.test(textLower)) signs.push("facial droop");
        if (/\b(arm|weak|cannot\s+lift|drift|leg)\b/i.test(textLower)) signs.push("unilateral limb weakness");
        if (/\b(speech|slurr|talk|words)\b/i.test(textLower)) signs.push("slurred speech / dysarthria");
        if (signs.length > 0) {
          return { intent: "answer_question", resolvedSlot: "neurological_signs", resolvedValue: signs };
        }
        if (/\b(no|none|denies|normal)\b/i.test(textLower)) {
          return { intent: "answer_question", resolvedSlot: "neurological_signs", resolvedValue: ["none reported"] };
        }
      }
    }

    // 3. Fallback opportunistic symptom extraction if no pending question matched
    if (/\b(chest|heart|sternum|angina|palpitation)\b/i.test(textLower)) {
      return { intent: "answer_question", resolvedSlot: "location", resolvedValue: "chest" };
    }

    return { intent: "unrelated" };
  }

  /**
   * Coordinate the next turn: Pre-Arbiter screening -> Slot updating -> Specialist requests -> Next action
   */
  public async processTurn(
    patientUtterance: string,
    existingState?: ClinicalInterviewState,
    demographics: { age?: number; age_group?: any } = { age_group: "adult" },
    localeConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG
  ): Promise<ConversationTurnResult> {
    const state: ClinicalInterviewState = existingState || this.createInitialState();
    const cleanMsg = patientUtterance.trim();

    // Update cumulative transcript
    state.cumulativeTranscript = state.cumulativeTranscript
      ? `${state.cumulativeTranscript}. ${cleanMsg}`
      : cleanMsg;

    // --- STEP 1: PRE-ARBITER DETERMINISTIC SAFETY SCREENING ON EVERY TURN ---
    // (Invariant: Safety > Conversational State > Specialist Reasoning)
    const preArbiterResult = evaluatePreArbiter({
      transcript: state.cumulativeTranscript,
      demographics: {
        age: demographics.age,
        age_group: demographics.age_group || "adult"
      }
    });

    // Run semantic interpreter for emergency inquiry and intent awareness
    const isEmergencyActive = state.informationState === "emergency_preempted" || preArbiterResult.immediate_danger;
    const semantic = this.interpreter.interpret(cleanMsg, state.pendingQuestion, state.slots, isEmergencyActive);

    // If patient expresses active panic / inquiry during an emergency ("what do i do? no one is around")
    if (semantic.isEmergencyInquiry || semantic.intent === "emergency_inquiry") {
      state.caseVersion++;
      state.informationState = "emergency_preempted";
      state.phase = "decided";

      if (state.pendingQuestion) {
        state.pendingQuestion.status = "superseded";
      }
      state.agentRequests.forEach(req => {
        if (req.status === "pending") req.status = "superseded";
      });

      return {
        action: "EMERGENCY_CONVENE_BOARD",
        doctorReply: getEmergencyDispatchInstructions(localeConfig),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead",
        state,
        preArbiterResult
      };
    }

    // Catastrophic life threats that immediately preempt normal history taking:
    const hasEmergencyPreemptionFlag = preArbiterResult.pre_safety_flags.some(f =>
      f === "PRE_FLAG_ACUTE_NEUROLOGIC_DEFICIT" ||
      f === "PRE_FLAG_IMMEDIATE_AIRWAY_FAILURE" ||
      f === "PRE_FLAG_ACS_RADIATION_OR_DIAPHORESIS" ||
      f === "PRE_FLAG_PEDIATRIC_CRISIS" ||
      f === "PRE_FLAG_ACOUSTIC_SEVERE_RESPIRATORY_DISTRESS"
    ) || /\b(unconscious|unresponsive|not\s+breathing|cardiac\s+arrest|collapsed)\b/i.test(state.cumulativeTranscript);

    if (hasEmergencyPreemptionFlag) {
      // Emergency detected mid-interview (e.g. sudden facial droop, respiratory arrest, anaphylaxis)
      state.caseVersion++;
      state.informationState = "emergency_preempted";
      state.phase = "decided";

      // Supersede all outstanding non-emergency questions
      if (state.pendingQuestion) {
        state.pendingQuestion.status = "superseded";
      }
      state.agentRequests.forEach(req => {
        if (req.status === "pending") req.status = "superseded";
      });

      const reply = preArbiterResult.pre_safety_flags.some(f => f.includes("NEURO"))
        ? "I hear you, and that sudden facial drooping and arm weakness are urgent signs of a stroke. Please stay right where you are, do not try to stand up, and emergency stroke protocols are being started right now."
        : "I'm very concerned about what you're experiencing with your chest. For your immediate safety, please sit down comfortably, take slow breaths, and emergency medical help is being contacted right now.";

      return {
        action: "EMERGENCY_CONVENE_BOARD",
        doctorReply: reply,
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead",
        state,
        preArbiterResult
      };
    }

    // --- STEP 2: CONVERSATIONAL INTERPRETATION & SLOT RESOLUTION ---
    const interpretation = this.interpretUtterance(cleanMsg, state.pendingQuestion, state);

    if (interpretation.intent === "confirmation" || semantic.isConfirmationOrRepetition || semantic.intent === "confirmation_or_correction") {
      // Patient confirmed previous statement (e.g. "I said head?")
      // Do NOT repeat the question. Acknowledge and advance!
      const confirmedSlot = interpretation.resolvedSlot || semantic.resolvedSlot || (state.pendingQuestion ? state.pendingQuestion.targetSlot : "information");
      const confirmedVal = interpretation.resolvedValue || semantic.resolvedValue || (state.slots as any)[confirmedSlot] || "noted";
      if (state.pendingQuestion) {
        state.pendingQuestion.status = "resolved";
        state.pendingQuestion = null;
      }
      state.caseVersion++;
      // Mark any matching agentRequest as resolved
      state.agentRequests.forEach(r => {
        if (r.targetSlot === confirmedSlot && r.status === "pending") r.status = "resolved";
      });
    } else if ((interpretation.intent === "answer_question" && interpretation.resolvedSlot) || (semantic.intent === "answer_pending_question" && semantic.resolvedSlot)) {
      // Successfully answered question
      const slot = interpretation.resolvedSlot || semantic.resolvedSlot!;
      const val = interpretation.resolvedValue || semantic.resolvedValue!;

      if (slot === "associated_symptoms" && Array.isArray(val)) {
        state.slots.associated_symptoms = Array.from(new Set([...state.slots.associated_symptoms, ...val]));
        state.slots.known_facts.push(`Associated: ${val.join(", ")}`);
      } else if (slot === "neurological_signs" && Array.isArray(val)) {
        state.slots.neurological_signs = Array.from(new Set([...state.slots.neurological_signs, ...val]));
        state.slots.known_facts.push(`Neurological: ${val.join(", ")}`);
      } else {
        (state.slots as any)[slot] = val;
        state.slots.known_facts.push(`${slot.toUpperCase()}: ${val}`);
      }

      // Resolve pending question
      if (state.pendingQuestion && state.pendingQuestion.targetSlot === slot) {
        state.resolvedQuestions.push({
          questionId: state.pendingQuestion.id,
          askedBy: state.pendingQuestion.askedBy,
          question: state.pendingQuestion.question,
          patientAnswer: cleanMsg,
          resolvedSlot: slot,
          slotValue: String(val)
        });
        state.pendingQuestion.status = "resolved";
        state.pendingQuestion = null;
      }

      // Mark corresponding AgentRequest as resolved
      state.agentRequests.forEach(r => {
        if (r.targetSlot === slot && r.status === "pending") {
          r.status = "resolved";
        }
      });

      state.caseVersion++;
    } else if (interpretation.intent === "ambiguous" && interpretation.clarificationNeeded) {
      // Ambiguous answer: Sarah asks for targeted clarification
      return {
        action: "CLARIFY",
        doctorReply: interpretation.clarificationNeeded,
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & General Practice",
        state,
        preArbiterResult
      };
    }

    // Opportunistic extraction from transcript
    if (!state.slots.character) {
      const charMatch = state.cumulativeTranscript.match(/\b(tightness|pressure|squeezing|crushing|burning|sharp|heavy|elephant)\b/i);
      if (charMatch) {
        state.slots.character = charMatch[0];
        if (!state.slots.known_facts.some(f => f.startsWith("CHARACTER"))) {
          state.slots.known_facts.push(`CHARACTER: ${charMatch[0]}`);
        }
      }
    }
    if (!state.slots.onset) {
      const onsetMatch = state.cumulativeTranscript.match(/\b(\d+\s*(?:minutes?|hours?|days?|weeks?)|twenty\s+minutes|thirty\s+minutes|a\s+week)\b/i);
      if (onsetMatch) {
        state.slots.onset = onsetMatch[0];
        if (!state.slots.known_facts.some(f => f.startsWith("ONSET"))) {
          state.slots.known_facts.push(`ONSET: ${onsetMatch[0]}`);
        }
      }
    }

    // --- STEP 3: SPECIALISTS OBSERVE BLACKBOARD & EMIT AGENT REQUESTS ---
    const patientCase: PatientCase = {
      patient_id: "ACTIVE-PT",
      patient_name: "Patient",
      transcript: state.cumulativeTranscript,
      conversation_history: [],
      demographics: {
        age: demographics.age,
        age_group: demographics.age_group
      },
      detected_symptoms: state.slots.known_facts,
      vitals: {},
      speech_features: undefined as any,
      pre_safety_flags: preArbiterResult.pre_safety_flags,
      immediate_danger_detected: preArbiterResult.immediate_danger,
      provenance_evidence: [],
      case_version: state.caseVersion
    };

    const cardioRequests = this.cardiology.assessEvidenceNeeds(patientCase);
    const neuroRequests = this.neurology.assessEvidenceNeeds(patientCase);
    const pedsRequests = this.pediatrics.assessEvidenceNeeds(patientCase);

    // Merge new active requests avoiding duplicates
    const allSpecialistRequests = [...cardioRequests, ...neuroRequests, ...pedsRequests];
    allSpecialistRequests.forEach(newReq => {
      const alreadyResolved = state.resolvedQuestions.some(q => q.resolvedSlot === newReq.targetSlot);
      const alreadyPending = state.agentRequests.some(r => r.targetSlot === newReq.targetSlot && r.status === "pending");
      const slotAlreadyHasValue = Boolean((state.slots as any)[newReq.targetSlot]);

      if (!alreadyResolved && !alreadyPending && !slotAlreadyHasValue) {
        state.agentRequests.push(newReq);
      }
    });

    // Update domain sufficiency states
    const hasChest = /\b(chest|heart|sternum|angina|pressure|tightness)\b/i.test(state.cumulativeTranscript);
    const hasNeuro = /\b(headache|dizz|droop|weak|numb|speech)\b/i.test(state.cumulativeTranscript);
    const hasPeds = demographics.age !== undefined && demographics.age < 16;

    if (hasChest) {
      const missingCardio = [];
      if (!state.slots.onset) missingCardio.push("onset");
      if (!state.slots.character) missingCardio.push("character");
      if (!state.slots.radiation) missingCardio.push("radiation");
      if (!state.slots.exertional) missingCardio.push("exertional");
      if (state.slots.associated_symptoms.length === 0) missingCardio.push("associated_symptoms");

      // Sufficient if key ischemic features (onset + character + radiation/associated) are known
      const cardioSuff = state.slots.onset !== undefined &&
        state.slots.character !== undefined &&
        (state.slots.radiation !== undefined || state.slots.associated_symptoms.length > 0);

      state.domainSufficiency.cardiology = {
        status: cardioSuff ? "sufficient" : "gathering",
        missing: missingCardio
      };
    } else {
      state.domainSufficiency.cardiology = { status: "inactive", missing: [] };
    }

    if (hasNeuro) {
      const missingNeuro = [];
      if (state.slots.neurological_signs.length === 0) missingNeuro.push("neurological_signs");
      if (!state.slots.onset) missingNeuro.push("onset");

      const neuroSuff = state.slots.neurological_signs.length > 0 && state.slots.onset !== undefined;
      state.domainSufficiency.neurology = {
        status: neuroSuff ? "sufficient" : "gathering",
        missing: missingNeuro
      };
    } else {
      state.domainSufficiency.neurology = { status: "inactive", missing: [] };
    }

    // --- STEP 4: NEXT-ACTION POLICY SELECTION ---
    // A. Check if active domains are sufficient for decision
    const activeDomains = [
      state.domainSufficiency.cardiology,
      state.domainSufficiency.neurology
    ].filter(d => d.status !== "inactive");

    const allActiveSufficient = activeDomains.length > 0 && activeDomains.every(d => d.status === "sufficient");

    // Comprehensive presentation bypass (e.g. benchmark vignettes)
    const isComprehensivePresentation =
      (hasChest && state.slots.onset && state.slots.character && (state.slots.radiation || state.slots.associated_symptoms.length > 0)) ||
      (hasNeuro && state.slots.neurological_signs.length >= 2 && state.slots.onset);

    if (allActiveSufficient || isComprehensivePresentation) {
      state.phase = "decided";
      state.informationState = "sufficient_for_decision";

      return {
        action: "CONVENE_BOARD",
        doctorReply: "Thank you for sharing those details with me. That gives our team what we need to evaluate your situation—give me just a moment while I consult with our clinical specialists.",
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Chief of Internal Medicine",
        state,
        preArbiterResult
      };
    }

    // B. Check for outstanding AgentRequests
    const pendingRequests = state.agentRequests.filter(r => r.status === "pending");

    if (pendingRequests.length > 0) {
      // Pick highest urgency request
      const nextReq = pendingRequests.sort((a, b) => {
        const priorityScore = { critical: 3, high: 2, normal: 1 };
        return priorityScore[b.urgency] - priorityScore[a.urgency];
      })[0];

      state.phase = "active_inquiring";
      state.informationState = "sufficient_for_specialist";

      // Transform into Sarah's warm, natural bedside phrasing
      let sarahQuestion = nextReq.suggestedQuestion || "Could you tell me a little more about that?";
      if (nextReq.targetSlot === "exertional") {
        sarahQuestion = "Does this discomfort usually happen when you're active, such as walking or climbing stairs, or does it happen while resting?";
      } else if (nextReq.targetSlot === "radiation") {
        sarahQuestion = "Does that chest discomfort travel anywhere, such as into your left arm, jaw, neck, or back?";
      } else if (nextReq.targetSlot === "associated_symptoms") {
        sarahQuestion = "Are you experiencing any shortness of breath, cold sweating, nausea, or lightheadedness right now?";
      } else if (nextReq.targetSlot === "onset") {
        sarahQuestion = "When did this discomfort begin, and did it start suddenly or build up gradually?";
      } else if (nextReq.targetSlot === "character") {
        sarahQuestion = "Could you describe what it feels like — is it a tight pressure, squeezing, burning, or a sharp pain?";
      }

      state.pendingQuestion = {
        id: nextReq.id,
        targetSlot: nextReq.targetSlot,
        askedBy: nextReq.fromAgent === "cardiology" ? "marcus" : nextReq.fromAgent === "neurology" ? "arthur" : "sarah",
        doctorName: nextReq.doctorName,
        patientFacingSpeaker: "sarah",
        question: sarahQuestion,
        purpose: nextReq.reason,
        required: nextReq.urgency !== "normal",
        priority: nextReq.urgency,
        status: "pending",
        createdAt: new Date().toISOString(),
        caseVersion: state.caseVersion
      };

      return {
        action: "ASK_PATIENT",
        doctorReply: sarahQuestion,
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & General Practice",
        activeAgentRequest: nextReq,
        state,
        preArbiterResult
      };
    }

    // C. Dynamic clinical response & intake if no specialist requests yet
    state.phase = "active_inquiring";
    state.informationState = "insufficient";

    let initialDoctorReply = "When did this discomfort begin, and did it start suddenly or build up gradually?";
    let initialTargetSlot = "onset";
    let initialPurpose = "Establish onset and duration of presenting symptom";

    const msgLower = cleanMsg.toLowerCase();
    const isChestPresentation = /\b(chest|heart|sternum|angina)\b/i.test(msgLower);
    const isLegNerveMuscle = /\b(leg|calf|thigh|hamstring|quadricep|shin)\b/i.test(msgLower) &&
                            /\b(needle|digged|digging|pins|sharp|stab|cramp|spasm|shoot|burning|numb|tingl|sciatica)\b/i.test(msgLower);
    const isAbdominal = /\b(stomach|abdom|belly|gut|nausea|vomit)\b/i.test(msgLower);
    const isHeadache = /\b(headache|migraine|head\s+pain)\b/i.test(msgLower) && !isChestPresentation;

    if (isLegNerveMuscle) {
      initialTargetSlot = "radiation_or_back";
      initialPurpose = "Differentiate sciatic radiculopathy, focal muscle spasm, and peripheral nerve irritation";
      if (semantic.isExplanatoryInquiry || msgLower.includes("why")) {
        initialDoctorReply = "A sharp pain that feels like a needle digging into your leg muscles usually occurs for a few specific reasons: most commonly, it is either nerve irritation—such as the sciatic nerve or a compressed nerve root sending sharp, lancinating signals down into the muscle—or an acute, localized muscle spasm. When sensory nerves are irritated, they send sharp, needle-like signals rather than a dull ache.\n\nTo help narrow this down: does that needle-like pain shoot down from your lower back or hip, do you feel any numbness or weakness when you lift your foot, and did this start suddenly?";
      } else {
        initialDoctorReply = "I understand you're experiencing sharp, needle-like pain in your leg muscles. Does this pain shoot down from your lower back or hip, do you notice any numbness or weakness in your foot, and did it start suddenly or build up over time?";
      }
    } else if (isAbdominal) {
      initialTargetSlot = "onset_and_location";
      initialPurpose = "Establish quadrant and onset of abdominal discomfort";
      initialDoctorReply = "I understand you're feeling abdominal discomfort. Could you tell me where in your abdomen it's located—such as the upper or lower part—and when it began?";
    } else if (isHeadache) {
      initialTargetSlot = "headache_onset_character";
      initialPurpose = "Screen for headache character and onset acuity";
      initialDoctorReply = "I hear you regarding your headache. Did it come on all of a sudden like a clap of thunder, or build up gradually, and are you sensitive to bright lights or sound?";
    } else if (!isChestPresentation) {
      initialDoctorReply = "Thank you for describing what you're experiencing. Could you tell me when this began, and whether it started suddenly or built up gradually?";
    }

    state.pendingQuestion = {
      id: `req-general-${initialTargetSlot}`,
      targetSlot: initialTargetSlot,
      askedBy: "sarah",
      doctorName: "Dr. Sarah Chen, MD",
      patientFacingSpeaker: "sarah",
      question: initialDoctorReply,
      purpose: initialPurpose,
      required: true,
      priority: "high",
      status: "pending",
      createdAt: new Date().toISOString(),
      caseVersion: state.caseVersion
    };

    return {
      action: "ASK_PATIENT",
      doctorReply: initialDoctorReply,
      doctorName: "Dr. Sarah Chen, MD",
      specialty: "Internal Medicine & General Practice",
      state,
      preArbiterResult
    };
  }
}

export const conversationManager = new ConversationManager();
