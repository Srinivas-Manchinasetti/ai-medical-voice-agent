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
export type ClinicalFactSource =
  | "device"
  | "device_measured"
  | "clinician"
  | "patient"
  | "patient_reported"
  | "tool"
  | "tool_derived"
  | "inferred"
  | "ai_inferred"
  | "agent_inferred"
  | "pre_arbiter"
  | "deterministic_pre_arbiter"
  | "not_assessed";

/**
 * EVIDENCE PROVENANCE HIERARCHY
 * DEVICE_MEASURED (5) > CLINICIAN / PRE_ARBITER (4) > PATIENT_REPORTED (3) > TOOL_DERIVED (2) > AI_INFERRED (1) > NOT_ASSESSED (0)
 */
export const PROVENANCE_HIERARCHY: Record<string, number> = {
  device: 5,
  device_measured: 5,
  clinician: 4,
  pre_arbiter: 4,
  deterministic_pre_arbiter: 4,
  patient: 3,
  patient_reported: 3,
  tool: 2,
  tool_derived: 2,
  inferred: 1,
  ai_inferred: 1,
  agent_inferred: 1,
  not_assessed: 0,
};

export function getProvenanceRank(source?: string): number {
  if (!source) return 0;
  return PROVENANCE_HIERARCHY[source.toLowerCase()] ?? 1;
}

export function isHigherOrEqualProvenance(sourceA?: string, sourceB?: string): boolean {
  return getProvenanceRank(sourceA) >= getProvenanceRank(sourceB);
}

export interface FactContradictionResult {
  winner: ClinicalFact;
  loser?: ClinicalFact;
  hasContradiction: boolean;
  resolutionRationale?: string;
}

/**
 * Reconciles conflicting or competing clinical facts regarding the same slot/symptom.
 * 1. Provenance hierarchy (Device > Clinician > Patient > Tool > AI Inferred)
 * 2. Temporal precedence (later observation breaks ties)
 */
export function reconcileConflictingFacts(existingFact: ClinicalFact, newFact: ClinicalFact): FactContradictionResult {
  const statusConflict = (existingFact.status === "present" && newFact.status === "absent") ||
                         (existingFact.status === "absent" && newFact.status === "present");

  if (!statusConflict) {
    if (getProvenanceRank(newFact.source) >= getProvenanceRank(existingFact.source)) {
      return { winner: newFact, loser: existingFact, hasContradiction: false };
    }
    return { winner: existingFact, loser: newFact, hasContradiction: false };
  }

  const rankExisting = getProvenanceRank(existingFact.source);
  const rankNew = getProvenanceRank(newFact.source);

  if (rankNew > rankExisting) {
    return {
      winner: newFact,
      loser: existingFact,
      hasContradiction: true,
      resolutionRationale: `Provenance override: ${newFact.source} (rank ${rankNew}) supersedes ${existingFact.source} (rank ${rankExisting}) for ${existingFact.name}.`
    };
  } else if (rankNew < rankExisting) {
    return {
      winner: existingFact,
      loser: newFact,
      hasContradiction: true,
      resolutionRationale: `Provenance retained: ${existingFact.source} (rank ${rankExisting}) preserved over ${newFact.source} (rank ${rankNew}) for ${existingFact.name}.`
    };
  } else {
    const isNewer = (newFact.turnId || 0) >= (existingFact.turnId || 0);
    const winner = isNewer ? newFact : existingFact;
    const loser = isNewer ? existingFact : newFact;
    return {
      winner,
      loser,
      hasContradiction: true,
      resolutionRationale: `Temporal precedence: turn ${winner.turnId ?? 0} supersedes earlier turn ${loser.turnId ?? 0} for ${existingFact.name}.`
    };
  }
}


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
 * Distinguishes legitimate subfields:
 * - severity vs character
 * - onset_pattern (sudden/gradual) vs onset (duration/timeline)
 * - episodic frequency vs episodic duration
 * - odynophagia (pain on swallowing) vs swallowing_difficulty (mechanical dysphagia)
 */
