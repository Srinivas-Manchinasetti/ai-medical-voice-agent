export type AuthorityTier =
  | "deterministic_safety"
  | "clinical_guideline"
  | "government_reference"
  | "medication_label"
  | "medication_identity"
  | "regulatory_adverse";

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
  | "adverse_events";

export type ClinicalDomain =
  | "cardiology"
  | "neurology"
  | "pediatrics"
  | "medications"
  | "general";

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
}

export interface KnowledgeContext {
  retrievedAt: string;
  query: string;
  domain: ClinicalDomain;
  passages: ClinicalPassage[];
  authorityHierarchyApplied: boolean;
}

export type MedicationTaskType = "identity" | "contraindication" | "adverse_event";

export interface MedicationQueryResult {
  task: MedicationTaskType;
  primarySource: "RxNorm" | "DailyMed" | "openFDA";
  drugName: string;
  findings: string[];
  passages: ClinicalPassage[];
}
