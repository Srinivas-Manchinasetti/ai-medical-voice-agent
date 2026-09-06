import { BoardExecutionTrace, ClinicalConsensus, PatientCase } from "./schemas";
import { evaluatePreArbiter } from "../triage/pre-arbiter";
import { TriageOrchestrator } from "./orchestrator";
import { ClinicalSynthesizer } from "./synthesizer";
import { evaluatePostArbiter, PostArbiterResult } from "../triage/post-arbiter";

export interface ClinicalBoardOutput {
  trace: BoardExecutionTrace;
  post_arbiter: PostArbiterResult;
  consensus: ClinicalConsensus;
  doctor_reply: string;
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

/**
 * MULTI-AGENT CLINICAL BOARD ORCHESTRATION PIPELINE
 * 
 * Flow:
 * Patient Case -> Pre-Arbiter -> Orchestrator -> Specialist Agents
 *              -> Consensus Synthesizer -> Post-Arbiter (Hard Override Shield)
 *              -> Patient-Safe Output + Audit Trail
 */
export class ClinicalBoard {
  private orchestrator = new TriageOrchestrator();
  private synthesizer = new ClinicalSynthesizer();

  public async evaluate(patientCase: PatientCase): Promise<ClinicalBoardOutput> {
    const boardStart = typeof performance !== "undefined" ? performance.now() : Date.now();

    // 1. Pre-Arbiter: Deterministic Pre-Screening
    const preResult = evaluatePreArbiter(patientCase);
    patientCase.pre_safety_flags = preResult.pre_safety_flags;
    patientCase.immediate_danger_detected = preResult.immediate_danger;

    // 2. Orchestrator: Selective Specialist Invocation
    const orchResult = await this.orchestrator.orchestrate(patientCase);

    // 3. Clinical Synthesizer: Conflict-Aware Differential Compilation
    const synthResult = await this.synthesizer.synthesize(
      patientCase,
      orchResult.opinions,
      orchResult.orchestrator_summary,
      orchResult.active_specialists
    );

    // 4. Post-Arbiter: Deterministic Safety Enforcement & Overrides
    const postResult = evaluatePostArbiter(patientCase, synthResult.consensus);

    const boardEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
    const total_board_latency_ms = Math.round(boardEnd - boardStart);

    // 5. Assemble Audit Trace
    const specialistLatencies: Record<string, number> = {};
    orchResult.specialists_requested.forEach(s => {
      specialistLatencies[s.specialty] = orchResult.latency_ms;
    });

    const trace: BoardExecutionTrace = {
      timestamp: new Date().toISOString(),
      patient_id: patientCase.patient_id,
      pre_arbiter_latency_us: preResult.latency_us,
      orchestrator_latency_ms: orchResult.latency_ms,
      specialist_latencies_ms: specialistLatencies,
      synthesis_latency_ms: synthResult.latency_ms,
      post_arbiter_latency_us: postResult.latency_us,
      total_board_latency_ms,
      specialists_summoned: orchResult.specialists_requested.map(s => s.specialty),
      pre_safety_flags: preResult.pre_safety_flags,
      immediate_danger: preResult.immediate_danger,
      opinions: orchResult.opinions,
      consensus: synthResult.consensus,
      post_arbiter_override: postResult.arbiter_override_applied,
      final_esi_level: postResult.final_esi_level,
      final_disposition: postResult.final_disposition,
      audit_sha256: postResult.audit_sha256
    };

    // 6. Generate Formal Multi-Agent SOAP Documentation
    const soap_note = {
      subjective: `Patient (${patientCase.patient_name}, ID: ${patientCase.patient_id}) presents with chief complaint: "${patientCase.transcript}". Speech characteristics: ${patientCase.speech_features.observations.join(", ") || "Reassuring continuity"}.`,
      objective: `Multi-Agent Clinical Board consultation [${orchResult.active_specialists.join(", ")}]. Pre-Arbiter Flags: ${preResult.pre_safety_flags.join(", ") || "None"}. Objective Evidence: ${synthResult.consensus.key_findings.join("; ") || "None"}. ICD-10 Tags: ${postResult.icd10_codes.join(", ") || "Z76.0"}.`,
      assessment: `${postResult.final_esi_title} (ESI ${postResult.final_esi_level}). Differential Diagnoses: ${synthResult.consensus.differential.map(d => `${d.condition} [Risk: ${d.risk.toUpperCase()}]`).join(", ")}. Specialty: ${synthResult.consensus.primary_specialty}. Safety Arbiter Status: ${postResult.arbiter_override_applied ? "OVERRIDE_ENFORCED" : "NOMINAL"}.`,
      plan: `1. Clinical Disposition: ${postResult.final_disposition.toUpperCase()}\n2. Specialist Actions: ${orchResult.opinions.flatMap(o => o.recommended_actions).slice(0, 4).join("; ")}\n3. Cryptographic Audit: SHA-256 ${postResult.audit_sha256.slice(0, 16)}...\n4. Hard Override Rationale: ${postResult.override_rationale || "None"}`
    };

    return {
      trace,
      post_arbiter: postResult,
      consensus: synthResult.consensus,
      doctor_reply: postResult.safe_spoken_narrative,
      soap_note
    };
  }
}

export const clinicalBoard = new ClinicalBoard();
