import { ClinicalConsensus, PatientCase } from "../agents/schemas";
import { ArbiterResult, evaluateSafetyArbiter } from "./safety-arbiter";
import { computeClinicalAuditHash } from "../emergency/dispatch";

export interface PostArbiterResult {
  final_esi_level: number;
  final_esi_title: string;
  final_triage_level: "emergency" | "priority" | "routine";
  final_disposition: "emergency_evaluation" | "urgent_outpatient" | "routine_outpatient";
  arbiter_override_applied: boolean;
  override_rationale?: string;
  red_flags: string[];
  matched_rules: string[];
  icd10_codes: string[];
  safe_spoken_narrative: string;
  audit_sha256: string;
  latency_us: number;
}

/**
 * DETERMINISTIC POST-ARBITER SAFETY ENFORCEMENT
 * 
 * Invariant: The Multi-Agent Consensus is a clinical recommendation;
 * the Deterministic Safety Arbiter is the SOLE clinical authority.
 * 
 * If any agent or synthesis downplays a life-threat, this arbiter forces
 * an unbypasable hard override to ESI 1 or 2.
 */
export function evaluatePostArbiter(
  patientCase: PatientCase,
  consensus: ClinicalConsensus
): PostArbiterResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

  // Evaluate deterministic clinical rule set
  const arbiterResult: ArbiterResult = evaluateSafetyArbiter({
    rawText: patientCase.transcript,
    patientAge: patientCase.demographics.age,
    llmSuggestedLevel: consensus.recommended_disposition === "emergency_evaluation" ? "emergency" :
                       consensus.recommended_disposition === "urgent_outpatient" ? "priority" : "routine"
  });

  let arbiter_override_applied = false;
  let override_rationale: string | undefined = undefined;

  let final_triage_level = arbiterResult.triageLevel;
  let final_esi_level = arbiterResult.esiScore;
  let final_esi_title = arbiterResult.esiTitle;
  let final_disposition = consensus.recommended_disposition;
  let safe_spoken_narrative = consensus.synthesized_reply_narrative;

  // INVARIANT CHECK: If arbiter flags an emergency, consensus CANNOT downgrade it
  if (arbiterResult.isEmergency) {
    if (consensus.recommended_disposition !== "emergency_evaluation") {
      arbiter_override_applied = true;
      override_rationale = `CRITICAL SAFETY OVERRIDE: Multi-Agent Consensus proposed disposition "${consensus.recommended_disposition}", but Deterministic Safety Arbiter detected emergency red flag(s): [${arbiterResult.redFlagsTriggered.join(", ")}]. Forcing ESI ${arbiterResult.esiScore} emergency disposition.`;
      
      final_disposition = "emergency_evaluation";
      final_triage_level = "emergency";
      final_esi_level = arbiterResult.esiScore;
      final_esi_title = arbiterResult.esiTitle;
      safe_spoken_narrative = `EMERGENCY SAFETY OVERRIDE ACTIVATED. Immediate medical intervention is required. Red flags identified: ${arbiterResult.redFlagsTriggered.join(", ")}. Please call 911 or 108 immediately.`;
    }
  }

  // Generate cryptographic audit hash
  const audit_sha256 = computeClinicalAuditHash({
    consultationId: `BOARD-${patientCase.patient_id}`,
    patientId: patientCase.patient_id,
    timestamp: new Date().toISOString(),
    esiScore: final_esi_level,
    triageLevel: final_triage_level,
    icd10Codes: arbiterResult.icd10Codes,
    chiefComplaint: patientCase.transcript
  });

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const latency_us = Math.max(1, Math.round((t1 - t0) * 1000));

  return {
    final_esi_level,
    final_esi_title,
    final_triage_level,
    final_disposition,
    arbiter_override_applied,
    override_rationale,
    red_flags: arbiterResult.redFlagsTriggered,
    matched_rules: arbiterResult.matchedRules,
    icd10_codes: arbiterResult.icd10Codes,
    safe_spoken_narrative,
    audit_sha256,
    latency_us
  };
}
