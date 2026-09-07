import { AgentOpinion, PatientCase, SpecialistRequest, PeerChallenge, ToolResult } from "./schemas";
import { Blackboard } from "./blackboard";
import { CardiologyAgent } from "./specialists/cardiology-agent";
import { NeurologyAgent } from "./specialists/neurology-agent";
import { PediatricsAgent } from "./specialists/pediatrics-agent";

export interface OrchestrationResult {
  orchestrator_summary: string;
  specialists_requested: SpecialistRequest[];
  opinions: AgentOpinion[];
  active_specialists: string[];
  tools_executed: ToolResult[];
  challenges: PeerChallenge[];
  deliberation_rounds_completed: number;
  latency_ms: number;
  blackboard: Blackboard;
}

/**
 * TRIAGE ORCHESTRATOR - DR. SARAH CHEN, MD
 * 
 * Invariant: Selectively routes cases and orchestrates bounded deliberation:
 * - Round 1: Specialized Intake + Domain Tool Execution.
 * - Round 2: Peer Review & Cross-Specialty Challenge.
 * - Bounded max rounds (<= 3), no runaway loops.
 */
export class TriageOrchestrator {
  private cardiology = new CardiologyAgent();
  private neurology = new NeurologyAgent();
  private pediatrics = new PediatricsAgent();

  /**
   * Helper to verify if a clinical pattern is affirmed or negated.
   */
  private isAffirmed(text: string, regex: RegExp): boolean {
    const match = text.match(regex);
    if (!match) return false;

    const idx = text.search(regex);
    if (idx === -1) return false;
    const windowStart = Math.max(0, idx - 60);
    const window = text.slice(windowStart, idx).trim();

    const negationPatterns = [
      /(?:no|denies|without|never|rules?\s+out|negative\s+for|not|free\s+of)(?:\s+[a-z0-9_-]+){0,3}\s+(?:or|and|\/)\s*$/i,
      /(?:no|denies|without|never|rules?\s+out|negative\s+for|not|free\s+of)(?:\s+[a-z0-9_-]+){0,3}\s*$/i,
    ];

    return !negationPatterns.some((pattern) => pattern.test(window));
  }

