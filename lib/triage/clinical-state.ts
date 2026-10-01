/**
 * CLINICAL INTERVIEW STATE & EVIDENCE MODEL
 * 
 * Invariants:
 * 1. Normalized Clinical Facts: Facts have explicit status ("present" | "absent" | "unknown"),
 *    confidence, source, and turn ID. Utterances are NEVER stored directly as clinical facts.
 * 2. Deterministic Completeness: History completeness is computed via an explicit weighted formula,
 *    not an arbitrary AI heuristic.
 * 3. Separation of Completeness and Safety: Completeness measures information gathered.
 *    Safety evaluates unresolved life-threat red flags independently.
 * 4. 3-Layer Memory Architecture:
 *    - Layer 1: Raw conversational transcript.
 *    - Layer 2: Structured clinical state (present / absent / unknown).
 *    - Layer 3: Interview memory (asked, answered, denied, do-not-repeat, next-target).
 */

export type ClinicalFactStatus = "present" | "absent" | "unknown";
export type ClinicalFactSource = "patient" | "clinician" | "inferred" | "pre_arbiter";

export interface ClinicalFact {
  id: string;
  name: string; // e.g. "throat_pain", "voice_change", "onset", "course", "severity", "dysphagia", "fever", "ear_pain"
  label: string; // Human-readable label: "Throat pain", "Voice change / Hoarseness", "Difficulty swallowing"
  category: "chief_complaint" | "symptom_profile" | "associated_symptom" | "red_flag" | "relevant_history";
  status: ClinicalFactStatus;
  value: any;
  normalizedText: string; // e.g. "2 days ago", "Gradually worsening", "Present (hoarseness)", "Denied"
  confidence: number;
  source: ClinicalFactSource;
  turnId: number;
  timestamp: string;
}

export interface RedFlagDomainAssessment {
  domain: "airway" | "swallowing" | "breathing" | "cardiac" | "neurological" | "bleeding";
  label: string;
  assessed: boolean;
  status: "clear" | "concerning" | "critical" | "pending";
  finding?: string;
  rationale?: string;
}

export interface ClinicalHistoryCompletenessBreakdown {
  chiefComplaint: { weight: number; earned: number; established: boolean; label: string };
  onsetTimeline: { weight: number; earned: number; established: boolean; label: string };
  courseProgression: { weight: number; earned: number; established: boolean; label: string };
  characterSeverity: { weight: number; earned: number; established: boolean; label: string };
  associatedSymptoms: { weight: number; earned: number; established: boolean; label: string };
  redFlagScreening: { weight: number; earned: number; established: boolean; label: string };
}

export interface ClinicalHistoryCompleteness {
  score: number; // 0 to 100
  percentageString: string; // e.g. "67%"
  formula: string;
  breakdown: ClinicalHistoryCompletenessBreakdown;
}

export interface ClinicalSafetyAssessment {
  status: "safe" | "screening_incomplete" | "warning_monitor" | "immediate_emergency";
  label: string;
  assessedCount: number;
  totalDomains: number;
  redFlagsTriggered: string[];
  immediateDanger: boolean;
}

export interface InterviewMemoryState {
  askedTopics: string[]; // Topics asked by doctor
  answeredTopics: string[]; // Topics answered by patient
  deniedTopics: string[]; // Symptoms patient explicitly denied
  acknowledgedFindings: string[]; // Findings already acknowledged (prevents "I hear" looping)
  doNotRepeat: string[]; // Topics blocked from re-asking
  patientObjections: string[];
  patientQuestions: string[];
  recentDoctorQuestions: string[];
  lastQuestionTarget?: string;
}

