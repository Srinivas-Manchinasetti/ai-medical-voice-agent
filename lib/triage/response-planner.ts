import { ClinicalInterviewState, ConversationMemory } from "./conversation-manager";
import { SemanticInterpretation } from "./conversation-interpreter";
import { PreArbiterResult } from "./pre-arbiter";
import { LocaleConfig, DEFAULT_LOCALE_CONFIG, getEmergencyDispatchInstructions } from "../config/locale";

export type PlanGoal =
  | "RESOLVE_OBJECTION_REPETITION"
  | "VALIDATE_EMOTION_BEFORE_INQUIRY"
  | "ADDRESS_ACCESS_BARRIER"
  | "CLARIFY_MEMORY_OR_IDENTITY"
  | "EMERGENCY_INTERVENTION"
  | "ACKNOWLEDGE_AND_EXPLORE"
  | "ADVANCE_CLINICAL_INTAKE";

export interface ResponsePlan {
  primaryGoal: PlanGoal;
  conversationalFocus: string;
  mustAvoidAsking: string[];
  nextHighValueInquiry?: {
    topic: string;
    clinicalRationale: string;
    suggestedPhrasing: string;
  };
  bedsideTone: "empathic_and_calm" | "urgent_and_directive" | "attentive_and_methodical";
  suggestedSpokenReply: string;
}

/**
 * RESPONSE PLANNER
 * 
 * Bridges the gap between raw clinical facts / safety invariants and natural doctor-patient dialogue.
 * 
 * Invariants:
 * 1. "What did this person actually communicate?" -> Interpret intent before clinical checklist.
 * 2. "What should I respond to FIRST?" -> Acknowledge, validate, apologize, or clarify before advancing.
 * 3. "What is the ONE most useful clinical thing needed next?" -> Ask at most ONE focused question.
 * 4. "Never ask for information already established or confirmed" -> Strictly enforce memory boundaries.
 */
