import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase, ToolResult, PeerChallenge, AgentRequest } from "../schemas";
import { Blackboard } from "../blackboard";
import { clinicalKnowledgeRetriever } from "../../clinical-knowledge/retriever";

export class CardiologyAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "cardiology-vance",
      doctorName: "Dr. Marcus Vance, MD, FACC",
      specialty: "Cardiology",
      clinicalDomain: "Cardiovascular, Hemodynamics & Acute Coronary Syndromes",
      systemPrompt: "You are Dr. Marcus Vance, MD, FACC, Senior Cardiologist and Critical Care Specialist. Evaluate patient presentations for Acute Coronary Syndrome (ACS), malignant arrhythmia, pulmonary embolism, and cardiogenic shock."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase, blackboard: Blackboard): Record<string, any> {
    const text = patientCase.transcript.toLowerCase();
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
        speech_pause_ratio: patientCase.speech_features?.speech_pause_ratio ?? 0.15,
        respiratory_distress_signal: patientCase.speech_features?.clinical_relevance?.respiratory_distress_signal ?? "unlikely",
        observations: (patientCase.speech_features?.observations || []).filter(o =>
          o.toLowerCase().includes("breath") || o.toLowerCase().includes("pause") || o.toLowerCase().includes("effort")
        )
      },
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("CARDIAC") || f.includes("CHEST")),
      blackboard_evidence_count: blackboard.evidence.size
    };
  }

  protected selectToolsToExecute(patientCase: PatientCase, blackboard: Blackboard): string[] {
    const text = patientCase.transcript.toLowerCase();
    const tools: string[] = [];

    // Prioritize check_drug_interactions if medication or contraindication keywords detected
    if (
      text.includes("sildenafil") ||
      text.includes("viagra") ||
      text.includes("nitroglycerin") ||
      text.includes("medication") ||
      text.includes("pill") ||
      text.includes("cialis")
    ) {
      tools.push("check_drug_interactions");
    }

    // Invokes ECG if chest discomfort, palpitations, or radiation reported
    if (text.includes("chest") || text.includes("pressure") || text.includes("crushing") || text.includes("palpitation") || text.includes("substernal")) {
      tools.push("analyze_ecg");
    }

    // Invokes TIMI risk score if high risk or older adult with angina (subject to max tools limit)
    if (tools.length < 2 && text.includes("chest") && (text.includes("radiat") || text.includes("sweat") || (patientCase.demographics.age && patientCase.demographics.age >= 60))) {
      tools.push("calculate_timi");
    }

    return tools;
  }

  protected evaluatePeerChallenges(blackboard: Blackboard): PeerChallenge[] {
    const challenges: PeerChallenge[] = [];
    const neuroOpinion = blackboard.getOpinion("neurology-pendelton");

    // If Neurology attributes syncope or unilateral left arm numbness exclusively to stroke while crushing chest pain is active
    if (neuroOpinion) {
      const allEvidence = blackboard.getAllEvidence();
      const hasChestPain = allEvidence.some(e => e.description.toLowerCase().includes("chest"));
      const neuroDownplaysCardio = !neuroOpinion.concerns.some(c => c.toLowerCase().includes("coronary") || c.toLowerCase().includes("ischemia"));

      if (hasChestPain && neuroDownplaysCardio) {
        challenges.push({
          from_agent: this.config.agentId,
          to_agent: "neurology-pendelton",
          claim_disputed: "Isolated focal neurological deficit without prioritizing acute coronary ischemia.",
          counter_evidence: [
            "Co-presenting substernal chest pressure with ischemic radiation",
            "Hemodynamic syncope proxy: transient cerebral hypoperfusion secondary to cardiogenic output compromise"
          ],
          challenge_rationale: "Unilateral left upper extremity paresthesia in setting of severe thoracic tightness carries high pre-test probability of referred cardiac ischemia (dermatomes C7-T1). Both pathways must remain emergently active.",
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
    const knowledgeContext = clinicalKnowledgeRetriever.retrieveKnowledge(text, "cardiology", { topK: 3 });
    const retrievedCitations = knowledgeContext.passages.map(p => p.id);
    const ecgResult = toolsRun.find(t => t.tool_name === "analyze_ecg");
    const timiResult = toolsRun.find(t => t.tool_name === "calculate_timi");
    const drugTool = toolsRun.find(t => t.tool_name === "check_drug_interactions");

    const hasFatalDrugInteraction = drugTool && drugTool.output?.safeToAdminister === false;
    if (hasFatalDrugInteraction) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: "Acute Thoracic Pain with Lethal Pharmacotherapy Contraindication (Nitrate + PDE5 Inhibitor)",
        concerns: [
          "Lethal Pharmacotherapy Contraindication: Nitrates co-administered with PDE-5 inhibitors",
          "Refractory Hemodynamic Collapse / Severe Vasodilatory Shock",
          "Acute Coronary Ischemia"
        ],
        evidence: [
          "Co-ingestion inquiry: Sildenafil within critical clearance window",
          "Proposed sublingual nitroglycerin administration",
          "Substernal chest pressure reported"
        ],
        evidence_for: [
          drugTool.clinical_summary,
          ecgResult ? ecgResult.clinical_summary : "Chest pressure evaluation"
        ],
        evidence_against: [],
        missing_evidence: ["Formal 12-lead ECG", "Continuous Non-invasive Blood Pressure Telemetry"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "high",
        recommended_actions: [
          "ABSOLUTE CONTRAINDICATION: DO NOT ADMINISTER NITROGLYCERIN",
          "Immediate 911 / 108 Emergency Medical Dispatch",
          "Continuous Blood Pressure & Cardiac Rhythm Monitoring",
          "Alternative non-nitrate anti-anginal / ischemic management by emergency physicians"
        ],
        confidence: 0.98,
        confidence_semantics: "tool_calibrated",
        requires_escalation: true,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "AHA/ACC Absolute Nitrate Contraindication Guideline",
        retrieved_citations: ["MED-DAILYMED-CONTRA-001", ...retrievedCitations]
      };
    }

    const hasACS = (text.includes("chest pain") || text.includes("chest pressure") || text.includes("crushing") || text.includes("substernal")) &&
                   (text.includes("arm") || text.includes("jaw") || text.includes("sweat") || text.includes("breath") || (ecgResult && ecgResult.output.acuteIschemia));
    const hasPalpitations = text.includes("palpitation") || text.includes("racing heart");

    if (hasACS) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: "Acute Coronary Syndrome (STEMI / High-Risk NSTEMI)",
        concerns: ["Acute Coronary Syndrome (STEMI / High-Risk NSTEMI)", "Myocardial Ischemia"],
        evidence: ["Crushing chest discomfort", "Classic ischemic radiation or diaphoresis"],
        evidence_for: [
          "Crushing substernal chest discomfort",
          ecgResult ? ecgResult.clinical_summary : "Classic ischemic distribution",
          timiResult ? timiResult.clinical_summary : "High clinical risk features"
        ],
        evidence_against: [],
        missing_evidence: ["Serial Cardiac Biomarkers (High-Sensitivity Troponin I/T)", "Formal 12-lead Electrocardiogram Confirmation"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "high",
        recommended_actions: [
          "Immediate 911/108 Emergency Dispatch",
          "Urgent 12-lead Electrocardiogram (ECG)",
          "Serial High-Sensitivity Cardiac Troponin I/T",
          "Continuous Cardiac Rhythm Telemetry"
        ],
        confidence: 0.94,
        confidence_semantics: "uncalibrated_model_score",
        requires_escalation: true,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "ACC/AHA Acute Coronary Syndrome Fast-Track Protocol",
        retrieved_citations: retrievedCitations
      };
    }

    if (hasPalpitations) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: "Symptomatic Cardiac Arrhythmia",
        concerns: ["Cardiac Arrhythmia", "Supraventricular / Ventricular Ectopy"],
        evidence: ["Reported rapid/irregular heartbeat without syncope"],
        evidence_for: ["Palpitations reported by patient", ecgResult ? ecgResult.clinical_summary : "Rhythm disturbance"],
        evidence_against: ["Absence of acute hemodynamic collapse or shock state"],
        missing_evidence: ["Ambulatory Holter Telemetry", "Comprehensive Electrolyte & Thyroid Panel"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "moderate",
        recommended_actions: [
          "Urgent Outpatient Electrocardiogram",
          "Electrolyte & Thyroid Panel (TSH, K+, Mg2+)",
          "Holter / Event Monitor Consideration"
        ],
        confidence: 0.85,
        confidence_semantics: "uncalibrated_model_score",
        requires_escalation: false,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "HRS Clinical Practice Guideline for Arrhythmias",
        retrieved_citations: retrievedCitations
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      deliberation_round: round,
      primary_hypothesis: "Non-cardiac chest sensation / Atypical Thoracic Discomfort",
      concerns: ["Non-cardiac chest sensations", "Musculoskeletal or reflux chest discomfort"],
      evidence: ["Absence of hemodynamic instability, ischemic radiation, or diaphoresis"],
      evidence_for: ["Low pre-test probability of acute plaque rupture"],
      evidence_against: ["Absence of diaphoresis or exertional chest pressure"],
      missing_evidence: [],
      tool_invocations: toolsRun,
      challenges_issued: challenges,
      challenges_received: [],
      risk_level: "low",
      recommended_actions: ["Primary Care outpatient review if symptoms persist"],
      confidence: 0.80,
      confidence_semantics: "uncalibrated_model_score",
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "Ambulatory Chest Discomfort Pathway",
      retrieved_citations: retrievedCitations
    };
  }

  public assessEvidenceNeeds(patientCase: PatientCase, blackboard?: Blackboard): AgentRequest[] {
    const text = patientCase.transcript.toLowerCase();
    const requests: AgentRequest[] = [];
    const caseVer = patientCase.case_version || 1;

    // Check if cardiac domain is active (chest discomfort, palpitations, breathlessness, angina)
    const hasCardiacSignal = /\b(chest|heart|sternum|angina|palpitation|pressure|tightness|squeezing)\b/i.test(text);
    if (!hasCardiacSignal) return [];

    // 1. Onset & Duration
    const hasOnset = /\b(\d+\s*(?:minutes?|hours?|days?|weeks?|mins?|hrs?)|sudden(?:ly)?|just\s+started|thirty\s+minutes|an?\s+hour|twenty\s+minutes|this\s+morning)\b/i.test(text);
    if (!hasOnset) {
      requests.push({
        id: `req-cardio-onset-v${caseVer}`,
        fromAgent: "cardiology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "onset",
        urgency: "high",
        reason: "Establish exact timeline and suddenness of chest discomfort for ischemic risk stratification",
        suggestedQuestion: "When did this chest discomfort begin, and did it start suddenly or build up gradually?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 2. Character / Quality
    const hasCharacter = /\b(crushing|pressure|squeezing|tightness|heavy|sharp|stabbing|burning|throbbing|ache|dull|elephant)\b/i.test(text);
    if (!hasCharacter) {
      requests.push({
        id: `req-cardio-char-v${caseVer}`,
        fromAgent: "cardiology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "character",
        urgency: "normal",
        reason: "Differentiate visceral pressure/squeezing from pleuritic or musculoskeletal quality",
        suggestedQuestion: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, or a sharp pain?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 3. Exertional Relationship
    const hasExertion = /\b(exert|exercise|walk|stair|rest|sitting|activity|physical|climb)\b/i.test(text);
    if (!hasExertion) {
      requests.push({
        id: `req-cardio-exert-v${caseVer}`,
        fromAgent: "cardiology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "exertional",
        urgency: "high",
        reason: "Determine if symptoms correlate with myocardial oxygen demand (exertion vs rest)",
        suggestedQuestion: "Does this discomfort happen when you're physically active, such as climbing stairs, or does it occur at rest?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 4. Radiation Pathway
    const hasRadiation = /\b(radiat.*|spread.*|travel.*|into\s+(?:my\s+)?(?:left\s+)?arm|jaw|neck|shoulder|back|head|throat)\b/i.test(text) ||
      /\b(no\s+radiation|stays?\s+(?:right\s+)?there|doesn't\s+travel|nowhere)\b/i.test(text);
    if (!hasRadiation) {
      requests.push({
        id: `req-cardio-rad-v${caseVer}`,
        fromAgent: "cardiology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "radiation",
        urgency: "high",
        reason: "Characterize ischemic dermatome radiation (arm, jaw, shoulder, neck, back)",
        suggestedQuestion: "Does the discomfort travel or spread anywhere, such as into your left arm, jaw, neck, or back?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    // 5. Associated Systemic Signs
    const hasAssociated = /\b(sweat|cold\s+sweats|clammy|diaphoresis|shortness\s+of\s+breath|difficulty\s+breathing|dyspnea|nausea|vomit|dizz|faint|syncope)\b/i.test(text) ||
      /\b(no\s+(?:sweat|shortness|nausea|dizziness)|denies\s+(?:sweat|dyspnea))\b/i.test(text);
    if (!hasAssociated) {
      requests.push({
        id: `req-cardio-assoc-v${caseVer}`,
        fromAgent: "cardiology",
        doctorName: this.config.doctorName,
        type: "patient_question",
        targetSlot: "associated_symptoms",
        urgency: "high",
        reason: "Check for autonomic signs: diaphoresis, dyspnea, nausea, and presyncope",
        suggestedQuestion: "Are you noticing any shortness of breath, cold sweating, nausea, or dizziness alongside this?",
        status: "pending",
        caseVersion: caseVer,
      });
    }

    return requests;
  }
}

