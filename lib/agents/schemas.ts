import { z } from "zod";

/**
 * PATIENT DEMOGRAPHICS SCHEMA
 */
export const DemographicsSchema = z.object({
  age: z.number().optional(),
  age_group: z.enum(["infant", "pediatric", "young_adult", "adult", "older_adult"]).default("adult"),
  gender: z.enum(["male", "female", "other"]).optional(),
});
export type Demographics = z.infer<typeof DemographicsSchema>;

/**
 * SPEECH & PARALINGUISTIC FEATURES SCHEMA
 * Structured as measured signals and observed acoustic characteristics.
 */
export const SpeechFeaturesSchema = z.object({
  speech_pause_ratio: z.number().min(0).max(1).default(0.15),
  mean_pause_duration_ms: z.number().nonnegative().default(350),
  speech_rate_wpm: z.number().nonnegative().default(130),
  voice_energy_variability: z.number().min(0).max(1).default(0.1),
  pitch_variability: z.number().min(0).max(1).default(0.12),
  observations: z.array(z.string()).default([]),
  clinical_relevance: z.object({
    respiratory_distress_signal: z.enum(["unlikely", "possible", "probable", "severe"]).default("unlikely"),
    vocal_instability_signal: z.enum(["none", "mild", "pronounced"]).default("none"),
    confidence: z.number().min(0).max(1).default(0.5),
  }).default({
    respiratory_distress_signal: "unlikely",
    vocal_instability_signal: "none",
    confidence: 0.5,
  }),
});
export type SpeechFeatures = z.infer<typeof SpeechFeaturesSchema>;

/**
 * NORMALIZED PATIENT CASE SCHEMA
 * The canonical clinical payload passed from intake into the multi-agent board.
 */
export const PatientCaseSchema = z.object({
  patient_id: z.string().default("ANON-PT"),
  patient_name: z.string().default("Patient"),
  transcript: z.string(),
  conversation_history: z.array(z.object({
    role: z.enum(["doctor", "patient", "system"]),
    text: z.string(),
    timestamp: z.string().optional(),
  })).default([]),
  demographics: DemographicsSchema.default({
    age_group: "adult",
  }),
  detected_symptoms: z.array(z.string()).default([]),
  vitals: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  speech_features: SpeechFeaturesSchema.default({
    speech_pause_ratio: 0.15,
    mean_pause_duration_ms: 350,
    speech_rate_wpm: 130,
    voice_energy_variability: 0.1,
    pitch_variability: 0.12,
    observations: [],
    clinical_relevance: {
      respiratory_distress_signal: "unlikely",
      vocal_instability_signal: "none",
      confidence: 0.5,
    },
  }),
  pre_safety_flags: z.array(z.string()).default([]),
  immediate_danger_detected: z.boolean().default(false),
});
export type PatientCase = z.infer<typeof PatientCaseSchema>;

/**
 * SPECIALIST INVOCATION REQUEST SCHEMA
 * Produced by deterministic routing rules and contextualized by the Orchestrator.
 */
export const SpecialistRequestSchema = z.object({
  specialty: z.enum(["cardiology", "neurology", "pediatrics"]),
  reason: z.string(),
  priority: z.enum(["immediate", "routine"]).default("routine"),
  trigger_flags: z.array(z.string()).default([]),
});
export type SpecialistRequest = z.infer<typeof SpecialistRequestSchema>;

/**
 * SPECIALIST STRUCTURED CLINICAL OPINION SCHEMA
 * Every agent must return this schema, ensuring strictly structured evidence.
 */
export const AgentOpinionSchema = z.object({
  agent: z.string(),
  doctor_name: z.string(),
  specialty: z.string(),
  concerns: z.array(z.string()),
  evidence: z.array(z.string()),
  risk_level: z.enum(["high", "moderate", "low"]),
  recommended_actions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  requires_escalation: z.boolean(),
  speech_observations_evaluated: z.array(z.string()).default([]),
  clinical_protocol: z.string().default("Standard evaluation"),
});
export type AgentOpinion = z.infer<typeof AgentOpinionSchema>;

/**
 * DIFFERENTIAL DIAGNOSIS ITEM
 */
export const DifferentialItemSchema = z.object({
  condition: z.string(),
  supporting_agents: z.array(z.string()),
  risk: z.enum(["high", "moderate", "low"]),
  clinical_rationale: z.string(),
});
export type DifferentialItem = z.infer<typeof DifferentialItemSchema>;

/**
 * CLINICAL CONFLICT SCHEMA
 * Documents disagreement or overlapping etiologies between specialists.
 */
export const ClinicalConflictSchema = z.object({
  topic: z.string(),
  agents: z.array(z.string()),
  resolution: z.string(),
});
export type ClinicalConflict = z.infer<typeof ClinicalConflictSchema>;

/**
 * CLINICAL CONSENSUS SCHEMA
 * Produced by the Consensus Synthesizer before deterministic safety arbitration.
 */
export const ClinicalConsensusSchema = z.object({
  differential: z.array(DifferentialItemSchema),
  conflicts: z.array(ClinicalConflictSchema).default([]),
  recommended_disposition: z.enum([
    "emergency_evaluation",
    "urgent_outpatient",
    "routine_outpatient"
  ]),
  consensus_risk: z.enum(["critical", "urgent", "routine"]),
  primary_specialty: z.string().default("general"),
  key_findings: z.array(z.string()),
  synthesized_reply_narrative: z.string(),
  orchestrator_summary: z.string(),
  requires_immediate_escalation: z.boolean().default(false),
  active_specialists: z.array(z.string()),
});
export type ClinicalConsensus = z.infer<typeof ClinicalConsensusSchema>;

/**
 * FULL BOARD EXECUTION TRACE
 * Full audit log recording exact timing and intermediate artifacts.
 */
export interface BoardExecutionTrace {
  timestamp: string;
  patient_id: string;
  pre_arbiter_latency_us: number; // in microseconds
  orchestrator_latency_ms: number;
  specialist_latencies_ms: Record<string, number>;
  synthesis_latency_ms: number;
  post_arbiter_latency_us: number;
  total_board_latency_ms: number;
  specialists_summoned: string[];
  pre_safety_flags: string[];
  immediate_danger: boolean;
  opinions: AgentOpinion[];
  consensus: ClinicalConsensus;
  post_arbiter_override: boolean;
  final_esi_level: number;
  final_disposition: string;
  audit_sha256: string;
}