export class ResponsePlanner {
  public plan(
    patientUtterance: string,
    semantic: SemanticInterpretation,
    state: ClinicalInterviewState,
    preArbiterResult: PreArbiterResult,
    conversationHistory: Array<{ role: string; text?: string; content?: string }> = [],
    localeConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG
  ): ResponsePlan {
    const textLower = patientUtterance.toLowerCase();
    const memory: ConversationMemory = state.conversationMemory || {
      confirmedFacts: state.slots.known_facts || [],
      deniedSymptoms: [],
      questionsAlreadyAsked: [],
      patientCorrections: [],
      patientObjections: [],
      patientConcerns: [],
      accessConstraints: [],
      uncertainties: [],
    };

    const isEmergency = preArbiterResult.immediate_danger || state.informationState === "emergency_preempted";
    const ambulanceNum = localeConfig.alternateEmergencyNumbers?.[0] || "108";

    // 1. EMERGENCY INVARIANT: If immediate danger is present, safety directive is non-negotiable
    if (isEmergency) {
      const dispatchInstructions = getEmergencyDispatchInstructions(localeConfig);
      return {
        primaryGoal: "EMERGENCY_INTERVENTION",
        conversationalFocus: "A deterministic life-threat invariant is active. Direct patient to stay seated, avoid exertion, and contact emergency ambulance immediately.",
        mustAvoidAsking: ["onset", "routine questions", "scheduling", "lengthy history"],
        bedsideTone: "urgent_and_directive",
        suggestedSpokenReply: dispatchInstructions,
      };
    }

    // 2. PATIENT OBJECTION / REPETITION ("We already talked about it?", "a minute like i said before?")
    if (semantic.intent === "patient_objection_repetition" || semantic.isObjectionRepetition) {
      const isDurationRepetition = /\b(minute|hour|second|duration|time)\b/i.test(patientUtterance) ||
        Boolean(semantic.newEvidence?.some(e => e.slot === "duration"));

      if (isDurationRepetition) {
        const dur = state.slots.duration || "about a minute";
        return {
          primaryGoal: "RESOLVE_OBJECTION_REPETITION",
          conversationalFocus: `Acknowledge that the patient previously mentioned the duration (${dur}) and validate it with humility. Clarify the distribution of weakness/numbness (unilateral vs bilateral) rather than repeating any covered topics.`,
          mustAvoidAsking: [...memory.questionsAlreadyAsked, "duration", "how long", "onset", "facial drooping", "speech difficulty"],
          bedsideTone: "empathic_and_calm",
          suggestedSpokenReply: `Thank you for bearing with me — about a minute each time, noted. When you feel that weakness or numbness, is it on one side of your body or both?`,
        };
      }

      const known = memory.confirmedFacts.length > 0
        ? memory.confirmedFacts.slice(0, 3).join(", ")
        : "the symptoms we've covered";

      const frequency = memory.frequencyPattern || state.slots.duration || "";
      const refSnippet = frequency ? `that this occurs ${frequency}` : known;

      return {
        primaryGoal: "RESOLVE_OBJECTION_REPETITION",
        conversationalFocus: `Acknowledge with humility that the patient noticed repetition. Explicitly state: "You're right — I don't want to make you repeat yourself." Reassure them that you already noted ${refSnippet}, and clarify what part they feel is being retreaded or what they'd like to focus on.`,
        mustAvoidAsking: [...memory.questionsAlreadyAsked, "frequency", "known heart disease", "onset"],
        bedsideTone: "empathic_and_calm",
        suggestedSpokenReply: `You're right — I don't want to make you repeat yourself. I have noted ${refSnippet}. What part are you feeling like we're retreading, or is there a specific concern you'd like us to focus on?`,
      };
    }

    // 3. EMOTIONAL DISTRESS ("I'm really scared", "Am I going to die?")
    if (semantic.intent === "emotional_distress" || semantic.isEmotionalDistress) {
      return {
        primaryGoal: "VALIDATE_EMOTION_BEFORE_INQUIRY",
        conversationalFocus: "Validate the patient's fear/anxiety first with human bedside warmth. Do NOT ask checklist onset or severity questions. Invite them to breathe and share what feels most uncomfortable right now.",
        mustAvoidAsking: ["onset", "duration", "severity score", "numeric ratings"],
        bedsideTone: "empathic_and_calm",
        suggestedSpokenReply: "I hear you, and it's completely understandable to feel scared right now. Let's take this one step at a time together. Tell me what feels most uncomfortable right now.",
      };
    }

    // 4. FREQUENCY / INTERMITTENT CLARIFICATION + NEGATIVE RISK FACTORS
    // e.g. "None... but it just happens once in a month i think?"
    if (semantic.intent === "frequency_clarification" || semantic.extractedFrequency || semantic.extractedRiskFactors) {
      const freq = semantic.extractedFrequency || "about once a month";
      const hasNoneRisk = Boolean(semantic.extractedRiskFactors || /\bnone\b/i.test(textLower));

      const focus = hasNoneRisk
        ? `Acknowledge that there are no known prior heart issues, and validate the episodic intermittent pattern (${freq}) rather than a one-time constant episode.`
        : `Acknowledge the intermittent episodic pattern (${freq}).`;

      return {
        primaryGoal: "ACKNOWLEDGE_AND_EXPLORE",
        conversationalFocus: focus,
        mustAvoidAsking: ["known heart disease", "cardiac risk factors", "frequency", "how often"],
        nextHighValueInquiry: {
          topic: "episode_duration",
          clinicalRationale: "Establish how long each intermittent chest discomfort episode lasts to differentiate angina from musculoskeletal spasm, gastroesophageal reflux, or microvascular spasms.",
          suggestedPhrasing: "When it happens, how long does the chest discomfort usually last?",
        },
        bedsideTone: "attentive_and_methodical",
        suggestedSpokenReply: `Okay, so this has happened intermittently, ${freq}, rather than being a one-time episode. When it happens, how long does the chest discomfort usually last?`,
      };
    }

    // 5. ACCESS BARRIERS (Financial, Remote Outskirts, Transportation)
    if (semantic.intent === "access_barrier" || semantic.isAccessBarrier || state.structuredHistory?.accessConstraints?.financial) {
      return {
        primaryGoal: "ADDRESS_ACCESS_BARRIER",
        conversationalFocus: `Acknowledge the financial or distance barrier with genuine empathy. Reassure them that government district hospitals and 108 emergency transport provide care under public health standards without excessive private hospital costs.`,
        mustAvoidAsking: ["insurance policy", "payment method"],
        nextHighValueInquiry: {
          topic: "emergency_care_accessibility",
          clinicalRationale: "Connect patient to accessible public care facilities while confirming safety.",
          suggestedPhrasing: `We can guide you to government district hospitals or dispatch the ${ambulanceNum} ambulance service where standard public rates apply. Would you like to review nearby public care options?`,
        },
        bedsideTone: "empathic_and_calm",
        suggestedSpokenReply: `I understand that costs are a heavy worry, especially when you are feeling unwell. Public district hospitals and the ${ambulanceNum} ambulance service operate under standard public healthcare rates. Let's make sure you get safe medical attention without worrying about expensive private fees.`,
      };
    }

    // 6. MEMORY / CONTEXT QUERY ("Hey.. do you remember my illness?")
    if (semantic.intent === "memory_inquiry" || semantic.isMemoryInquiry) {
      const knownSymptoms = memory.confirmedFacts.filter(f => !f.toLowerCase().includes("greeting"));
      if (knownSymptoms.length > 0) {
        return {
          primaryGoal: "CLARIFY_MEMORY_OR_IDENTITY",
          conversationalFocus: `Summarize the symptoms already recorded in this active consultation (${knownSymptoms.join(", ")}), and ask what has changed since then.`,
          mustAvoidAsking: ["unrelated onset"],
          bedsideTone: "attentive_and_methodical",
          suggestedSpokenReply: `Yes — I have that context from our current consultation. We noted ${knownSymptoms.join(", ")}. What has changed since we last discussed it, or what would you like us to evaluate?`,
        };
      } else {
        return {
          primaryGoal: "CLARIFY_MEMORY_OR_IDENTITY",
          conversationalFocus: "Honestly and warmly clarify that you can follow everything in this consultation, but no illness has been described yet in this session, and ask what illness or symptoms they are referring to.",
          mustAvoidAsking: ["When did the symptoms first start?"],
          bedsideTone: "attentive_and_methodical",
          suggestedSpokenReply: "I can follow what we've discussed in this consultation, but I don't want to assume I remember a condition you haven't described here. What illness or symptoms are you referring to?",
        };
      }
    }

    // 7. META / IDENTITY QUERY ("Who are you?", "Are you real?", "Is this private?")
    if (semantic.intent === "meta_inquiry" || semantic.isMetaInquiry) {
      let reply = "I'm Dr. Sarah Chen, lead physician for MedVoice AI. I work alongside our clinical board to evaluate your symptoms safely. How can I help you today?";
      if (/private|confidential|secure/i.test(textLower)) {
        reply = "Yes, your consultation is processed securely under clinical privacy standards. What symptoms or medical concerns brought you in today?";
      }
      return {
        primaryGoal: "CLARIFY_MEMORY_OR_IDENTITY",
        conversationalFocus: "Directly and warmly answer the patient's procedural or identity question before inquiring about symptoms.",
        mustAvoidAsking: ["medical interrogation"],
        bedsideTone: "empathic_and_calm",
        suggestedSpokenReply: reply,
      };
    }

    // 8. GENERAL CLINICAL INTAKE: DYNAMIC NEXT-ACTION SELECTION
    const hasChest = Boolean(state.slots.character || state.slots.location === "chest" || /\bchest\b/i.test(state.cumulativeTranscript));
    const hasNeuro = Boolean(state.slots.neurological_signs.length > 0 || /\b(headache|dizz|droop|weak|speech)\b/i.test(state.cumulativeTranscript));

    const askedQuestions = new Set(memory.questionsAlreadyAsked.map(q => q.toLowerCase()));

    let nextInquiry: { topic: string; clinicalRationale: string; suggestedPhrasing: string } | undefined = undefined;

    if (hasChest) {
      if (!state.slots.character && !askedQuestions.has("character")) {
        nextInquiry = {
          topic: "character",
          clinicalRationale: "Differentiate pressure/squeezing from sharp or pleuritic pain.",
          suggestedPhrasing: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, burning, or a sharp pain?",
        };
      } else if (!state.slots.onset && !askedQuestions.has("onset")) {
        nextInquiry = {
          topic: "onset",
          clinicalRationale: "Establish onset acuity and timeline.",
          suggestedPhrasing: "When did this begin, and did it start suddenly or build up gradually?",
        };
      } else if (!state.slots.radiation && !askedQuestions.has("radiation")) {
        nextInquiry = {
          topic: "radiation",
          clinicalRationale: "Screen for radiation into left arm, jaw, neck, or back.",
          suggestedPhrasing: "Does that chest discomfort travel anywhere, such as into your left arm, jaw, neck, or back?",
        };
      } else if (!state.slots.exertional && !askedQuestions.has("exertional")) {
        nextInquiry = {
          topic: "exertional",
          clinicalRationale: "Determine exertional vs rest ischemia.",
          suggestedPhrasing: "Does this discomfort happen when you're physically active, or does it happen while resting?",
        };
      } else if (state.slots.associated_symptoms.length === 0 && !askedQuestions.has("associated_symptoms")) {
        nextInquiry = {
          topic: "associated_symptoms",
          clinicalRationale: "Screen for diaphoresis, dyspnea, nausea, and presyncope.",
          suggestedPhrasing: "Are you feeling any shortness of breath, cold sweating, nausea, or lightheadedness alongside it?",
        };
      }
    } else if (hasNeuro) {
      const denied = new Set((memory.deniedSymptoms || []).map(d => d.toLowerCase()));
      const weaknessReported = state.slots.neurological_signs.some(s => /weak|numb/i.test(s));

      if (weaknessReported && !askedQuestions.has("weakness_distribution") && !askedQuestions.has("laterality")) {
        nextInquiry = {
          topic: "weakness_distribution",
          clinicalRationale: "Clarify whether weakness/numbness is unilateral (higher concern for focal stroke/TIA) or bilateral/generalized (more consistent with orthostatic presyncope or peripheral cause).",
          suggestedPhrasing: "When that weakness and numbness happens, is it on one side of your body, or on both sides?",
        };
      } else if (state.slots.neurological_signs.length === 0 && !askedQuestions.has("neurological_signs") && !denied.has("facial drooping")) {
        nextInquiry = {
          topic: "neurological_signs",
          clinicalRationale: "Screen for BE-FAST stroke signs (facial droop, unilateral arm/leg weakness, speech difficulty).",
          suggestedPhrasing: "Have you noticed any weakness in your arms or legs, facial drooping, or difficulty finding your words?",
        };
      } else if (!state.slots.duration && !askedQuestions.has("duration") && !memory.durationPattern) {
        nextInquiry = {
          topic: "duration",
          clinicalRationale: "Establish episode duration to differentiate transient orthostasis from persistent deficits.",
          suggestedPhrasing: "When these episodes happen, roughly how long does each one last?",
        };
      } else if (!state.slots.onset && !askedQuestions.has("onset")) {
        nextInquiry = {
          topic: "onset",
          clinicalRationale: "Establish symptom timeline and progression.",
          suggestedPhrasing: "When did you first notice these symptoms, and did they come on all of a sudden?",
        };
      }
    } else {
      if (!state.slots.onset && !askedQuestions.has("onset")) {
        nextInquiry = {
          topic: "onset",
          clinicalRationale: "Establish symptom timeline and progression.",
          suggestedPhrasing: "Could you tell me when this began, and whether it started suddenly or built up gradually?",
        };
      }
    }

    const defaultPhrasing = nextInquiry?.suggestedPhrasing || "Could you tell me a little more about what you're experiencing?";

    return {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: `Directly acknowledge what the patient just stated. If they shared a new finding, validate it naturally. Then ask ONE high-yield question: ${nextInquiry?.topic || "clarification"}.`,
      mustAvoidAsking: memory.questionsAlreadyAsked,
      nextHighValueInquiry: nextInquiry,
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: defaultPhrasing,
    };
  }
}

export const responsePlanner = new ResponsePlanner();