export interface ClinicalInterviewStateV2 {
  caseVersion: number;
  turnCount: number;
  chiefComplaint: ClinicalFact | null;
  symptomProfile: {
    onset: ClinicalFact | null;
    duration: ClinicalFact | null;
    course: ClinicalFact | null;
    severity: ClinicalFact | null;
    character: ClinicalFact | null;
    location: ClinicalFact | null;
  };
  establishedFacts: ClinicalFact[]; // All facts with status "present" or "absent"
  associatedSymptoms: ClinicalFact[];
  redFlags: Record<string, RedFlagDomainAssessment>;
  interviewMemory: InterviewMemoryState;
  nextBestQuestion: {
    target: string;
    label: string;
    clinicalRationale: string;
    suggestedPhrasing: string;
  } | null;
  completeness: ClinicalHistoryCompleteness;
  safety: ClinicalSafetyAssessment;
}

export const HISTORY_WEIGHTS = {
  chiefComplaint: 20,
  onsetTimeline: 15,
  courseProgression: 15,
  characterSeverity: 15,
  associatedSymptoms: 15,
  redFlagScreening: 20,
};

/**
 * Deterministically compute history completeness score based on validated clinical facts.
 */
export function calculateHistoryCompleteness(
  chiefComplaint: ClinicalFact | null,
  symptomProfile: ClinicalInterviewStateV2["symptomProfile"],
  associatedSymptoms: ClinicalFact[],
  redFlags: Record<string, RedFlagDomainAssessment>
): ClinicalHistoryCompleteness {
  const ccEstablished = Boolean(chiefComplaint && chiefComplaint.status === "present");
  const onsetEstablished = Boolean(symptomProfile.onset && symptomProfile.onset.status !== "unknown");
  const courseEstablished = Boolean(symptomProfile.course && symptomProfile.course.status !== "unknown");
  
  // Character or severity established (at least one)
  const charOrSevEstablished = Boolean(
    (symptomProfile.character && symptomProfile.character.status !== "unknown") ||
    (symptomProfile.severity && symptomProfile.severity.status !== "unknown")
  );

  // Associated symptoms (at least 1 evaluated, present or denied)
  const evaluatedAssociatedCount = associatedSymptoms.filter(f => f.status !== "unknown").length;
  const assocEstablished = evaluatedAssociatedCount > 0;

  // Red flags assessed count
  const redFlagList = Object.values(redFlags);
  const assessedRedFlagsCount = redFlagList.filter(rf => rf.assessed).length;
  const redFlagRatio = redFlagList.length > 0 ? assessedRedFlagsCount / redFlagList.length : 0;

  const earnedCC = ccEstablished ? HISTORY_WEIGHTS.chiefComplaint : 0;
  const earnedOnset = onsetEstablished ? HISTORY_WEIGHTS.onsetTimeline : 0;
  const earnedCourse = courseEstablished ? HISTORY_WEIGHTS.courseProgression : 0;
  const earnedChar = charOrSevEstablished ? HISTORY_WEIGHTS.characterSeverity : 0;
  const earnedAssoc = assocEstablished ? Math.min(HISTORY_WEIGHTS.associatedSymptoms, evaluatedAssociatedCount * 7.5) : 0;
  const earnedRedFlag = Math.round(redFlagRatio * HISTORY_WEIGHTS.redFlagScreening);

  const rawScore = earnedCC + earnedOnset + earnedCourse + earnedChar + earnedAssoc + earnedRedFlag;
  const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  return {
    score: finalScore,
    percentageString: `${finalScore}%`,
    formula: `CC(${earnedCC}/${HISTORY_WEIGHTS.chiefComplaint}) + Onset(${earnedOnset}/${HISTORY_WEIGHTS.onsetTimeline}) + Course(${earnedCourse}/${HISTORY_WEIGHTS.courseProgression}) + Char/Sev(${earnedChar}/${HISTORY_WEIGHTS.characterSeverity}) + Assoc(${earnedAssoc}/${HISTORY_WEIGHTS.associatedSymptoms}) + RedFlags(${earnedRedFlag}/${HISTORY_WEIGHTS.redFlagScreening})`,
    breakdown: {
      chiefComplaint: {
        weight: HISTORY_WEIGHTS.chiefComplaint,
        earned: earnedCC,
        established: ccEstablished,
        label: chiefComplaint ? chiefComplaint.label : "Chief complaint",
      },
      onsetTimeline: {
        weight: HISTORY_WEIGHTS.onsetTimeline,
        earned: earnedOnset,
        established: onsetEstablished,
        label: symptomProfile.onset?.normalizedText || "Onset & timeline",
      },
      courseProgression: {
        weight: HISTORY_WEIGHTS.courseProgression,
        earned: earnedCourse,
        established: courseEstablished,
        label: symptomProfile.course?.normalizedText || "Course & progression",
      },
      characterSeverity: {
        weight: HISTORY_WEIGHTS.characterSeverity,
        earned: earnedChar,
        established: charOrSevEstablished,
        label: symptomProfile.severity?.normalizedText || symptomProfile.character?.normalizedText || "Character & severity",
      },
      associatedSymptoms: {
        weight: HISTORY_WEIGHTS.associatedSymptoms,
        earned: earnedAssoc,
        established: assocEstablished,
        label: `${evaluatedAssociatedCount} associated symptom(s) assessed`,
      },
      redFlagScreening: {
        weight: HISTORY_WEIGHTS.redFlagScreening,
        earned: earnedRedFlag,
        established: assessedRedFlagsCount >= 2,
        label: `${assessedRedFlagsCount}/${redFlagList.length} red-flag domains screened`,
      },
    },
  };
}

