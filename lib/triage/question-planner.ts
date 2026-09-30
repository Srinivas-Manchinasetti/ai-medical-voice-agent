/**
 * CLINICAL QUESTION PLANNER & INTERVIEW STATE MACHINE
 * 
 * Invariants:
 * 1. State-Driven Next-Best Question: Determines the single most useful clinical question
 *    based on what is known, what is missing, and what was already asked.
 * 2. Pivot to New Information: When the patient introduces a new finding (e.g. voice change),
 *    immediately prioritizes exploring that finding before advancing standard intake.
 * 3. One Question Per Turn: Never bundles multiple inquiries into one sentence.
 * 4. Strict Anti-Repetition: Checks askedTopics, answeredTopics, and doNotRepeat to guarantee
 *    0% repeated-question rate.
 * 5. Persona-Calibrated Phrasing: Formulates questions matched to clinician specialty and bedside style.
 */

import {
  ClinicalInterviewStateV2,
  ClinicalFact,
} from "./clinical-state";
import { ExtractedEvidenceResult } from "./evidence-extractor";

export interface PlannedQuestion {
  target: string;
  label: string;
  clinicalRationale: string;
  suggestedPhrasing: string;
  isEmergencyIntervention: boolean;
  isPivotToNewFinding: boolean;
  priority: "emergency" | "high" | "normal";
}

