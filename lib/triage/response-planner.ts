import { ClinicalInterviewState, ConversationMemory } from "./conversation-manager";
import { SemanticInterpretation } from "./conversation-interpreter";
import { PreArbiterResult } from "./pre-arbiter";
import { LocaleConfig, DEFAULT_LOCALE_CONFIG, getEmergencyDispatchInstructions } from "../config/locale";
import { extractSubfieldState, isAbdominalPresentation } from "./clinical-state";

export type PlanGoal =
  | "CONFIRM_CORRECTION_AND_PROCEED"
  | "ACKNOWLEDGE_AND_ADVANCE"
  | "GENTLE_CLARIFICATION"
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

      const isThroatOrVoiceRepetition = /\b(throat|voice|insist)\b/i.test(textLower) ||
        state.slots.known_facts.some(f => /throat|voice/i.test(f));
      if (isThroatOrVoiceRepetition) {
        return {
          primaryGoal: "RESOLVE_OBJECTION_REPETITION",
          conversationalFocus: "Acknowledge patient's reaffirmed symptoms (throat pain and voice change) with humility. Reassure them that these are noted, and ask a single unasked safety or severity question without repeating previous questions.",
          mustAvoidAsking: [...memory.questionsAlreadyAsked, "voice change", "how long", "onset"],
          bedsideTone: "empathic_and_calm",
          suggestedSpokenReply: "Understood, and we have the throat pain and voice change clearly recorded. On a scale from zero to ten, how severe is the throat pain right now?",
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

    // 2.5 PATIENT CONTRADICTION / CORRECTION ("Actually it started yesterday", "No, left arm")
    if (semantic.intent === "correction" || semantic.isCorrection) {
      const detail = semantic.correctedDetail || "your updated information";
      const slot = semantic.correctedSlot || "corrected_fact";
      return {
        primaryGoal: "CONFIRM_CORRECTION_AND_PROCEED",
        conversationalFocus: `Acknowledge the patient's correction (${detail}) with clarity, gratitude, and reassurance. Do not ask for the old or new value again; confirm the updated fact and continue clinical intake.`,
        mustAvoidAsking: [...memory.questionsAlreadyAsked, slot, "onset", "when did it start"],
        bedsideTone: "attentive_and_methodical",
        suggestedSpokenReply: `Got it, thank you for clarifying — noted ${detail}. Has the discomfort been getting worse, improving, or staying about the same?`,
      };
    }

    // 2.6 UNCERTAINTY / PATIENT SAYS "I DON'T KNOW"
    if (semantic.intent === "uncertainty_or_unknown" || semantic.isUncertainty) {
      return {
        primaryGoal: "ACKNOWLEDGE_AND_ADVANCE",
        conversationalFocus: "Acknowledge that the patient does not know or is unsure with warm reassurance, avoid badgering them for that detail, and move smoothly to the next unasked clinical question.",
        mustAvoidAsking: [...memory.questionsAlreadyAsked, state.pendingQuestion?.targetSlot || "unknown_topic"],
        bedsideTone: "empathic_and_calm",
        suggestedSpokenReply: "That's completely fine — you don't have to know for sure. Let's focus on what you're noticing right now. Does it feel constant, or does it come and go?",
      };
    }

    // 2.7 VAGUE ANSWER ("a bit", "kind of")
    if (semantic.intent === "vague_answer") {
      return {
        primaryGoal: "GENTLE_CLARIFICATION",
        conversationalFocus: "Gently clarify the patient's vague response without sounding interrogative.",
        mustAvoidAsking: memory.questionsAlreadyAsked,
        bedsideTone: "empathic_and_calm",
        suggestedSpokenReply: "Take your time. Does it feel constant throughout the day, or does it come and go?",
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
    const subfields = extractSubfieldState(state.slots, state.slots.known_facts, state.conversationMemory);
    const hasChest = Boolean(state.slots.location === "chest" || /\b(chest|heart|sternum|angina|substernal)\b/i.test(state.cumulativeTranscript));
    const hasAbdomen = isAbdominalPresentation(state.cumulativeTranscript) ||
      Boolean(state.slots.location && /abdom|stomach|belly|quadrant|periumbilical|epigastr/i.test(String(state.slots.location)));
    const hasNeuro = Boolean(state.slots.neurological_signs.length > 0 || /\b(headache|dizz|droop|weak|speech)\b/i.test(state.cumulativeTranscript));
    const hasThroat = Boolean(state.slots.location === "throat" || /\b(throat|swallow|pharyngitis|voice)\b/i.test(state.cumulativeTranscript));
    const hasFatigue = /\b(tired|fatigue|exhaust|malaise|weakness|low energy)\b/i.test(state.cumulativeTranscript) ||
      state.slots.known_facts.some(f => /tired|fatigue/i.test(f));

    const slotAskCount = memory.slotAskCount || {};
    const askedQuestions = new Set(memory.questionsAlreadyAsked.map(q => q.toLowerCase()));
    const deniedSymptoms = new Set((memory.deniedSymptoms || []).map(d => d.toLowerCase()));
    const isTopicAddressed = (topic: string) => {
      const topLower = topic.toLowerCase();
      // Generic slot repetition guard: if asked 2 or more times without being filled, mark exhausted!
      if ((slotAskCount[topLower] || 0) >= 2) return true;
      if (askedQuestions.has(topLower)) return true;
      if (deniedSymptoms.has(topLower)) return true;
      if (topLower === "location" || topLower === "abdominal_location") {
        return Boolean(state.slots.location) || state.slots.known_facts.some(f => /^Abdominal location:/i.test(f));
      }
      if (topLower === "associated_symptoms" || topLower === "associated_general") {
        return state.slots.associated_symptoms.length > 0;
      }
      if (state.slots.known_facts.some(f => f.toLowerCase().includes(topLower) && !/^ONSET_AND_LOCATION:/i.test(f))) return true;
      const slotVal = (state.slots as any)[topic];
      if (Array.isArray(slotVal)) {
        if (slotVal.length > 0) return true;
      } else if (slotVal) {
        return true;
      }
      if (topic === "fever" && (deniedSymptoms.has("fever") || state.slots.known_facts.some(f => /fever/i.test(f)) || state.cumulativeTranscript.toLowerCase().includes("no fever"))) return true;
      if (topic === "postural_dizziness" && (state.slots.known_facts.some(f => /dizz|lightheaded/i.test(f)) || state.cumulativeTranscript.toLowerCase().includes("dizz") || state.cumulativeTranscript.toLowerCase().includes("lightheaded"))) return true;
      if (topic === "oral_intake" && (state.slots.known_facts.some(f => /water|drink|eat|intake/i.test(f)) || state.cumulativeTranscript.toLowerCase().includes("drinking much water"))) return true;
      if (topic === "red_flag_screen" && (state.cumulativeTranscript.toLowerCase().includes("no chest pain") || state.cumulativeTranscript.toLowerCase().includes("no shortness of breath"))) return true;
      return false;
    };

    const REPHRASED_PHRASINGS: Record<string, string> = {
      onset_pattern: "Just to clarify, did your symptoms begin all at once out of nowhere, or did they develop slowly over time?",
      onset_time: "To help me understand the timeline better, roughly when did you first notice this starting?",
      onset: "To help me pin down the onset, when did this start, and did it come on all of a sudden or gradually?",
      swallowing_difficulty: "Just to make sure I have this completely right—are you able to swallow liquids and saliva normally, or does it feel stuck or painful?",
      fever: "Have you felt feverish, hot to the touch, or experienced any temperature spikes or chills?",
      character: "To help me understand better, how would you describe the feeling — would you say it's more of an ache, a burning sensation, or a sharp pressure?",
      severity: "On a scale from 0 to 10 where 10 is the worst discomfort imaginable, roughly where would you rate it right now?",
      radiation: "Does the discomfort stay in one spot, or do you feel it spreading to your shoulder, arm, back, or neck?",
      exertional: "Does this happen mainly when you're exerting yourself physically, or does it also happen while sitting quietly?",
      associated_symptoms: "Along with that, have you noticed any other symptoms like cold sweating, nausea, or shortness of breath?",
      abdominal_location: "Where in your abdomen does the pain feel strongest — upper, lower, right, left, around the navel, or all over?",
      location: "Where in your abdomen does the pain feel strongest — upper, lower, right, left, around the navel, or all over?",
      vomiting: "Have you had any vomiting with this?",
      gi_associated: "Have you had any vomiting, fever, or blood in your stool?",
      blood_in_stool: "Have you noticed any blood in your stool?",
      ear_pain: "Has that pain spread up into your ears at all?",
      course: "Over the last day or two, has the symptom progression been worsening, getting better, or remaining about the same?",
      neurological_signs: "Just to be thorough, have you felt any weakness on one side, difficulty speaking clearly, or face numbness?",
    };

    let nextInquiry: { topic: string; clinicalRationale: string; suggestedPhrasing: string } | undefined = undefined;

    if (hasChest) {
      if (!subfields.characterSeverity.character && !isTopicAddressed("character")) {
        nextInquiry = {
          topic: "character",
          clinicalRationale: "Differentiate pressure/squeezing from sharp or pleuritic pain.",
          suggestedPhrasing: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, burning, or a sharp pain?",
        };
      } else if (!subfields.onset.isResolved) {
        if (subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset_pattern")) {
          nextInquiry = {
            topic: "onset_pattern",
            clinicalRationale: "Establish whether chest discomfort onset was sudden or gradual.",
            suggestedPhrasing: "Did that chest discomfort come on suddenly, or did it build up gradually?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern !== "unknown" && !isTopicAddressed("onset_time") && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset_time",
            clinicalRationale: "Establish onset timeline of chest discomfort.",
            suggestedPhrasing: "When did that chest discomfort first begin?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset",
            clinicalRationale: "Establish onset acuity and timeline.",
            suggestedPhrasing: "When did this begin, and did it start suddenly or build up gradually?",
          };
        }
      } else if (!state.slots.radiation && !isTopicAddressed("radiation")) {
        nextInquiry = {
          topic: "radiation",
          clinicalRationale: "Screen for radiation into left arm, jaw, neck, or back.",
          suggestedPhrasing: "Does that chest discomfort travel anywhere, such as into your left arm, jaw, neck, or back?",
        };
      } else if (!state.slots.exertional && !isTopicAddressed("exertional")) {
        nextInquiry = {
          topic: "exertional",
          clinicalRationale: "Determine exertional vs rest ischemia.",
          suggestedPhrasing: "Does this discomfort happen when you're physically active, or does it happen while resting?",
        };
      } else if (state.slots.associated_symptoms.length === 0 && !isTopicAddressed("associated_symptoms")) {
        nextInquiry = {
          topic: "associated_symptoms",
          clinicalRationale: "Screen for diaphoresis, dyspnea, nausea, and presyncope.",
          suggestedPhrasing: "Are you feeling any shortness of breath, cold sweating, nausea, or lightheadedness alongside it?",
        };
      }
    } else if (hasAbdomen) {
      const hasGiFact = (name: string) =>
        state.slots.associated_symptoms.some(s => s.toLowerCase().includes(name)) ||
        state.slots.known_facts.some(f => f.toLowerCase().includes(name)) ||
        deniedSymptoms.has(name);

      if (!isTopicAddressed("abdominal_location") && !isTopicAddressed("location")) {
        nextInquiry = {
          topic: "abdominal_location",
          clinicalRationale: "Localize abdominal pain to a quadrant or region before broadening the history.",
          suggestedPhrasing: "Where in your abdomen does the pain feel strongest — upper, lower, right, left, around the navel, or all over?",
        };
      } else if (!subfields.onset.isResolved) {
        if (subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset_pattern")) {
          nextInquiry = {
            topic: "onset_pattern",
            clinicalRationale: "Establish whether abdominal pain began suddenly or built up gradually.",
            suggestedPhrasing: "Did the abdominal pain start suddenly, or did it build up gradually?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern !== "unknown" && !isTopicAddressed("onset_time") && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset_time",
            clinicalRationale: "Establish how long the abdominal pain has been present.",
            suggestedPhrasing: "Roughly how long have you had this abdominal pain?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset_time",
            clinicalRationale: "Establish the timeline of abdominal pain.",
            suggestedPhrasing: "When did this abdominal pain first begin?",
          };
        }
      } else if (!subfields.characterSeverity.character && !isTopicAddressed("character")) {
        nextInquiry = {
          topic: "character",
          clinicalRationale: "Characterize abdominal pain quality.",
          suggestedPhrasing: "Does the pain feel more dull, cramping, burning, or sharp?",
        };
      } else if (!subfields.characterSeverity.severity && !isTopicAddressed("severity")) {
        nextInquiry = {
          topic: "severity",
          clinicalRationale: "Quantify usual versus peak abdominal pain.",
          suggestedPhrasing: "On a scale from zero to ten, how bad is it usually, and how bad does it get at its worst?",
        };
      } else if (!hasGiFact("vomiting") && !isTopicAddressed("vomiting")) {
        nextInquiry = {
          topic: "vomiting",
          clinicalRationale: "Screen for vomiting as a high-yield GI associated symptom.",
          suggestedPhrasing: "Have you had any vomiting with this?",
        };
      } else if (!hasGiFact("fever") && !isTopicAddressed("fever")) {
        nextInquiry = {
          topic: "fever",
          clinicalRationale: "Screen for systemic infection alongside abdominal pain.",
          suggestedPhrasing: "Have you had a fever or felt feverish?",
        };
      } else if (!hasGiFact("blood_in_stool") && !hasGiFact("blood in stool") && !isTopicAddressed("blood_in_stool")) {
        nextInquiry = {
          topic: "blood_in_stool",
          clinicalRationale: "Screen for GI bleeding.",
          suggestedPhrasing: "Have you noticed any blood in your stool?",
        };
      } else if (!hasGiFact("diarrhea") && !isTopicAddressed("diarrhea")) {
        nextInquiry = {
          topic: "diarrhea",
          clinicalRationale: "Establish whether bowel movements are loose or watery.",
          suggestedPhrasing: "Have your stools been loose or watery?",
        };
      }
    } else if (hasNeuro) {
      const weaknessReported = state.slots.neurological_signs.some(s => /weak|numb/i.test(s));

      if (weaknessReported && !isTopicAddressed("weakness_distribution") && !isTopicAddressed("laterality")) {
        nextInquiry = {
          topic: "weakness_distribution",
          clinicalRationale: "Clarify whether weakness/numbness is unilateral (higher concern for focal stroke/TIA) or bilateral/generalized (more consistent with orthostatic presyncope or peripheral cause).",
          suggestedPhrasing: "When that weakness and numbness happens, is it on one side of your body, or on both sides?",
        };
      } else if (state.slots.neurological_signs.length === 0 && !isTopicAddressed("neurological_signs") && !deniedSymptoms.has("facial drooping")) {
        nextInquiry = {
          topic: "neurological_signs",
          clinicalRationale: "Screen for BE-FAST stroke signs (facial droop, unilateral arm/leg weakness, speech difficulty).",
          suggestedPhrasing: "Have you noticed any weakness in your arms or legs, facial drooping, or difficulty finding your words?",
        };
      } else if (!state.slots.duration && !isTopicAddressed("duration") && !memory.durationPattern) {
        nextInquiry = {
          topic: "duration",
          clinicalRationale: "Establish episode duration to differentiate transient orthostasis from persistent deficits.",
          suggestedPhrasing: "When these episodes happen, roughly how long does each one last?",
        };
      } else if (!subfields.onset.isResolved) {
        if (subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset_pattern")) {
          nextInquiry = {
            topic: "onset_pattern",
            clinicalRationale: "Establish whether neurological symptoms began suddenly (concerning for vascular event) or gradually.",
            suggestedPhrasing: "Did it come on suddenly, or did it gradually get worse?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern !== "unknown" && !isTopicAddressed("onset_time") && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset_time",
            clinicalRationale: "Establish timeline of neurological symptoms.",
            suggestedPhrasing: "Roughly when did you first notice these neurological symptoms?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset",
            clinicalRationale: "Establish symptom timeline and progression.",
            suggestedPhrasing: "When did you first notice these symptoms, and did they come on all of a sudden?",
          };
        }
      }
    } else {
      const hasVoiceChange = /\b(voice\s+has\s+been\s+ruined|voice\s+changed|voice\s+is\s+different|lost\s+my\s+voice|hoarse|hoarseness)\b/i.test(patientUtterance) ||
        state.slots.associated_symptoms.some(s => /voice/i.test(s));
      const hasThroat = /\b(throat|swallow)\b/i.test(patientUtterance) ||
        state.slots.known_facts.some(f => /throat/i.test(f));

      // Check for painful swallowing (odynophagia)
      const hasOdynophagia = /\b(?:hurts?|painful|pain|burning|sharp)\s+(?:when\s+(?:i\s+)?swallow|to\s+swallow|swallowing)\b/i.test(patientUtterance) ||
        state.slots.known_facts.some(f => /odynophagia|painful\s+swallowing/i.test(f)) ||
        state.slots.associated_symptoms.some(s => /painful\s+swallowing/i.test(s));
      const swallowingAssessed = isTopicAddressed("swallowing_difficulty") || isTopicAddressed("dysphagia");

      // Pivot to new voice change finding if just reported
      if (hasVoiceChange && !isTopicAddressed("voice_character")) {
        nextInquiry = {
          topic: "voice_character",
          clinicalRationale: "Patient communicated a voice change. Differentiate hoarseness / laryngitis from aphonia or upper airway difficulty.",
          suggestedPhrasing: "The voice change is useful to know. Is it more like hoarseness, weakness, or difficulty producing your voice?",
        };
      } else if (hasOdynophagia && !swallowingAssessed) {
        nextInquiry = {
          topic: "swallowing_difficulty",
          clinicalRationale: "Patient reported painful swallowing (odynophagia); screen specifically for mechanical obstruction or inability to swallow fluids (true dysphagia).",
          suggestedPhrasing: "When you say it hurts to swallow, are you still able to swallow liquids and saliva normally?",
        };
      } else if (!subfields.onset.isResolved) {
        if (subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset_pattern")) {
          nextInquiry = {
            topic: "onset_pattern",
            clinicalRationale: "Timeline/duration is established; determine whether onset was sudden or built up gradually.",
            suggestedPhrasing: "Did it come on suddenly, or did it gradually get worse?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern !== "unknown" && !isTopicAddressed("onset_time") && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset_time",
            clinicalRationale: "Onset pattern is established; determine timeline / how long symptoms have persisted.",
            suggestedPhrasing: "Roughly how long have you had this, or when did it begin?",
          };
        } else if (!subfields.onset.duration && subfields.onset.onsetPattern === "unknown" && !isTopicAddressed("onset")) {
          nextInquiry = {
            topic: "onset",
            clinicalRationale: "Establish symptom timeline and progression.",
            suggestedPhrasing: "Could you tell me when this began, and whether it started suddenly or built up gradually?",
          };
        }
      } else if (hasThroat && !state.slots.known_facts.some(f => /course/i.test(f)) && !isTopicAddressed("course")) {
        nextInquiry = {
          topic: "course",
          clinicalRationale: "Establish course and progression of throat symptoms.",
          suggestedPhrasing: "Has the throat pain been getting worse, improving, or staying about the same?",
        };
      } else if (hasThroat && !isTopicAddressed("swallowing_difficulty")) {
        const hasOdynophagia = state.slots.known_facts.some(f => /odynophagia|painful\s+swallowing/i.test(f)) ||
          state.slots.associated_symptoms.some(s => /painful\s+swallowing/i.test(s));
        nextInquiry = {
          topic: "swallowing_difficulty",
          clinicalRationale: hasOdynophagia
            ? "Patient reported painful swallowing (odynophagia); screen specifically for mechanical obstruction or inability to swallow fluids (true dysphagia)."
            : "Screen for red-flag dysphagia, peritonsillar abscess, and upper airway compromise.",
          suggestedPhrasing: hasOdynophagia
            ? "I understand that swallowing is painful. Despite the pain, are you still able to swallow liquids and keep them down without choking?"
            : "Have you had any difficulty swallowing liquids or your own saliva?",
        };
      } else if (hasThroat && !isTopicAddressed("fever")) {
        nextInquiry = {
          topic: "fever",
          clinicalRationale: "Screen for systemic infection and bacterial pharyngitis.",
          suggestedPhrasing: "Have you had a fever or chills?",
        };
      } else if (!subfields.characterSeverity.character && !isTopicAddressed("character")) {
        nextInquiry = {
          topic: "character",
          clinicalRationale: hasFatigue ? "Assess functional impact and quality of fatigue." : "Establish symptom sensation and quality.",
          suggestedPhrasing: hasFatigue
            ? "Could you describe what this fatigue feels like — does it make it hard to get out of bed, or is it a general exhaustion?"
            : "Could you describe what the sensation feels like — is it sharp, burning, dull, or a tight pressure?",
        };
      } else if (!subfields.characterSeverity.severity && !isTopicAddressed("severity")) {
        nextInquiry = {
          topic: "severity",
          clinicalRationale: "Quantify symptom pain or fatigue intensity.",
          suggestedPhrasing: "How severe is that discomfort right now on a scale from zero to ten?",
        };
      } else if (hasFatigue && !isTopicAddressed("postural_dizziness")) {
        nextInquiry = {
          topic: "postural_dizziness",
          clinicalRationale: "Screen for orthostatic hypotension, dehydration, and lightheadedness in fatigue.",
          suggestedPhrasing: "Do you feel lightheaded or dizzy when you stand up quickly, or have you had any fever or cough?",
        };
      } else if (hasFatigue && !isTopicAddressed("oral_intake")) {
        nextInquiry = {
          topic: "oral_intake",
          clinicalRationale: "Assess hydration and oral caloric intake.",
          suggestedPhrasing: "How has your fluid and food intake been since this started — have you been drinking plenty of water?",
        };
      } else if (hasFatigue && !isTopicAddressed("red_flag_screen")) {
        nextInquiry = {
          topic: "red_flag_screen",
          clinicalRationale: "Screen for cardiopulmonary and neurological red flags in fatigue.",
          suggestedPhrasing: "Are you having any chest pain, difficulty breathing, or numbness in your hands or feet?",
        };
      } else if (hasThroat && !isTopicAddressed("ear_pain")) {
        nextInquiry = {
          topic: "ear_pain",
          clinicalRationale: "Screen for referred otalgia.",
          suggestedPhrasing: "Are you feeling any ear pain or pain radiating to your ears?",
        };
      } else if (subfields.episodic.isEpisodic) {
        if (!subfields.episodic.episodeDuration && !isTopicAddressed("duration")) {
          nextInquiry = {
            topic: "duration",
            clinicalRationale: "Frequency is known; quantify duration of individual episodes.",
            suggestedPhrasing: "When these episodes happen, roughly how long does each one last?",
          };
        } else if (!subfields.episodic.frequency && !isTopicAddressed("frequency")) {
          nextInquiry = {
            topic: "frequency",
            clinicalRationale: "Episode duration is known; quantify frequency of occurrence.",
            suggestedPhrasing: "How often do these episodes tend to occur?",
          };
        }
      }
    }

    const defaultPhrasing = nextInquiry?.suggestedPhrasing ||
      (hasAbdomen
        ? "Where in your abdomen does the pain feel strongest — upper, lower, right, left, around the navel, or all over?"
        : "Could you tell me a little more about what you're experiencing?");

    const mustAvoid = [...memory.questionsAlreadyAsked];
    if (subfields.onset.duration) {
      mustAvoid.push("onset", "when did it begin", "when did this begin", "how long have you had", "started a week");
    }
    if (subfields.onset.onsetPattern !== "unknown") {
      mustAvoid.push("onset_pattern", "started suddenly", "built up gradually");
    }
    if (subfields.characterSeverity.severity) {
      mustAvoid.push("severity", "scale from zero to ten", "0-10");
    }
    if (subfields.characterSeverity.character) {
      mustAvoid.push("character", "describe what it feels like");
    }
    if (subfields.episodic.frequency) {
      mustAvoid.push("frequency", "how often");
    }
    if (subfields.episodic.episodeDuration) {
      mustAvoid.push("how long does each one last");
    }
    if (state.slots.location || state.slots.known_facts.some(f => /^Abdominal location:/i.test(f))) {
      mustAvoid.push("abdominal_location", "location", "where in your abdomen");
    }
    if (state.slots.associated_symptoms.some(s => /diarrh|loose/i.test(s))) {
      mustAvoid.push("associated_symptoms", "what else you've been noticing", "any other symptoms");
    }

    return {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: `Directly acknowledge what the patient just stated. If they shared a new finding, validate it naturally. Then ask ONE high-yield question: ${nextInquiry?.topic || "clarification"}.`,
      mustAvoidAsking: Array.from(new Set(mustAvoid)),
      nextHighValueInquiry: nextInquiry,
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: defaultPhrasing,
    };
  }
}

export const responsePlanner = new ResponsePlanner();
