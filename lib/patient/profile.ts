import crypto from "crypto";
import {
  PatientProfile,
  PatientMedication,
  DrugAllergy,
  CurrentEncounter,
  ContextAwareQuery,
  ClinicalDomain,
  PopulationTag,
} from "../clinical-knowledge/types";
import { ClinicalInterviewStateV2 } from "../triage/clinical-state";

export class PatientProfileManager {
  /**
   * Determine categorical population age tier from chronological age in years.
   */
  public static computeAgeGroup(age: number): PopulationTag {
    if (age <= 0.08) return "neonate"; // <= 28 days
    if (age < 1) return "infant";
    if (age <= 12) return "pediatric";
    if (age <= 17) return "adolescent";
    if (age >= 65) return "older_adult";
    return "adult";
  }

  /**
   * Calculate precise age from ISO or standard date string.
   */
  public static computeAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return 30; // fallback adult
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  }

  /**
   * Initialize a clean baseline patient profile.
   */
  public static createEmpty(userId?: string): PatientProfile {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      userId,
      relationshipToUser: "self",
      yearOfBirth: new Date().getFullYear() - 30, // default 30yo adult band
      ageGroup: "adult",
      knownConditions: [],
      currentMedications: [],
      allergyStatus: "unassessed",
      drugAllergies: [],
      surgicalHistory: [],
      pregnancyStatus: "not_applicable",
      smokingStatus: "unknown",
      consentGiven: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Formulate a structured context query joining patient history and encounter state.
   */
  public static buildContextQuery(
    query: string,
    profile?: PatientProfile,
    encounter?: CurrentEncounter,
    domain?: ClinicalDomain
  ): ContextAwareQuery {
    return {
      query,
      domain,
      patient: profile,
      encounter,
      topK: 5,
      minScore: 5,
    };
  }

  /**
   * Extract current encounter clinical state from structured interview state V2.
   */
  public static encounterFromClinicalState(state: ClinicalInterviewStateV2): CurrentEncounter {
    return {
      chiefComplaint: state.chiefComplaint?.normalizedText || state.chiefComplaint?.label,
      onset: state.symptomProfile?.onset?.normalizedText,
      duration: state.symptomProfile?.duration?.normalizedText,
      location: state.symptomProfile?.location?.normalizedText,
      character: state.symptomProfile?.character?.normalizedText,
      severity: state.symptomProfile?.severity?.normalizedText,
      associatedSymptoms: (state.associatedSymptoms || [])
        .filter((s) => s.status === "present")
        .map((s) => s.name || s.label),
      exposures: [],
      recentMedications: [],
    };
  }
}

export default PatientProfileManager;
