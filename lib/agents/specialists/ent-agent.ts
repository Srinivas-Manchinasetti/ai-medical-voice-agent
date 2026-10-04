import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase, ToolResult, PeerChallenge, AgentRequest } from "../schemas";
import { Blackboard } from "../blackboard";
import { clinicalKnowledgeRetriever } from "../../clinical-knowledge/retriever";

export class OtolaryngologyAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "otolaryngology-sharma",
      doctorName: "Dr. Rajiv Sharma, MS (ENT), DLO",
      specialty: "Otolaryngology",
      clinicalDomain: "Head & Neck Surgery, Airway Protection & Upper Aerodigestive Pathology",
      systemPrompt: "You are Dr. Rajiv Sharma, MS (ENT), DLO, Senior Head & Neck Specialist. Evaluate pharyngeal presentations for peritonsillar abscess (Quinsy), deep neck space phlegmon/abscess, acute epiglottitis, impending upper airway compromise, and severe odynophagia."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase, blackboard: Blackboard): Record<string, any> {
    const text = patientCase.transcript.toLowerCase();
    return {
      specialty: "Otolaryngology",
      demographics: patientCase.demographics,
      transcript: patientCase.transcript,
      ent_symptoms: patientCase.detected_symptoms.filter(s =>
        s.includes("throat") || s.includes("swallow") || s.includes("voice") ||
        s.includes("neck") || s.includes("ear") || s.includes("stridor") ||
        s.includes("saliva") || s.includes("mouth") || s.includes("fever")
      ),
      vitals: patientCase.vitals,
      relevant_speech_features: {
        speech_rate_wpm: patientCase.speech_features?.speech_rate_wpm ?? 130,
        observations: (patientCase.speech_features?.observations || []).filter(o =>
          o.toLowerCase().includes("muffle") || o.toLowerCase().includes("hoarse") || o.toLowerCase().includes("breathing")
        )
      },
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("AIRWAY") || f.includes("PTA") || f.includes("NECK"))
    };
  }

  protected selectToolsToExecute(patientCase: PatientCase, blackboard: Blackboard): string[] {
    const text = patientCase.transcript.toLowerCase();
    const tools: string[] = [];

    // Execute deep neck space & airway risk assessment for sore throat / swallowing / airway presentations
    if (text.includes("throat") || text.includes("swallow") || text.includes("saliva") || text.includes("muffle") || text.includes("stridor") || text.includes("neck")) {
      tools.push("assess_deep_neck_airway");
    }

    return tools;
  }

  protected evaluatePeerChallenges(blackboard: Blackboard): PeerChallenge[] {
    const challenges: PeerChallenge[] = [];
    const allOpinions = blackboard.getAllOpinions();
    const primaryCare = allOpinions.find(o => o.agent === "primary-care-chen");

    // If Primary Care categorizes a patient with muffled voice and saliva odynophagia as routine or low-risk URI
    if (primaryCare) {
      const allEvidence = blackboard.getAllEvidence();
      const hasAirwayOrAbscessThreat = allEvidence.some(e =>
        e.description.toLowerCase().includes("muffle") ||
        e.description.toLowerCase().includes("saliva") ||
        e.description.toLowerCase().includes("trismus") ||
        e.description.toLowerCase().includes("pta")
      );

      if (hasAirwayOrAbscessThreat && primaryCare.risk_level === "low") {
        challenges.push({
          from_agent: this.config.agentId,
          to_agent: "primary-care-chen",
          claim_disputed: "Primary Care underestimating potential deep neck space infection or peritonsillar abscess.",
          counter_evidence: [
            "Hot potato / muffled voice acoustic change reported",
            "Severe odynophagia with inability to swallow oral secretions / saliva",
            "Risk of imminent airway displacement / descending mediastinitis"
          ],
          challenge_rationale: "Pharyngitis presenting with 'hot potato' speech and inability to manage secretions indicates potential peritonsillar or parapharyngeal abscess. Routine outpatient management carries prohibitive airway obstruction risk.",
          resolved: false
        });
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
    const knowledgeContext = clinicalKnowledgeRetriever.retrieveKnowledge(text, "general", { topK: 3 });
    const retrievedCitations = knowledgeContext.passages.map(p => p.id);
    const airwayTool = toolsRun.find(t => t.tool_name === "assess_deep_neck_airway");

    const hasMuffledVoice = /\b(muffled|hot\s+potato|something in.*mouth)\b/i.test(text);
    const hasSalivaPain = /\b(saliva|swallow.*saliva|drool|spit)\b/i.test(text);
    const hasStridor = /\b(stridor|noisy breathing|throat.*closing)\b/i.test(text);
    const hasFever = /\b(fever|temp|10[0-9]|3[8-9]\.[0-9])\b/i.test(text);

    const isHighRiskAbscess = hasStridor || (hasMuffledVoice && hasSalivaPain) || (airwayTool?.output?.airwayThreatLevel === "critical" || airwayTool?.output?.airwayThreatLevel === "high");

    if (isHighRiskAbscess) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: "Peritonsillar Abscess (Quinsy) vs. Parapharyngeal Space Phlegmon",
        concerns: [
          "Peritonsillar Abscess (PTA) with impending upper airway compromise",
          "Deep Neck Space Phlegmon / Retropharyngeal Abscess",
          "Acute Epiglottitis / Supraglottitis"
        ],
        evidence: [
          patientCase.transcript,
          hasMuffledVoice ? "Acoustic biomarker: 'Hot potato' muffled voice" : "Severe progressive pharyngeal pain",
          hasSalivaPain ? "Severe odynophagia: Inability to swallow saliva normally" : "Dysphagia to oral secretions",
          hasFever ? "Systemic pyrexia confirmed" : "Systemic inflammation"
        ],
        evidence_for: [
          "Classic triad of fever, muffled voice, and severe saliva odynophagia",
          "High pre-test probability of unilateral space-occupying pharyngeal infection"
        ],
        evidence_against: ["Absence of stridor or biphasic upper airway sounds at rest"],
        missing_evidence: ["Direct fiberoptic laryngoscopy visualization", "Contrast-enhanced cervical CT scan"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "high",
        recommended_actions: [
          "Immediate emergency ENT evaluation for fiberoptic examination and needle aspiration / I&D",
          "Maintain seated upright position; avoid supine posture to preserve airway patency",
          "Parenteral IV hydration and empirical antimicrobial coverage (Ampicillin-Sulbactam / Clindamycin)",
          "Urgent cervical CT with IV contrast if trismus limits intraoral visual inspection"
        ],
        confidence: 0.94,
        confidence_semantics: "tool_calibrated",
        requires_escalation: true,
        speech_observations_evaluated: patientCase.speech_features?.observations || [],
        clinical_protocol: "Emergency ENT Airway & Deep Neck Space Infection Protocol",
        retrieved_citations: retrievedCitations
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      deliberation_round: round,
      primary_hypothesis: "Acute Pharyngotonsillitis / Exudative Tonsillitis",
      concerns: [
        "Acute Streptococcal Pharyngitis (Centor evaluation)",
        "Viral Pharyngitis (EBV / Infectious Mononucleosis vs Adenovirus)",
        "Early uncomplicated tonsillitis without deep neck phlegmon"
      ],
      evidence: [patientCase.transcript],
      evidence_for: ["Acute throat pain without severe trismus or airway compromise"],
      evidence_against: ["Absence of muffled voice, drooling, or unilateral palatal displacement"],
      missing_evidence: ["Rapid antigen detection test (RADT) / throat swab"],
      tool_invocations: toolsRun,
      challenges_issued: challenges,
      challenges_received: [],
      risk_level: "low",
      recommended_actions: [
        "Outpatient evaluation for Centor score / throat swab if bacterial infection suspected",
        "Warm salt-water gargles, systemic analgesia (acetaminophen/ibuprofen), adequate hydration",
        "Seek immediate emergency care if unable to swallow liquids, voice becomes muffled, or breathing is difficult"
      ],
      confidence: 0.85,
      confidence_semantics: "uncalibrated_model_score",
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "Outpatient Pharyngitis & Upper Airway Clinical Guideline",
      retrieved_citations: retrievedCitations
    };
  }

  public assessEvidenceNeeds(patientCase: PatientCase, blackboard?: Blackboard): AgentRequest[] {
    const text = patientCase.transcript.toLowerCase();
    const requests: AgentRequest[] = [];
    const caseVer = patientCase.case_version || 1;

    // Check if ENT / throat domain is active
    const hasThroatSignal = /\b(throat|swallow|voice|neck|tonsil|saliva|earache|otalgia|sore\s+throat)\b/i.test(text);
    if (!hasThroatSignal) return [];

    // 1. Airway / Saliva Swallowing / Secretion management screen
    //    Only fire when PTA / deep neck concern is active (pre-arbiter flag, muffled voice, fever+severe pain)
    const hasSalivaStatus = /\b(saliva|drool|spit|liquid|swallowing\s+saliva|water\s+slowly)\b/i.test(text);
    const hasEntUrgency = patientCase.pre_safety_flags?.some(f => f.includes("PTA") || f.includes("DEEP_NECK") || f.includes("AIRWAY")) ||
      text.includes("muffle") || text.includes("stridor") ||
      (text.includes("fever") && /\b(severe|8|9|10)\b/.test(text));
    if (!hasSalivaStatus && hasEntUrgency) {
      requests.push({
        id: `req-ent-saliva-v${caseVer}`,
        fromAgent: "otolaryngology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "swallowing_difficulty",
        urgency: "high",
        reason: "Screen for impending airway compromise and severe odynophagia (inability to swallow saliva / secretions)",
        suggestedQuestion: "When you swallow, are you able to swallow liquids and your own saliva normally, or does it feel stuck or too painful to swallow?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 2. Trismus (Jaw opening limitation) — only when PTA / deep neck infection is actively suspected
    //    Requires pre-arbiter PTA flag OR explicit muffled voice / stridor
    const hasTrismusStatus = /\b(open.*mouth|jaw|trismus|mouth.*open|chew|stiff.*jaw)\b/i.test(text);
    const hasPtaConcern = patientCase.pre_safety_flags?.some(f => f.includes("PTA") || f.includes("DEEP_NECK")) ||
      /\b(muffled|hot\s+potato|stridor|noisy\s+breathing)\b/i.test(text);
    if (!hasTrismusStatus && hasPtaConcern) {
      requests.push({
        id: `req-ent-trismus-v${caseVer}`,
        fromAgent: "otolaryngology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "trismus_or_jaw_opening",
        urgency: "high",
        reason: "Screen for pterygoid space spasm / peritonsillar inflammation causing trismus",
        suggestedQuestion: "Can you open your mouth completely, or does your jaw feel stiff, painful, or limited when you try to open wide?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    return requests;
  }
}
