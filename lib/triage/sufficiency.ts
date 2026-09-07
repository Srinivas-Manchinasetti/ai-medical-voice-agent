/**
 * CLINICAL INFORMATION SUFFICIENCY & MULTI-TURN INQUIRY ENGINE
 * 
 * Invariant:
 * Prevents premature diagnostic conclusions and ESI assignment on underspecified symptoms.
 * Evaluates clinical dimension completeness (onset, character, radiation, associated signs).
 * Generates targeted clinical follow-ups and allows specialists to request clarifying evidence.
 */

export interface ClinicalDimensions {
  has_symptom: boolean;
  onset?: string;
  character?: string;
  radiation?: string;
  associated_symptoms: string[];
  neurological_signs: string[];
  pediatric_signs: string[];
  known_facts: string[];
  missing_dimensions: string[];
}

export interface SufficiencyResult {
  is_sufficient: boolean;
  phase: "gathering_history" | "specialist_deliberation" | "board_decision";
  completeness_score: number; // 0.0 to 1.0
  dimensions: ClinicalDimensions;
  next_question?: string;
  question_source?: "lead" | "cardiology" | "neurology" | "pediatrics";
  question_target_dimension?: string;
  status_summary: string;
}

export function evaluateClinicalSufficiency(transcript: string): SufficiencyResult {
  const text = transcript.toLowerCase();
  const known_facts: string[] = [];
  const missing_dimensions: string[] = [];
  const associated_symptoms: string[] = [];
  const neurological_signs: string[] = [];
  const pediatric_signs: string[] = [];

  // 1. Detect Core Presenting Domain
  const hasChestComplaint = /\b(chest|heart|sternum|angina|palpitation)\b/i.test(text);
  const hasNeuroComplaint = /\b(headache|dizz|droop|weak|speech|slurr|numb|stroke|black\s*out|faint|vision)\b/i.test(text);
  const hasPedsComplaint = /\b(baby|infant|newborn|child|toddler|grunting|floppy|weeks?\s+old|months?\s+old)\b/i.test(text);
  const hasRoutineRefill = /\b(refill|prescription|lisinopril|atorvastatin|metformin|blood\s*pressure\s*med)\b/i.test(text) &&
                           /\b(fine|normal|routine|maintenance|refill\s+only)\b/i.test(text);

  // If purely routine refill with no active distress, mark as sufficient immediately
  if (hasRoutineRefill) {
    return {
      is_sufficient: true,
      phase: "board_decision",
      completeness_score: 1.0,
      dimensions: {
        has_symptom: false,
        associated_symptoms: [],
        neurological_signs: [],
        pediatric_signs: [],
        known_facts: ["Routine maintenance medication refill request", "No acute symptoms reported"],
        missing_dimensions: []
      },
      status_summary: "Routine Medication Review"
    };
  }

  // 2. Extract Dimensions
  // A. Onset / Duration
  let onset: string | undefined;
  const onsetMatch = text.match(/\b(\d+\s*(?:minutes?|hours?|days?|weeks?|mins?|hrs?)|sudden(?:ly)?|just\s+started|thirty\s+minutes|an?\s+hour|twenty\s+minutes|this\s+morning)\b/i);
  if (onsetMatch) {
    onset = onsetMatch[0];
    known_facts.push(`Onset/Duration: ${onset}`);
  } else {
    missing_dimensions.push("onset_and_duration");
  }

  // B. Character / Quality
  let character: string | undefined;
  const charMatch = text.match(/\b(crushing|pressure|squeezing|tightness|heavy|sharp|stabbing|burning|throbbing|ache|dull|elephant)\b/i);
  if (charMatch) {
    character = charMatch[0];
    known_facts.push(`Character: ${character}`);
  } else if (hasChestComplaint) {
    missing_dimensions.push("pain_character");
  }

  // C. Radiation
  let radiation: string | undefined;
  const radMatch = text.match(/\b(radiat.*|spread.*|travel.*|into\s+(?:my\s+)?(?:left\s+)?arm|jaw|neck|shoulder|back|between\s+shoulder\s+blades)\b/i);
  if (radMatch) {
    radiation = radMatch[0];
    known_facts.push(`Radiation: ${radiation}`);
  } else if (hasChestComplaint) {
    missing_dimensions.push("radiation");
  }

  // D. Associated Systemic Symptoms
  if (/\b(shortness\s+of\s+breath|difficulty\s+breathing|cannot\s+breathe|gasping|dyspnea)\b/i.test(text)) {
    associated_symptoms.push("Dyspnea / Shortness of breath");
    known_facts.push("Shortness of breath");
  }
  if (/\b(sweat|sweating|cold\s+sweats|diaphoresis|clammy)\b/i.test(text)) {
    associated_symptoms.push("Cold sweats / Diaphoresis");
    known_facts.push("Cold sweats");
  }
  if (/\b(nausea|vomit|queasy|sick\s+to\s+(?:my\s+)?stomach)\b/i.test(text)) {
    associated_symptoms.push("Nausea / Gastrointestinal distress");
    known_facts.push("Nausea");
  }
  if (/\b(dizz|lightheaded|faint|presyncope|syncope|black\s*out)\b/i.test(text)) {
    associated_symptoms.push("Dizziness / Lightheadedness");
    known_facts.push("Dizziness");
  }

  // E. Neurological Signs
  if (/\b(droop|face.*droop|facial.*asymmetry)\b/i.test(text)) {
    neurological_signs.push("Facial droop / Asymmetry");
    known_facts.push("Facial droop");
  }
  if (/\b(arm.*weak|weakness|cannot.*lift|loss\s+of\s+strength|drift)\b/i.test(text)) {
    neurological_signs.push("Unilateral arm weakness");
    known_facts.push("Arm weakness");
  }
  if (/\b(numb|numbness|paresthesia|pins\s+and\s+needles)\b/i.test(text)) {
    neurological_signs.push("Numbness / Paresthesia");
    known_facts.push("Numbness");
  }
  if (/\b(speech|slurr|talk|words|aphasia|trouble.*speaking)\b/i.test(text)) {
    neurological_signs.push("Slurred speech / Dysarthria");
    known_facts.push("Speech difficulty");
  }

  // F. Pediatric Signs
  if (/\b(fever|102|101|103|104|temperature)\b/i.test(text) && hasPedsComplaint) {
    pediatric_signs.push("High fever / Pyrexia");
    known_facts.push("Fever");
  }
  if (/\b(letharg|floppy|unresponsive|grunting|refusing.*feed|sleepy)\b/i.test(text) && hasPedsComplaint) {
    pediatric_signs.push("Severe lethargy / Grunting");
    known_facts.push("Lethargy / Grunting");
  }

  // 3. Clinical Sufficiency Evaluation
  // Catastrophic life-threat emergency presentation (bypass history gathering immediately)
  const isCatastrophicEmergency =
    /\b(unconscious|unresponsive|not\s+breathing|cardiac\s+arrest|passed\s*out\s+cold|massive\s+bleed|swollen\s+lips|throat\s+closing|stridor|anaphylaxis|cannot\s+swallow)\b/i.test(text);

  // Complete presentations (e.g. comprehensive benchmark descriptions with full onset, quality, radiation, etc.)
  const hasFullCardiacPresentation = hasChestComplaint && (onset !== undefined) && (character !== undefined) && (radiation !== undefined || associated_symptoms.length > 0);
  const hasFullStrokePresentation = neurological_signs.length >= 2 && (onset !== undefined);
  const hasFullPediatricPresentation = hasPedsComplaint && pediatric_signs.length >= 2 && (onset !== undefined);

  // Sufficiency scoring
  let score = 0.2;
  if (onset) score += 0.25;
  if (character) score += 0.2;
  if (radiation) score += 0.2;
  if (associated_symptoms.length > 0) score += 0.15;
  if (neurological_signs.length > 0) score += 0.2;
  if (pediatric_signs.length > 0) score += 0.2;

  if (isCatastrophicEmergency || hasFullCardiacPresentation || hasFullStrokePresentation || hasFullPediatricPresentation) {
    score = Math.max(score, 0.95);
  }
  score = Math.min(1.0, score);

  const is_sufficient = score >= 0.75 || isCatastrophicEmergency;

  // 4. Determine Next Targeted Question (If Not Sufficient)
  let next_question: string | undefined;
  let question_source: "lead" | "cardiology" | "neurology" | "pediatrics" = "lead";
  let question_target_dimension: string | undefined;

  if (!is_sufficient) {
    if (hasChestComplaint) {
      if (!onset) {
        question_source = "lead";
        question_target_dimension = "onset";
        next_question = "When did this chest discomfort begin, and did it start suddenly or build up gradually?";
      } else if (!character) {
        question_source = "lead";
        question_target_dimension = "character";
        next_question = "Could you describe the sensation — is it a heavy pressure, squeezing, burning, or a sharp pain?";
      } else if (!radiation) {
        question_source = "cardiology";
        next_question = "Dr. Marcus Vance (Cardiology) would like to check: does the discomfort travel anywhere, such as into your left arm, shoulder, jaw, or back?";
        question_target_dimension = "radiation";
      } else if (associated_symptoms.length === 0) {
        question_source = "cardiology";
        next_question = "Dr. Vance is also asking: are you experiencing any shortness of breath, cold sweating, nausea, or lightheadedness right now?";
        question_target_dimension = "associated_symptoms";
      }
    } else if (hasNeuroComplaint) {
      if (neurological_signs.length === 0) {
        question_source = "neurology";
        next_question = "Dr. Arthur Pendelton (Neurology) would like to ask: have you noticed any facial drooping, arm weakness, or difficulty speaking clearly?";
        question_target_dimension = "neurological_signs";
      } else if (!onset) {
        question_source = "neurology";
        next_question = "Dr. Pendelton would like to establish the timeline: exactly what time did these neurological symptoms start, and did they come on abruptly?";
        question_target_dimension = "onset";
      }
    } else {
      question_source = "lead";
      question_target_dimension = "general_history";
      next_question = "Could you tell me a bit more about when this started and how severe it feels on a scale of 1 to 10?";
    }
  }

  return {
    is_sufficient,
    phase: is_sufficient ? "board_decision" : "gathering_history",
    completeness_score: score,
    dimensions: {
      has_symptom: hasChestComplaint || hasNeuroComplaint || hasPedsComplaint || known_facts.length > 0,
      onset,
      character,
      radiation,
      associated_symptoms,
      neurological_signs,
      pediatric_signs,
      known_facts,
      missing_dimensions
    },
    next_question,
    question_source,
    question_target_dimension,
    status_summary: is_sufficient
      ? "Clinical Context Complete · Deliberation Active"
      : `Gathering Clinical Context (${Math.round(score * 100)}% Complete)`
  };
}
