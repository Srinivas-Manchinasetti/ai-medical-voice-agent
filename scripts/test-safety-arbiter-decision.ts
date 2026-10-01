/**
 * CLINICAL SAFETY ARBITER & DECISION ENGINE VERIFICATION SUITE
 * 
 * Tests the 6 clinical safety requirements across 12 scenario categories:
 *  1. Clear emergency (ESI-1 / ESI-2 immediate escalation)
 *  2. Clear non-emergency (ESI-4 / ESI-5 routine outpatient)
 *  3. Red flag buried in otherwise benign history (stroke/airway not suppressed by cold symptoms)
 *  4. Multiple competing findings (safety precedence: ESI-2 strictly overrides ESI-4)
 *  5. Missing information != negative information (unresolved is never treated as benign)
 *  6. Contradictory findings (device measurement supersedes verbal denial)
 *  7. Patient denial (respected when validly denied and not contradicted)
 *  8. AI-inferred vs patient-reported evidence precedence (patient denial > AI inference)
 *  9. Safety escalation after earlier low priority (turn 1 routine -> turn 2 acute stridor/dyspnea)
 * 10. No fabricated vitals (vitals are never invented when unassessed)
 * 11. No diagnosis inflation (triage priority + syndromic urgency protocol, NOT autonomous definitive diagnosis)
 * 12. Deterministic output for identical state (100% reproducible across multiple executions)
 */