/**
 * Evaluate safety independently of history completeness.
 */
export function evaluateClinicalSafety(
  redFlags: Record<string, RedFlagDomainAssessment>,
  immediateDangerDetected = false,
  preSafetyFlags: string[] = []
): ClinicalSafetyAssessment {
  const redFlagList = Object.values(redFlags);
  const assessedCount = redFlagList.filter(rf => rf.assessed).length;
  const totalDomains = redFlagList.length;

  if (immediateDangerDetected || preSafetyFlags.length > 0) {
    return {
      status: "immediate_emergency",
      label: "Critical life-threat detected — immediate emergency response active",
      assessedCount,
      totalDomains,
      redFlagsTriggered: preSafetyFlags,
      immediateDanger: true,
    };
  }

  const concerningDomains = redFlagList.filter(rf => rf.status === "concerning" || rf.status === "critical");
  if (concerningDomains.length > 0) {
    return {
      status: "warning_monitor",
      label: `Alert: ${concerningDomains.map(d => d.label).join(", ")} flagged for clinical attention`,
      assessedCount,
      totalDomains,
      redFlagsTriggered: concerningDomains.map(d => d.label),
      immediateDanger: false,
    };
  }

  if (assessedCount < 2) {
    return {
      status: "screening_incomplete",
      label: `Screening incomplete (${assessedCount}/${totalDomains} assessed)`,
      assessedCount,
      totalDomains,
      redFlagsTriggered: [],
      immediateDanger: false,
    };
  }

  return {
    status: "safe",
    label: `Standard risk (${assessedCount}/${totalDomains} red-flag domains cleared)`,
    assessedCount,
    totalDomains,
    redFlagsTriggered: [],
    immediateDanger: false,
  };
}

/**
 * Create fresh interview state v2
 */