  /**
   * Determine which specialists should be summoned.
   */
  public determineSpecialistRouting(patientCase: PatientCase): SpecialistRequest[] {
    const text = patientCase.transcript.toLowerCase();
    const requests: SpecialistRequest[] = [];

    // 1. Check Pre-Arbiter flags first
    const hasCardiacFlag = patientCase.pre_safety_flags.some(f => f.includes("CHEST") || f.includes("CARDIAC"));
    const hasNeuroFlag = patientCase.pre_safety_flags.some(f => f.includes("NEURO"));
    const hasPediatricFlag = patientCase.pre_safety_flags.some(f => f.includes("PEDIATRIC"));

    // Check if this is a purely routine medication refill without symptoms
    const isMedicationRefillOnly = /\b(refill|prescription|medication\s+refill)\b/i.test(text) &&
                                  !hasCardiacFlag && !hasNeuroFlag && !hasPediatricFlag &&
                                  /\b(normal|routine|feeling\s+fine|no\s+symptoms|completely\s+normal)\b/i.test(text);

    // 2. Cardiology Triggers (with negation check)
    const cardioRegex = /\b(chest\s+pain|chest\s+pressure|chest\s+tightness|crushing.*chest|heavy.*chest|tightness.*chest|angina|palpitation|racing\s+heart|substernal|cold\s+sweats|diaphoresis)\b/i;
    const hasAffirmedCardio = this.isAffirmed(text, cardioRegex);
    
    // Check dyspnea only if affirmed
    const hasAffirmedDyspnea = this.isAffirmed(text, /\b(shortness\s+of\s+breath|difficulty\s+breathing|cannot\s+breathe|gasping)\b/i);

    const needsCardio = !isMedicationRefillOnly && (hasCardiacFlag || hasAffirmedCardio || hasAffirmedDyspnea);

    if (needsCardio) {
      requests.push({
        specialty: "cardiology",
        reason: hasCardiacFlag ? "Pre-screened acute chest pain / hemodynamic risk" : "Cardiovascular symptom evaluation",
        priority: (hasCardiacFlag || hasAffirmedCardio) ? "immediate" : "routine",
        trigger_flags: patientCase.pre_safety_flags.filter(f => f.includes("CHEST") || f.includes("CARDIAC"))
      });
    }

    // 3. Neurology Triggers (with negation check)
    const neuroRegex = /\b(droop|facial\s+droop|arm\s+weakness|arm.*numb|slurred\s+speech|cannot\s+speak|thunderclap|stroke|seizure|loss\s+of\s+speech|hemiparesis)\b/i;
    const hasAffirmedNeuro = this.isAffirmed(text, neuroRegex);

    // Headache / dizziness only if affirmed and not part of simple routine refill or cold
    const hasAffirmedHeadacheOrDizziness = this.isAffirmed(text, /\b(headache|migraine|vertigo|dizziness|faint|syncope|black\s+out)\b/i);
    const isColdColdSoreThroatOnly = /\b(runny\s+nose|sore\s+throat|nasal\s+drainage)\b/i.test(text);

    const needsNeuro = !isMedicationRefillOnly && (hasNeuroFlag || hasAffirmedNeuro || (hasAffirmedHeadacheOrDizziness && !isColdColdSoreThroatOnly));

    if (needsNeuro) {
      requests.push({
        specialty: "neurology",
        reason: hasNeuroFlag ? "Pre-screened acute focal neurological deficit / stroke sign" : "Neurological symptom screening",
        priority: (hasNeuroFlag || hasAffirmedNeuro) ? "immediate" : "routine",
        trigger_flags: patientCase.pre_safety_flags.filter(f => f.includes("NEURO"))
      });
    }

    // 4. Pediatric Triggers
    const isPediatric = hasPediatricFlag ||
                        patientCase.demographics.age_group === "infant" ||
                        patientCase.demographics.age_group === "pediatric" ||
                        (patientCase.demographics.age !== undefined && patientCase.demographics.age < 16) ||
                        ["baby", "child", "infant", "toddler", "weeks old", "months old"].some(k => text.includes(k));
    if (isPediatric) {
      requests.push({
        specialty: "pediatrics",
        reason: hasPediatricFlag ? "Pre-screened pediatric crisis / neonatal vulnerability" : "Pediatric health evaluation",
        priority: hasPediatricFlag ? "immediate" : "routine",
        trigger_flags: patientCase.pre_safety_flags.filter(f => f.includes("PEDIATRIC"))
      });
    }

    return requests;
  }

  public generatePrimaryCareOpinion(patientCase: PatientCase, round: number = 1): AgentOpinion {
    const text = patientCase.transcript.toLowerCase();
    const hasFever = text.includes("fever") || text.includes("temperature");
    const hasRespiratory = text.includes("cough") || text.includes("cold") || text.includes("congestion") || text.includes("sore throat") || text.includes("runny nose");
    const isRefill = text.includes("refill") || text.includes("prescription");

    return {
      agent: "primary-care-chen",
      doctor_name: "Dr. Sarah Chen, MD",
      specialty: "Internal Medicine & Primary Triage",
      deliberation_round: round,
      primary_hypothesis: isRefill ? "Maintenance Medication Refill" : hasRespiratory ? "Viral Upper Respiratory Infection" : "General Ambulatory Review",
      concerns: isRefill ? ["Routine Prescription Maintenance", "Medication Adherence Review"] :
                hasRespiratory ? ["Upper Respiratory Tract Infection", "Viral Pharyngitis/Rhinitis"] :
                hasFever ? ["Pyrexia of unknown origin", "Mild infectious illness"] :
                ["General Medical Consultation", "Outpatient Symptom Review"],
      evidence: [
        patientCase.transcript,
        `Vitals status: ${Object.keys(patientCase.vitals).length ? JSON.stringify(patientCase.vitals) : "Stable / Non-acute"}`
      ],
      evidence_for: [patientCase.transcript],
      evidence_against: [],
      missing_evidence: [],
      tool_invocations: [],
      challenges_issued: [],
      challenges_received: [],
      risk_level: patientCase.immediate_danger_detected ? "high" : "low",
      recommended_actions: isRefill ? [
        "Review last recorded blood pressure log",
        "Authorize maintenance medication refill pending physician sign-off"
      ] : [
        "Rest and adequate fluid intake",
        "Over-the-counter symptomatic management as tolerated",
        "Primary Care outpatient follow-up if symptoms persist past 3 days"
      ],
      confidence: 0.90,
      confidence_semantics: "uncalibrated_model_score",
      requires_escalation: patientCase.immediate_danger_detected,
      speech_observations_evaluated: patientCase.speech_features?.observations || [],
      clinical_protocol: isRefill ? "Routine Medication Refill Protocol" : "Internal Medicine Ambulatory Protocol"
    };
  }

