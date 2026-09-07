import { BaseClinicalAgent } from "../base-agent";
import { AgentOpinion, PatientCase, ToolResult, PeerChallenge } from "../schemas";
import { Blackboard } from "../blackboard";

export class NeurologyAgent extends BaseClinicalAgent {
  constructor() {
    super({
      agentId: "neurology-pendelton",
      doctorName: "Dr. Arthur Pendelton, MD, PhD",
      specialty: "Neurology",
      clinicalDomain: "Cerebrovascular Disease, Stroke & Acute Neurologic Emergencies",
      systemPrompt: "You are Dr. Arthur Pendelton, MD, PhD, Senior Vascular Neurologist. Evaluate presentations for acute ischemic stroke, intracranial hemorrhage, subarachnoid hemorrhage, status epilepticus, and focal neuropathies."
    });
  }

  protected extractSpecialtyContext(patientCase: PatientCase, blackboard: Blackboard): Record<string, any> {
    const text = patientCase.transcript.toLowerCase();
    return {
      specialty: "Neurology",
      demographics: patientCase.demographics,
      transcript: patientCase.transcript,
      neuro_symptoms: patientCase.detected_symptoms.filter(s =>
        s.includes("head") || s.includes("weak") || s.includes("numb") ||
        s.includes("speech") || s.includes("droop") || s.includes("dizz") ||
        s.includes("vision") || s.includes("faint") || s.includes("seiz") || s.includes("black")
      ),
      vitals: patientCase.vitals,
      relevant_speech_features: {
        speech_rate_wpm: patientCase.speech_features?.speech_rate_wpm ?? 130,
        cognitive_load_signal: patientCase.speech_features?.clinical_relevance?.vocal_instability_signal ?? "none",
        observations: (patientCase.speech_features?.observations || []).filter(o =>
          o.toLowerCase().includes("slow") || o.toLowerCase().includes("cadence") || o.toLowerCase().includes("pause")
        )
      },
      pre_safety_flags: patientCase.pre_safety_flags.filter(f => f.includes("NEURO"))
    };
  }

  protected selectToolsToExecute(patientCase: PatientCase, blackboard: Blackboard): string[] {
    const text = patientCase.transcript.toLowerCase();
    const tools: string[] = [];

    // BE-FAST tool if facial droop, arm weakness, speech changes, numbness, or dizziness
    if (text.includes("droop") || text.includes("weak") || text.includes("numb") || text.includes("speech") || text.includes("words") || text.includes("dizz") || text.includes("black out")) {
      tools.push("compute_befast");
    }

    // NIHSS approximation if focal deficit suspected
    if (text.includes("face") || text.includes("arm") || text.includes("slurr") || text.includes("speak") || text.includes("paraly")) {
      tools.push("compute_nihss");
    }

    return tools;
  }