export function createInitialInterviewStateV2(): ClinicalInterviewStateV2 {
  const defaultRedFlags: Record<string, RedFlagDomainAssessment> = {
    airway: { domain: "airway", label: "Airway & breathing", assessed: false, status: "pending" },
    swallowing: { domain: "swallowing", label: "Swallowing & saliva management", assessed: false, status: "pending" },
    breathing: { domain: "breathing", label: "Respiratory distress", assessed: false, status: "pending" },
    cardiac: { domain: "cardiac", label: "Acute coronary / hemodynamic", assessed: false, status: "pending" },
    neurological: { domain: "neurological", label: "Focal neurological deficit (BE-FAST)", assessed: false, status: "pending" },
    bleeding: { domain: "bleeding", label: "Active hemorrhage / hemoptysis", assessed: false, status: "pending" },
  };

  const initialCompleteness = calculateHistoryCompleteness(null, {
    onset: null,
    duration: null,
    course: null,
    severity: null,
    character: null,
    location: null,
  }, [], defaultRedFlags);

  const initialSafety = evaluateClinicalSafety(defaultRedFlags, false, []);

  return {
    caseVersion: 1,
    turnCount: 0,
    chiefComplaint: null,
    symptomProfile: {
      onset: null,
      duration: null,
      course: null,
      severity: null,
      character: null,
      location: null,
    },
    establishedFacts: [],
    associatedSymptoms: [],
    redFlags: defaultRedFlags,
    interviewMemory: {
      askedTopics: [],
      answeredTopics: [],
      deniedTopics: [],
      acknowledgedFindings: [],
      doNotRepeat: [],
      patientObjections: [],
      patientQuestions: [],
      recentDoctorQuestions: [],
    },
    nextBestQuestion: null,
    completeness: initialCompleteness,
    safety: initialSafety,
  };
}

/**
 * SUB-FIELD LEVEL CLINICAL STATE MODEL
 * 
 * Prevents repeating already-resolved portions of compound categories.
 * Breaks down compound categories into independently resolved atomic facts:
 * - Onset / Timeline: duration vs onsetPattern (sudden vs gradual)
 * - Character & Severity: character vs numeric severity
 * - Episodic: episodeDuration vs frequency
 */
export interface SubfieldClinicalState {
  onset: {
    duration?: string;
    onsetPattern?: "sudden" | "gradual" | "unknown";
    isResolved: boolean;
  };
  characterSeverity: {
    character?: string;
    severity?: string;
    isResolved: boolean;
  };
  episodic: {
    isEpisodic?: boolean;
    frequency?: string;
    episodeDuration?: string;
    isResolved: boolean;
  };
}

