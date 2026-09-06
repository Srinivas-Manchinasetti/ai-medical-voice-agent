import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase } from "../schemas";

export class CardiologyAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "cardiology-vance",
      doctorName: "Dr. Marcus Vance, MD, FACC",
      specialty: "Cardiology & Critical Care",
      clinicalDomain: "Cardiovascular, Hemodynamics & Acute Coronary Syndromes",
      systemPrompt: "You are Dr. Marcus Vance, MD, FACC, Senior Cardiologist and Critical Care Specialist. Evaluate patient presentations for Acute Coronary Syndrome (ACS), malignant arrhythmia, pulmonary embolism, and cardiogenic shock. Base your analysis on objective clinical evidence, hemodynamics, and respiratory markers."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase): Record<string, any> {
    return {
      specialty: "Cardiology",
      demographics: patientCase.demographics,
      transcript: patientCase.transcript,
      cardiac_symptoms: patientCase.detected_symptoms.filter(s =>
        s.includes("chest") || s.includes("pain") || s.includes("pressure") ||
        s.includes("palpitation") || s.includes("sweat") || s.includes("arm") ||
        s.includes("jaw") || s.includes("faint") || s.includes("dizz")
      ),
      vitals: patientCase.vitals,
      relevant_speech_features: {
        speech_pause_ratio: patientCase.speech_features.speech_pause_ratio,
        respiratory_distress_signal: patientCase.speech_features.clinical_relevance.respiratory_distress_signal,
        observations: patientCase.speech_features.observations.filter(o =>
          o.toLowerCase().includes("breath") || o.toLowerCase().includes("pause") || o.toLowerCase().includes("effort")
        )
      },
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("CARDIAC") || f.includes("CHEST"))
    };
  }

  protected generateDeterministicFallback(patientCase: PatientCase, ctx: Record<string, any>): AgentOpinion {
    const text = patientCase.transcript.toLowerCase();
    const hasACS = (text.includes("chest pain") || text.includes("chest pressure") || text.includes("crushing")) &&
                   (text.includes("arm") || text.includes("jaw") || text.includes("sweat") || text.includes("breath"));
    const hasPalpitations = text.includes("palpitation") || text.includes("racing heart");

    if (hasACS) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        concerns: ["Acute Coronary Syndrome (STEMI / High-Risk NSTEMI)", "Myocardial Ischemia"],
        evidence: ["Crushing chest discomfort", "Classic ischemic radiation or diaphoresis"],
        risk_level: "high",
        recommended_actions: [
          "Immediate 911/108 Emergency Dispatch",
          "Urgent 12-lead Electrocardiogram (ECG)",
          "Serial High-Sensitivity Cardiac Troponin I/T",
          "Continuous Cardiac Rhythm Telemetry"
        ],
        confidence: 0.94,
        requires_escalation: true,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "ACC/AHA Acute Coronary Syndrome Fast-Track Protocol"
      };
    }

    if (hasPalpitations) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        concerns: ["Cardiac Arrhythmia", "Supraventricular / Ventricular Ectopy"],
        evidence: ["Reported rapid/irregular heartbeat without syncope"],
        risk_level: "moderate",
        recommended_actions: [
          "Urgent Outpatient Electrocardiogram",
          "Electrolyte & Thyroid Panel (TSH, K+, Mg2+)",
          "Holter / Event Monitor Consideration"
        ],
        confidence: 0.85,
        requires_escalation: false,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "HRS Clinical Practice Guideline for Arrhythmias"
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      concerns: ["Non-cardiac chest sensations", "Musculoskeletal or reflux chest discomfort"],
      evidence: ["Absence of hemodynamic instability, ischemic radiation, or diaphoresis"],
      risk_level: "low",
      recommended_actions: ["Primary Care outpatient review if symptoms persist"],
      confidence: 0.80,
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "Ambulatory Chest Discomfort Pathway"
    };
  }
}
