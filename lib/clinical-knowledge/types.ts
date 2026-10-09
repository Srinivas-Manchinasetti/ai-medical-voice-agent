export type AuthorityTier =
  | "deterministic_safety"
  | "clinical_guideline"
  | "national_guideline"
  | "government_reference"
  | "medication_label"
  | "medication_identity"
  | "regulatory_adverse"
  | "peer_reviewed_evidence";

export type ClinicalSection =
  | "overview"
  | "symptoms"
  | "emergency_guidance"
  | "diagnosis"
  | "treatment"
  | "risk_factors"
  | "prevention"
  | "contraindications"
  | "interactions"
  | "adverse_events"
  | "management"
  | "referral";

export type ClinicalDomain =
  | "cardiology"
  | "neurology"
  | "pediatrics"
  | "medications"
  | "gastroenterology"
  | "pulmonology"
  | "endocrinology"
  | "infectious_disease"
  | "obstetrics_gynecology"
  | "orthopedics"
  | "dermatology"
  | "psychiatry"
  | "ent"
  | "emergency_medicine"
  | "general";

export type PopulationTag =
  | "neonate"
  | "infant"
  | "pediatric"
  | "adolescent"
  | "adult"
  | "older_adult"
  | "pregnant";

export type AcuityLevel = "emergent" | "urgent" | "routine" | "preventive";

export interface ClinicalPassage {
  id: string;
  topicId: string;
  title: string;
  section: ClinicalSection;
  source: string;
  sourceUrl?: string;
  releaseDate: string;
  authority: AuthorityTier;
  domain: ClinicalDomain;
  content: string;
  keyTerms: string[];
  relevanceScore?: number;

  // Population & context metadata (Phase 1)
  population?: PopulationTag[];
  acuity?: AcuityLevel[];
  conditions?: string[];
  country?: string;
  language?: string;
  sourceType?: "clinical_guideline" | "government_reference" | "drug_label" | "adverse_event_report" | "systematic_review" | "textbook";
  version?: string;
  reviewedAt?: string;
  reviewerSignoff?: string;
  licensingProvenance?: string;
}

export interface KnowledgeContext {
  retrievedAt: string;
  query: string;
  domain: ClinicalDomain;
  passages: ClinicalPassage[];
  authorityHierarchyApplied: boolean;
  patientContextApplied?: boolean;
}

export type MedicationTaskType = "identity" | "contraindication" | "adverse_event";

export interface MedicationQueryResult {
  task: MedicationTaskType;
  primarySource: "RxNorm" | "DailyMed" | "openFDA";
  drugName: string;
  findings: string[];
  passages: ClinicalPassage[];
}

// ─── PATIENT PROFILE ───────────────────────────────────────────────────────────

export interface PatientMedication {
  name: string;
  brandName?: string;
  rxcui?: string;
  dose?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
}

export type AllergyStatus = "unassessed" | "none_known" | "confirmed";

export interface DrugAllergy {
  drugName: string;
  drugClass?: string;
  rxcui?: string;
  reactionType: "allergy" | "intolerance" | "adverse_reaction";
  severity: "mild" | "moderate" | "severe" | "anaphylaxis";
  reactionDescription?: string;
  verificationStatus?: "patient_reported" | "verified";
  lastConfirmedAt?: string;
}

export interface PatientProfile {
  id: string;
  userId?: string;
  relationshipToUser?: "self" | "child" | "parent" | "spouse" | "other";

  // Demographics
  yearOfBirth?: number;
  dateOfBirth?: string;
  age?: number;
  ageMonths?: number;
  ageGroup: PopulationTag;
  sexAssignedAtBirth?: "male" | "female" | "intersex";
  pregnancyStatus?: "pregnant" | "not_pregnant" | "unknown" | "not_applicable";

  // Medical history
  knownConditions: string[];
  currentMedications: PatientMedication[];
  allergyStatus?: AllergyStatus;
  drugAllergies: DrugAllergy[];
  surgicalHistory: string[];

  // Lifestyle
  smokingStatus?: "current" | "former" | "never" | "unknown";

  // DPDP Privacy Compliance
  consentGiven?: boolean;
  consentTimestamp?: string;
  isDeleted?: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ContraindicationAlert {
  category: "allergy" | "drug_interaction" | "pregnancy" | "pediatric_warning";
  triggerItem: string;
  conflictingItem: string;
  severity: "critical" | "warning";
  clinicalRationale: string;
  actionRequired: "block" | "warn";
}

// ─── CURRENT ENCOUNTER ─────────────────────────────────────────────────────────

export interface CurrentEncounter {
  chiefComplaint?: string;
  onset?: string;
  duration?: string;
  location?: string;
  character?: string;
  severity?: string;
  associatedSymptoms: string[];
  exposures: string[];
  recentMedications: string[];
}

// ─── CONTEXT-AWARE QUERY ───────────────────────────────────────────────────────

export interface ContextAwareQuery {
  query: string;
  domain?: ClinicalDomain;
  patient?: PatientProfile;
  encounter?: CurrentEncounter;
  targetSection?: ClinicalSection;
  topK?: number;
  minScore?: number;
}