export function extractSubfieldState(
  slots: Record<string, any> = {},
  knownFacts: string[] = [],
  conversationMemory?: any
): SubfieldClinicalState {
  // 1. Onset & Timeline subfields
  let onsetDuration = slots.duration || slots.onset;
  if (!onsetDuration) {
    const onsetFact = knownFacts.find(f => /^(?:ONSET|Duration):\s*(.+)/i.test(f));
    if (onsetFact) {
      const match = onsetFact.match(/^(?:ONSET|Duration):\s*(.+)/i);
      if (match) onsetDuration = match[1].trim();
    }
  }
  let isDurationValid = false;
  if (onsetDuration && !/^(?:sudden|gradual|unknown)$/i.test(String(onsetDuration).trim())) {
    isDurationValid = true;
  }

  let pattern: "sudden" | "gradual" | "unknown" = "unknown";
  if (slots.acute_worsening === true) pattern = "sudden";
  else if (slots.acute_worsening === false) pattern = "gradual";
  else {
    const typeFact = knownFacts.find(f => /ONSET_(?:TYPE|PATTERN):\s*(sudden|gradual)/i.test(f) || /Course:\s*(sudden|gradual)/i.test(f));
    if (typeFact) {
      pattern = /sudden/i.test(typeFact) ? "sudden" : "gradual";
    } else if ((slots as any).onset_pattern) {
      pattern = (slots as any).onset_pattern === "sudden" ? "sudden" : "gradual";
    } else if (knownFacts.some(f => /sudden\s+onset/i.test(f))) {
      pattern = "sudden";
    } else if (knownFacts.some(f => /gradual/i.test(f))) {
      pattern = "gradual";
    } else if (slots.onset && /sudden/i.test(String(slots.onset))) {
      pattern = "sudden";
    } else if (slots.onset && /gradual/i.test(String(slots.onset))) {
      pattern = "gradual";
    }
  }

  // 2. Character & Severity subfields
  let character = slots.character;
  if (!character) {
    const charFact = knownFacts.find(f => /^CHARACTER:\s*(.+)/i.test(f));
    if (charFact) character = charFact.replace(/^CHARACTER:\s*/i, "").trim();
  }

  let severity = slots.severity ? extractNumericSeverity(slots.severity) || slots.severity : undefined;
  if (!severity) {
    const sevFact = knownFacts.find(f => /^SEVERITY:\s*(.+)/i.test(f) || /\b([0-9]|10)\/10\b/i.test(f));
    if (sevFact) {
      const match = sevFact.match(/\b([0-9]|10)\/10\b/i);
      severity = match ? match[0] : extractNumericSeverity(sevFact) || sevFact.replace(/^SEVERITY:\s*/i, "").trim();
    } else {
      for (const fact of knownFacts) {
        const extracted = extractNumericSeverity(fact);
        if (extracted) {
          severity = extracted;
          break;
        }
      }
    }
  }

  // 3. Episodic subfields
  const freq = conversationMemory?.frequencyPattern ||
    knownFacts.find(f => /^Frequency:\s*(.+)/i.test(f))?.replace(/^Frequency:\s*/i, "").trim();
  const isEpisodic = Boolean(freq || /episode/i.test(conversationMemory?.durationPattern || ""));
  const episodeDur = conversationMemory?.durationPattern || (isEpisodic ? slots.duration : undefined);

  return {
    onset: {
      duration: isDurationValid ? String(onsetDuration) : undefined,
      onsetPattern: pattern,
      isResolved: Boolean(isDurationValid && pattern !== "unknown")
    },
    characterSeverity: {
      character: character ? String(character) : undefined,
      severity: severity ? String(severity) : undefined,
      isResolved: Boolean(character && severity)
    },
    episodic: {
      isEpisodic,
      frequency: freq ? String(freq) : undefined,
      episodeDuration: episodeDur ? String(episodeDur) : undefined,
      isResolved: Boolean(freq && episodeDur)
    }
  };
}

const WORD_TO_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/**
 * Robust extraction for numeric pain severity ratings.
 * Covers natural variants:
 * - "8 out of 10", "8/10", "8 by 10", "maybe 8 by 10", "8 on 10", "8 of 10"
 * - "I'd say an eight", "probably an 8", "maybe an 8", "pain is an 8", "pain is 6"
 * - Targeted standalone numbers: "8" when replying to a severity scale question
 */