export function detectQuestionTargetSlot(questionText: string, defaultSlot?: string): string {
  const lower = questionText.toLowerCase();

  // 1. Odynophagia (pain on swallowing) vs Mechanical dysphagia (trouble swallowing / fluids & saliva / choking)
  if (/hurts?\s+to\s+swallow|painful\s+to\s+swallow|pain\s+when\s+swallowing|odynophagia|hurt\s+more\s+when\s+you\s+swallow/i.test(lower)) {
    return "odynophagia";
  }
  if (/swallow(?:ing)?\s+liquids|liquids\s+and\s+saliva|difficulty\s+swallowing|trouble\s+swallowing|able\s+to\s+swallow|choking|dysphagia/i.test(lower)) {
    return "swallowing_difficulty";
  }
  if (/swallow/i.test(lower)) {
    return "swallowing_difficulty";
  }

  // 2. Ear pain / otalgia
  if (/ear\s*pain|earache|ears/i.test(lower)) return "ear_pain";

  // 3. Fever / chills
  if (/fever|chills|temperature/i.test(lower)) return "fever";

  // 4. Severity (numerical scale / 0-10 / rate pain) vs Character (quality / sensation)
  if (/scale|0\s*[-–to]\s*10|zero\s*[-–to]\s*ten|how\s+severe|severity|rate\s+your\s+pain/i.test(lower)) return "severity";
  if (/what\s+(?:does\s+it|it)\s+feel\s+like|sharp|dull|burning|pressure|tightness|squeezing|character|crushing|throbbing/i.test(lower)) return "character";

  // 5. Onset pattern (sudden vs gradual) vs Episodic duration/frequency vs Onset timeline
  if (/sudden|gradual|come\s+on\s+all\s+at\s+once|build\s+up/i.test(lower)) return "onset_pattern";
  if (/how\s+long\s+(?:does\s+each|each\s+one\s+last)|duration\s+of\s+each/i.test(lower)) return "duration";
  if (/how\s+often|how\s+many\s+times\s+a\s+(?:day|month|week)|frequency/i.test(lower)) return "frequency";
  if (/when\s+did|how\s+long\s+have\s+you\s+had|how\s+many\s+days|how\s+many\s+hours|when\s+did\s+this\s+start/i.test(lower)) return "onset";

  // 6. Voice character
  if (/voice|hoarse|hoarseness|speak/i.test(lower)) return "voice_character";

  // 7. Course & progression
  if (/worse|better|improving|staying\s+the\s+same|course/i.test(lower)) return "course";

  // 8. Radiation
  if (/radiat|travel|spread|arm|jaw|back/i.test(lower)) return "radiation";

  // 9. Exertional
  if (/active|activity|exercis|stairs?|rest(?:ing)?|exert/i.test(lower)) return "exertional";

  // 10. Associated symptoms
  if (/other\s+symptoms|associated|alongside/i.test(lower)) return "associated_symptoms";

  return defaultSlot || "general_inquiry";
}

/**
 * Evaluates whether a detected question slot matches the planner's expected clinical topic.
 * Enforces strict distinction between subfields (e.g. severity vs character, onset pattern vs duration).
 */
export function isTargetSlotMatch(expectedTopic: string, detectedSlot: string): boolean {
  if (!expectedTopic || !detectedSlot) return false;
  const exp = expectedTopic.toLowerCase().trim();
  const det = detectedSlot.toLowerCase().trim();

  if (exp === det) return true;

  // Onset timeline variants: "onset", "onset_time" (when did it start / duration of complaint)
  if ((exp === "onset" || exp === "onset_time") && (det === "onset" || det === "onset_time")) {
    return true;
  }

  // Neurological laterality / distribution
  if ((exp === "weakness_distribution" || exp === "laterality") && (det === "weakness_distribution" || det === "laterality")) {
    return true;
  }

  // Swallowing variants: odynophagia (painful swallowing) ↔ swallowing_difficulty ↔ dysphagia
  const swallowGroup = new Set(["swallowing_difficulty", "odynophagia", "dysphagia"]);
  if (swallowGroup.has(exp) && swallowGroup.has(det)) {
    return true;
  }

  return false;
}

export interface TargetValidationResult {
  isValid: boolean;
  detectedTarget: string;
  reason?: string;
}

/**
 * Post-generation validator for doctor replies:
 * A. Checks if a question exists when clinical inquiry is active.
 * B. Checks if detected question target strictly matches the responsePlan's nextHighValueInquiry.topic.
 * C. Enforces that the reply does not violate responsePlan.mustAvoidAsking (both by slot and forbidden phrases).
 * D. Enforces that the reply does not repeat already-resolved subfields or denied symptoms.
 * E. Enforces that the reply does not bundle multiple clinical questions.
 */
