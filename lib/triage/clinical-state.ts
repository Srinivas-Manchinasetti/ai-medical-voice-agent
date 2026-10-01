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

  let severity = slots.severity;
  if (!severity) {
    const sevFact = knownFacts.find(f => /^SEVERITY:\s*(.+)/i.test(f) || /\b([0-9]|10)\/10\b/i.test(f));
    if (sevFact) {
      const match = sevFact.match(/\b([0-9]|10)\/10\b/i);
      severity = match ? match[0] : sevFact.replace(/^SEVERITY:\s*/i, "").trim();
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

