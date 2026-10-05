import { clinicalKnowledgeRetriever } from "../lib/clinical-knowledge/retriever";
import { PatientProfileManager } from "../lib/patient/profile";
import { PatientProfile, CurrentEncounter } from "../lib/clinical-knowledge/types";

async function runContextAwareRetrievalTests() {
  console.log("==============================================================================");
  console.log("     CONTEXT-AWARE & POPULATION-SENSITIVE CLINICAL RAG EVALUATION             ");
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

  const baselineResult = clinicalKnowledgeRetriever.retrieveKnowledge("abdominal pain diarrhea", "general", { topK: 5 });
  const pedsResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "abdominal pain diarrhea",
    domain: "general",
    patient: pediatricProfile,
    encounter: pedsEncounter,
    topK: 5,
  });

  assert(pedsResult.patientContextApplied === true, "Patient context is flagged as applied");
  assert(pedsResult.passages.length > 0, "Retrieved candidate passages for pediatric presentation");
  
  // Verify pediatric scoring effect
  const hasPediatricScoring = pedsResult.passages.some(
    p => p.domain === "pediatrics" ||
         (p.population && p.population.includes("pediatric")) ||
         /pediatric|child|infant/i.test(p.title + " " + p.content)
  );
  assert(hasPediatricScoring, "Retriever prioritized or surfaced pediatric-compatible clinical evidence");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: 67-year-old on NSAID (Ibuprofen) with Peptic Ulcer History
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 2] Scenario: 67-year-old on NSAIDs with Abdominal Pain");
  const elderlyProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-geriatric-02"),
    age: 67,
    ageGroup: PatientProfileManager.computeAgeGroup(67),
    sexAssignedAtBirth: "female",
    knownConditions: ["peptic_ulcer", "osteoarthritis"],
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
    p => /ulcer|ibuprofen|peptic|stomach/i.test(p.title + " " + p.content)
  );
  assert(matchedUlcerOrMeds, "Retriever prioritized peptic ulcer / NSAID-relevant gastroenterology passages");
  assert(elderlyProfile.ageGroup === "older_adult", "Patient age 67 correctly categorized as older_adult");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Medication Allergy Awareness (Penicillin Allergy)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 3] Scenario: Patient with Penicillin Allergy");
  const allergyProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-allergy-03"),
    age: 34,
    ageGroup: "adult",
    drugAllergies: [
      {
        drugName: "penicillin",
        reactionType: "allergy",
        severity: "severe",
        reaction: "anaphylaxis and urticaria",
      },
    ],
  };

  const allergyResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "strep throat bacterial pharyngitis antibiotics",
    domain: "ent",
    patient: allergyProfile,
    topK: 5,
  });

  assert(allergyResult.passages.length > 0, "Retrieved candidate guidance for pharyngitis");
  assert(allergyResult.patientContextApplied === true, "Patient allergy context acknowledged in retrieval output");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Pregnancy Safety Filtering
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 4] Scenario: Pregnant Patient with Headache");
  const pregnantProfile: PatientProfile = {
    ...PatientProfileManager.createEmpty("user-preg-04"),
    age: 29,
    ageGroup: "adult",
    pregnancyStatus: "pregnant",
  };

  const pregnantResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "severe headache migraine nausea",
    domain: "neurology",
    patient: pregnantProfile,
    topK: 5,
  });

  assert(pregnantResult.passages.length > 0, "Retrieved migraine & headache passages");
  assert(pregnantResult.patientContextApplied === true, "Pregnancy status factored into context retrieval");

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: High Acuity & Emergency Modulation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 5] Scenario: High Acuity Acute Chest Pain Encounter");
  const acuteResult = clinicalKnowledgeRetriever.retrieveWithContext({
    query: "crushing chest pain radiating to left arm diaphoresis",
    domain: "cardiology",
    encounter: {
      chiefComplaint: "crushing chest pain",
      onset: "20 minutes ago sudden",
      severity: "9/10",
      associatedSymptoms: ["cold sweat", "shortness of breath"],
      exposures: [],
      recentMedications: [],
    },
    topK: 4,
  });

  assert(acuteResult.passages.length > 0, "Retrieved cardiology passages");
  const topPassage = acuteResult.passages[0];
  assert(
    topPassage.section === "symptoms" || topPassage.section === "emergency_guidance",
    "Highest-ranked passage is acute symptoms or emergency guidance under high acuity",
    `Top passage section was: ${topPassage.section}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Backward Compatibility Guarantee
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n[TEST 6] Scenario: Backward Compatibility with retrieveKnowledge()");
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