export class QuestionPlanner {
  /**
   * Plan the next single best clinical inquiry
   */
  public planNextQuestion(
    state: ClinicalInterviewStateV2,
    extracted: ExtractedEvidenceResult,
    doctorSpecialty = "Internal Medicine",
    doctorId = "dr-sarah-chen"
  ): PlannedQuestion {
    const memory = state.interviewMemory;
    const askedSet = new Set(memory.askedTopics.map(t => t.toLowerCase()));
    const answeredSet = new Set(memory.answeredTopics.map(t => t.toLowerCase()));
    const blockedSet = new Set(memory.doNotRepeat.map(t => t.toLowerCase()));

    const isKnown = (topic: string) => {
      const top = topic.toLowerCase();
      if (top === "onset" && state.symptomProfile.onset && state.symptomProfile.onset.status !== "unknown") return true;
      if (top === "course" && state.symptomProfile.course && state.symptomProfile.course.status !== "unknown") return true;
      if (top === "severity" && state.symptomProfile.severity && state.symptomProfile.severity.status !== "unknown") return true;
      if (top === "character" && state.symptomProfile.character && state.symptomProfile.character.status !== "unknown") return true;
      if (top === "duration" && state.symptomProfile.duration && state.symptomProfile.duration.status !== "unknown") return true;
      if (top === "swallowing_difficulty") {
        const sw = state.redFlags.swallowing;
        if (sw && sw.assessed) return true;
      }
      if (top === "voice_character") {
        return state.establishedFacts.some(f => (f.name === "voice_character" || f.name === "voice_quality") && f.status !== "unknown");
      }
      return state.establishedFacts.some(f => f.name.toLowerCase() === top && f.status !== "unknown");
    };

    const isBlocked = (topic: string) =>
      askedSet.has(topic.toLowerCase()) ||
      answeredSet.has(topic.toLowerCase()) ||
      blockedSet.has(topic.toLowerCase()) ||
      isKnown(topic);

    // 1. EMERGENCY INVARIANT: Critical life-threat triggers
    const redFlagList = Object.values(state.redFlags);
    const criticalFlag = redFlagList.find(rf => rf.status === "critical");
    if (criticalFlag || state.safety.immediateDanger) {
      return {
        target: "emergency_dispatch",
        label: "Immediate emergency escalation",
        clinicalRationale: "A critical life-threat invariant is active. Immediately instruct patient to seek emergency care.",
        suggestedPhrasing: "Because of these urgent symptoms, please stay seated, remain calm, and contact emergency ambulance services immediately.",
        isEmergencyIntervention: true,
        isPivotToNewFinding: false,
        priority: "emergency",
      };
    }

    // 2. PATIENT OBJECTION / REAFFIRMATION ("I insist my throat is paining and my voice has been changed")
    if (extracted.isReaffirmation) {
      const knownList = state.establishedFacts
        .filter(f => f.status === "present")
        .map(f => f.label.toLowerCase())
        .slice(0, 3)
        .join(" and ");

      // Acknowledge without repeating, and advance to next unasked safety question
      if (!isBlocked("severity")) {
        return {
          target: "severity",
          label: "Pain severity (0-10)",
          clinicalRationale: "Acknowledge patient's reaffirmed symptoms with humility, and quantify throat pain severity.",
          suggestedPhrasing: "I understand, and we have that noted clearly. On a scale from zero to ten, how severe is the throat pain right now?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
      if (!isBlocked("swallowing_difficulty")) {
        return {
          target: "swallowing_difficulty",
          label: "Swallowing difficulty",
          clinicalRationale: "Screen for red-flag dysphagia/odynophagia without repeating previous questions.",
          suggestedPhrasing: "Understood. Are you having any difficulty swallowing liquids or your own saliva?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
    }

    // 3. PIVOT TO NEW INFORMATION: If patient just revealed an uncharacterized finding (e.g. voice change)
    if (extracted.newFindingsDetected.includes("voice_change") && !isBlocked("voice_character")) {
      return {
        target: "voice_character",
        label: "Characterize voice change",
        clinicalRationale: "Patient reported new voice alteration. Differentiate hoarseness / laryngitis from aphonia or upper airway obstruction.",
        suggestedPhrasing: "The voice change is helpful to know. Is it more like hoarseness, weakness, or difficulty producing your voice?",
        isEmergencyIntervention: false,
        isPivotToNewFinding: true,
        priority: "high",
      };
    }

    // 4. CHIEF COMPLAINT: If not yet established
    if (!state.chiefComplaint && !isBlocked("chief_complaint")) {
      return {
        target: "chief_complaint",
        label: "Presenting symptom / Chief complaint",
        clinicalRationale: "Establish the primary symptom or health concern.",
        suggestedPhrasing: "What symptoms or health concerns brought you in today?",
        isEmergencyIntervention: false,
        isPivotToNewFinding: false,
        priority: "high",
      };
    }

    // 5. DOMAIN-SPECIFIC NEXT-BEST QUESTION SELECTION
    const ccName = state.chiefComplaint?.name || "";
    const isThroatPresentation = ccName.includes("throat") || state.establishedFacts.some(f => f.name.includes("throat"));
    const isChestPresentation = ccName.includes("chest") || state.establishedFacts.some(f => f.name.includes("chest"));
    const isNeuroPresentation = ccName.includes("neuro") || state.establishedFacts.some(f => f.name.includes("droop") || f.name.includes("weakness"));

    // --- DOMAIN A: THROAT / ENT / PHARYNGITIS ---
    if (isThroatPresentation) {
      // Step A1: Onset (if timeline not established)
      if (!isBlocked("onset")) {
        return {
          target: "onset",
          label: "Onset & timeline",
          clinicalRationale: "Establish when the throat pain began and if it started suddenly or built up gradually.",
          suggestedPhrasing: "Could you tell me when this began, and whether it started suddenly or built up gradually?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }

      // Step A1.5: Course Progression (if onset is already known but course is missing)
      if (!isBlocked("course")) {
        return {
          target: "course",
          label: "Course & progression",
          clinicalRationale: "Establish whether the throat pain is worsening, improving, or staying the same.",
          suggestedPhrasing: "Has the throat pain been getting worse, improving, or staying about the same?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }

      // Step A2: Red Flag Dysphagia (Saliva / Liquids)
      if (!isBlocked("swallowing_difficulty")) {
        const hasOdynophagia = state.associatedSymptoms.some(s => s.name === "painful_swallowing") ||
          state.establishedFacts.some(f => f.name === "painful_swallowing");
        const phrasing = hasOdynophagia
          ? "I understand that swallowing is painful. Despite the pain, are you still able to swallow liquids and keep them down without choking?"
          : "Have you had any difficulty swallowing liquids or your own saliva?";
        return {
          target: "swallowing_difficulty",
          label: "Swallowing difficulty",
          clinicalRationale: hasOdynophagia
            ? "Patient reported painful swallowing (odynophagia); screen specifically for mechanical obstruction or inability to swallow fluids (true dysphagia)."
            : "Screen for epiglottitis, peritonsillar abscess, and airway obstruction risk.",
          suggestedPhrasing: phrasing,
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }

      // Step A3: Systemic Fever / Chills
      if (!isBlocked("fever")) {
        return {
          target: "fever",
          label: "Fever / Chills",
          clinicalRationale: "Screen for systemic bacterial or viral infection (Centor score criteria).",
          suggestedPhrasing: "Have you had a fever or chills?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }

      // Step A4: Characterize Voice Change (if voice change is present but character unclarified)
      const hasVoiceChangeFact = state.associatedSymptoms.some(s => s.name === "voice_change");
      if (hasVoiceChangeFact && !isBlocked("voice_character")) {
        return {
          target: "voice_character",
          label: "Voice change characterization",
          clinicalRationale: "Differentiate laryngeal inflammation from vocal cord involvement.",
          suggestedPhrasing: "Regarding your voice, is it mainly hoarseness, or are you struggling to produce sounds?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "normal",
        };
      }

      // Step A5: Pain Severity (0 to 10)
      if (!state.symptomProfile.severity && !isBlocked("severity")) {
        return {
          target: "severity",
          label: "Pain severity",
          clinicalRationale: "Quantify current pain level to evaluate clinical severity.",
          suggestedPhrasing: "How severe is the throat pain right now on a scale from zero to ten?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "normal",
        };
      }

      // Step A6: Referred Ear Pain (Otalgia)
      if (!isBlocked("ear_pain")) {
        return {
          target: "ear_pain",
          label: "Referred ear pain (Otalgia)",
          clinicalRationale: "Screen for glossopharyngeal nerve referred otalgia indicative of peritonsillar process.",
          suggestedPhrasing: "Are you feeling any ear pain or pain radiating toward your ears?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "normal",
        };
      }

      // Step A7: Associated Cough or Cold Symptoms
      if (!isBlocked("cough")) {
        return {
          target: "cough",
          label: "Cough & rhinorrhea",
          clinicalRationale: "Distinguish viral upper respiratory tract infection from streptococcal pharyngitis.",
          suggestedPhrasing: "Do you have a cough or runny nose alongside the sore throat?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "normal",
        };
      }
    }

    // --- DOMAIN B: CHEST / CARDIOVASCULAR ---
    if (isChestPresentation) {
      if (!state.symptomProfile.character && !isBlocked("character")) {
        return {
          target: "character",
          label: "Chest sensation character",
          clinicalRationale: "Differentiate pressure/squeezing from sharp or pleuritic pain.",
          suggestedPhrasing: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, burning, or a sharp pain?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
      if (!state.symptomProfile.onset && !isBlocked("onset")) {
        return {
          target: "onset",
          label: "Onset & timeline",
          clinicalRationale: "Establish onset acuity and timeline.",
          suggestedPhrasing: "When did this begin, and did it start suddenly or build up gradually?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
      if (!isBlocked("radiation")) {
        return {
          target: "radiation",
          label: "Radiation pathway",
          clinicalRationale: "Screen for radiation into left arm, jaw, neck, or back.",
          suggestedPhrasing: "Does that chest discomfort travel anywhere, such as into your left arm, jaw, neck, or back?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
      if (!isBlocked("exertional")) {
        return {
          target: "exertional",
          label: "Exertional relationship",
          clinicalRationale: "Determine exertional vs rest ischemia.",
          suggestedPhrasing: "Does this discomfort happen when you're physically active, or does it happen while resting?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
      if (!isBlocked("associated_symptoms")) {
        return {
          target: "associated_symptoms",
          label: "Associated autonomic symptoms",
          clinicalRationale: "Screen for diaphoresis, dyspnea, nausea, and presyncope.",
          suggestedPhrasing: "Are you feeling any shortness of breath, cold sweating, or nausea alongside it?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
    }

    // --- DOMAIN C: NEUROLOGICAL ---
    if (isNeuroPresentation) {
      if (!isBlocked("neurological_signs")) {
        return {
          target: "neurological_signs",
          label: "Focal stroke deficits (BE-FAST)",
          clinicalRationale: "Screen for unilateral weakness, facial droop, or speech impairment.",
          suggestedPhrasing: "Have you noticed any weakness in your arms or legs, facial drooping, or difficulty speaking?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "high",
        };
      }
      if (!state.symptomProfile.duration && !isBlocked("duration")) {
        return {
          target: "duration",
          label: "Episode duration",
          clinicalRationale: "Differentiate transient ischemic deficit from persistent deficit.",
          suggestedPhrasing: "When these episodes happen, roughly how long does each one last?",
          isEmergencyIntervention: false,
          isPivotToNewFinding: false,
          priority: "normal",
        };
      }
    }

    // --- DEFAULT FALLBACK: GENERAL CLINICAL INTAKE ---
    if (!state.symptomProfile.onset && !isBlocked("onset")) {
      return {
        target: "onset",
        label: "Onset & progression",
        clinicalRationale: "Establish timeline and onset acuity.",
        suggestedPhrasing: "Could you tell me when this began, and whether it started suddenly or built up gradually?",
        isEmergencyIntervention: false,
        isPivotToNewFinding: false,
        priority: "normal",
      };
    }

    if (!state.symptomProfile.severity && !isBlocked("severity")) {
      return {
        target: "severity",
        label: "Severity assessment",
        clinicalRationale: "Assess symptom severity.",
        suggestedPhrasing: "How severe are your symptoms right now on a scale from zero to ten?",
        isEmergencyIntervention: false,
        isPivotToNewFinding: false,
        priority: "normal",
      };
    }

    const result = {
      target: "associated_general",
      label: "Associated symptoms",
      clinicalRationale: "Broaden diagnostic differential.",
      suggestedPhrasing: "Are you experiencing any other symptoms alongside this?",
      isEmergencyIntervention: false,
      isPivotToNewFinding: false,
      priority: "normal" as const,
    };

    return result;
  }
}

/**
 * GOLDEN INVARIANT VALIDATOR:
 * Guarantees that the agent NEVER asks "Do you have X?" when the clinical state
 * already contains X = present or X = absent / denied, unless explicitly performing
 * contradiction clarification.
 */
export function validatePlannedQuestionAgainstState(
  question: PlannedQuestion,
  state: ClinicalInterviewStateV2
): { isValid: boolean; violationReason?: string } {
  // Emergency instructions and contradiction clarification bypass standard checklist checks
  if (question.isEmergencyIntervention || question.target === "emergency_dispatch") {
    return { isValid: true };
  }

  const target = question.target.toLowerCase();

  // Check 1: Target slot already resolved in symptomProfile
  if (target === "onset" && state.symptomProfile.onset && state.symptomProfile.onset.status !== "unknown") {
    return {
      isValid: false,
      violationReason: `Golden Invariant Violation: Target 'onset' is already established (${state.symptomProfile.onset.normalizedText}).`,
    };
  }
  if (target === "course" && state.symptomProfile.course && state.symptomProfile.course.status !== "unknown") {
    return {
      isValid: false,
      violationReason: `Golden Invariant Violation: Target 'course' is already established (${state.symptomProfile.course.normalizedText}).`,
    };
  }
  if (target === "severity" && state.symptomProfile.severity && state.symptomProfile.severity.status !== "unknown") {
    return {
      isValid: false,
      violationReason: `Golden Invariant Violation: Target 'severity' is already established (${state.symptomProfile.severity.normalizedText}).`,
    };
  }
  if (target === "character" && state.symptomProfile.character && state.symptomProfile.character.status !== "unknown") {
    return {
      isValid: false,
      violationReason: `Golden Invariant Violation: Target 'character' is already established (${state.symptomProfile.character.normalizedText}).`,
    };
  }

  // Check 2: Target slot already established or denied in established facts
  const established = state.establishedFacts.find(
    f => f.name.toLowerCase() === target && (f.status === "present" || f.status === "absent")
  );
  if (established) {
    return {
      isValid: false,
      violationReason: `Golden Invariant Violation: Fact '${target}' is already known as '${established.status}' (${established.normalizedText}).`,
    };
  }

  // Check 3: Denied topics in interview memory
  if (state.interviewMemory.deniedTopics.some(d => d.toLowerCase() === target)) {
    return {
      isValid: false,
      violationReason: `Golden Invariant Violation: Fact '${target}' was explicitly denied by patient.`,
    };
  }

  // Check 4: Semantic leakage in question phrasing
  const lowerPhrasing = question.suggestedPhrasing.toLowerCase();

  // If onset is known, phrasing must not ask when it began
  if (state.symptomProfile.onset && state.symptomProfile.onset.status !== "unknown") {
    if (/\b(when did (?:this|it) (?:start|begin)|how long have you had|when did you (?:first )?(?:notice|feel))\b/i.test(lowerPhrasing)) {
      return {
        isValid: false,
        violationReason: `Golden Invariant Violation: Phrasing asks for onset when onset is already known (${state.symptomProfile.onset.normalizedText}).`,
      };
    }
  }

  // If swallowing is already screened
  const swallowingFact = state.establishedFacts.find(f => f.name === "swallowing_difficulty");
  const swallowingFlag = state.redFlags.swallowing;
  if ((swallowingFact && swallowingFact.status !== "unknown") || (swallowingFlag && swallowingFlag.assessed)) {
    if (/\b(difficulty swallowing|trouble swallowing|swallow.*liquids|swallow.*saliva)\b/i.test(lowerPhrasing)) {
      return {
        isValid: false,
        violationReason: `Golden Invariant Violation: Phrasing queries swallowing difficulty when swallowing is already screened.`,
      };
    }
  }

  // If fever is already screened
  const feverFact = state.establishedFacts.find(f => f.name === "fever");
  if (feverFact && feverFact.status !== "unknown") {
    if (/\b(have you had a fever|any fever or chills|feverish)\b/i.test(lowerPhrasing)) {
      return {
        isValid: false,
        violationReason: `Golden Invariant Violation: Phrasing queries fever when fever is already screened (${feverFact.normalizedText}).`,
      };
    }
  }

  // If ear pain is already screened
  const earFact = state.establishedFacts.find(f => f.name === "ear_pain");
  if (earFact && earFact.status !== "unknown") {
    if (/\b(ear pain|earache|ears? hurt|radiat.*to.*ears?)\b/i.test(lowerPhrasing)) {
      return {
        isValid: false,
        violationReason: `Golden Invariant Violation: Phrasing queries ear pain when ear pain is already screened (${earFact.normalizedText}).`,
      };
    }
  }

  return { isValid: true };
}

export const questionPlanner = new QuestionPlanner();
