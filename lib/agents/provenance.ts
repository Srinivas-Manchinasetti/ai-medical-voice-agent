import { ClinicalInterviewState } from "../triage/conversation-manager";
import { EvidenceItem, SpeechFeatures } from "./schemas";

export interface BuildProvenanceOptions {
  state: ClinicalInterviewState;
  speechFeatures?: SpeechFeatures;
  vitals?: Record<string, string | number>;
  transcript?: string;
  patientName?: string;
  patientId?: string;
}

/**
 * DETERMINISTIC CLINICAL PROVENANCE BUILDER
 * 
 * Adapts existing conversation & clinical interview state into immutable,
 * provenance-tagged evidence items:
 * - [PATIENT-REPORTED]: Symptoms, onset, severity, explicit denials
 * - [NOT ASSESSED]: Vital signs (BP, HR, SpO2, Temp, RR) & physical examination
 * - [DEVICE / ACOUSTIC MEASURED]: Measured speech cadence & acoustic features
 * - [AI-INFERRED / DETERMINISTIC]: Pre-arbiter flags & algorithm-derived indices
 */
export function buildProvenanceEvidenceFromClinicalState(
  options: BuildProvenanceOptions
): EvidenceItem[] {
  const { state, speechFeatures, vitals = {} } = options;
  const now = new Date().toISOString();
  const evidence: EvidenceItem[] = [];

  const slots = state.slots || {
    associated_symptoms: [],
    neurological_signs: [],
    pediatric_signs: [],
    known_facts: [],
  };
  const memory = state.conversationMemory || {
    confirmedFacts: slots.known_facts || [],
    deniedSymptoms: [],
    questionsAlreadyAsked: [],
    patientCorrections: [],
    patientObjections: [],
    patientConcerns: [],
    accessConstraints: [],
    uncertainties: [],
  };

  // 1. [PATIENT-REPORTED] Chief Complaint
  const cc = state.structuredHistory?.chiefComplaint ||
    (slots.known_facts.find(f => /throat/i.test(f)) ? "Throat pain" :
     slots.known_facts.find(f => /chest/i.test(f)) ? "Chest discomfort" :
     slots.known_facts.find(f => /headache/i.test(f)) ? "Headache" : "Primary clinical concern");

  evidence.push({
    id: "ev-cc",
    domain: "chief_complaint",
    label: "Chief Complaint",
    type: "symptom",
    description: cc,
    value: cc,
    status: "present",
    source: "patient_reported",
    confidence: 1.0,
    confidence_semantics: "patient_statement",
    timestamp: now,
  });

  // 2. [PATIENT-REPORTED] Timeline: Onset & Duration
  if (slots.onset) {
    evidence.push({
      id: "ev-onset",
      domain: "onset",
      label: "Onset & Timeline",
      type: "timeline",
      description: `Onset ~${slots.onset}`,
      value: slots.onset,
      status: "present",
      source: "patient_reported",
      confidence: 0.95,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }

  if (slots.duration) {
    evidence.push({
      id: "ev-duration",
      domain: "duration",
      label: "Episode Duration",
      type: "timeline",
      description: slots.duration,
      value: slots.duration,
      status: "present",
      source: "patient_reported",
      confidence: 0.95,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }

  // Course progression from known facts
  const courseFact = slots.known_facts.find(f => f.startsWith("COURSE:"));
  if (courseFact) {
    const courseVal = courseFact.replace(/^COURSE:\s*/i, "").trim();
    evidence.push({
      id: "ev-course",
      domain: "course",
      label: "Course & Progression",
      type: "course",
      description: courseVal,
      value: courseVal,
      status: "present",
      source: "patient_reported",
      confidence: 0.95,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }

  // 3. [PATIENT-REPORTED] Pain Severity
  if (slots.severity) {
    evidence.push({
      id: "ev-severity",
      domain: "pain_severity",
      label: "Pain Severity",
      type: "severity",
      description: `Severity: ${slots.severity}`,
      value: slots.severity,
      status: "present",
      source: "patient_reported",
      confidence: 0.98,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }

  // 4. [PATIENT-REPORTED] Character & Radiation
  if (slots.character) {
    evidence.push({
      id: "ev-character",
      domain: "character",
      label: "Symptom Character",
      type: "quality",
      description: slots.character,
      value: slots.character,
      status: "present",
      source: "patient_reported",
      confidence: 0.92,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }
  if (slots.radiation) {
    evidence.push({
      id: "ev-radiation",
      domain: "radiation",
      label: "Pain Radiation",
      type: "localization",
      description: slots.radiation,
      value: slots.radiation,
      status: "present",
      source: "patient_reported",
      confidence: 0.94,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }

  // 5. [PATIENT-REPORTED] Associated Symptoms (Present)
  slots.associated_symptoms.forEach((sym, idx) => {
    const isOdynophagia = /odynophagia|painful\s+swallowing/i.test(sym);
    const domain = isOdynophagia ? "odynophagia" : "associated_symptom";
    const label = isOdynophagia ? "Painful Swallowing (Odynophagia)" : `Associated Symptom (${sym})`;

    evidence.push({
      id: `ev-assoc-${idx}`,
      domain,
      label,
      type: "associated_symptom",
      description: sym,
      value: sym,
      status: "present",
      source: "patient_reported",
      confidence: 0.95,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  });

  // Explicit check for Odynophagia in known_facts if not in associated_symptoms
  if (
    slots.known_facts.some(f => /odynophagia/i.test(f)) &&
    !evidence.some(e => e.domain === "odynophagia")
  ) {
    evidence.push({
      id: "ev-odynophagia",
      domain: "odynophagia",
      label: "Painful Swallowing (Odynophagia)",
      type: "associated_symptom",
      description: "Painful swallowing upon saliva/fluids",
      value: true,
      status: "present",
      source: "patient_reported",
      confidence: 0.98,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  }

  // Neurological Signs (Present)
  slots.neurological_signs.forEach((sign, idx) => {
    evidence.push({
      id: `ev-neuro-${idx}`,
      domain: "neurological_sign",
      label: "Neurological Sign",
      type: "neurological_sign",
      description: sign,
      value: sign,
      status: "present",
      source: "patient_reported",
      confidence: 0.92,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  });

  // 6. [PATIENT-REPORTED / DENIED] Explicit Symptom Denials
  const allDenied = new Set<string>();
  (memory.deniedSymptoms || []).forEach(d => allDenied.add(d.toLowerCase()));

  slots.known_facts.forEach(f => {
    const deniedMatch = f.match(/^Denied:\s*(.+)$/i);
    if (deniedMatch && deniedMatch[1]) {
      deniedMatch[1].split(",").forEach(item => allDenied.add(item.trim().toLowerCase()));
    }
  });

  allDenied.forEach(denial => {
    let domain = denial;
    let label = denial.charAt(0).toUpperCase() + denial.slice(1);
    let description = `Denied (${label})`;

    if (denial === "fever") {
      domain = "fever";
      label = "Fever / Chills";
      description = "Denied (No fever or chills reported)";
    } else if (denial === "ear_pain") {
      domain = "ear_pain";
      label = "Referred Ear Pain (Otalgia)";
      description = "Denied (No ear pain reported)";
    } else if (denial === "swallowing_difficulty") {
      domain = "swallowing_difficulty";
      label = "Difficulty Swallowing (Dysphagia)";
      description = "Denied (No mechanical obstruction or fluid swallowing difficulty)";
    }

    evidence.push({
      id: `ev-denied-${domain}`,
      domain,
      label,
      type: "symptom_denial",
      description,
      value: false,
      status: "denied",
      source: "patient_reported",
      confidence: 0.98,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });
  });

  // 7. [NOT ASSESSED] Vital Signs & Physical Examination
  const standardVitals: Array<{
    domain: string;
    label: string;
    telehealthRationale: string;
  }> = [
    {
      domain: "blood_pressure",
      label: "Blood Pressure",
      telehealthRationale: "Not assessed (remote voice encounter; no automated sphygmomanometer connected)",
    },
    {
      domain: "heart_rate",
      label: "Heart Rate / Pulse",
      telehealthRationale: "Not assessed (no pulse oximetry or ECG hardware connected)",
    },
    {
      domain: "spo2",
      label: "Oxygen Saturation (SpO₂)",
      telehealthRationale: "Not assessed (no optical pulse oximeter connected)",
    },
    {
      domain: "temperature",
      label: "Body Temperature",
      telehealthRationale: allDenied.has("fever")
        ? "Not assessed (patient verbally denied fever; no biometric thermometer reading)"
        : "Not assessed (no digital thermometer connected)",
    },
    {
      domain: "respiratory_rate",
      label: "Respiratory Rate",
      telehealthRationale: "Not assessed (chest wall excursion cannot be directly measured via audio)",
    },
    {
      domain: "physical_examination",
      label: "Physical Examination",
      telehealthRationale: "Not performed (remote voice telehealth consultation)",
    },
  ];

  standardVitals.forEach(vital => {
    // If telemetry or user explicitly provided a measured vital
    const measuredVal = vitals[vital.domain];
    if (measuredVal !== undefined && measuredVal !== null && measuredVal !== "") {
      evidence.push({
        id: `ev-vital-${vital.domain}`,
        domain: vital.domain,
        label: vital.label,
        type: "vital_sign",
        description: `${vital.label}: ${measuredVal}`,
        value: measuredVal,
        status: "present",
        source: "device_measured",
        confidence: 0.99,
        confidence_semantics: "tool_calibrated",
        timestamp: now,
      });
    } else {
      evidence.push({
        id: `ev-unassessed-${vital.domain}`,
        domain: vital.domain,
        label: vital.label,
        type: "vital_sign",
        description: vital.telehealthRationale,
        value: null,
        status: "not_assessed",
        source: "not_assessed",
        confidence: 1.0,
        confidence_semantics: "unassessed",
        timestamp: now,
      });
    }
  });

  // 8. [DEVICE / ACOUSTIC MEASURED] Speech Features
  if (speechFeatures) {
    if (speechFeatures.speech_rate_wpm) {
      evidence.push({
        id: "ev-speech-rate",
        domain: "speech_rate",
        label: "Speech Cadence",
        type: "acoustic_metric",
        description: `${speechFeatures.speech_rate_wpm} WPM`,
        value: speechFeatures.speech_rate_wpm,
        status: "present",
        source: "device_measured",
        confidence: 0.95,
        confidence_semantics: "tool_calibrated",
        timestamp: now,
      });
    }
    if (speechFeatures.observations && speechFeatures.observations.length > 0) {
      evidence.push({
        id: "ev-acoustic-observations",
        domain: "acoustic_observations",
        label: "Acoustic Observations",
        type: "acoustic_metric",
        description: speechFeatures.observations.join("; "),
        value: speechFeatures.observations,
        status: "present",
        source: "device_measured",
        confidence: speechFeatures.clinical_relevance?.confidence || 0.85,
        confidence_semantics: "tool_calibrated",
        timestamp: now,
      });
    }
  }

  return evidence;
}
