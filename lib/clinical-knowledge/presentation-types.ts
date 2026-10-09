/**
 * PRESENTATION SCHEMA & DIMENSION REGISTRY
 *
 * Invariants:
 * 1. PresentationContext describes what clinical presentations/syndromes are active.
 * 2. ClinicalState remains the ONLY source of truth for what the patient has actually reported.
 * 3. Never duplicate clinical values inside PresentationContext.
 * 4. Safety-screen concepts are concepts the presentation causes us to screen for; actual evidence
 *    still routes strictly to the Deterministic Safety Arbiter.
 */

export type PresentationId =
  | "ABDOMINAL_PAIN"
  | "ACUTE_DIARRHEA"
  | "CHEST_DISCOMFORT"
  | "ACUTE_DYSPNEA"
  | "HEADACHE"
  | "FEBRILE_ILLNESS"
  | "DIZZINESS_VERTIGO"
  | "PHARYNGITIS_ODYNOPHAGIA"
  | "PEDIATRIC_CRISIS"
  | "UNCLASSIFIED";

export type DimensionType = "core_history" | "associated" | "safety_screen";

export type DimensionStatus =
  | "answered"
  | "partial"
  | "denied"
  | "ambiguous"
  | "unresolved";

export interface ClinicalDimension {
  id: string; // e.g. "location", "character", "severity", "radiation", "vomiting"
  name: string;
  type: DimensionType;
  clinicalRationale: string;
  suggestedPhrasing: string;
  evaluatorSlot: string; // Slot or fact key checked in existing ClinicalState
}

export interface PresentationDefinition {
  id: PresentationId;
  name: string;
  category: string;
  screeningConcepts: string[]; // Normalized concepts that trigger this presentation
  dimensions: ClinicalDimension[];
}

export interface ActivePresentation {
  id: PresentationId;
  confidence: number;
  triggeredBy: string[]; // Normalized concept IDs/strings
}

export interface PresentationContext {
  active: ActivePresentation[];
  primary?: PresentationId;
  supporting: PresentationId[];
}

export interface DimensionEvaluation {
  dimension: ClinicalDimension;
  status: DimensionStatus;
  currentValue?: any;
}
