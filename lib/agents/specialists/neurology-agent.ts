import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase } from "../schemas";

export class NeurologyAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "neurology-pendelton",
      doctorName: "Dr. Arthur Pendelton, MD, PhD",
      specialty: "Neurology & Stroke Triage",
      clinicalDomain: "Cerebrovascular Disease, Stroke & Neuro-emergencies",
      systemPrompt: "You are Dr. Arthur Pendelton, MD, PhD, Consultant Neurologist. Rapidly evaluate patient presentations for Acute Ischemic Stroke (BE-FAST criteria), Intracranial Hemorrhage, thunderclap headaches, and severe focal neurological deficits."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase): Record<string, any> {
    return {
      specialty: "Neurology",
      demographics: patientCase.demographics,
      transcript: patientCase.transcript,
      neurological_symptoms: patientCase.detected_symptoms.filter(s =>
        s.includes("droop") || s.includes("weak") || s.includes("numb") ||
        s.includes("speech") || s.includes("headache") || s.includes("confus") ||
        s.includes("dizz") || s.includes("vision") || s.includes("balance")
      ),
      relevant_speech_features: {
        speech_rate_wpm: patientCase.speech_features.speech_rate_wpm,
        vocal_instability_signal: patientCase.speech_features.clinical_relevance.vocal_instability_signal,
        observations: patientCase.speech_features.observations.filter(o =>
          o.toLowerCase().includes("slur") || o.toLowerCase().includes("hesitat") || o.toLowerCase().includes("pause")
        )
      },
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("NEURO"))
    };
  }

  protected generateDeterministicFallback(patientCase: PatientCase, ctx: Record<string, any>): AgentOpinion {
    const text = patientCase.transcript.toLowerCase();
    const hasStroke = text.includes("facial droop") || text.includes("arm weakness") ||
                      text.includes("slurred speech") || text.includes("cannot speak") ||
                      text.includes("sudden numbness") || text.includes("hemiparesis");
    const hasThunderclap = text.includes("thunderclap") || text.includes("worst headache of my life");

    if (hasStroke) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        concerns: ["Acute Ischemic Stroke", "Transient Ischemic Attack (TIA)"],
        evidence: ["Positive BE-FAST focal neurological deficit indicators"],
        risk_level: "high",
        recommended_actions: [
          "Activate Code Stroke Fast-Track Protocol",
          "Immediate Non-Contrast Head CT / MRI Brain",
          "Assess Thrombolytic (tPA/TNK) & Endovascular Thrombectomy Window",
          "Fingerstick Blood Glucose (Rule Out Hypoglycemia Mimic)"
        ],
        confidence: 0.95,
        requires_escalation: true,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "AHA/ASA Acute Ischemic Stroke Guideline"
      };
    }

    if (hasThunderclap) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        concerns: ["Subarachnoid Hemorrhage (SAH)", "Aneurysmal Rupture"],
        evidence: ["Abrupt, peak-intensity thunderclap headache"],
        risk_level: "high",
        recommended_actions: [
          "Immediate Non-Contrast Head CT",
          "Lumbar Puncture (LP) if CT is negative within SAH window",
          "Strict Blood Pressure Management"
        ],
        confidence: 0.92,
        requires_escalation: true,
        speech_observations_evaluated: [],
        clinical_protocol: "Ottawa SAH Clinical Decision Rule"
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      concerns: ["Primary headache disorder (Migraine / Tension-type)", "Peripheral vestibulopathy"],
      evidence: ["Absence of focal neurological deficits, altered mental status, or sudden onset"],
      risk_level: "low",
      recommended_actions: ["Neurology / Primary Care outpatient consultation with headache diary"],
      confidence: 0.82,
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "Outpatient Headache Management Protocol"
    };
  }
}