export function extractNumericSeverity(text: string, isSeverityPrompt: boolean = false): string | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // 1. Explicit ratio patterns:
  // e.g. "8/10", "8 out of 10", "maybe 8 by 10", "8 by 10", "8 on 10", "8 of 10", "eight out of ten", "eight by ten"
  const ratioMatch = lower.match(
    /\b(?:(?:maybe|probably|around|about|like|roughly|i'd\s+say|i\s+would\s+say|pain\s+(?:level\s+)?(?:is\s+)?|severity\s+(?:is\s+)?)\s*)*(?:an?\s+)?([0-9]|10|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:\/|\s*out\s+of\s*|\s*by\s*|\s*on\s*|\s*of\s*)\s*(?:10|ten)\b/i
  );
  if (ratioMatch) {
    const rawVal = ratioMatch[1].toLowerCase();
    const num = WORD_TO_NUM[rawVal] !== undefined ? WORD_TO_NUM[rawVal] : parseInt(rawVal, 10);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      return `${num}/10`;
    }
  }

  // 2. Explicit pain phrases without denominator:
  // e.g. "pain is 8", "pain is an 8", "severity is 7", "hurts at an 8", "pain level 8"
  const painMatch = lower.match(
    /\b(?:pain\s+(?:level\s+)?(?:is\s+|at\s+)?|severity\s+(?:is\s+|at\s+)?|hurts?\s+(?:at\s+)?)\s*(?:about\s+|around\s+)?(?:an?\s+)?([0-9]|10|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i
  );
  if (painMatch) {
    const rawVal = painMatch[1].toLowerCase();
    const num = WORD_TO_NUM[rawVal] !== undefined ? WORD_TO_NUM[rawVal] : parseInt(rawVal, 10);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      return `${num}/10`;
    }
  }

  // 3. Conversational / qualified ratings:
  // e.g. "I'd say an eight", "probably an 8", "maybe an 8", "it's about an 8", "around an 8", "maybe 8", "probably 8"
  const qualifiedMatch = lower.match(
    /\b(?:i'd\s+say|i\s+would\s+say|probably|maybe|around|about|it's\s+about|like)\s+(?:an?\s+)?([0-9]|10|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i
  );
  if (qualifiedMatch) {
    const rawVal = qualifiedMatch[1].toLowerCase();
    const num = WORD_TO_NUM[rawVal] !== undefined ? WORD_TO_NUM[rawVal] : parseInt(rawVal, 10);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      return `${num}/10`;
    }
  }

  // 4. Standalone number when answering a targeted severity inquiry:
  // e.g. Doctor asked: "How severe is the pain on a scale of 0 to 10?" -> Patient: "8" or "eight"
  if (isSeverityPrompt) {
    const targetedMatch = lower.match(
      /^(?:an?\s+)?([0-9]|10|zero|one|two|three|four|five|six|seven|eight|nine|ten)[.!?\s]*$/i
    );
    if (targetedMatch) {
      const rawVal = targetedMatch[1].toLowerCase();
      const num = WORD_TO_NUM[rawVal] !== undefined ? WORD_TO_NUM[rawVal] : parseInt(rawVal, 10);
      if (!isNaN(num) && num >= 0 && num <= 10) {
        return `${num}/10`;
      }
    }
  }

  return null;
}

/**
 * Slots that represent categorical or quantitative dimensions and can NEVER be treated as denied symptoms.
 */
export const NON_DENIABLE_SLOTS = new Set([
  "onset_pattern",
  "onset",
  "onset_time",
  "course",
  "duration",
  "frequency",
  "timing_pattern",
  "severity",
  "character",
  "chief_complaint",
  "patient_objection",
  "emotional_concern",
  "general_inquiry",
]);

/**
 * Detects the clinical target topic/slot of a doctor's spoken question to maintain
 * bidirectional question-to-answer integrity even if an LLM paraphrases the planned inquiry.
 */
export function detectQuestionTargetSlot(questionText: string, defaultSlot?: string): string {
  const lower = questionText.toLowerCase();
  if (/swallow|dysphagia|liquids|solids|saliva/i.test(lower)) return "swallowing_difficulty";
  if (/ear\s*pain|earache|ears/i.test(lower)) return "ear_pain";
  if (/fever|chills|temperature/i.test(lower)) return "fever";
  if (/scale|0\s*[-–to]\s*10|zero\s*[-–to]\s*ten|how\s+severe|severity|rate\s+your\s+pain/i.test(lower)) return "severity";
  if (/sudden|gradual|come\s+on\s+all\s+at\s+once|build\s+up/i.test(lower)) return "onset_pattern";
  if (/when\s+did|how\s+long\s+have\s+you\s+had|how\s+many\s+days/i.test(lower)) return "onset";
  if (/voice|hoarse|hoarseness|speak/i.test(lower)) return "voice_character";
  if (/worse|better|improving|staying\s+the\s+same|course/i.test(lower)) return "course";
  if (/radiat|travel|spread|arm|jaw|back/i.test(lower)) return "radiation";
  if (/what\s+(?:does\s+it|it)\s+feel\s+like|sharp|dull|burning|pressure|tightness|character/i.test(lower)) return "character";
  return defaultSlot || "general_inquiry";
}

