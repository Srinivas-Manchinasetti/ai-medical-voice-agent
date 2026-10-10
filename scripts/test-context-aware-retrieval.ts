import { clinicalKnowledgeRetriever } from "../lib/clinical-knowledge/retriever";
import { PatientProfileManager } from "../lib/patient/profile";
import { PatientProfile, CurrentEncounter } from "../lib/clinical-knowledge/types";
import { evaluatePharmacologySafetyShield } from "../lib/clinical-knowledge/safety-matrix";
import { evaluateSafetyArbiter } from "../lib/triage/safety-arbiter";
import { normalizeClinicalSymptoms } from "../lib/clinical-knowledge/synonyms";
import { sanitizeDosageVerbalization } from "../lib/triage/response-planner";

async function runContextAwareRetrievalTests() {
  console.log("==============================================================================");
  console.log("     CONTEXT-AWARE, POPULATION-SENSITIVE & PHARMA-SAFETY EVALUATION           ");
  console.log("==============================================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Pediatric vs Adult Abdominal Presentation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 1] Scenario: 8-year-old Child with Abdominal Pain vs Unspecified Patient");
  const pediatricProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-peds-01"),
    age: 8,
    ageGroup: PatientProfileManager.computeAgeGroup(8),
    sexAssignedAtBirth: "male",
  };

  const pedsEncounter: CurrentEncounter = {
    chiefComplaint: "abdominal pain",
    onset: "yesterday",
    associatedSymptoms: ["diarrhea", "nausea"],
    exposures: ["school cafeteria"],
    recentMedications: [],
  };

  const pedsResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "abdominal pain diarrhea",
    domain: "general",
    patient: pediatricProfile,
    encounter: pedsEncounter,
    topK: 5,
  });

  assert(pedsResult.patientContextApplied === true, "Patient context is flagged as applied");
  assert(pedsResult.passages.length > 0, "Retrieved candidate passages for pediatric presentation");
  
  const hasPediatricScoring = pedsResult.passages.some(
    p => p.domain === "pediatrics" ||
         (p.population && p.population.includes("pediatric")) ||
         /pediatric|child|infant/i.test(p.title + " " + p.content)
  );
  assert(hasPediatricScoring, "Retriever prioritized or surfaced pediatric-compatible clinical evidence");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: 67-year-old on NSAID (Ibuprofen) with Peptic Ulcer History
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 2] Scenario: 67-year-old on NSAIDs with Abdominal Pain & Peptic Ulcer History");
  const elderlyProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-geriatric-02"),
    age: 67,
    ageGroup: PatientProfileManager.computeAgeGroup(67),
    sexAssignedAtBirth: "female",
    knownConditions: ["peptic ulcer", "osteoarthritis"],
    currentMedications: [
      { name: "ibuprofen", brandName: "Advil", dose: "600mg", frequency: "TID" },
    ],
    drugAllergies: [],
  };

  const elderlyResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "abdominal pain burning epigastric",
    domain: "gastroenterology",
    patient: elderlyProfile,
    topK: 5,
  });

  const matchedUlcerOrMeds = elderlyResult.passages.some(
    p => /ulcer|peptic|stomach/i.test(p.title + " " + p.content)
  );
  assert(matchedUlcerOrMeds, "Retriever prioritized peptic ulcer comorbidity in gastroenterology passages");
  assert(elderlyProfile.ageGroup === "older_adult", "Patient age 67 correctly categorized as older_adult");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Deterministic Safety Arbiter Penicillin Allergy Blocking
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 3] Scenario: Penicillin Allergy Safety Shield (Arbiter Rule, not Retrieval Boost)");
  const allergyProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-allergy-03"),
    age: 34,
    ageGroup: "adult",
    allergyStatus: "confirmed",
    drugAllergies: [
      {
        drugName: "penicillin",
        reactionType: "allergy",
        severity: "severe",
        reactionDescription: "anaphylaxis and urticaria",
      },
    ],
  };

  // Candidate advice recommending amoxicillin/Augmentin to allergic patient
  const candidateAdviceAmox = "You should start taking Augmentin (amoxicillin with clavulanate) 625mg twice daily.";
  const allergyShieldResult = evaluatePharmacologySafetyShield(allergyProfile, candidateAdviceAmox);
  assert(allergyShieldResult.isSafe === false, "Safety shield blocked Augmentin for penicillin-allergic patient");
  assert(allergyShieldResult.alerts.some(a => a.category === "allergy" && a.actionRequired === "block"), "Allergy alert created with actionRequired = 'block'");

  // Evaluated through Safety Arbiter
  const arbiterAllergyEval = evaluateSafetyArbiter({
    rawText: "I have a sore throat and fever",
    patientProfile: allergyProfile,
    candidateAdvice: candidateAdviceAmox,
  });
  assert(arbiterAllergyEval.redFlagsTriggered.some(f => f.includes("CRITICAL_CONTRAINDICATION_ALLERGY")), "Safety Arbiter triggered CRITICAL_CONTRAINDICATION_ALLERGY red flag");
  assert(arbiterAllergyEval.matchedRules.some(r => r.includes("PHARMA-BLOCK: allergy")), "Arbiter recorded PHARMA-BLOCK rule");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Lethal Drug-Drug Interaction (Nitrates + Sildenafil / Penegra)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 4] Scenario: Lethal Drug-Drug Interaction (Nitrates + PDE5 Inhibitor)");
  const sildenafilProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-ddi-04"),
    age: 58,
    ageGroup: "adult",
    currentMedications: [
      { name: "sildenafil", brandName: "Penegra", dose: "50mg", frequency: "PRN" },
    ],
  };

  const nitrateCandidate = "Take Sorbitrate (nitroglycerin) sublingually for chest tightness.";
  const ddiShieldResult = evaluatePharmacologySafetyShield(sildenafilProfile, nitrateCandidate);
  assert(ddiShieldResult.isSafe === false, "Safety shield blocked Sorbitrate (nitrate) for patient on Penegra (sildenafil)");
  assert(ddiShieldResult.alerts.some(a => a.category === "drug_interaction" && a.actionRequired === "block"), "DDI alert generated with actionRequired = 'block'");

  const arbiterDdiEval = evaluateSafetyArbiter({
    rawText: "I have chest tightness",
    patientProfile: sildenafilProfile,
    candidateAdvice: nitrateCandidate,
  });
  assert(arbiterDdiEval.redFlagsTriggered.some(f => f.includes("CRITICAL_CONTRAINDICATION_DRUG_INTERACTION")), "Arbiter recorded CRITICAL_CONTRAINDICATION_DRUG_INTERACTION");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Teratogenicity & Pregnancy Safety Shield
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 5] Scenario: Teratogen / NSAID Blocking in Confirmed Pregnancy");
  const pregnantProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-preg-05"),
    age: 29,
    ageGroup: "adult",
    pregnancyStatus: "pregnant",
  };

  const nsaidCandidate = "Take Combiflam (ibuprofen with paracetamol) for your severe headache.";
  const pregShieldResult = evaluatePharmacologySafetyShield(pregnantProfile, nsaidCandidate);
  assert(pregShieldResult.isSafe === false, "Safety shield blocked Combiflam (NSAID) in pregnant patient");
  assert(pregShieldResult.alerts.some(a => a.category === "pregnancy" && a.actionRequired === "block"), "Pregnancy contraindication alert created with actionRequired = 'block'");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Cross-Specialty Differential (No -10 Penalty for GERD in Chest Pain)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 6] Scenario: Cross-Specialty Differentials (Cardiology Query surfaces GERD / Esophageal guidance)");
  const chestPainResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "chest pain burning behind breastbone after eating",
    domain: "cardiology",
    topK: 6,
  });

  assert(chestPainResult.passages.length > 0, "Retrieved passages for burning chest pain");
  const hasEsophagealOrGerd = chestPainResult.passages.some(
    p => /esophag|gerd|reflux|acid/i.test(p.title + " " + p.content)
  );
  assert(hasEsophagealOrGerd, "Cross-specialty differential preserved: esophageal/GERD passages surfaced despite domain=cardiology");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: Multilingual Clinical Concept Normalization (English, Hinglish, Telugu)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 7] Scenario: Multilingual Concept Normalization");
  const hinglishTest = normalizeClinicalSymptoms("Mera pet dard kar raha hai aur loose motions ho rahe hain");
  assert(hinglishTest.detectedConcepts.includes("abdominal pain"), "Hinglish 'pet dard' mapped to canonical 'abdominal pain'");
  assert(hinglishTest.detectedConcepts.includes("diarrhea"), "Hinglish 'loose motions' mapped to canonical 'diarrhea'");

  const teluguTest = normalizeClinicalSymptoms("Naku gunde noppi ga undi mariyu aayasam ga undi");
  assert(teluguTest.detectedConcepts.includes("chest pain"), "Telugu 'gunde noppi' mapped to canonical 'chest pain'");
  assert(teluguTest.detectedConcepts.includes("shortness of breath"), "Telugu 'aayasam' mapped to canonical 'shortness of breath'");

  // Direct retriever check with colloquial query
  const colloquialResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "pet me dard hai loose motions",
    domain: "gastroenterology",
    topK: 4,
  });
  const surfacesDiarrheaOrGI = colloquialResult.passages.some(p => /diarrhea|dehydration|ors|oral rehydration|gastro/i.test(p.title + " " + p.content));
  assert(surfacesDiarrheaOrGI, "Colloquial Hinglish query retrieved standard GI diarrhea/rehydration guidelines");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: Anti-Dosage Verbalization Guard
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 8] Scenario: Anti-Dosage Verbalization Guard");
  const unsafeDoctorPrescription = "You can take 650mg of paracetamol or take 2 tablets of Combiflam every 8 hours.";
  const sanitizedDoctorSpoken = sanitizeDosageVerbalization(unsafeDoctorPrescription);
  assert(!/\b650\s*mg\b/i.test(sanitizedDoctorSpoken), "Numerical dosage 650mg sanitized from spoken output");
  assert(!/\btake 2 tablets\b/i.test(sanitizedDoctorSpoken), "Specific tablet count instructions sanitized from spoken output");
  assert(sanitizedDoctorSpoken.includes("[prescribed amount]") || sanitizedDoctorSpoken.includes("prescribed"), "Replaced with safe doctor-prescribed phrasing");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 9: MoHFW India Standard Treatment Guidelines (STGs) Presence
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 9] Scenario: MoHFW India STG Coverage (Dengue, Malaria, Acute Diarrhea)");
  const dengueResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "dengue high fever severe body ache retro-orbital pain",
    domain: "infectious_disease",
    topK: 3,
  });
  const hasDengueSTG = dengueResult.passages.some(p => p.id === "GUIDELINE-MOHFW-ID-DENGUE-001");
  assert(hasDengueSTG, "MoHFW NVBDCP Dengue Clinical Management Guideline retrieved as top evidence");

  const diarrheaResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "acute diarrhea watery stools dehydration zinc",
    domain: "gastroenterology",
    topK: 8,
  });
  const hasDiarrheaSTG = diarrheaResult.passages.some(p => p.id === "GUIDELINE-MOHFW-GI-DIARRHEA-001");
  assert(hasDiarrheaSTG, "MoHFW India Acute Diarrhea & ORS Management Guideline retrieved");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 10: Backward Compatibility Guarantee with retrieveKnowledge()
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 10] Scenario: Backward Compatibility with retrieveKnowledge()");
  const legacyResult = clinicalKnowledgeRetriever.retrieveKnowledge("sudden weakness facial droop", "neurology", { topK: 3 });
  assert(legacyResult.passages.length === 3, "Legacy retrieveKnowledge returned exactly requested topK");
  assert(legacyResult.authorityHierarchyApplied === true, "Authority hierarchy applied in legacy signature");
  assert(legacyResult.passages[0].authority === "clinical_guideline", "Clinical guidelines retain top authority in stroke");

  console.log("\n==============================================================================");
  console.log(`BENCHMARK SUMMARY: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("==============================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runContextAwareRetrievalTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
