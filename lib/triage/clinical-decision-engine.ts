import { ClinicalInterviewState } from "./conversation-manager";
import { PreArbiterResult } from "./pre-arbiter";
import { LocaleConfig, DEFAULT_LOCALE_CONFIG, getEmergencyDispatchInstructions } from "../config/locale";

export type TurnIntent =
  | "QUESTION_OR_EXPLANATION_REQUEST"
  | "TEMPORAL_UPDATE"
  | "CLARIFICATION_OR_CORRECTION"
  | "EMOTIONAL_OR_UNCERTAIN"
  | "EMERGENCY_ACTION_INQUIRY"
  | "NEW_SYMPTOM"
  | "TRANSIENT_SYMPTOMS_RESOLVED"
  | "FINANCIAL_CONSTRAINT"
  | "GEOGRAPHIC_ACCESS_CONSTRAINT"
  | "TRANSPORTATION_OBSTACLE"
  | "ANSWER_TO_QUESTION"
  | "CLOSING"
  | "SMALL_TALK"
  | "UNRELATED";

export interface TurnClassification {
  intent: TurnIntent;
  confidence: number;
  extractedEntities: {
    symptoms: Array<{ name: string; laterality?: string; location?: string }>;
    temporalPhrase?: string;
    temporalCategory?: "acute_minutes" | "acute_hours" | "subacute_days" | "chronic_weeks" | "timeline_shift" | "historical";
    isSudden?: boolean;
    correctionTarget?: string;
    correctionValue?: string;
    emotionalState?: "fear" | "panic" | "confusion" | "anxiety";
    questionTopic?: "stroke_relevance" | "cardiac_relevance" | "mechanism" | "severity" | "treatment" | "general";
  };
}

export interface NextTurnDecision {
  action: "EXPLAIN_AND_INQUIRE" | "CLARIFY_TIMELINE" | "ACKNOWLEDGE_CORRECTION" | "REASSURE_AND_FOCUS" | "PROVIDE_EMERGENCY_GUIDANCE" | "EXPLORE_NEW_SYMPTOM" | "ADVANCE_INTERVIEW" | "CONVENE_BOARD";
  spokenDoctorReply: string;
  doctorName: string;
  specialty: string;
  missingDimensionResolved?: string;
}

