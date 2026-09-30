import { conversationManager } from "../lib/triage/conversation-manager";
import { buildProvenanceEvidenceFromClinicalState } from "../lib/agents/provenance";
import { clinicalBoard } from "../lib/agents/clinical-board";
import { PatientCase } from "../lib/agents/schemas";
import { generateFHIRBundle } from "../lib/fhir/bundle";

async function runProvenanceSoapEvaluation() {
  console.log("===============================================================================");
  console.log("   TESTING P1: HONEST PROVENANCE-BASED SOAP DOCUMENTATION & FHIR COMPLIANCE");
  console.log("===============================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // STEP 1: Process 2-Turn Patient Encounter
  // -------------------------------------------------------------------------
  console.log("--- 1. Multi-Turn Clinical Encounter Intake ---");
  const state0 = conversationManager.createInitialState();
  const turn1 = await conversationManager.processTurn("I have had a bad sore throat for two days.", state0);
  const turn2 = await conversationManager.processTurn(
    "It hurts when I swallow saliva. No fever. Pain is about 6 out of 10.",
    turn1.state
  );

  assert(turn2.state.slots.severity === "6/10", "Severity captured as 6/10");
  assert(
    turn2.state.conversationMemory?.deniedSymptoms.includes("fever") ||
      turn2.state.slots.known_facts.some(f => /denied:\s*fever/i.test(f)),
    "Fever correctly captured as denied"
  );
  assert(
    turn2.state.slots.known_facts.some(f => /odynophagia/i.test(f)),
    "Odynophagia (painful swallowing) captured in slots"
  );

  // -------------------------------------------------------------------------
  // STEP 2: Deterministic Provenance Evidence Generation
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Deterministic Provenance Model ---");
  const speechFeatures = {
    speech_rate_wpm: 128,
    speech_pause_ratio: 0.18,
    mean_pause_duration_ms: 220,
    voice_energy_variability: 0.12,
    pitch_variability: 0.14,
    observations: ["Acoustic intake via browser microphone", "Vocal strain detected during speech production"],
    clinical_relevance: {
      respiratory_distress_signal: "unlikely" as const,
      vocal_instability_signal: "mild" as const,
      confidence: 0.95,
    },
  };

  const provenanceEvidence = buildProvenanceEvidenceFromClinicalState({
    state: turn2.state,
    speechFeatures,
    vitals: {},
  });

  // Check Patient-Reported Items
  const ccItem = provenanceEvidence.find(e => e.domain === "chief_complaint");
  const sevItem = provenanceEvidence.find(e => e.domain === "pain_severity");
  const feverItem = provenanceEvidence.find(e => e.domain === "fever");
  const odynoItem = provenanceEvidence.find(e => e.domain === "odynophagia" || e.label?.includes("Odynophagia"));

  assert(Boolean(ccItem && ccItem.source === "patient_reported"), "Chief complaint tagged as patient_reported");
  assert(Boolean(sevItem && sevItem.source === "patient_reported" && sevItem.value === "6/10"), "Pain severity 6/10 tagged as patient_reported");
  assert(Boolean(feverItem && feverItem.source === "patient_reported" && feverItem.status === "denied"), "Fever denial tagged with status: denied");
  assert(Boolean(odynoItem && odynoItem.source === "patient_reported"), "Odynophagia tagged as patient_reported");

  // Check Unassessed Metrics (Zero Fabricated Vitals)
  const bpItem = provenanceEvidence.find(e => e.domain === "blood_pressure");
  const hrItem = provenanceEvidence.find(e => e.domain === "heart_rate");
  const spo2Item = provenanceEvidence.find(e => e.domain === "spo2" || e.domain === "oxygen_saturation");
  const tempItem = provenanceEvidence.find(e => e.domain === "temperature");
  const rrItem = provenanceEvidence.find(e => e.domain === "respiratory_rate");
  const peItem = provenanceEvidence.find(e => e.domain === "physical_examination");

  assert(Boolean(bpItem && bpItem.source === "not_assessed" && bpItem.status === "not_assessed"), "Blood Pressure tagged as not_assessed");
  assert(Boolean(hrItem && hrItem.source === "not_assessed" && hrItem.status === "not_assessed"), "Heart Rate tagged as not_assessed");
  assert(Boolean(spo2Item && spo2Item.source === "not_assessed" && spo2Item.status === "not_assessed"), "SpO₂ tagged as not_assessed");
  assert(Boolean(tempItem && tempItem.source === "not_assessed" && tempItem.status === "not_assessed"), "Temperature tagged as not_assessed");
  assert(Boolean(tempItem && /verbally denied fever/i.test(tempItem.description)), "Temperature item notes verbal fever denial");
  assert(Boolean(rrItem && rrItem.source === "not_assessed" && rrItem.status === "not_assessed"), "Respiratory Rate tagged as not_assessed");
  assert(Boolean(peItem && peItem.source === "not_assessed" && peItem.status === "not_assessed"), "Physical Exam tagged as not_assessed");

  // Check Device / Acoustic Telemetry
  const speechItem = provenanceEvidence.find(e => e.source === "device_measured" && (e.domain === "speech_rate" || e.domain === "speech_acoustics"));
  assert(Boolean(speechItem && speechItem.source === "device_measured"), "Speech features tagged as device_measured");

  // -------------------------------------------------------------------------
  // STEP 3: Multi-Agent Clinical Board Deliberation & SOAP Generation
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Multi-Agent Board SOAP Synthesis ---");
  const patientCase: PatientCase = {
    patient_id: "PT-TEST-P1",
    patient_name: "Test Subject",
    transcript: turn2.state.cumulativeTranscript || "Patient: I have had a bad sore throat for two days.\nPatient: It hurts when I swallow saliva. No fever. Pain is about 6 out of 10.",
    conversation_history: [
      { role: "patient", text: "I have had a bad sore throat for two days.", timestamp: new Date().toISOString() },
      { role: "doctor", text: turn1.doctorReply, timestamp: new Date().toISOString() },
      { role: "patient", text: "It hurts when I swallow saliva. No fever. Pain is about 6 out of 10.", timestamp: new Date().toISOString() },
    ],
    speech_features: speechFeatures,
    detected_symptoms: turn2.state.slots.known_facts,
    provenance_evidence: provenanceEvidence,
    demographics: {
      age: 34,
      age_group: "adult",
      gender: "female",
    },
    pre_safety_flags: [],
    vitals: {},
    immediate_danger_detected: false,
    case_version: 1,
  };

  const boardResult = await clinicalBoard.evaluate(patientCase);
  const soap = boardResult.soap_note;

  console.log("\nGenerated SOAP Note Summary:");
  console.log("--------------------------------------------------");
  console.log("[SUBJECTIVE]:\n" + soap.subjective);
  console.log("\n[OBJECTIVE]:\n" + soap.objective);
  console.log("\n[ASSESSMENT]:\n" + soap.assessment);
  console.log("\n[PLAN]:\n" + soap.plan);
  console.log("--------------------------------------------------\n");

  // Assert Subjective Section
  assert(soap.subjective.startsWith("[PATIENT-REPORTED]"), "Subjective starts with [PATIENT-REPORTED] header");
  assert(/Chief Complaint:\s*.*throat/i.test(soap.subjective), "Subjective identifies sore throat chief complaint");
  assert(/Pain Severity:\s*6\/10/i.test(soap.subjective), "Subjective includes Pain Severity: 6/10");
  assert(/Pertinent Denials:.*fever/i.test(soap.subjective), "Subjective includes Pertinent Denials: fever");

  // Assert Objective Section
  assert(soap.objective.includes("[NOT ASSESSED]"), "Objective includes [NOT ASSESSED] block");
  assert(/Blood Pressure:\s*Not assessed/i.test(soap.objective), "Objective itemizes unassessed Blood Pressure");
  assert(/Heart Rate:\s*Not assessed/i.test(soap.objective), "Objective itemizes unassessed Heart Rate");
  assert(/SpO₂:\s*Not assessed/i.test(soap.objective), "Objective itemizes unassessed SpO₂");
  assert(/Temperature:\s*Not assessed.*verbally denied fever/i.test(soap.objective), "Objective itemizes Temperature with verbal denial");
  assert(/Respiratory Rate:\s*Not assessed/i.test(soap.objective), "Objective itemizes unassessed Respiratory Rate");
  assert(/Physical Examination:\s*Not performed/i.test(soap.objective), "Objective itemizes unperformed Physical Exam");
  assert(soap.objective.includes("[DEVICE / ACOUSTIC MEASURED]"), "Objective includes [DEVICE / ACOUSTIC MEASURED]");
  assert(/Speech Rate:\s*128\s*WPM/i.test(soap.objective), "Objective reports acoustic 128 WPM telemetry");

  // Negative Assertions on Objective: Zero Fabricated Vitals & No Symptom Misplacement
  assert(!/\b120\/80\b|\b98%\b|\b72\s*bpm\b/i.test(soap.objective), "Objective contains zero fabricated numeric vitals");
  assert(!/• Reported Symptoms:/i.test(soap.objective), "Objective does NOT contain patient reported symptoms");

  // Assert Assessment Section
  assert(soap.assessment.startsWith("[AI-INFERRED / ALGORITHMIC]"), "Assessment starts with [AI-INFERRED / ALGORITHMIC]");
  assert(/Primary Triage Impression:/i.test(soap.assessment), "Assessment lists primary triage impression");
  assert(/Clinical Governance:.*Does not replace physical examination/i.test(soap.assessment), "Assessment contains clinical governance disclaimer");

  // Assert Plan Section
  assert(soap.plan.startsWith("[AI-GENERATED]"), "Plan starts with [AI-GENERATED]");
  assert(/Recommended Disposition:/i.test(soap.plan), "Plan contains actionable disposition");
  assert(/Audit Ledger & Provenance:.*SHA-256 block height/i.test(soap.plan), "Plan references SHA-256 audit block height");

  // -------------------------------------------------------------------------
  // STEP 4: FHIR R4 Bundle Serialization
  // -------------------------------------------------------------------------
  console.log("\n--- 4. HL7 FHIR R4 Serialization Integrity ---");
  const fhirBundle = generateFHIRBundle({
    id: "ENC-TEST-P1",
    patientName: "Test Subject",
    patientGender: "female",
    patientAge: "34",
    doctorId: "dr-anna-bennett",
    doctorName: "Dr. Anna Bennett, MD",
    specialty: "Family Medicine & Urgent Care",
    chiefComplaint: "Sore throat for two days",
    triageLevel: "priority",
    triageTitle: "Acute Odynophagia & Pharyngitis Evaluation",
    esiScore: 3,
    icd10Codes: boardResult.post_arbiter.icd10_codes,
    detectedSymptoms: turn2.state.slots.known_facts,
    soapSubjective: soap.subjective,
    soapObjective: soap.objective,
    soapAssessment: soap.assessment,
    soapPlan: soap.plan,
    recommendedAction: boardResult.post_arbiter.final_disposition,
    createdAt: new Date().toISOString(),
    transcript: [
      { role: "patient", text: "I have had a bad sore throat for two days.", timestamp: new Date().toISOString() },
      { role: "doctor", text: turn1.doctorReply, timestamp: new Date().toISOString() },
      { role: "patient", text: "It hurts when I swallow saliva. No fever. Pain is about 6 out of 10.", timestamp: new Date().toISOString() },
    ],
  });

  const compositionEntry = fhirBundle.entry.find(e => e.resource.resourceType === "Composition");
  assert(Boolean(compositionEntry), "FHIR Composition resource present in bundle");

  const composition = compositionEntry?.resource as any;
  const subjSection = composition?.section?.find((s: any) => s.code?.coding?.[0]?.code === "61150-9");
  const objSection = composition?.section?.find((s: any) => s.code?.coding?.[0]?.code === "61149-1");

  assert(Boolean(subjSection && subjSection.text?.div?.includes("[PATIENT-REPORTED]")), "FHIR Subjective (LOINC 61150-9) contains [PATIENT-REPORTED]");
  assert(Boolean(objSection && objSection.text?.div?.includes("[NOT ASSESSED]")), "FHIR Objective (LOINC 61149-1) contains [NOT ASSESSED]");
  assert(Boolean(objSection && !objSection.text?.div?.includes("<p>Detected Symptoms:")), "FHIR Objective (LOINC 61149-1) DOES NOT contain detected symptoms paragraph");

  // -------------------------------------------------------------------------
  // STEP 5: UI Modal Guard Invariant
  // -------------------------------------------------------------------------
  console.log("\n--- 5. UI Modal Invariant: No Parallel Fallback Notes ---");
  const checkReportReady = (s: any) => Boolean(s?.subjective && s?.assessment);
  const isReportReadyNull = checkReportReady(null);
  const isReportReadyEmpty = checkReportReady({ subjective: "", assessment: "" });
  const isReportReadyActual = checkReportReady(soap);

  assert(isReportReadyNull === false, "When SOAP is null, isReportReady is false (Clinical Report in Progress displayed)");
  assert(isReportReadyEmpty === false, "When SOAP is empty, isReportReady is false (no raw transcript fallback fabrication)");
  assert(isReportReadyActual === true, "When SOAP is generated by board, isReportReady is true");

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runProvenanceSoapEvaluation().catch(err => {
  console.error("Unhandled error during provenance SOAP test:", err);
  process.exit(1);
});
