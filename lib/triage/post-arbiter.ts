import { ClinicalConsensus, PatientCase, HashChainBlock } from "../agents/schemas";
import { ArbiterResult, evaluateSafetyArbiter } from "./safety-arbiter";
import crypto from "crypto";

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
  audit_hash_chain: HashChainBlock[];
  latency_us: number;
}

/**
 * Helper to compute sequential tamper-evident SHA-256 block hash.
 * H_k = SHA256(Record_k || H_{k-1})
 */
function computeChainedHash(payload: string, previousHash: string): string {
  return crypto.createHash("sha256").update(payload + previousHash).digest("hex");
}

/**
 * DETERMINISTIC POST-ARBITER SAFETY ENFORCEMENT & AUDIT HASH CHAINING
 * 
 * Invariant: The Multi-Agent Consensus is a clinical recommendation;
 * the Deterministic Safety Arbiter is the SOLE clinical authority.
 * 
 * Enforces:
 * 1. Hard overrides if multi-agent deliberation downplays emergency life threats.
 * 2. Sequential cryptographic hash chaining for tamper-evident event ordering.
 */
export function evaluatePostArbiter(
  patientCase: PatientCase,
  consensus: ClinicalConsensus,
  previousRootHash: string = "GENESIS_ROOT_BLOCK_00000000000000000000000000000000"
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

  // --- CONSTRUCT TAMPER-EVIDENT CRYPTOGRAPHIC AUDIT HASH CHAIN ---
  // Chain: Block 0 (Pre-Arbiter) -> Block 1 (Deliberation Consensus) -> Block 2 (Post-Arbiter Override & Disposition)
  const audit_hash_chain: HashChainBlock[] = [];
  const now = new Date().toISOString();

  // Block 0: Pre-Screening Event
  const b0_payload = `PRE_ARBITER|PT:${patientCase.patient_id}|FLAGS:${patientCase.pre_safety_flags.join(",")}`;
  const h0 = computeChainedHash(b0_payload, previousRootHash);
  audit_hash_chain.push({
    block_index: 0,
    timestamp: now,
    event_type: "pre_arbiter",
    payload_summary: b0_payload,
    previous_hash: previousRootHash,
    current_hash: h0
  });

  // Block 1: Consensus Synthesis Event
  const b1_payload = `CONSENSUS|ROUNDS:${consensus.deliberation_rounds_completed}|DISP:${consensus.recommended_disposition}|DIFF:${consensus.differential.map(d => d.condition).join(",")}`;
  const h1 = computeChainedHash(b1_payload, h0);
  audit_hash_chain.push({
    block_index: 1,
    timestamp: now,
    event_type: "consensus_synthesis",
    payload_summary: b1_payload,
    previous_hash: h0,
    current_hash: h1
  });

  // Block 2: Post-Arbiter Final Authority Event
  const b2_payload = `POST_ARBITER|FINAL_ESI:${final_esi_level}|OVERRIDE:${arbiter_override_applied}|ICD:${arbiterResult.icd10Codes.join(",")}`;
  const h2 = computeChainedHash(b2_payload, h1);
  audit_hash_chain.push({
    block_index: 2,
    timestamp: now,
    event_type: "post_arbiter_override",
    payload_summary: b2_payload,
    previous_hash: h1,
    current_hash: h2
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
    audit_sha256: h2,
    audit_hash_chain,
    latency_us
  };
}