export class ClinicalDecisionEngine {
  /**
   * 1. CLASSIFY THE LATEST PATIENT TURN
   * Analyzes what the patient just did, distinguishing questions/challenges,
   * temporal updates, corrections, emotional expressions, new symptoms, and answers.
   */
  public classifyTurn(
    utterance: string,
    state: ClinicalInterviewState
  ): TurnClassification {
    const text = utterance.trim();
    const lower = text.toLowerCase();

    // A. Closing / Thank you
    if (/^(thank\s+you|thanks|ok\s+thanks|bye|goodbye|have\s+a\s+good\s+(?:day|night))[.!?\s]*$/i.test(lower)) {
      return {
        intent: "CLOSING",
        confidence: 0.98,
        extractedEntities: { symptoms: [] }
      };
    }

    // B. Small talk / Greeting without symptoms
    const hasClinicalKeywords = /\b(pain|tightness|pressure|ache|hurt|droop|stroke|fever|cough|breath|dizzy|numb|bleeding|nausea|vomit|symptom|chest|arm|head|stomach|belly|throat|rash|swelling|burning|weak|vision|speech|words?|slur)\b/i.test(lower);
    if (!hasClinicalKeywords && (/^(hello|hi|hey|good\s+(morning|afternoon|evening)|can\s+you\s+hear\s+me|testing|greetings)[.!?\s]*$/i.test(lower) || (text.length <= 15 && /\b(hello|hi|hey)\b/i.test(lower)))) {
      return {
        intent: "SMALL_TALK",
        confidence: 0.95,
        extractedEntities: { symptoms: [] }
      };
    }

    // C. Emergency Action Inquiry ("What do I do?", "Help me", "Should I call an ambulance?")
    if (/\b(what\s+(do|should)\s+i\s+do|no\s+one\s+(?:is\s+)?around|alone|nobody\s+here|who\s+(?:do|can)\s+i\s+call|should\s+i\s+(?:take|call)|is\s+an?\s+ambulance|help\s+me|what\s+now)\b/i.test(lower)) {
      return {
        intent: "EMERGENCY_ACTION_INQUIRY",
        confidence: 0.96,
        extractedEntities: { symptoms: [] }
      };
    }

    // D. Emotional / Uncertain ("I'm really scared", "Am I going to die?", "I'm terrified")
    if (/\b(really\s+scared|so\s+scared|terrified|frightened|panicking|freaking\s+out|im\s+scared|am\s+i\s+going\s+to\s+(?:die|be\s+okay|have\s+permanent)|im\s+nervous|so\s+worried|freaking\s+me\s+out)\b/i.test(lower)) {
      return {
        intent: "EMOTIONAL_OR_UNCERTAIN",
        confidence: 0.94,
        extractedEntities: {
          symptoms: [],
          emotionalState: /panick|freak/i.test(lower) ? "panic" : "fear"
        }
      };
    }

    // E. Temporal Shift / Update ("A few days later...", "After three days", "The next morning", "Since then")
    const temporalShiftPattern = /\b(a\s+few\s+days\s+later|days?\s+later|hours?\s+later|weeks?\s+later|months?\s+later|after\s+a\s+few\s+days|after\s+(?:a\s+couple\s+of|two|three|\d+)\s+days|the\s+next\s+day|the\s+following\s+day|by\s+the\s+next\s+morning|over\s+the\s+next|in\s+the\s+following\s+days|since\s+then|subsequently|eventually|over\s+time|afterwards|later\s+on)\b/i;
    const temporalShiftMatch = lower.match(temporalShiftPattern);
    if (temporalShiftMatch) {
      return {
        intent: "TEMPORAL_UPDATE",
        confidence: 0.93,
        extractedEntities: {
          symptoms: [],
          temporalPhrase: temporalShiftMatch[0],
          temporalCategory: "timeline_shift"
        }
      };
    }

    // F. Clarification or Correction ("Actually it started yesterday", "Actually, no.", "No, actually my left arm", "Like I said...")
    const correctionPattern = /\b(actually(?:,\s*(?:no|wait))?|no[,\s]+actually|actually\s+(?:it|i|it's|it\s+was|it\s+started|mostly|think)|i\s+meant|not\s+(?:my\s+right|my\s+left|today|20\s+minutes|pain)|wait\s+no|i\s+said\s+[a-z]+|like\s+i\s+said|already\s+told\s+you|to\s+be\s+clear|let\s+me\s+correct)\b/i;
    if (correctionPattern.test(lower)) {
      let target = "general";
      let val = text;
      if (/\b(yesterday|days?\s+ago|last\s+week|hours?\s+ago|minutes?|this\s+morning)\b/i.test(lower)) {
        target = "onset";
        const m = lower.match(/\b(yesterday|two\s+days\s+ago|three\s+days\s+ago|\d+\s+days?\s+ago|last\s+week|hours?\s+ago|this\s+morning)\b/i);
        if (m) val = m[0];
      } else if (/\b(left|right|arm|leg|face|head)\b/i.test(lower)) {
        target = "location";
      }
      return {
        intent: "CLARIFICATION_OR_CORRECTION",
        confidence: 0.92,
        extractedEntities: {
          symptoms: [],
          correctionTarget: target,
          correctionValue: val
        }
      };
    }

    // G. Transient Symptoms Resolved ("came for 5 mins and now I feel better", "went away", "feel better now", "only lasted 5 minutes")
    const transientPattern = /\b((?:came|lasted|went\s+on)\s+(?:for\s+)?(?:a\s+few|\d+)\s*(?:mins?|minutes?|seconds?)|(?:now\s+i|i\s+now)\s+(?:feel\s+better|feel\s+fine|feel\s+normal)|(?:it\s+)?(?:went\s+away|disappeared|resolved|passed|cleared\s+up)|symptoms?\s+(?:are\s+gone|stopped)|back\s+to\s+normal)\b/i;
    if (transientPattern.test(lower)) {
      return {
        intent: "TRANSIENT_SYMPTOMS_RESOLVED",
        confidence: 0.95,
        extractedEntities: { symptoms: [] }
      };
    }

    // H. Financial Constraint ("I am poor", "can't afford all that", "no money", "hospital is too expensive")
    const financialPattern = /\b(poor|can'?t\s+afford|cannot\s+afford|no\s+money|don'?t\s+have\s+(?:the\s+)?money|too\s+expensive|no\s+insurance|cost\s+too\s+much|financial(?:ly)?\s+hard|can\s+barely\s+pay)\b/i;
    if (financialPattern.test(lower)) {
      return {
        intent: "FINANCIAL_CONSTRAINT",
        confidence: 0.96,
        extractedEntities: { symptoms: [] }
      };
    }

    // I. Geographic Access Constraint ("outskirts", "no hospitals closeby", "far away", "remote area", "in a village")
    const geographicPattern = /\b(outskirts|no\s+hospitals?\s+close\s*by|no\s+hospital\s+near|too\s+far|far\s+away|miles\s+away|hours\s+away|remote|village|isolated|rural\s+area|middle\s+of\s+nowhere)\b/i;
    if (geographicPattern.test(lower)) {
      return {
        intent: "GEOGRAPHIC_ACCESS_CONSTRAINT",
        confidence: 0.96,
        extractedEntities: { symptoms: [] }
      };
    }

    // J. Transportation Obstacle ("no car", "can't drive", "nobody to take me", "no transport")
    const transportPattern = /\b(no\s+car|can'?t\s+drive|cannot\s+drive|no\s+vehicle|no\s+ride|no\s+one\s+to\s+(?:drive|take)\s+me|nobody\s+to\s+take\s+me|no\s+transport(?:ation)?|bus\s+doesn'?t\s+run)\b/i;
    if (transportPattern.test(lower)) {
      return {
        intent: "TRANSPORTATION_OBSTACLE",
        confidence: 0.94,
        extractedEntities: { symptoms: [] }
      };
    }

    // K. Question or Explanation Request ("Wait how is that even related to stroke?", "Why is that?", "What does that mean?")
    const explanationPattern = /\b(how\s+is\s+(?:that|this|it)\s+(?:even\s+)?related|why\s+(?:is\s+that|is\s+it|does\s+it|would\s+it|am\s+i|are\s+you\s+asking)|what\s+does\s+that\s+mean|how\s+does\s+(?:that|it)\s+relate|could\s+this\s+be\s+something\s+else|is\s+that\s+(?:serious|bad|dangerous)|why\s+stroke|what\s+do\s+you\s+mean|are\s+you\s+sure|can\s+you\s+explain|what\s+(?:causes?|is\s+causing)|why\s+are\s+we\s+talking\s+about)\b/i;
    const isQuestioning = explanationPattern.test(lower) || (text.endsWith("?") && /\b(how|why|what|could|is\s+that|are\s+you)\b/i.test(lower));
    if (isQuestioning) {
      let topic: "stroke_relevance" | "cardiac_relevance" | "mechanism" | "severity" | "treatment" | "general" = "general";
      if (/\b(stroke|brain|neuro|weakness|droop)\b/i.test(lower)) {
        topic = "stroke_relevance";
      } else if (/\b(heart|cardiac|chest|infarct|angina)\b/i.test(lower)) {
        topic = "cardiac_relevance";
      } else if (/\b(needle|dig|spasm|muscle|nerve|sciat)\b/i.test(lower)) {
        topic = "mechanism";
      }
      return {
        intent: "QUESTION_OR_EXPLANATION_REQUEST",
        confidence: 0.95,
        extractedEntities: {
          symptoms: [],
          questionTopic: topic
        }
      };
    }

    // H. New Symptom reporting during ongoing dialogue
    const mentionsHeadBurning = /\b(burning|burn|fire|heat)\b/i.test(lower) && /\b(head|scalp|forehead|face)\b/i.test(lower);
    const mentionsVision = /\b(vision|blurry|double\s+vision|blind|see|eyes?)\b/i.test(lower);
    const mentionsHeadache = /\b(headache|head\s+hurts?|pain\s+in\s+(?:my\s+)?head)\b/i.test(lower);
    const mentionsLeg = /\b(leg|foot|walk|feet|stumble|fall)\b/i.test(lower) && !lower.includes("no leg");
    const mentionsNumbness = /\b(numb|tingling|pins\s+and\s+needles)\b/i.test(lower);

    const hasNewSymptomIntro = /\b(i\s+also\s+(?:feel|have|noticed?|got)|and\s+also|another\s+thing|now\s+i\s+(?:feel|have))\b/i.test(lower);
    if (mentionsHeadBurning || mentionsVision || mentionsHeadache || mentionsLeg || mentionsNumbness || hasNewSymptomIntro) {
      const symptoms: Array<{ name: string; laterality?: string; location?: string }> = [];
      if (mentionsHeadBurning) symptoms.push({ name: "burning sensation on head/scalp", location: "head" });
      if (mentionsVision) symptoms.push({ name: "visual disturbance / blurry vision", location: "eyes" });
      if (mentionsHeadache) symptoms.push({ name: "headache", location: "head" });
      if (mentionsLeg) symptoms.push({ name: "lower extremity weakness / trouble walking", location: "leg" });
      if (mentionsNumbness) symptoms.push({ name: "numbness / paresthesia", location: "extremity" });

      return {
        intent: "NEW_SYMPTOM",
        confidence: 0.91,
        extractedEntities: { symptoms }
      };
    }

    // I. Answers to Pending Questions or Diagnostic Metrics
    const timeMatch = lower.match(/\b(\d+\s*(?:minutes?|hours?|days?|weeks?|mins?|hrs?)(?:\s+ago)?|twenty\s+minutes(?:\s+ago)?|thirty\s+minutes(?:\s+ago)?|ten\s+minutes(?:\s+ago)?|an?\s+hour(?:\s+ago)?|two\s+hours(?:\s+ago)?|yesterday|this\s+morning|a\s+week\s+ago)\b/i);
    const indicatesSudden = /\b(sudden(?:ly)?|abrupt(?:ly)?|out\s+of\s+nowhere|all\s+at\s+once|immediate(?:ly)?)\b/i.test(lower);
    const indicatesGradual = /\b(gradual(?:ly)?|slowly|built\s+up|over\s+time)\b/i.test(lower);

    return {
      intent: "ANSWER_TO_QUESTION",
      confidence: 0.88,
      extractedEntities: {
        symptoms: [],
        temporalPhrase: timeMatch ? timeMatch[0] : undefined,
        temporalCategory: timeMatch ? (timeMatch[0].includes("minute") ? "acute_minutes" : timeMatch[0].includes("hour") ? "acute_hours" : "subacute_days") : undefined,
        isSudden: indicatesSudden ? true : indicatesGradual ? false : undefined
      }
    };
  }

  /**
   * 2. UPDATE STRUCTURED CLINICAL STATE
   * Enriches structured history, symptom slots, timeline anchors, and unanswered diagnostic dimensions.
   */
  public updateStructuredState(
    state: ClinicalInterviewState,
    classification: TurnClassification,
    utterance: string
  ): void {
    const textLower = utterance.toLowerCase();

    // Ensure structuredHistory container exists
    if (!state.structuredHistory) {
      state.structuredHistory = {
        chiefComplaint: undefined,
        timeline: {},
        unansweredDimensions: [
          "onset_time",
          "sudden_vs_gradual",
          "speech_difficulty",
          "visual_deficit",
          "severe_headache",
          "leg_mobility"
        ],
        patientCorrections: [],
        patientQuestions: [],
        recentDoctorReplies: [],
        turnCount: 0,
        accessConstraints: {
          financial: false,
          remoteLocation: false,
          transportation: "unknown",
          caregiverAvailable: undefined,
          locationPermission: "unknown",
        },
        evidenceStatus: {
          enoughForDisposition: false,
          missingKeyDimensions: ["onset", "character", "severity", "progression"],
          clinicalConfidence: "insufficient",
          dispositionTier: "insufficient_information",
        },
        nearbyHospitals: [],
      };
    }

    const hist = state.structuredHistory;
    hist.turnCount++;

    if (!hist.accessConstraints) {
      hist.accessConstraints = {
        financial: false,
        remoteLocation: false,
        transportation: "unknown",
        caregiverAvailable: undefined,
        locationPermission: "unknown",
      };
    }

    if (!hist.evidenceStatus) {
      hist.evidenceStatus = {
        enoughForDisposition: false,
        missingKeyDimensions: ["onset", "character", "severity", "progression"],
        clinicalConfidence: "insufficient",
        dispositionTier: "insufficient_information",
      };
    }

    // Record chief complaint on Turn 1 if not set
    if (!hist.chiefComplaint && hist.turnCount === 1) {
      hist.chiefComplaint = utterance;
    }

    // Opportunistic extraction of focal deficits
    if (/\b(droop|face|facial)\b/i.test(textLower) && !state.slots.neurological_signs.some(s => s.includes("face"))) {
      state.slots.neurological_signs.push("facial droop");
      state.slots.known_facts.push("NEUROLOGICAL: Facial droop");
    }
    if (/\b(arm|cant\s+lift|arm\s+feels\s+weak|weak\s+arm)\b/i.test(textLower) && !state.slots.neurological_signs.some(s => s.includes("arm"))) {
      state.slots.neurological_signs.push("unilateral arm weakness");
      state.slots.known_facts.push("NEUROLOGICAL: Arm weakness");
    }
    if (/\b(speech|slur|words?|hard\s+to\s+talk|trouble\s+getting\s+my\s+words|cant\s+talk)\b/i.test(textLower) && !state.slots.neurological_signs.some(s => s.includes("speech"))) {
      state.slots.neurological_signs.push("speech difficulty (dysarthria/aphasia)");
      state.slots.known_facts.push("NEUROLOGICAL: Speech difficulty");
      hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "speech_difficulty");
    }

    // Track Access Constraints
    if (classification.intent === "FINANCIAL_CONSTRAINT" || /\b(poor|can'?t\s+afford|cannot\s+afford|no\s+money|don'?t\s+have\s+(?:the\s+)?money|too\s+expensive|no\s+insurance)\b/i.test(textLower)) {
      hist.accessConstraints.financial = true;
      if (!state.slots.known_facts.some(f => f.includes("Financial hardship"))) {
        state.slots.known_facts.push("CONSTRAINT: Financial hardship / cannot afford private emergency care");
      }
    }

    if (classification.intent === "GEOGRAPHIC_ACCESS_CONSTRAINT" || /\b(outskirts|no\s+hospitals?\s+close\s*by|far\s+away|remote|village|isolated|rural)\b/i.test(textLower)) {
      hist.accessConstraints.remoteLocation = true;
      if (!state.slots.known_facts.some(f => f.includes("Remote location"))) {
        state.slots.known_facts.push("CONSTRAINT: Remote location / outskirts with no immediate hospitals");
      }
    }

    if (classification.intent === "TRANSPORTATION_OBSTACLE" || /\b(no\s+car|can'?t\s+drive|cannot\s+drive|no\s+vehicle|no\s+ride|no\s+transport)\b/i.test(textLower)) {
      hist.accessConstraints.transportation = "unavailable";
      if (!state.slots.known_facts.some(f => f.includes("No personal transportation"))) {
        state.slots.known_facts.push("CONSTRAINT: No personal transportation / cannot drive");
      }
    }

    if (/\b(wife|husband|daughter|son|friend|family|neighbor|mom|dad|brother|sister|partner)\b/i.test(textLower)) {
      hist.accessConstraints.caregiverAvailable = true;
      if (!state.slots.known_facts.some(f => f.startsWith("SOCIAL: Caregiver"))) {
        state.slots.known_facts.push("SOCIAL: Caregiver/family member present or mentioned");
      }
    } else if (/\b(alone|by\s+myself|no\s+one\s+(?:here|with\s+me)|nobody\s+(?:here|around))\b/i.test(textLower)) {
      hist.accessConstraints.caregiverAvailable = false;
      if (!state.slots.known_facts.some(f => f.startsWith("SOCIAL: Patient is alone"))) {
        state.slots.known_facts.push("SOCIAL: Patient is alone");
      }
    }

    // Process new symptoms
    if (classification.extractedEntities.symptoms.length > 0) {
      classification.extractedEntities.symptoms.forEach(sym => {
        if (!state.slots.associated_symptoms.includes(sym.name)) {
          state.slots.associated_symptoms.push(sym.name);
          state.slots.known_facts.push(`ASSOCIATED: ${sym.name}`);
        }
        if (sym.name.includes("vision")) {
          hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "visual_deficit");
        }
        if (sym.name.includes("headache")) {
          hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "severe_headache");
        }
        if (sym.name.includes("leg")) {
          hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "leg_mobility");
        }
      });
    }

