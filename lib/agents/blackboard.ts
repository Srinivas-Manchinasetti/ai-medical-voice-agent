import {
  EvidenceItem,
  PeerChallenge,
  ToolRequest,
  ToolResult,
  AgentOpinion,
  PatientCase
} from "./schemas";

export interface BlackboardEvent {
  event_id: string;
  round: number;
  timestamp: string;
  source: string;
  type:
    | "evidence_added"
    | "hypothesis_posted"
    | "tool_requested"
    | "tool_completed"
    | "challenge_issued"
    | "challenge_answered"
    | "patient_interruption"
    | "assessments_invalidated";
  priority?: "interaction" | "clinical" | "safety";
  summary: string;
}

/**
 * SHARED CLINICAL BLACKBOARD
 * Represents the multi-agent shared environment.
 * Specialists read shared evidence and hypotheses, write findings, request tools,
 * post challenges, and observe peer findings across bounded deliberation rounds.
 */
export class Blackboard {
  public case_id: string;
  public round: number = 1;
  public evidence: Map<string, EvidenceItem> = new Map();
  public opinions: Map<string, AgentOpinion> = new Map();
  public tool_requests: ToolRequest[] = [];
  public tool_results: ToolResult[] = [];
  public challenges: PeerChallenge[] = [];
  public events: BlackboardEvent[] = [];

  constructor(patientCase: PatientCase) {
    this.case_id = patientCase.patient_id;
    this.initializeFromCase(patientCase);
  }

  /**
   * Hydrate blackboard with initial evidence and explicit provenance.
   */
  private initializeFromCase(patientCase: PatientCase): void {
    const now = new Date().toISOString();

    // 1. Patient transcript
    this.addEvidence({
      id: "ev-transcript",
      type: "transcript",
      description: patientCase.transcript,
      source: "patient_reported",
      confidence: 1.0,
      confidence_semantics: "patient_statement",
      timestamp: now,
    });

    // 2. Extracted symptoms
    patientCase.detected_symptoms.forEach((sym, idx) => {
      this.addEvidence({
        id: `ev-sym-${idx}`,
        type: "symptom",
        description: sym,
        source: "patient_reported",
        confidence: 0.9,
        confidence_semantics: "patient_statement",
        timestamp: now,
      });
    });

    // 3. Vitals (device measured)
    Object.entries(patientCase.vitals).forEach(([key, val]) => {
      this.addEvidence({
        id: `ev-vital-${key}`,
        type: "vital_sign",
        description: `${key}: ${val}`,
        source: "device_measured",
        confidence: 0.99,
        confidence_semantics: "tool_calibrated",
        timestamp: now,
        raw_payload: { [key]: val }
      });
    });

    // 4. Acoustic paralinguistic observations
    if (patientCase.speech_features) {
      patientCase.speech_features.observations.forEach((obs, idx) => {
        this.addEvidence({
          id: `ev-acoustic-${idx}`,
          type: "acoustic_observation",
          description: obs,
          source: "device_measured",
          confidence: patientCase.speech_features.clinical_relevance.confidence,
          confidence_semantics: "tool_calibrated",
          timestamp: now,
          raw_payload: {
            speech_rate_wpm: patientCase.speech_features.speech_rate_wpm,
            speech_pause_ratio: patientCase.speech_features.speech_pause_ratio
          }
        });
      });
    }

    // 5. Deterministic pre-arbiter safety flags
    patientCase.pre_safety_flags.forEach((flag, idx) => {
      this.addEvidence({
        id: `ev-pre-flag-${idx}`,
        type: "deterministic_flag",
        description: flag,
        source: "deterministic_pre_arbiter",
        confidence: 1.0,
        confidence_semantics: "deterministic_flag",
        timestamp: now,
      });
    });

    // 6. Handle patient interruption / barge-in evidence if present
    if (patientCase.is_interruption) {
      this.recordPatientInterruption(patientCase.transcript, patientCase.interrupted_agent);
    }
  }

  public recordPatientInterruption(utterance: string, interruptedAgent?: string): void {
    // 1. Interaction Event (high priority in interaction runtime)
    this.events.push({
      event_id: `evt-bargein-${Date.now()}`,
      round: this.round,
      timestamp: new Date().toISOString(),
      source: "patient_barge_in",
      type: "patient_interruption",
      priority: "interaction",
      summary: `Patient barged in during ${interruptedAgent || "doctor"} statement: "${utterance}"`
    });

    // 2. Clinical Evidence extracted from utterance
    this.addEvidence({
      id: `ev-interruption-${Date.now()}`,
      type: "interruption_patient_statement",
      description: utterance,
      source: "patient_reported",
      confidence: 1.0,
      confidence_semantics: "patient_statement",
      timestamp: new Date().toISOString(),
      raw_payload: { interrupted_agent: interruptedAgent, is_barge_in: true }
    });

    // 3. Invariant: New patient evidence supersedes stale agent assessments
    this.invalidateStaleAssessments("New patient evidence from barge-in supersedes stale agent assessments");
  }

  public invalidateStaleAssessments(reason: string): void {
    this.events.push({
      event_id: `evt-inval-${Date.now()}`,
      round: this.round,
      timestamp: new Date().toISOString(),
      source: "blackboard_runtime",
      type: "assessments_invalidated",
      priority: "safety",
      summary: reason
    });
    this.opinions.clear();
  }

  public addEvidence(item: EvidenceItem): void {
    this.evidence.set(item.id, item);
    this.logEvent("evidence_added", item.source, `Evidence added: [${item.type}] ${item.description.slice(0, 80)}`);
  }

  public getAllEvidence(): EvidenceItem[] {
    return Array.from(this.evidence.values());
  }

  public postOpinion(opinion: AgentOpinion): void {
    this.opinions.set(opinion.agent, opinion);
    this.logEvent("hypothesis_posted", opinion.agent, `${opinion.doctor_name} posted hypothesis: ${opinion.primary_hypothesis} (Risk: ${opinion.risk_level})`);
  }

  public getOpinion(agentId: string): AgentOpinion | undefined {
    return this.opinions.get(agentId);
  }

  public getAllOpinions(): AgentOpinion[] {
    return Array.from(this.opinions.values());
  }

  public recordToolResult(result: ToolResult, requestedBy: string): void {
    this.tool_results.push(result);
    // Also promote tool output into blackboard evidence
    this.addEvidence({
      id: `ev-tool-${result.tool_name}-${Date.now()}`,
      type: "diagnostic_tool_result",
      description: `[${result.tool_name}] ${result.clinical_summary}`,
      source: "tool_derived",
      confidence: 0.95,
      confidence_semantics: "tool_calibrated",
      timestamp: new Date().toISOString(),
      raw_payload: result.output
    });
    this.logEvent("tool_completed", requestedBy, `Tool executed: ${result.tool_name} -> ${result.clinical_summary}`);
  }

  public postChallenge(challenge: PeerChallenge): void {
    this.challenges.push(challenge);
    this.logEvent("challenge_issued", challenge.from_agent, `Challenge to ${challenge.to_agent}: "${challenge.claim_disputed}"`);
  }

  public getChallengesFor(agentId: string): PeerChallenge[] {
    return this.challenges.filter(c => c.to_agent === agentId);
  }

  public getChallengesFrom(agentId: string): PeerChallenge[] {
    return this.challenges.filter(c => c.from_agent === agentId);
  }

  public setRound(r: number): void {
    this.round = r;
  }

  private logEvent(type: BlackboardEvent["type"], source: string, summary: string): void {
    this.events.push({
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      round: this.round,
      timestamp: new Date().toISOString(),
      source,
      type,
      summary
    });
  }
}
