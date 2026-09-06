import { AgentOpinion, ClinicalConflict, ClinicalConsensus, DifferentialItem, PatientCase } from "./schemas";

export interface SynthesisResult {
  consensus: ClinicalConsensus;
  latency_ms: number;
}

/**
 * CONFLICT-AWARE CLINICAL CONSENSUS SYNTHESIZER
 * 
 * Invariant: Aggregates structured specialist evidence into an integrated differential diagnosis.
 * Identifies and explicitly resolves cross-specialty conflicts rather than flattening opinions.
 */
export class ClinicalSynthesizer {
  public async synthesize(
    patientCase: PatientCase,
    opinions: AgentOpinion[],
    orchestratorSummary: string,
    activeSpecialists: string[]
  ): Promise<SynthesisResult> {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();

    // 1. Compile Differential Diagnoses across all opinions
    const differential: DifferentialItem[] = [];
    const seenConditions = new Set<string>();

    for (const op of opinions) {
      for (const concern of op.concerns) {
        if (!seenConditions.has(concern.toLowerCase())) {
          seenConditions.add(concern.toLowerCase());
          differential.push({
            condition: concern,
            supporting_agents: [op.doctor_name],
            risk: op.risk_level,
            clinical_rationale: op.evidence.join("; ") || "Clinical clinical indicator"
          });
        } else {
          // If another agent also raised this concern, add them as supporting agent
          const existing = differential.find(d => d.condition.toLowerCase() === concern.toLowerCase());
          if (existing && !existing.supporting_agents.includes(op.doctor_name)) {
            existing.supporting_agents.push(op.doctor_name);
            if (op.risk_level === "high") existing.risk = "high";
          }
        }
      }
    }

    // 2. Conflict Detection & Explicit Resolution
    const conflicts: ClinicalConflict[] = [];

    const hasHighCardio = opinions.some(o => o.specialty.includes("Cardio") && o.risk_level === "high");
    const hasHighNeuro = opinions.some(o => o.specialty.includes("Neuro") && o.risk_level === "high");
    const hasPeds = opinions.some(o => o.specialty.includes("Pedia"));

    if (hasHighCardio && hasHighNeuro) {
      conflicts.push({
        topic: "Primary Etiology (Cardiovascular vs. Acute Cerebrovascular)",
        agents: ["Dr. Marcus Vance (Cardiology)", "Dr. Arthur Pendelton (Neurology)"],
        resolution: "Both cardiovascular and neurovascular pathways present acute life-threat red flags (e.g. cardio-embolic stroke or concurrent hemodynamic crisis). Neither pathway is deprioritized; dual emergency resuscitation and rapid CT/ECG protocol activated."
      });
    }

    // Check for disposition differences
    const highRiskCount = opinions.filter(o => o.risk_level === "high").length;
    const moderateRiskCount = opinions.filter(o => o.risk_level === "moderate").length;

    let recommended_disposition: "emergency_evaluation" | "urgent_outpatient" | "routine_outpatient" = "routine_outpatient";
    let consensus_risk: "critical" | "urgent" | "routine" = "routine";
    let requires_immediate_escalation = false;

    if (highRiskCount > 0 || patientCase.immediate_danger_detected) {
      recommended_disposition = "emergency_evaluation";
      consensus_risk = "critical";
      requires_immediate_escalation = true;
    } else if (moderateRiskCount > 0) {
      recommended_disposition = "urgent_outpatient";
      consensus_risk = "urgent";
    }

    // 3. Compile Key Clinical Findings
    const key_findings: string[] = [];
    opinions.forEach(o => {
      o.evidence.forEach(e => {
        if (!key_findings.includes(e)) key_findings.push(e);
      });
    });

    // 4. Primary Specialty assignment
    let primary_specialty = "Internal Medicine";
    if (hasHighCardio) primary_specialty = "Cardiology & Resuscitation";
    else if (hasHighNeuro) primary_specialty = "Neurology & Stroke Triage";
    else if (hasPeds) primary_specialty = "Pediatrics";

    // 5. Formulate Spoken Clinical Narrative
    let synthesized_reply_narrative = "";
    if (consensus_risk === "critical") {
      if (hasHighCardio && hasHighNeuro) {
        synthesized_reply_narrative = "Our medical board has evaluated your symptoms as a multi-system emergency requiring immediate medical intervention. Please sit down, remain completely still, and dial emergency services right now.";
      } else if (hasHighCardio) {
        synthesized_reply_narrative = "I am detecting significant cardiovascular distress indicators. For your safety, please sit upright, avoid any physical exertion, and have someone dial emergency medical services immediately.";
      } else if (hasHighNeuro) {
        synthesized_reply_narrative = "These indicators represent an acute neurological emergency. Immediate hospital emergency evaluation is critical. Please remain stationary while emergency care is arranged.";
      } else {
        synthesized_reply_narrative = "Your clinical symptoms require immediate emergency attention. Please proceed to the nearest emergency department or call emergency dispatch right away.";
      }
    } else if (consensus_risk === "urgent") {
      synthesized_reply_narrative = "Thank you for explaining what you're feeling. Our clinical team has reviewed your symptoms and recommends an urgent medical evaluation today. Please monitor your temperature and vitals closely.";
    } else {
      synthesized_reply_narrative = "I've reviewed your symptoms. They appear consistent with a routine, low-acuity presentation. Stay hydrated, rest, and follow up with your primary physician if symptoms persist beyond three days.";
    }

    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const latency_ms = Math.round(t1 - t0);

    const consensus: ClinicalConsensus = {
      differential,
      conflicts,
      recommended_disposition,
      consensus_risk,
      primary_specialty,
      key_findings,
      synthesized_reply_narrative,
      orchestrator_summary: orchestratorSummary,
      requires_immediate_escalation,
      active_specialists: activeSpecialists
    };

    return {
      consensus,
      latency_ms
    };
  }
}
