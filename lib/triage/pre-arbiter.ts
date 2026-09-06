import { PatientCase, SpecialistRequest } from "../agents/schemas";

export interface PreArbiterResult {
  immediate_danger: boolean;
  pre_safety_flags: string[];
  suggested_specialists: SpecialistRequest[];
  latency_us: number; // empirical latency in microseconds
}

/**
 * DETERMINISTIC PRE-ARBITER SAFETY SHIELD
 * 
 * Invariant: Runs before any LLM is invoked.
 * Detects immediate life-threatening physiological crises with zero LLM dependence.
 * Measures exact runtime latency in microseconds without marketing exaggerations.
 */
export function evaluatePreArbiter(patientCase: Partial<PatientCase>): PreArbiterResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  const text = (patientCase.transcript || "").toLowerCase();
  const pre_safety_flags: string[] = [];
  const suggested_specialists: SpecialistRequest[] = [];

  // Helper for lookbehind negation detection
  const negationPatterns = [
    /(?:no|denies|without|never|rules?\s+out|negative\s+for|not|free\s+of)(?:\s+[a-z0-9_-]+){0,3}\s+(?:or|and|\/)\s*$/i,
    /(?:no|denies|without|never|rules?\s+out|negative\s+for|not|free\s+of)(?:\s+[a-z0-9_-]+){0,3}\s*$/i,
  ];

  // Helper for lookbehind negation detection
  const isNegated = (keyword: string): boolean => {
    const idx = text.indexOf(keyword);
    if (idx === -1) return false;
    const windowStart = Math.max(0, idx - 70);
    const window = text.slice(windowStart, idx);
    return negationPatterns.some((pattern) => pattern.test(window.trim()));
  };

  const hasAffirmative = (patterns: string[]): boolean => {
    return patterns.some((p) => text.includes(p) && !isNegated(p));
  };

  const hasAffirmativeRegex = (re: RegExp): boolean => {
    const match = text.match(re);
    if (!match) return false;
    const idx = text.search(re);
    const windowStart = Math.max(0, idx - 70);
    const window = text.slice(windowStart, idx);
    return !negationPatterns.some((pattern) => pattern.test(window.trim()));
  };

  // 1. Cardiovascular / Acute Coronary Syndrome (ACS) Red Flags
  const hasChestPain = hasAffirmative([
    "chest pain", "chest pressure", "crushing chest", "heavy chest", "tightness in chest",
    "elephant on chest", "squeezing chest", "pain radiating to left arm", "substernal"
  ]) || hasAffirmativeRegex(/\b(crushing|heavy|tightness|pressure|squeezing).*chest\b/i);

  const hasCardiacRadiation = hasAffirmative([
    "left arm", "jaw pain", "neck pain", "between shoulder blades", "cold sweats", "diaphoresis"
  ]) || hasAffirmativeRegex(/radiat.*(left arm|arm|jaw)/i);

  if (hasChestPain) {
    pre_safety_flags.push("PRE_FLAG_ACUTE_CHEST_PAIN");
    if (hasCardiacRadiation) {
      pre_safety_flags.push("PRE_FLAG_ACS_RADIATION_OR_DIAPHORESIS");
    }
    suggested_specialists.push({
      specialty: "cardiology",
      reason: hasCardiacRadiation ? "Crushing chest discomfort with typical radiation" : "Thoracic pain evaluation",
      priority: "immediate",
      trigger_flags: ["PRE_FLAG_ACUTE_CHEST_PAIN"]
    });
  }

  // 2. Neurological / Acute Ischemic Stroke Red Flags (BE-FAST)
  const hasNeuroDeficit = hasAffirmative([
    "facial droop", "face drooping", "arm weakness", "slurred speech", "cannot speak",
    "sudden numbness", "loss of speech", "sudden confusion", "hemiparesis",
    "thunderclap headache", "worst headache of my life"
  ]) || hasAffirmativeRegex(/\b(facial.*droop|face.*droop|arm.*weak|slurred.*speech|sudden.*numb)\b/i);

  if (hasNeuroDeficit) {
    pre_safety_flags.push("PRE_FLAG_ACUTE_NEUROLOGIC_DEFICIT");
    suggested_specialists.push({
      specialty: "neurology",
      reason: "Acute focal neurological deficit / BE-FAST criteria match",
      priority: "immediate",
      trigger_flags: ["PRE_FLAG_ACUTE_NEUROLOGIC_DEFICIT"]
    });
  }

  // 3. Airway / Respiratory Failure / Anaphylaxis Red Flags
  const hasAirwayCompromise = hasAffirmative([
    "cannot breathe", "stridor", "blue lips", "gasping for air", "throat swelling",
    "tongue swelling", "unable to speak full sentences", "anaphylaxis"
  ]);

  if (hasAirwayCompromise) {
    pre_safety_flags.push("PRE_FLAG_IMMEDIATE_AIRWAY_FAILURE");
  }

  // Check speech features if provided
  if (patientCase.speech_features?.clinical_relevance?.respiratory_distress_signal === "severe") {
    pre_safety_flags.push("PRE_FLAG_ACOUSTIC_SEVERE_RESPIRATORY_DISTRESS");
  }

  // 4. Pediatric Crisis Red Flags
  const isPediatric = patientCase.demographics?.age_group === "infant" ||
                      patientCase.demographics?.age_group === "pediatric" ||
                      (patientCase.demographics?.age !== undefined && patientCase.demographics.age < 16) ||
                      hasAffirmative(["baby", "child", "infant", "toddler", "my son", "my daughter", "months old", "weeks old"]);

  const hasPediatricEmergency = isPediatric && hasAffirmative([
    "inconsolable", "lethargic", "floppy", "not waking up", "grunting", "sunken fontanelle",
    "fever in newborn", "high fever"
  ]);

  if (isPediatric) {
    suggested_specialists.push({
      specialty: "pediatrics",
      reason: "Pediatric-specific symptom and developmental vital evaluation",
      priority: hasPediatricEmergency ? "immediate" : "routine",
      trigger_flags: hasPediatricEmergency ? ["PRE_FLAG_PEDIATRIC_CRISIS"] : []
    });
    if (hasPediatricEmergency) {
      pre_safety_flags.push("PRE_FLAG_PEDIATRIC_CRISIS");
    }
  }

  // Determine immediate danger threshold
  const immediate_danger = pre_safety_flags.length > 0;

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const latency_us = Math.max(1, Math.round((t1 - t0) * 1000));

  return {
    immediate_danger,
    pre_safety_flags,
    suggested_specialists,
    latency_us
  };
}