  protected evaluatePeerChallenges(blackboard: Blackboard): PeerChallenge[] {
    const challenges: PeerChallenge[] = [];
    const cardioOpinion = blackboard.getOpinion("cardiology-vance");

    // If Cardiology attributes unilateral focal arm numbness/weakness purely to non-emergent or non-focal cardiac radiation without addressing stroke risk
    if (cardioOpinion) {
      const allEvidence = blackboard.getAllEvidence();
      const hasNeuroDeficit = allEvidence.some(e =>
        e.description.toLowerCase().includes("droop") ||
        e.description.toLowerCase().includes("slurr") ||
        e.description.toLowerCase().includes("words") ||
        (e.description.toLowerCase().includes("arm") && e.description.toLowerCase().includes("weak"))
      );

      if (hasNeuroDeficit && cardioOpinion.risk_level !== "high") {
        challenges.push({
          from_agent: this.config.agentId,
          to_agent: "cardiology-vance",
          claim_disputed: "Cardiology underestimating co-presenting focal neurological signs as secondary.",
          counter_evidence: [
            "Objective acute focal weakness / language hesitancy demonstrated",
            "BE-FAST criteria positive"
          ],
          challenge_rationale: "Focal cranial nerve asymmetry and acute lateralized motor deficits cannot be safely attributed to cardiac etiology alone. Code Stroke emergent neuroimaging is obligatory.",
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
    const befastResult = toolsRun.find(t => t.tool_name === "compute_befast");
    const nihssResult = toolsRun.find(t => t.tool_name === "compute_nihss");

    const hasStrokeDeficit = text.includes("droop") || text.includes("slurred") || text.includes("facial") ||
                             text.includes("arm weakness") || text.includes("cannot speak") ||
                             (befastResult && befastResult.output.isPositive);

    const hasThunderclap = text.includes("thunderclap") || text.includes("worst headache") || (text.includes("headache") && text.includes("sudden severe"));
    const hasDizzinessSyncope = text.includes("dizziness") || text.includes("black out") || text.includes("vertigo") || text.includes("faint");

    if (hasStrokeDeficit || hasThunderclap) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: hasThunderclap ? "Subarachnoid Hemorrhage (SAH)" : "Acute Ischemic Stroke / Large Vessel Occlusion (LVO)",
        concerns: hasThunderclap
          ? ["Aneurysmal Subarachnoid Hemorrhage (SAH)", "Sentinel Headache"]
          : ["Acute Ischemic Stroke (BE-FAST criteria match)", "Transient Ischemic Attack (TIA)"],
        evidence: [
          hasThunderclap ? "Thunderclap headache onset" : "Focal neurological deficit (facial droop, unilateral weakness, or dysarthria)",
          "Hyperacute symptom onset (< 4.5 hour intravenous thrombolysis window)"
        ],
        evidence_for: [
          hasThunderclap ? "Hyperacute maximal headache" : "Focal motor/speech deficit",
          befastResult ? befastResult.clinical_summary : "BE-FAST criteria positive",
          nihssResult ? nihssResult.clinical_summary : "Acute focal neurological deficit"
        ],
        evidence_against: [],
        missing_evidence: ["Emergent Non-Contrast Head CT / CT Angiography", "Serum Glucose & Coagulation INR/PTT"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "high",
        recommended_actions: [
          "Immediate 911/108 Emergency Stroke Code Activation",
          "Emergent Non-Contrast Head CT and CT Angiography (CTA)",
          "Fingerstick Blood Glucose (exclude severe hypoglycemia)",
          "Establish Exact Last Known Well (LKW) Time Window"
        ],
        confidence: 0.95,
        confidence_semantics: "uncalibrated_model_score",
        requires_escalation: true,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "AHA/ASA Acute Ischemic Stroke Early Management Guidelines"
      };
    }

    if (hasDizzinessSyncope) {
      return {
        agent: this.config.agentId,
        doctor_name: this.config.doctorName,
        specialty: this.config.specialty,
        deliberation_round: round,
        primary_hypothesis: "Presyncope / Transient Cerebral Hypoperfusion vs. Vestibulopathy",
        concerns: ["Presyncope / Orthostatic Hypoperfusion", "Peripheral Vestibulopathy vs. Posterior Circulation TIA"],
        evidence: ["Reported dizziness or near-syncope without persistent cranial nerve deficits"],
        evidence_for: ["Dizziness/syncope reported", befastResult ? befastResult.clinical_summary : "Screening negative for focal cortical stroke"],
        evidence_against: ["Absence of hemiparesis, facial droop, or aphasia"],
        missing_evidence: ["Orthostatic Blood Pressure (supine and standing)", "Dix-Hallpike / HINTS Exam"],
        tool_invocations: toolsRun,
        challenges_issued: challenges,
        challenges_received: [],
        risk_level: "moderate",
        recommended_actions: [
          "Orthostatic Vital Signs Measurement",
          "Urgent Outpatient Neurological / Vestibular Evaluation",
          "Cardiac Arrhythmia Cross-Evaluation (Holter / ECG)"
        ],
        confidence: 0.84,
        confidence_semantics: "uncalibrated_model_score",
        requires_escalation: false,
        speech_observations_evaluated: ctx.relevant_speech_features?.observations || [],
        clinical_protocol: "AAN Clinical Guideline for Unexplained Syncope and Dizziness"
      };
    }

    return {
      agent: this.config.agentId,
      doctor_name: this.config.doctorName,
      specialty: this.config.specialty,
      deliberation_round: round,
      primary_hypothesis: "Tension-type / Non-focal Primary Headache",
      concerns: ["Primary headache disorder (tension/migraine)", "Non-focal neurological complaints"],
      evidence: ["Absence of focal neurologic signs, papilledema, or sudden thunderclap onset"],
      evidence_for: ["Low pre-test probability of intracranial vascular catastrophe"],
      evidence_against: ["Absence of BE-FAST stroke deficits"],
      missing_evidence: [],
      tool_invocations: toolsRun,
      challenges_issued: challenges,
      challenges_received: [],
      risk_level: "low",
      recommended_actions: ["Outpatient neurological consultation if headaches worsen or recur"],
      confidence: 0.82,
      confidence_semantics: "uncalibrated_model_score",
      requires_escalation: false,
      speech_observations_evaluated: [],
      clinical_protocol: "Outpatient Primary Headache Management Pathway"
    };
  }
}
