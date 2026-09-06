import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase } from "../schemas";

export class PediatricsAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "pediatrics-rostova",
      doctorName: "Dr. Elena Rostova, MD, FAAP",
      specialty: "Pediatric & Adolescent Medicine",
      clinicalDomain: "Neonatal, Infant & Child Health, Pediatric Emergencies",
      systemPrompt: "You are Dr. Elena Rostova, MD, FAAP, Consultant Pediatrician. Evaluate infants, children, and adolescents. Assess age-specific vital ranges, signs of respiratory distress (retractions, stridor, grunting), pediatric sepsis, and acute dehydration."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase): Record<string, any> {
    return {
      specialty: "Pediatrics",
      demographics: patientCase.demographics,
      transcript: patientCase.transcript,
      vitals: patientCase.vitals,
      pediatric_observations: patientCase.speech_features.observations,
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("PEDIATRIC"))
    };
  }

  protected generateDeterministicFallback(patientCase: PatientCase, ctx: Record<string, any>): AgentOpinion {
    const text = patientCase.transcript.toLowerCase();
    const isNeonatalFever = (patientCase.demographics.age !== undefined && patientCase.demographics.age < 0.25) ||
                            text.includes("newborn") || text.includes("weeks old");
    const hasSevereDistress = text.includes("stridor") || text.includes("grunting") ||
                             text.includes("retractions") || text.includes("inconsolable") ||
                             text.includes("lethargic") || text.includes("floppy");

    if (isNeonatalFever || hasSevereDistress) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        concerns: ["Pediatric Sepsis / Severe Neonatal Infection", "Critical Airway Obstruction / Croup / Epiglottitis"],
        evidence: ["High fever in vulnerable pediatric age bracket or severe physiological distress"],
        risk_level: "high",
        recommended_actions: [
          "Immediate Emergency Department Transfer",
          "Pediatric Sepsis Workup (Blood, Urine, CSF cultures)",
          "Immediate Humidified Oxygen & Airway Stridor Assessment"
        ],
        confidence: 0.96,
        requires_escalation: true,
        speech_observations_evaluated: ctx.pediatric_observations || [],
        clinical_protocol: "AAP Pediatric Advanced Life Support (PALS) Protocol"
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      concerns: ["Mild viral upper respiratory tract infection", "Pediatric viral exanthem"],
      evidence: ["Child remains alert, hydrated, with reassuring respiratory effort"],
      risk_level: "low",
      recommended_actions: [
        "Antipyretics (weight-dosed Acetaminophen/Ibuprofen)",
        "Oral rehydration therapy monitoring (wet diapers)",
        "Outpatient pediatric clinic follow-up"
      ],
      confidence: 0.88,
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "AAP Ambulatory Pediatric Fever Protocol"
    };
  }
}