  public async orchestrate(patientCase: PatientCase): Promise<OrchestrationResult> {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const blackboard = new Blackboard(patientCase);
    const requests = this.determineSpecialistRouting(patientCase);
    const activeSpecialists: string[] = ["Dr. Sarah Chen, MD (Primary Care Lead)"];

    // Initialize Lead Primary Care Opinion on Blackboard
    const chenInitial = this.generatePrimaryCareOpinion(patientCase, 1);
    blackboard.postOpinion(chenInitial);

    // Map specialists
    const activeAgents: { name: string; agent: CardiologyAgent | NeurologyAgent | PediatricsAgent }[] = [];
    if (requests.some(r => r.specialty === "cardiology")) {
      activeSpecialists.push("Dr. Marcus Vance, MD, FACC (Cardiology)");
      activeAgents.push({ name: "Dr. Marcus Vance", agent: this.cardiology });
    }
    if (requests.some(r => r.specialty === "neurology")) {
      activeSpecialists.push("Dr. Arthur Pendelton, MD, PhD (Neurology)");
      activeAgents.push({ name: "Dr. Arthur Pendelton", agent: this.neurology });
    }
    if (requests.some(r => r.specialty === "pediatrics")) {
      activeSpecialists.push("Dr. Elena Rostova, MD, FAAP (Pediatrics)");
      activeAgents.push({ name: "Dr. Elena Rostova", agent: this.pediatrics });
    }

    const allToolsRun: ToolResult[] = [];
    const allChallenges: PeerChallenge[] = [];

    // --- ROUND 1: Ingestion, Tool Execution & Initial Hypotheses ---
    blackboard.setRound(1);
    if (activeAgents.length > 0) {
      const round1Promises = activeAgents.map(a => a.agent.executeRound1(patientCase, blackboard));
      const round1Results = await Promise.all(round1Promises);
      for (const res of round1Results) {
        allToolsRun.push(...res.tools_executed);
      }
    }

    // --- ROUND 2: Peer Cross-Examination & Revision ---
    blackboard.setRound(2);
    if (activeAgents.length > 1) {
      // Multiple specialists: conduct peer cross-examination
      const round2Promises = activeAgents.map(a => a.agent.executeRound2(patientCase, blackboard));
      const round2Results = await Promise.all(round2Promises);
      for (const res of round2Results) {
        allChallenges.push(...res.challengesIssued);
      }
    }

    const finalOpinions = blackboard.getAllOpinions();
    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latency_ms = Math.round(t1 - t0);

    const orchestrator_summary = activeAgents.length === 0
      ? "Evaluated solo by Dr. Sarah Chen. Routine presentation; no specialist cross-consultation indicated."
      : `Dr. Sarah Chen summoned ${activeAgents.length} specialist(s) [${requests.map(r => r.specialty).join(", ")}] across ${activeAgents.length > 1 ? 2 : 1} deliberation rounds with ${allToolsRun.length} diagnostic tool(s) and ${allChallenges.length} peer challenge(s).`;

    return {
      orchestrator_summary,
      specialists_requested: requests,
      opinions: finalOpinions,
      active_specialists: activeSpecialists,
      tools_executed: allToolsRun,
      challenges: allChallenges,
      deliberation_rounds_completed: activeAgents.length > 1 ? 2 : 1,
      latency_ms,
      blackboard
    };
  }
}