export function validateDoctorReplyTarget(
  replyText: string,
  plan?: {
    primaryGoal?: string;
    mustAvoidAsking?: string[];
    nextHighValueInquiry?: { topic: string; clinicalRationale: string; suggestedPhrasing: string };
  },
  slots?: Record<string, any>,
  memory?: any,
  confirmedFacts?: string[],
  deniedSymptoms?: string[]
): TargetValidationResult {
  const clean = replyText.trim();
  if (!clean) {
    return { isValid: false, detectedTarget: "empty", reason: "LLM_EMPTY_REPLY" };
  }

  // A. Is there a question?
  if (!clean.includes("?")) {
    if (plan?.primaryGoal === "EMERGENCY_DISPOSITION" || plan?.primaryGoal === "VALIDATE_EMOTION_BEFORE_INQUIRY") {
      return { isValid: true, detectedTarget: "statement" };
    }
    return { isValid: false, detectedTarget: "none", reason: "LLM_NO_QUESTION_FOUND" };
  }

  // E. Does it contain multiple competing clinical questions?
  const questionMarks = (clean.match(/\?/g) || []).length;
  if (questionMarks > 1) {
    return { isValid: false, detectedTarget: "multiple", reason: "LLM_MULTIPLE_QUESTIONS" };
  }

  // Detect the target slot of the generated question
  const detectedTarget = detectQuestionTargetSlot(clean);

  // C. Does the generated question violate responsePlan.mustAvoidAsking?
  const mustAvoid = plan?.mustAvoidAsking || [];
  const lower = clean.toLowerCase();

  for (const item of mustAvoid) {
    const itemLower = item.toLowerCase().trim();
    if (!itemLower) continue;

    // Check direct slot match
    if (itemLower === detectedTarget) {
      return {
        isValid: false,
        detectedTarget,
        reason: `LLM_MUST_AVOID_SLOT_VIOLATION: target slot '${detectedTarget}' is in mustAvoidAsking`,
      };
    }

    // Check phrase match (for phrases with 4+ characters)
    if (itemLower.length >= 4 && lower.includes(itemLower)) {
      return {
        isValid: false,
        detectedTarget,
        reason: `LLM_MUST_AVOID_PHRASE_VIOLATION: question contains forbidden phrase '${item}'`,
      };
    }
  }

  // D. Does it repeat a resolved or denied dimension?
  const denied = deniedSymptoms || memory?.deniedSymptoms || [];
  for (const d of denied) {
    const dLower = d.toLowerCase().trim();
    if (dLower === detectedTarget) {
      return {
        isValid: false,
        detectedTarget,
        reason: `LLM_REPEATED_DENIED_DIMENSION: symptom '${d}' was already denied by patient`,
      };
    }
    if (dLower.length >= 4 && lower.includes(dLower) && lower.includes("?")) {
      return {
        isValid: false,
        detectedTarget,
        reason: `LLM_REPEATED_DENIED_DIMENSION: question re-asks about denied symptom '${d}'`,
      };
    }
  }

  // Check subfields resolved:
  if (slots) {
    const subfields = extractSubfieldState(slots, confirmedFacts || slots.known_facts || [], memory);

    // If duration is resolved, cannot ask onset timeline again
    if (subfields.onset.duration && (detectedTarget === "onset" || detectedTarget === "onset_time")) {
      return {
        isValid: false,
        detectedTarget,
        reason: "LLM_REPEATED_RESOLVED_DIMENSION: onset duration is already resolved",
      };
    }

    // If onset pattern (sudden vs gradual) is resolved, cannot ask onset pattern again
    if (subfields.onset.onsetPattern !== "unknown" && detectedTarget === "onset_pattern") {
      return {
        isValid: false,
        detectedTarget,
        reason: "LLM_REPEATED_RESOLVED_DIMENSION: onset pattern is already resolved",
      };
    }

    // If severity is resolved, cannot ask severity again
    if (subfields.characterSeverity.severity && detectedTarget === "severity") {
      return {
        isValid: false,
        detectedTarget,
        reason: "LLM_REPEATED_RESOLVED_DIMENSION: pain severity is already resolved",
      };
    }

    // If character is resolved, cannot ask character again
    if (subfields.characterSeverity.character && detectedTarget === "character") {
      return {
        isValid: false,
        detectedTarget,
        reason: "LLM_REPEATED_RESOLVED_DIMENSION: symptom character is already resolved",
      };
    }
  }

  // B. Does the detected question target match responsePlan.nextHighValueInquiry.topic?
  if (plan?.nextHighValueInquiry?.topic) {
    const expectedTopic = plan.nextHighValueInquiry.topic;
    if (!isTargetSlotMatch(expectedTopic, detectedTarget)) {
      return {
        isValid: false,
        detectedTarget,
        reason: `LLM_QUESTION_TARGET_MISMATCH: expected '${expectedTopic}', detected '${detectedTarget}'`,
      };
    }
  }

  return { isValid: true, detectedTarget };
}

