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
 * MULTI-AGENT CLINICAL BOARD ORCHESTRATION PIPELINE (LEVEL 5 BOUNDED)
 * 
 * Flow:
 * Patient Case -> Pre-Arbiter (Deterministic)
 *              -> Shared Blackboard Ingestion (with Provenance)
 *              -> Orchestrator & Specialist Deliberation (Rounds 1 & 2)
 *              -> Bounded Tool Invocation (Allowlists)
 *              -> Peer Cross-Examination / Challenges
 *              -> Conflict-Aware Consensus Synthesizer
 *              -> Post-Arbiter (Hard Override Shield + Cryptographic Hash Chain)
 *              -> Tamper-Evident Multi-Agent SOAP Output
 */
export class ClinicalBoard {
  private orchestrator = new TriageOrchestrator();
  private synthesizer = new ClinicalSynthesizer();

  public async evaluate(patientCase: PatientCase): Promise<ClinicalBoardOutput> {
    const boardStart = typeof performance !== "undefined" ? performance.now() : Date.now();

    // 1. Pre-Arbiter: Deterministic Sub-Millisecond Pre-Screening
    const preResult = evaluatePreArbiter(patientCase);
    patientCase.pre_safety_flags = preResult.pre_safety_flags;
    patientCase.immediate_danger_detected = preResult.immediate_danger;

    // 2. Orchestrator: Multi-Agent Deliberation over Shared Blackboard
    const orchResult = await this.orchestrator.orchestrate(patientCase);

    // 3. Clinical Synthesizer: Conflict-Aware Differential Compilation
    const synthResult = await this.synthesizer.synthesize(
      patientCase,
      orchResult.opinions,
      orchResult.orchestrator_summary,
      orchResult.active_specialists,
      orchResult.deliberation_rounds_completed,
      orchResult.blackboard,
      orchResult.deliberation_messages
    );

    // 4. Post-Arbiter: Deterministic Hard Overrides & Sequential Hash Chaining
    const postResult = evaluatePostArbiter(patientCase, synthResult.consensus);

    // 5. Append Safety Arbiter disposition to the deliberation stream
    synthResult.consensus.deliberation_messages.push({
      id: `safety-arbiter-${Date.now()}`,
      round: orchResult.deliberation_rounds_completed,
      speakerRole: "safety_arbiter",
      agentId: "deterministic-post-arbiter",
      doctorName: "Deterministic Safety Arbiter",
      specialty: "Clinical Safety Arbiter",
      type: "safety_disposition",
      content: postResult.arbiter_override_applied
        ? `DETERMINISTIC OVERRIDE ENFORCED: ${postResult.override_rationale || "Emergency criteria confirmed"}. Final disposition locked to ${postResult.final_esi_title} (ESI ${postResult.final_esi_level}).`
        : `SAFETY AUDIT VERIFIED: Disposition confirmed at ${postResult.final_esi_title} (ESI ${postResult.final_esi_level}). Tamper-evident hash: ${postResult.audit_sha256.slice(0, 16)}...`,
      references: postResult.red_flags,
      timestamp: new Date().toISOString()
    });

    const boardEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
    const total_board_latency_ms = Math.round(boardEnd - boardStart);

    // 6. Compute Specialist and Tool Latencies
    const specialistLatencies: Record<string, number> = {};
    orchResult.specialists_requested.forEach(s => {
      specialistLatencies[s.specialty] = orchResult.latency_ms;
    });

    const toolLatencies: Record<string, number> = {};
    orchResult.tools_executed.forEach(t => {
      toolLatencies[t.tool_name] = t.latency_ms;
    });

    // 7. Assemble Comprehensive Audit Trace
    const trace: BoardExecutionTrace = {
      timestamp: new Date().toISOString(),
      patient_id: patientCase.patient_id,
      deliberation_rounds: orchResult.deliberation_rounds_completed,
      pre_arbiter_latency_us: preResult.latency_us,
      orchestrator_latency_ms: orchResult.latency_ms,
      specialist_latencies_ms: specialistLatencies,
      tool_latencies_ms: toolLatencies,
      synthesis_latency_ms: synthResult.latency_ms,
      post_arbiter_latency_us: postResult.latency_us,
      total_board_latency_ms,
      specialists_summoned: orchResult.specialists_requested.map(s => s.specialty),
      tools_executed: orchResult.tools_executed.map(t => t.tool_name),
      tools_executed_details: orchResult.tools_executed,
      peer_challenges_count: orchResult.challenges.length,
      peer_challenges: orchResult.challenges,
      pre_safety_flags: preResult.pre_safety_flags,
      immediate_danger: preResult.immediate_danger,
      opinions: orchResult.opinions,
      consensus: synthResult.consensus,
      post_arbiter_override: postResult.arbiter_override_applied,
      final_esi_level: postResult.final_esi_level,
      final_disposition: postResult.final_disposition,
      audit_hash_chain: postResult.audit_hash_chain,
      root_audit_hash: postResult.audit_sha256,
      deliberation_messages: synthResult.consensus.deliberation_messages
    };

    // 7. Generate Formal Multi-Agent SOAP Documentation
    const soap_note = {
      subjective: `Patient (${patientCase.patient_name}, ID: ${patientCase.patient_id}) presents with chief complaint: "${patientCase.transcript}". Speech characteristics: ${patientCase.speech_features?.observations.join(", ") || "Reassuring continuity"}.`,
      objective: `Multi-Agent Clinical Board [Rounds: ${orchResult.deliberation_rounds_completed} | Active: ${orchResult.active_specialists.join(", ")}]. Tools Executed: [${orchResult.tools_executed.map(t => t.tool_name).join(", ") || "None"}]. Pre-Arbiter Flags: [${preResult.pre_safety_flags.join(", ") || "None"}]. Key Evidence: ${synthResult.consensus.key_findings.join("; ") || "None"}. ICD-10 Tags: ${postResult.icd10_codes.join(", ") || "Z76.0"}.`,
      assessment: `${postResult.final_esi_title} (ESI ${postResult.final_esi_level}). Differential Diagnoses: ${synthResult.consensus.differential.map(d => `${d.condition} [Prob: ${d.probability.toUpperCase()}]`).join(", ")}. Primary Specialty: ${synthResult.consensus.primary_specialty}. Safety Arbiter Status: ${postResult.arbiter_override_applied ? "OVERRIDE_ENFORCED" : "NOMINAL"}. Conflicts: ${synthResult.consensus.conflicts.length ? synthResult.consensus.conflicts.map(c => c.topic).join("; ") : "None"}.`,
      plan: `1. Clinical Disposition: ${postResult.final_disposition.toUpperCase()}\n2. Diagnostic & Resuscitation Directives: ${orchResult.opinions.flatMap(o => o.recommended_actions).slice(0, 4).join("; ")}\n3. Tamper-Evident Hash Chain: Block Height ${postResult.audit_hash_chain.length} (Root: ${postResult.audit_sha256.slice(0, 16)}...)\n4. Safety Override Rationale: ${postResult.override_rationale || "None"}`
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