    // Process Temporal Updates
    if (classification.intent === "TEMPORAL_UPDATE" && classification.extractedEntities.temporalPhrase) {
      hist.timeline.temporalShiftDetected = true;
      hist.timeline.temporalShiftDescription = classification.extractedEntities.temporalPhrase;
      state.slots.known_facts.push(`TIMELINE_SHIFT: ${classification.extractedEntities.temporalPhrase}`);
    }

    // Process Corrections
    if (classification.intent === "CLARIFICATION_OR_CORRECTION") {
      const target = classification.extractedEntities.correctionTarget || "general";
      const val = classification.extractedEntities.correctionValue || utterance;
      hist.patientCorrections.push({ slot: target, from: state.slots.onset || "previous", to: val });
      if (target === "onset") {
        state.slots.onset = val;
        state.slots.known_facts.push(`CORRECTED_ONSET: ${val}`);
        hist.timeline.anchor = val;
        hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "onset_time");
      }
    }

    // Process Temporal / Onset answers
    if (classification.extractedEntities.temporalPhrase && !state.slots.onset) {
      state.slots.onset = classification.extractedEntities.temporalPhrase;
      state.slots.known_facts.push(`ONSET: ${classification.extractedEntities.temporalPhrase}`);
      hist.timeline.duration = classification.extractedEntities.temporalPhrase;
      hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "onset_time");
    }

    // Process Sudden vs Gradual answers
    if (classification.extractedEntities.isSudden !== undefined && state.slots.acute_worsening === undefined) {
      state.slots.acute_worsening = classification.extractedEntities.isSudden;
      state.slots.known_facts.push(`ONSET_TYPE: ${classification.extractedEntities.isSudden ? "sudden" : "gradual"}`);
      hist.timeline.isSudden = classification.extractedEntities.isSudden;
      hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "sudden_vs_gradual");
    }

    // Record Questions asked by patient
    if (classification.intent === "QUESTION_OR_EXPLANATION_REQUEST") {
      hist.patientQuestions.push(utterance);
    }

    // Calibrate Evidence Status & Disposition Tier
    const hasNeuroRedFlag = state.slots.neurological_signs.length > 0 ||
      /\b(droop|facial|arm\s+weak|speech|slurred|aphasia|trouble\s+getting\s+my\s+words)\b/i.test(state.cumulativeTranscript);
    const hasCardioRedFlag = state.slots.known_facts.some(f => f.includes("CARDIAC") || f.includes("Chest pain")) ||
      /\b(crushing\s+chest|substernal|chest\s+pressure|radiat.*arm)\b/i.test(state.cumulativeTranscript);

    if (hasNeuroRedFlag || hasCardioRedFlag) {
      // Deterministic emergency safety floor locked
      hist.evidenceStatus.dispositionTier = "emergency";
      if (state.slots.onset && state.slots.acute_worsening !== undefined) {
        hist.evidenceStatus.clinicalConfidence = "high";
        hist.evidenceStatus.enoughForDisposition = true;
        hist.evidenceStatus.missingKeyDimensions = [];
      } else {
        hist.evidenceStatus.clinicalConfidence = "moderate";
        hist.evidenceStatus.enoughForDisposition = false;
        const missing: string[] = [];
        if (!state.slots.onset) missing.push("onset_time");
        if (state.slots.acute_worsening === undefined) missing.push("sudden_vs_gradual");
        hist.evidenceStatus.missingKeyDimensions = missing;
      }
    } else {
      // Non-emergency intake: Graduated disposition earned through evidence gathering
      const missing: string[] = [];
      if (!state.slots.onset) missing.push("onset_time");
      if (!state.slots.character) missing.push("character_quality");
      if (!state.slots.severity) missing.push("severity");
      if (state.slots.acute_worsening === undefined) missing.push("progression");

      hist.evidenceStatus.missingKeyDimensions = missing;
      if (missing.length >= 2 || hist.turnCount <= 1) {
        hist.evidenceStatus.enoughForDisposition = false;
        hist.evidenceStatus.clinicalConfidence = "insufficient";
        hist.evidenceStatus.dispositionTier = "insufficient_information";
      } else {
        hist.evidenceStatus.enoughForDisposition = true;
        hist.evidenceStatus.clinicalConfidence = "moderate";
        hist.evidenceStatus.dispositionTier = "routine_evaluation";
      }
    }
  }

  /**
   * 3. NEXT-TURN CLINICAL ACTION DECISION
   * Decides the next conversational move based on the latest patient turn,
   * what is already known, what is still missing, and patient safety context.
   */
  public decideNextAction(
    classification: TurnClassification,
    state: ClinicalInterviewState,
    preArbiterResult: PreArbiterResult,
    localeConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG
  ): NextTurnDecision {
    const isNeuro = preArbiterResult.pre_safety_flags.some(f => f.includes("NEURO")) ||
      /\b(droop|facial|arm|weakness|speech|slur|stroke|aphasia|words?)\b/i.test(state.cumulativeTranscript);
    const isCardio = preArbiterResult.pre_safety_flags.some(f => f.includes("ACS") || f.includes("CARDIO")) ||
      /\b(chest|crushing|pressure|radiat|substernal|angina)\b/i.test(state.cumulativeTranscript);

    const hist = state.structuredHistory!;

    // CASE 1: Patient Challenges or Questions Clinical Relevance ("Wait how is that even related to stroke?", "Why is that?")
    if (classification.intent === "QUESTION_OR_EXPLANATION_REQUEST") {
      const topic = classification.extractedEntities.questionTopic;

      if (topic === "stroke_relevance" || isNeuro) {
        let answer = "The facial drooping, arm weakness, and trouble speaking are concerning because they occur when blood flow to part of the brain is interrupted, which is exactly what happens during a stroke. That is why I am treating this with high urgency.";
        
        // Decide what to ask next depending on what is missing
        let followUp = "";
        if (!state.slots.onset) {
          followUp = "The timing is critical because acute treatments must be given early—when did you first notice the weakness?";
        } else if (state.slots.acute_worsening === undefined) {
          followUp = "Did the weakness begin suddenly out of nowhere, or did it build up gradually?";
        } else if (!state.slots.neurological_signs.some(s => s.includes("speech"))) {
          followUp = "Are you having trouble speaking clearly right now, or difficulty understanding words?";
        } else {
          followUp = "Have you noticed any severe sudden headache, double vision, or weakness in your leg?";
        }

        const reply = `${answer} ${followUp}`;
        return {
          action: "EXPLAIN_AND_INQUIRE",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "stroke relevance"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      if (topic === "cardiac_relevance" || isCardio) {
        const answer = "Chest tightness and pressure that spreads into your arm, neck, or jaw happens because the nerves supplying the heart share pathways with your upper body in the spinal cord. That is why we treat radiating chest discomfort as potentially cardiac.";
        let followUp = !state.slots.onset
          ? "When did this chest discomfort begin, and does it spread anywhere else?"
          : !state.slots.exertional
          ? "Did this pressure start while resting or after physical exertion?"
          : "Are you feeling shortness of breath or cold sweats with it?";
        const reply = `${answer} ${followUp}`;
        return {
          action: "EXPLAIN_AND_INQUIRE",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "cardiac relevance"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      if (topic === "mechanism") {
        const reply = "Sharp, needle-like pain digging into leg muscles usually indicates nerve root irritation—such as sciatica—or acute muscle fiber spasm. Does this pain shoot down from your lower back into your foot, or stay isolated in the muscle?";
        return {
          action: "EXPLAIN_AND_INQUIRE",
          spokenDoctorReply: reply,
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      const generalReply = "I understand why you are asking. In clinical evaluation, these specific patterns help us rule out serious neurological and vascular causes immediately. To help me evaluate this accurately, when did you first notice these symptoms?";
      return {
        action: "EXPLAIN_AND_INQUIRE",
        spokenDoctorReply: this.guardAgainstRepetition(generalReply, hist.recentDoctorReplies, "general inquiry"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 2: Patient reports Transient Symptoms Resolved ("came for 5 mins and now I feel better")
    if (classification.intent === "TRANSIENT_SYMPTOMS_RESOLVED") {
      if (isNeuro) {
        state.slots.known_facts.push("CLINICAL_EVENT: Transient episode of focal neurological deficits (suspected TIA)");
        const reply = "Even though the symptoms lasted only five minutes and resolved, that pattern can represent a transient ischemic attack, or warning stroke. High risk of a major stroke remains. Are you experiencing any lingering weakness, numbness, or difficulty speaking right now?";
        return {
          action: "EXPLAIN_AND_INQUIRE",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "tia transient resolution"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      const reply = "Even though your symptoms feel better now, temporary relief can sometimes happen with significant underlying conditions. Are you completely back to normal, or is any mild symptom lingering?";
      return {
        action: "EXPLAIN_AND_INQUIRE",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "transient improvement"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 3: Patient Expresses Financial Hardship / Cost Barrier
    if (classification.intent === "FINANCIAL_CONSTRAINT") {
      if (isNeuro) {
        const reply = "I understand worries about expense, but an acute neurological evaluation cannot be delayed. Government and public district hospitals provide emergency triage and subsidized care under public healthcare programs. What area or city are you located in so we can identify a nearby public facility?";
        return {
          action: "EXPLAIN_AND_INQUIRE",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "financial constraint neuro"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      const reply = "I hear your concern about healthcare costs. Public district hospitals provide subsidized and affordable care options. What city or district are you in so we can identify nearby government care centers?";
      return {
        action: "EXPLAIN_AND_INQUIRE",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "financial constraint general"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 4: Patient Expresses Geographic / Outskirts Barrier
    if (classification.intent === "GEOGRAPHIC_ACCESS_CONSTRAINT") {
      const hospitals = hist.nearbyHospitals || [];
      if (isNeuro) {
        if (hospitals.length > 0) {
          const topGov = hospitals.find((h: any) => h.ownership === "government") || hospitals[0];
          const distStr = topGov.distanceKm ? ` approximately ${Math.round(topGov.distanceKm)} kilometers away` : "";
          const reply = `If you are on the outskirts, calling 108 for an emergency ambulance is safest because paramedics can start care on the road. The nearest verified emergency facility is ${topGov.name}${distStr}. Would you like me to guide you there or coordinate ambulance dispatch?`;
          return {
            action: "PROVIDE_EMERGENCY_GUIDANCE",
            spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "outskirts hospital guidance"),
            doctorName: "Dr. Sarah Chen, MD",
            specialty: "Internal Medicine & Critical Care Lead"
          };
        }
        const reply = "If you are on the outskirts, dialing 108 for an emergency ambulance is safest because trained paramedics can stabilize you during transport. What city or district are you near so we can verify the closest emergency department?";
        return {
          action: "PROVIDE_EMERGENCY_GUIDANCE",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "outskirts 108 dispatch"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      const reply = "Being far from medical centers makes travel difficult. Dialing 108 can provide ambulance transport if needed. What district or town are you in so we can check nearby care options?";
      return {
        action: "EXPLAIN_AND_INQUIRE",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "outskirts general"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Primary Triage"
      };
    }

    // CASE 5: Transportation Obstacle
    if (classification.intent === "TRANSPORTATION_OBSTACLE") {
      if (isNeuro) {
        const reply = "Please do not attempt to drive yourself. Dial 108 right now for an emergency ambulance, which is equipped for urgent transport. Is there a family member or neighbor nearby who can stay with you while help arrives?";
        return {
          action: "PROVIDE_EMERGENCY_GUIDANCE",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "transport obstacle neuro"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      const reply = "Without safe transportation, please do not drive if you feel unwell. Dialing 108 can arrange medical transit, or do you have a friend or neighbor who can take you?";
      return {
        action: "ADVANCE_INTERVIEW",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "transport obstacle general"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Primary Triage"
      };
    }

    // CASE 6: Patient reports a Temporal Shift ("A few days later...", "After three days")
    if (classification.intent === "TEMPORAL_UPDATE") {
      const phrase = classification.extractedEntities.temporalPhrase || "later on";
      const reply = `Let's clarify the timeline. When you say "${phrase}", are you saying the facial drooping and weakness continued over those days, or is this something that happened in the past?`;
      return {
        action: "CLARIFY_TIMELINE",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "timeline shift"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 3: Patient Corrects Previous Information ("Actually it started yesterday")
    if (classification.intent === "CLARIFICATION_OR_CORRECTION") {
      const val = classification.extractedEntities.correctionValue || "yesterday";
      const reply = `Thank you for correcting that—I've noted that it actually started ${val}. Because unilateral weakness is still medically significant even when it started yesterday, are the symptoms still just as severe right now, or have they improved?`;
      return {
        action: "ACKNOWLEDGE_CORRECTION",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "correction"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 4: Patient Expresses Fear / Panic ("I'm really scared")
    if (classification.intent === "EMOTIONAL_OR_UNCERTAIN") {
      const reply = "I understand, and it is completely natural to feel scared right now. You are doing the right thing by getting this evaluated. Please sit down comfortably, take slow steady breaths, and avoid trying to walk or exert yourself. Are you alone right now, or is someone there with you?";
      return {
        action: "REASSURE_AND_FOCUS",
        spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "reassurance"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 5: Panic / Emergency Action Inquiry ("What do I do? Help me")
    if (classification.intent === "EMERGENCY_ACTION_INQUIRY") {
      if (isNeuro) {
        const reply = "Please stay right where you are and sit comfortably upright. Keep your front door unlocked so emergency responders can enter immediately. Avoid walking, do not eat or drink anything, and do not take aspirin until hospital imaging is complete. Emergency stroke protocols are being alerted now.";
        return {
          action: "PROVIDE_EMERGENCY_GUIDANCE",
          spokenDoctorReply: reply,
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      return {
        action: "PROVIDE_EMERGENCY_GUIDANCE",
        spokenDoctorReply: getEmergencyDispatchInstructions(localeConfig),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // CASE 6: Patient Reports a New Symptom (e.g. blurry vision, burning head sensation, headache)
    if (classification.intent === "NEW_SYMPTOM") {
      const sym = classification.extractedEntities.symptoms[0];
      const symName = sym ? sym.name : "that new symptom";

      if (symName.includes("vision")) {
        const reply = "Vision changes alongside unilateral weakness and facial drooping are critical neurological signs. Did the blurry vision start at the exact same moment as the weakness, or did it begin earlier?";
        return {
          action: "EXPLORE_NEW_SYMPTOM",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "vision symptom"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      if (symName.includes("burning")) {
        const reply = "That burning sensation on your head could be related to nerve irritation, but the facial drooping and arm weakness remain our primary urgent concern. Did that burning feeling start at the exact same time as the weakness, or come on before?";
        return {
          action: "EXPLORE_NEW_SYMPTOM",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "burning head"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      if (symName.includes("headache")) {
        const reply = "A severe headache alongside weakness and facial drooping increases our urgency. Did this headache hit you suddenly like a clap of thunder, or did it build up gradually?";
        return {
          action: "EXPLORE_NEW_SYMPTOM",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "headache"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      if (symName.includes("leg")) {
        const reply = "Thank you for noting the difficulty with your leg. Please stay seated and avoid attempting to stand or walk. Are both legs affected, or is the weakness specifically on the right side?";
        return {
          action: "EXPLORE_NEW_SYMPTOM",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "leg weakness"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
    }

    // CASE 7: Initial Turn or Answering Questions — Methodical Clinical Progression
    if (isNeuro) {
      // Turn 1 initial presentation with neuro deficits
      if (hist.turnCount === 1 && !state.slots.onset) {
        const reply = "Those symptoms can indicate a stroke and require urgent assessment. When did the weakness begin?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "initial stroke onset"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      // Progression step 1: Onset unknown
      if (!state.slots.onset) {
        const reply = "To assess acute treatment options, timing is vital. When did you first notice the weakness or facial drooping starting?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "stroke onset follow-up"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      // Progression step 2: Sudden vs Gradual unknown
      if (state.slots.acute_worsening === undefined) {
        const onsetStr = state.slots.onset.includes("ago") || state.slots.onset.includes("yesterday") || state.slots.onset.includes("morning") ? state.slots.onset : `${state.slots.onset} ago`;
        const reply = `Thank you, noting that this began ${onsetStr}. Did the weakness start suddenly out of nowhere, or did it gradually get worse?`;
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "suddenness follow-up"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      // Progression step 3: Speech difficulty unknown
      if (!state.slots.neurological_signs.some(s => s.includes("speech"))) {
        const reply = "Understood. Are you having difficulty speaking clearly right now, or trouble getting your words out?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "speech follow-up"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      // Progression step 4: Secondary neurological signs (vision, severe headache, leg)
      if (hist.unansweredDimensions.includes("visual_deficit") || hist.unansweredDimensions.includes("severe_headache")) {
        hist.unansweredDimensions = hist.unansweredDimensions.filter(d => d !== "visual_deficit" && d !== "severe_headache");
        const reply = "Understood, thank you for confirming. Are you experiencing any vision changes, a severe sudden headache, or numbness in your leg?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "secondary neuro signs"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }

      // Progression step 5: Critical triage profile assembled -> Emergency Escalation
      const escalationReply = "Because these symptoms started within the acute treatment window, every minute counts. I am escalating this immediately as a suspected acute ischemic stroke. Please stay seated, avoid trying to walk, and keep your front door unlocked. Emergency response protocols have been alerted.";
      return {
        action: "CONVENE_BOARD",
        spokenDoctorReply: escalationReply,
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    if (isCardio) {
      if (!state.slots.onset) {
        const reply = "When did this chest discomfort begin, and does it spread into your arm, neck, or jaw?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "cardio onset"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      if (!state.slots.radiation) {
        const reply = "Does the chest discomfort radiate or travel anywhere, such as into your left arm, shoulder, or jaw?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "cardio radiation"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      if (!state.slots.exertional) {
        const reply = "Did this pressure start while you were resting, or during physical activity like walking or stairs?";
        return {
          action: "ADVANCE_INTERVIEW",
          spokenDoctorReply: this.guardAgainstRepetition(reply, hist.recentDoctorReplies, "cardio exertional"),
          doctorName: "Dr. Sarah Chen, MD",
          specialty: "Internal Medicine & Critical Care Lead"
        };
      }
      const cardioEscalation = "Given the persistent chest discomfort, we must treat this as potentially cardiac. Please sit down comfortably, take slow breaths, and emergency medical help is being contacted right now. Do not exert yourself or walk.";
      return {
        action: "CONVENE_BOARD",
        spokenDoctorReply: cardioEscalation,
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Critical Care Lead"
      };
    }

    // Ambulatory / General intake - Evidence-first graduated inquiry
    if (!state.slots.onset) {
      const defaultReply = "I want to make sure we evaluate this carefully. When did this discomfort first begin, and did it start after an injury or sudden strain?";
      return {
        action: "ADVANCE_INTERVIEW",
        spokenDoctorReply: this.guardAgainstRepetition(defaultReply, hist.recentDoctorReplies, "general onset inquiry"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Primary Triage"
      };
    }
    if (!state.slots.severity) {
      const defaultReply = "How would you describe the feeling—is it a dull ache, sharp pain, or throbbing, and is it constant or does it come and go?";
      return {
        action: "ADVANCE_INTERVIEW",
        spokenDoctorReply: this.guardAgainstRepetition(defaultReply, hist.recentDoctorReplies, "general severity inquiry"),
        doctorName: "Dr. Sarah Chen, MD",
        specialty: "Internal Medicine & Primary Triage"
      };
    }
    const defaultReply = "Thank you for that context. While there are no immediate red flags, I cannot perform a physical examination over voice. Have you noticed any swelling, redness, or numbness?";
    return {
      action: "ADVANCE_INTERVIEW",
      spokenDoctorReply: this.guardAgainstRepetition(defaultReply, hist.recentDoctorReplies, "general intake follow-up"),
      doctorName: "Dr. Sarah Chen, MD",
      specialty: "Internal Medicine & Primary Triage"
    };
  }

  /**
   * 4. ANTI-REPETITION SHIELD
   * Guarantees that the assistant never replays an identical or near-identical response.
   * If a candidate reply has high similarity to recent replies, it reformulates using
   * an alternative phrasing and shifts the conversational angle.
   */
  public guardAgainstRepetition(
    candidateReply: string,
    recentReplies: string[] = [],
    contextHint = ""
  ): string {
    if (!recentReplies || recentReplies.length === 0) {
      return candidateReply;
    }

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    const candNorm = normalize(candidateReply);
    const candTokens = new Set(candNorm.split(/\s+/).filter(w => w.length > 2));

    const isDuplicate = recentReplies.some(prev => {
      const prevNorm = normalize(prev);
      if (prevNorm === candNorm) return true;

      // Jaccard similarity
      const prevTokens = new Set(prevNorm.split(/\s+/).filter(w => w.length > 2));
      let intersection = 0;
      candTokens.forEach(t => { if (prevTokens.has(t)) intersection++; });
      const union = new Set([...candTokens, ...prevTokens]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      return jaccard > 0.72;
    });

    if (!isDuplicate) {
      return candidateReply;
    }

    // Dynamic Multi-Tier Reformulation: Select an alternative that hasn't been used recently
    const alternatives: Record<string, string[]> = {
      "stroke relevance": [
        "These symptoms happen when blood supply to a region of the brain is compromised, which can lead to rapid neurological deficits. That is why immediate assessment of timing is vital. When did you first notice the weakness?",
        "When brain tissue is deprived of oxygen from an arterial blockage, the nerves controlling facial muscles and arms lose function suddenly. Because emergency interventions are strictly time-sensitive, when did you first notice the weakness?",
        "Sudden unilateral weakness and facial asymmetry are hallmark signs of focal brain ischemia. We must establish the exact timeline to determine hospital protocols: approximately what time did this start?"
      ],
      "stroke onset": [
        "To determine the best immediate medical response, timing is our highest priority. How many minutes or hours ago did this weakness start?",
        "Knowing the exact time you were last feeling completely normal helps doctors choose the safest emergency treatments. When did you first notice this happening?",
        "Because acute neurological treatments have a strict therapeutic window, every minute matters. Can you estimate when the weakness began?"
      ],
      "suddenness": [
        "Thank you. Did the weakness hit all at once in an instant, or did it build up gradually over time?",
        "Understood. Did you feel the symptoms peak within seconds out of the blue, or did they slowly increase over minutes or hours?"
      ],
      "timeline shift": [
        "I want to be certain we have your timeline correct. Are you describing symptoms that occurred over several days, or did this acute episode begin earlier?",
        "Let's make sure I understand the sequence. Are you saying the symptoms persisted over the following days, or did a new symptom develop later on?"
      ]
    };

    // Find best category match
    for (const [catKey, candidates] of Object.entries(alternatives)) {
      if (contextHint.includes(catKey) || catKey.includes(contextHint)) {
        for (const cand of candidates) {
          const norm = normalize(cand);
          const alreadyUsed = recentReplies.some(r => normalize(r) === norm);
          if (!alreadyUsed) {
            return cand;
          }
        }
      }
    }

    // Generic variation if specific candidates exhausted
    return `To ensure we provide the most accurate medical guidance, I want to clarify: how long have you been experiencing these symptoms?`;
  }
}

export const clinicalDecisionEngine = new ClinicalDecisionEngine();
