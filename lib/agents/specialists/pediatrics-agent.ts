import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase, ToolResult, PeerChallenge, AgentRequest } from "../schemas";
import { Blackboard } from "../blackboard";
import { clinicalKnowledgeRetriever } from "../../clinical-knowledge/retriever";

export class PediatricsAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "pediatrics-rostova",
      doctorName: "Dr. Elena Rostova, MD, FAAP",
      specialty: "Pediatrics",
      clinicalDomain: "Neonatal Resuscitation, Pediatric Sepsis & Vulnerable Infant Physiology",
      systemPrompt: "You are Dr. Elena Rostova, MD, FAAP, Senior Pediatrician and Neonatologist. Evaluate presentations in infants and pediatric patients for neonatal sepsis, respiratory syncytial virus (RSV) distress, croup/epiglottitis, dehydration, and developmental vital stability."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase, blackboard: Blackboard): Record<string, any> {
    const text = patientCase.transcript.toLowerCase();
    const age = patientCase.demographics.age;
    const isInfant = patientCase.demographics.age_group === "infant" || (age !== undefined && age <= 1);

    return {
      specialty: "Pediatrics",
      demographics: patientCase.demographics,
      transcript: patientCase.transcript,
      is_infant: isInfant,
      vitals: patientCase.vitals,
      pediatric_symptoms: patientCase.detected_symptoms.filter(s =>
        s.includes("fever") || s.includes("temp") || s.includes("feed") ||
        s.includes("cry") || s.includes("letharg") || s.includes("floppy") ||
        s.includes("grunt") || s.includes("rash") || s.includes("vomit") || s.includes("breath")
      ),
      relevant_speech_features: {
        respiratory_distress_signal: patientCase.speech_features?.clinical_relevance?.respiratory_distress_signal ?? "unlikely",
        observations: patientCase.speech_features?.observations || []
      },
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("PEDIATRIC"))
    };
  }

  protected selectToolsToExecute(patientCase: PatientCase, blackboard: Blackboard): string[] {
    const text = patientCase.transcript.toLowerCase();
    const tools: string[] = [];

    // Always calculate PEWS if pediatric / infant
    if (patientCase.demographics.age_group === "infant" || patientCase.demographics.age_group === "pediatric" || (patientCase.demographics.age && patientCase.demographics.age < 16)) {
      tools.push("calculate_pews");
    }

    return tools;
  }

  protected evaluatePeerChallenges(blackboard: Blackboard): PeerChallenge[] {
    const challenges: PeerChallenge[] = [];
    const allOpinions = blackboard.getAllOpinions();

    // If an adult specialist (cardio/neuro) evaluates an infant without applying neonatal fever / sepsis guidelines
    for (const opinion of allOpinions) {
      if (opinion.agent !== this.config.agentId && opinion.specialty !== "Pediatrics") {
        const allEvidence = blackboard.getAllEvidence();
        const isNeonatalFever = allEvidence.some(e =>
          e.description.toLowerCase().includes("newborn") ||
          e.description.toLowerCase().includes("week") ||
          (e.description.toLowerCase().includes("fever") && e.description.toLowerCase().includes("102"))
        );

        if (isNeonatalFever && opinion.risk_level !== "high") {
          challenges.push({
            from_agent: this.config.agentId,
            to_agent: opinion.agent,
            claim_disputed: "Adult clinical triage framework applied to febrile neonate.",
            counter_evidence: [
              "Immature neonatal blood-brain barrier and lack of splenic opsonization",
              "Rectal fever >= 100.4 F in neonate < 60 days constitutes hyperacute sepsis until proven otherwise"
            ],
            challenge_rationale: "Neonates do not localize infections and progress to septic shock precipitously. Non-emergent disposition is impermissible.",
            resolved: false
          });
        }
      }
    }

    return challenges;
  }

  protected generateDeterministicFallback(
    patientCase: PatientCase,
    ctx: Record<string, any>,
    toolsRun: ToolResult[],
    round: number,
    challenges: PeerChallenge[]
  ): AgentOpinion {
    const text = patientCase.transcript.toLowerCase();
    const knowledgeContext = clinicalKnowledgeRetriever.retrieveKnowledge(text, "pediatrics", { topK: 3 });
    const retrievedCitations = knowledgeContext.passages.map(p => p.id);
    const pewsResult = toolsRun.find(t => t.tool_name === "calculate_pews");

    const isInfant = patientCase.demographics.age_group === "infant" || (patientCase.demographics.age !== undefined && patientCase.demographics.age <= 1);
    const hasFever = text.includes("fever") || text.includes("temp") || text.includes("102") || text.includes("103");
    const hasCriticalPediatricSign = text.includes("floppy") || text.includes("not waking up") || text.includes("grunting") ||
                                     text.includes("stridor") || text.includes("inconsolable") ||
                                     (pewsResult && pewsResult.output.pewsScore >= 4);

    if (isInfant && (hasFever || hasCriticalPediatricSign)) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: "Neonatal / Pediatric Sepsis Syndrome vs. Acute Bacterial Meningitis",
        concerns: [
          "Neonatal Fever / Early-Onset Sepsis Protocol",
          "Pediatric Acute Respiratory Decompensation",
          "Hyporesponsive Infant / Acute Encephalopathy"
        ],
        evidence: [
          "Rectal temperature elevation in vulnerable infant window",
          "Marked lethargy, hypotonia ('floppy'), or grunting respirations",
          "Refusal of oral enteral feeding with failure to awaken"
        ],
        evidence_for: [
          "Hypotonic neurological state with fever",
          pewsResult ? pewsResult.clinical_summary : "High-risk neonatal vulnerability"
        ],
        evidence_against: [],
        missing_evidence: ["Complete Sepsis Evaluation (Blood Cultures, Urine catheterization, Lumbar Puncture CSF)", "Capillary / Venous Blood Gas & Lactate"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "high",
        recommended_actions: [
          "Immediate Pediatric Emergency Department Transfer (Do not delay for oral antipyretics)",
          "Full Neonatal Sepsis Workup (Blood, Urine, CSF)",
          "Empiric Parenteral Antibiotic Therapy (Ampicillin + Cefotaxime/Gentamicin)",
          "Continuous Pulse Oximetry and Respiratory Support"
        ],
        confidence: 0.96,
        confidence_semantics: "uncalibrated_model_score",
        requires_escalation: true,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "AAP Clinical Practice Guideline for the Evaluation of Well-Appearing Febrile Infants 8-60 Days",
        retrieved_citations: retrievedCitations
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      deliberation_round: round,
      primary_hypothesis: "Viral Upper Respiratory Infection / Benign Pediatric Illness",
      concerns: ["Viral URI / Common Pediatric Cold", "Mild Gastrointestinal Upset"],
      evidence: ["Preserved alert demeanor, interactive behavior, and adequate hydration"],
      evidence_for: ["Low-acuity pediatric presentation without red-flag toxic appearance"],
      evidence_against: ["Absence of respiratory retraction, stridor, or lethargy"],
      missing_evidence: [],
      tool_invocations: toolsRun,
      challenges_issued: challenges,
      challenges_received: [],
      risk_level: "low",
      recommended_actions: ["Pediatric outpatient review if fever develops or fluid intake drops"],
      confidence: 0.88,
      confidence_semantics: "uncalibrated_model_score",
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "Ambulatory Pediatric Triage Protocol",
      retrieved_citations: retrievedCitations
    };
  }

  public assessEvidenceNeeds(patientCase: PatientCase, blackboard?: Blackboard): AgentRequest[] {
    const text = patientCase.transcript.toLowerCase();
    const requests: AgentRequest[] = [];
    const caseVer = patientCase.case_version || 1;

    const hasPedsSignal = patientCase.demographics.age_group === "infant" ||
      patientCase.demographics.age_group === "pediatric" ||
      (patientCase.demographics.age !== undefined && patientCase.demographics.age < 16) ||
      /\b(baby|infant|newborn|child|toddler|weeks?\s+old|months?\s+old)\b/i.test(text);

    if (!hasPedsSignal) return [];

    // 1. Age / Exact Month or Week
    const hasAge = patientCase.demographics.age !== undefined ||
      /\b(\d+\s*(?:weeks?|months?|days?|years?)\s+old)\b/i.test(text);
    if (!hasAge) {
      requests.push({
        id: `req-peds-age-v${caseVer}`,
        fromAgent: "pediatrics",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "pediatric_signs",
        urgency: "high",
        reason: "Determine exact age in weeks or months for neonatal fever threshold (under 60 days)",
        suggestedQuestion: "How old is your child or baby, in exact weeks or months?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 2. Temperature / Fever
    const hasTemp = /\b(temp|fever|101|102|103|104|degree|febrile)\b/i.test(text);
    if (!hasTemp) {
      requests.push({
        id: `req-peds-temp-v${caseVer}`,
        fromAgent: "pediatrics",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "pediatric_signs",
        urgency: "high",
        reason: "Assess exact measured temperature for pediatric fever protocol",
        suggestedQuestion: "Have you checked their temperature, and what was the highest reading?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 3. Responsiveness / Feeding
    const hasActivity = /\b(feed|drink|wet\s*diaper|alert|cry|sleepy|floppy|grunt|letharg)\b/i.test(text);
    if (!hasActivity) {
      requests.push({
        id: `req-peds-activity-v${caseVer}`,
        fromAgent: "pediatrics",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "pediatric_signs",
        urgency: "high",
        reason: "Evaluate alertness, feeding vigor, and hydration (wet diapers)",
        suggestedQuestion: "Are they waking up to feed normally, making wet diapers, and responding to your voice?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    return requests;
  }
}