import { evaluateSafetyArbiter, ArbiterResult } from '../lib/triage/safety-arbiter';
import { ClinicalFact, RedFlagDomainAssessment } from '../lib/triage/clinical-state';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (failureDetails) console.error(`     Details: ${failureDetails}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runSafetyArbiterSuite() {
  console.log('\n' + '='.repeat(80));
  console.log('       MEDVOICE AI CLINICAL SAFETY ARBITER DECISION ENGINE TEST SUITE');
  console.log('       Verifying 6 Clinical Invariants Across 12 Rigorous Scenario Categories');
  console.log('='.repeat(80) + '\n');

  // =========================================================================
  // SCENARIO 1: Clear Emergency (ESI 1 / ESI 2)
  // =========================================================================
  console.log('--- [SCENARIO 1] Clear Emergency (ESI 1 / ESI 2) ---');
  {
    // ESI 1: Stridor & severe airway compromise
    const stridorFact: ClinicalFact = {
      id: 'f-1',
      name: 'stridor',
      label: 'Stridor',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'High-pitched inspiratory sound',
      confidence: 1.0,
      source: 'clinician',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const res1 = evaluateSafetyArbiter({
      facts: [stridorFact],
      rawText: 'Patient is making high pitched choking sounds when breathing in',
    });

    assert(res1.esiScore === 1, 'ESI 1 assigned for critical airway compromise / stridor');
    assert(res1.isEmergency === true, 'isEmergency is true for ESI 1');
    assert(res1.triageLevel === 'emergency', 'triageLevel is emergency');
    assert(res1.redFlagsTriggered.some(r => r.includes('AIRWAY') || r.includes('COLLAPSE')), 'Airway collapse red flag triggered');

    // ESI 2: Crushing chest pressure + left arm radiation
    const chestPressureFact: ClinicalFact = {
      id: 'f-2',
      name: 'chest_pressure',
      label: 'Crushing chest pressure',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Like an elephant sitting on chest',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };
    const armRadFact: ClinicalFact = {
      id: 'f-3',
      name: 'radiation_arm',
      label: 'Radiation to left arm',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Radiating down left arm',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const res2 = evaluateSafetyArbiter({
      facts: [chestPressureFact, armRadFact],
    });

    assert(res2.esiScore === 2, 'ESI 2 assigned for acute coronary syndrome symptoms');
    assert(res2.isEmergency === true, 'isEmergency is true for ESI 2');
    assert(res2.triageLevel === 'emergency', 'triageLevel is emergency for ACS');
  }

  // =========================================================================
  // SCENARIO 2: Clear Non-Emergency (ESI 4 / ESI 5)
  // =========================================================================
  console.log('\n--- [SCENARIO 2] Clear Non-Emergency (ESI 4 / ESI 5) ---');
  {
    // ESI 5: Prescription refill
    const refillFact: ClinicalFact = {
      id: 'f-refill',
      name: 'prescription_refill',
      label: 'Prescription refill',
      category: 'relevant_history',
      status: 'present',
      value: 'Metformin 500mg',
      normalizedText: 'Needs blood pressure and diabetes refill',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const resRefill = evaluateSafetyArbiter({
      facts: [refillFact],
      rawText: 'I just need a refill on my blood pressure medications',
    });

    assert(resRefill.esiScore === 5, 'ESI 5 assigned for prescription refill');
    assert(resRefill.triageLevel === 'routine', 'triageLevel is routine for ESI 5');
    assert(resRefill.isEmergency === false, 'isEmergency is false for prescription refill');

    // ESI 4: Mild cold with runny nose
    const resCold = evaluateSafetyArbiter({
      rawText: 'I have a mild runny nose and scratchy throat since yesterday',
    });

    assert(resCold.esiScore === 4, 'ESI 4 assigned for mild URI symptoms');
    assert(resCold.triageLevel === 'routine', 'triageLevel is routine for mild URI');
    assert(resCold.isEmergency === false, 'isEmergency is false for mild URI');
  }

  // =========================================================================
  // SCENARIO 3: Red Flag Buried in Otherwise Benign History
  // =========================================================================
  console.log('\n--- [SCENARIO 3] Red Flag Buried in Otherwise Benign History ---');
  {
    // Patient gives 3 paragraphs of mild cold history, but has unilateral facial droop
    const facialDroopFact: ClinicalFact = {
      id: 'f-stroke',
      name: 'facial_droop',
      label: 'Facial droop',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Right side of face is drooping',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const benignTranscript = 
      'I caught a mild cold 3 days ago. Runny nose, sneezing, a little tickle in my throat. ' +
      'I took some tea and honey which helped. But this morning my wife noticed the right side ' +
      'of my face is drooping when I smile, and I feel a little off.';

    const resBuried = evaluateSafetyArbiter({
      facts: [facialDroopFact],
      rawText: benignTranscript,
    });

    assert(resBuried.esiScore === 2, 'ESI 2 assigned despite extensive benign cold history');
    assert(resBuried.isEmergency === true, 'Buried red flag forces isEmergency = true');
    assert(resBuried.triageLevel === 'emergency', 'triageLevel escalated to emergency');
    assert(resBuried.redFlagsTriggered.some(r => r.includes('STROKE') || r.includes('BE_FAST')), 'BE-FAST acute stroke red flag triggered');
  }

  // =========================================================================
  // SCENARIO 4: Multiple Competing Findings (Safety Precedence)
  // =========================================================================
  console.log('\n--- [SCENARIO 4] Multiple Competing Findings (Safety Precedence) ---');
  {
    // Patient has mild ankle sprain (routine ESI 4) AND acute crushing chest pressure (ESI 2)
    const sprainFact: ClinicalFact = {
      id: 'f-sprain',
      name: 'minor_sprain',
      label: 'Twisted ankle',
      category: 'associated_symptom',
      status: 'present',
      value: true,
      normalizedText: 'Mildly twisted ankle walking the dog',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };
    const chestFact: ClinicalFact = {
      id: 'f-chest',
      name: 'chest_pressure',
      label: 'Chest pressure',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Heavy crushing chest pressure',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const resCompeting = evaluateSafetyArbiter({
      facts: [sprainFact, chestFact],
      rawText: 'I twisted my ankle earlier, and now I have heavy crushing chest pressure',
    });

    assert(resCompeting.esiScore === 2, 'ESI 2 strictly overrides ESI 4 when competing findings exist');
    assert(resCompeting.isEmergency === true, 'Safety precedence forces emergency disposition');
  }

  // =========================================================================
  // SCENARIO 5: Missing Information != Negative Information
  // =========================================================================
  console.log('\n--- [SCENARIO 5] Missing Information != Negative Information ---');
  {
    // Screening incomplete: red flags for airway, cardiac, and neurological are pending
    const redFlags: Record<string, RedFlagDomainAssessment> = {
      airway: { domain: 'airway', label: 'Airway & breathing', assessed: false, status: 'pending' },
      breathing: { domain: 'breathing', label: 'Respiratory distress', assessed: false, status: 'pending' },
      cardiac: { domain: 'cardiac', label: 'Acute coronary / hemodynamic', assessed: false, status: 'pending' },
      neurological: { domain: 'neurological', label: 'Focal neurological deficit (BE-FAST)', assessed: false, status: 'pending' },
      bleeding: { domain: 'bleeding', label: 'Active hemorrhage / hemoptysis', assessed: false, status: 'pending' },
    };

    const resMissing = evaluateSafetyArbiter({
      rawText: 'I have had a mild dry cough for two days',
      redFlags,
    });

    assert(resMissing.isScreeningComplete === false, 'isScreeningComplete is false when core domains are pending');
    assert(resMissing.unresolvedRedFlags.length >= 3, 'unresolvedRedFlags tracks pending domains');
    assert(resMissing.clinicalProtocol.includes('Screening Note'), 'Protocol warns that life threats are not definitively excluded');
  }

  // =========================================================================
  // SCENARIO 6: Contradictory Findings (Device Supersedes Patient Denial)
  // =========================================================================
  console.log('\n--- [SCENARIO 6] Contradictory Findings (Device Supersedes Patient Denial) ---');
  {
    // Fact 1: Patient says "No fever" (patient_reported, absent)
    const patientDenial: ClinicalFact = {
      id: 'f-fever-pt',
      name: 'fever',
      label: 'Fever',
      category: 'associated_symptom',
      status: 'absent',
      value: false,
      normalizedText: 'Denied: fever',
      confidence: 0.9,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    // Fact 2: Thermometer reads 39.8°C (device_measured, present)
    const deviceMeasurement: ClinicalFact = {
      id: 'f-fever-dev',
      name: 'fever',
      label: 'High fever',
      category: 'red_flag',
      status: 'present',
      value: 39.8,
      normalizedText: 'Device measured: 39.8°C',
      confidence: 1.0,
      source: 'device_measured',
      turnId: 2,
      timestamp: new Date().toISOString(),
    };

    const resContradiction = evaluateSafetyArbiter({
      facts: [patientDenial, deviceMeasurement],
    });

    assert(resContradiction.esiScore === 3, 'ESI 3 assigned because device measurement overrode verbal denial');
    assert(resContradiction.provenanceSummary?.contradictionsResolved === 1, 'Contradiction was successfully tracked and resolved');
    assert(resContradiction.provenanceSummary?.highestProvenance === 'device_measured', 'Highest provenance recorded as device_measured');
  }

  // =========================================================================
  // SCENARIO 7: Patient Denial (Properly Respected When Validly Denied)
  // =========================================================================
  console.log('\n--- [SCENARIO 7] Patient Denial (Properly Respected When Validly Denied) ---');
  {
    // Transcript mentions "chest pain" in context of family history, but patient fact explicitly denies it
    const chestDenialFact: ClinicalFact = {
      id: 'f-chest-denied',
      name: 'chest_pain',
      label: 'Chest pain',
      category: 'red_flag',
      status: 'absent',
      value: false,
      normalizedText: 'Explicitly denied chest pain or pressure',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const resDenial = evaluateSafetyArbiter({
      facts: [chestDenialFact],
      rawText: 'My uncle had sudden chest pain and died last year. But I have no chest pain whatsoever, just an ankle twist.',
    });

    assert(resDenial.esiScore >= 4, 'ESI 4 or 5 assigned because structured patient denial prevented false chest pain escalation');
    assert(resDenial.isEmergency === false, 'isEmergency remains false when symptom is validly denied');
  }

  // =========================================================================
  // SCENARIO 8: AI-Inferred vs Patient-Reported Evidence Precedence
  // =========================================================================
  console.log('\n--- [SCENARIO 8] AI-Inferred vs Patient-Reported Evidence Precedence ---');
  {
    // AI inference weakly hypothesizes chest pain
    const aiInferredFact: ClinicalFact = {
      id: 'f-ai-inf',
      name: 'chest_pain',
      label: 'Chest pain',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Weak AI heuristic inference',
      confidence: 0.4,
      source: 'ai_inferred',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    // Patient explicitly denies chest pain
    const patientDenialFact: ClinicalFact = {
      id: 'f-pt-deny',
      name: 'chest_pain',
      label: 'Chest pain',
      category: 'red_flag',
      status: 'absent',
      value: false,
      normalizedText: 'Explicitly denied by patient',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 2,
      timestamp: new Date().toISOString(),
    };

    const resPrecedence = evaluateSafetyArbiter({
      facts: [aiInferredFact, patientDenialFact],
      rawText: 'I do not have any chest pain.',
    });

    assert(resPrecedence.esiScore >= 4, 'Patient reported denial (rank 3) overrides AI inference (rank 1)');
    assert(resPrecedence.isEmergency === false, 'AI inference cannot override direct patient denial');
  }

  // =========================================================================
  // SCENARIO 9: Safety Escalation After Earlier Low Priority
  // =========================================================================
  console.log('\n--- [SCENARIO 9] Safety Escalation After Earlier Low Priority ---');
  {
    // Turn 1: Patient has mild sore throat
    const turn1Fact: ClinicalFact = {
      id: 'f-t1',
      name: 'throat_pain',
      label: 'Throat pain',
      category: 'symptom_profile',
      status: 'present',
      value: 'mild',
      normalizedText: 'Mild throat scratchiness',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const evalTurn1 = evaluateSafetyArbiter({
      facts: [turn1Fact],
      rawText: 'Just a scratchy throat for 2 days',
    });
    assert(evalTurn1.esiScore === 4, 'Turn 1: Correctly triaged as ESI 4 routine');

    // Turn 2: Stridor develops / is observed
    const turn2Fact: ClinicalFact = {
      id: 'f-t2',
      name: 'stridor',
      label: 'Stridor',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'High pitched inspiratory whistling',
      confidence: 1.0,
      source: 'clinician',
      turnId: 2,
      timestamp: new Date().toISOString(),
    };

    const evalTurn2 = evaluateSafetyArbiter({
      facts: [turn1Fact, turn2Fact],
      rawText: 'Just a scratchy throat for 2 days, but now making high pitched whistling sounds when inhaling',
    });

    assert(evalTurn2.esiScore === 1, 'Turn 2: Escalates immediately to ESI 1');
    assert(evalTurn2.isEmergency === true, 'Turn 2: isEmergency becomes true');
    assert(evalTurn2.triageLevel === 'emergency', 'Turn 2: triageLevel becomes emergency');
  }

  // =========================================================================
  // SCENARIO 10: No Fabricated Vitals
  // =========================================================================
  console.log('\n--- [SCENARIO 10] No Fabricated Vitals ---');
  {
    // Unassessed vitals (empty vitals record)
    const resNoVitals = evaluateSafetyArbiter({
      rawText: 'I have had a mild headache since this morning',
      vitals: {},
    });

    // Arbiter should not invent fictitious vitals or trigger highFever/hypoxia without evidence
    assert(resNoVitals.esiScore === 4, 'Baseline headache without vitals stays ESI 4');
    assert(!resNoVitals.detectedSymptoms.some(s => /SpO2|High fever measured/i.test(s)), 'No fabricated vitals detected in symptoms');
  }

  // =========================================================================
  // SCENARIO 11: No Diagnosis Inflation
  // =========================================================================
  console.log('\n--- [SCENARIO 11] No Diagnosis Inflation ---');
  {
    // Emergent ACS case: verify output is triage priority + clinical protocol, NOT uncertified definitive diagnosis
    const acsFact1: ClinicalFact = {
      id: 'f-acs1',
      name: 'chest_pressure',
      label: 'Crushing chest pressure',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Crushing elephant on chest',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };
    const acsFact2: ClinicalFact = {
      id: 'f-acs2',
      name: 'radiation_arm',
      label: 'Radiation to left arm',
      category: 'red_flag',
      status: 'present',
      value: true,
      normalizedText: 'Radiation to left arm',
      confidence: 1.0,
      source: 'patient_reported',
      turnId: 1,
      timestamp: new Date().toISOString(),
    };

    const resAcs = evaluateSafetyArbiter({
      facts: [acsFact1, acsFact2],
    });

    // Title should emphasize ESI level, emergent protocol, and rule-out / suspected syndrome
    assert(resAcs.esiTitle.startsWith('ESI LEVEL 2: EMERGENT'), 'esiTitle specifies ESI level and urgency');
    assert(resAcs.esiTitle.includes('Protocol') || resAcs.esiTitle.includes('Suspected'), 'esiTitle designates a triage protocol, not a definitive diagnosis');
    // Must NOT state "Diagnosis: Acute Anterior Myocardial Infarction"
    assert(!resAcs.esiTitle.includes('Confirmed Acute Anterior Myocardial Infarction'), 'No uncertified definitive diagnosis claim');
    assert(resAcs.clinicalProtocol.includes('Urgent 12-lead ECG'), 'Protocol directs standard emergency diagnostic pathway');
  }

  // =========================================================================
  // SCENARIO 12: Deterministic Output for Identical State
  // =========================================================================
  console.log('\n--- [SCENARIO 12] Deterministic Output for Identical State ---');
  {
    const testInput = {
      rawText: 'Sudden onset severe chest tightness with sweating and nausea',
      facts: [
        {
          id: 'det-1',
          name: 'chest_pressure',
          label: 'Severe chest tightness',
          category: 'red_flag' as const,
          status: 'present' as const,
          value: true,
          normalizedText: 'Severe chest tightness',
          confidence: 1.0,
          source: 'patient_reported' as const,
          turnId: 1,
          timestamp: '2026-10-01T00:00:00Z',
        },
      ],
      llmSuggestedLevel: 'routine',
    };

    const run1 = evaluateSafetyArbiter(testInput);
    for (let i = 2; i <= 25; i++) {
      const runN = evaluateSafetyArbiter(testInput);
      assert(runN.esiScore === run1.esiScore, `Run ${i} matches ESI score (${run1.esiScore})`);
      assert(runN.esiTitle === run1.esiTitle, `Run ${i} matches ESI title`);
      assert(runN.triageLevel === run1.triageLevel, `Run ${i} matches triage level`);
      assert(runN.isEmergency === run1.isEmergency, `Run ${i} matches emergency boolean`);
      assert(runN.arbiterOverride === run1.arbiterOverride, `Run ${i} matches arbiter override`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`   🎉 ALL ${passedTests} / ${totalTests} CLINICAL SAFETY ARBITER INVARIANTS PASSED 100%!`);
  console.log('='.repeat(80) + '\n');
}

runSafetyArbiterSuite().catch((err) => {
  console.error('[FATAL SUITE ERROR]:', err);
  process.exit(1);
});
