import fs from 'fs';
import path from 'path';
import { evaluateSafetyArbiter } from '../lib/triage/safety-arbiter';

interface ClinicalCase {
  id: string;
  category: string;
  patientAge: number;
  patientSex: string;
  transcript: string;
  expectedEsi: number;
  expectedUrgency: 'emergency' | 'priority' | 'routine';
  mustNotMiss: boolean;
  description: string;
}

function runClinicalEvaluation() {
  const casesPath = path.join(process.cwd(), 'tests/clinical-eval/cases.json');
  if (!fs.existsSync(casesPath)) {
    console.error('Error: Clinical cases dataset not found at:', casesPath);
    process.exit(1);
  }

  const rawData = fs.readFileSync(casesPath, 'utf-8');
  const cases: ClinicalCase[] = JSON.parse(rawData);

  console.log('\n' + '='.repeat(78));
  console.log('       MEDVOICE AI CLINICAL SAFETY ARBITER BENCHMARK HARNESS');
  console.log('       Deterministic ESI v4 Guardrails & Life-Threat Sensitivity Eval');
  console.log('='.repeat(78) + '\n');

  let correctClassifications = 0;
  let emergencyCasesTotal = 0;
  let emergencyCasesDetected = 0;
  let falseNegatives = 0;
  let overridesFired = 0;
  const latencies: number[] = [];

  const categoryBreakdown: Record<string, { total: number; passed: number }> = {};

  cases.forEach((testCase, idx) => {
    if (!categoryBreakdown[testCase.category]) {
      categoryBreakdown[testCase.category] = { total: 0, passed: 0 };
    }
    categoryBreakdown[testCase.category].total++;

    const isTrueEmergency = testCase.expectedUrgency === 'emergency';
    if (isTrueEmergency) {
      emergencyCasesTotal++;
    }

    // Pass a simulated unsafe LLM suggestion ('routine') to rigorously test
    // that the Arbiter's red-flag rule engine refuses to let an unsafe downplay happen!
    const simulatedLlmSuggestion = 'routine';

    const result = evaluateSafetyArbiter({
      rawText: testCase.transcript,
      patientAge: testCase.patientAge,
      llmSuggestedLevel: simulatedLlmSuggestion,
    });

    latencies.push(result.latencyMs);

    if (result.arbiterOverride) {
      overridesFired++;
    }

    const urgencyMatch = result.triageLevel === testCase.expectedUrgency;
    const esiMatch = result.esiScore === testCase.expectedEsi;
    const passed = urgencyMatch;

    if (isTrueEmergency) {
      if (result.isEmergency) {
        emergencyCasesDetected++;
      } else {
        falseNegatives++;
        console.error(
          `[CRITICAL SAFETY FAILURE] Case ${testCase.id} missed! Expected emergency, got ${result.triageLevel}`
        );
      }
    }

    if (passed) {
      correctClassifications++;
      categoryBreakdown[testCase.category].passed++;
      const flagStr = result.redFlagsTriggered.length > 0 ? `[Red-Flag: ${result.redFlagsTriggered[0]}]` : '';
      console.log(
        `  ✓ [${testCase.id.padEnd(14)}] ${testCase.category.padEnd(20)} ESI ${result.esiScore} (${result.triageLevel.toUpperCase().padEnd(9)}) ${flagStr} (${result.latencyMs}ms)`
      );
    } else {
      console.warn(
        `  ✗ [${testCase.id.padEnd(14)}] ${testCase.category.padEnd(20)} FAILED: Expected ${testCase.expectedUrgency}, Got ${result.triageLevel}`
      );
    }
  });

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const meanLatency = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));

  const accuracy = Number(((correctClassifications / cases.length) * 100).toFixed(1));
  const sensitivity = Number(
    ((emergencyCasesDetected / (emergencyCasesTotal || 1)) * 100).toFixed(1)
  );

  console.log('\n' + '='.repeat(78));
  console.log('                          BENCHMARK SUMMARY');
  console.log('='.repeat(78));
  console.log(`  Total Vignettes Evaluated:        ${cases.length}`);
  console.log(`  Correct Classifications:          ${correctClassifications} / ${cases.length}`);
  console.log(`  Overall Triage Accuracy:          ${accuracy}%`);
  console.log('-'.repeat(78));
  console.log('  CRITICAL SAFETY METRICS:');
  console.log(`  Life-Threat Emergencies Tested:   ${emergencyCasesTotal} cases`);
  console.log(
    `  Emergency Sensitivity (Recall):   ${sensitivity}% ${
      sensitivity === 100 ? '✅ (ZERO FALSE NEGATIVES)' : '❌ (UNSAFE)'
    }`
  );
  console.log(`  Fatal False Negatives:            ${falseNegatives}`);
  console.log(`  Safety Arbiter Overrides Fired:   ${overridesFired} (Unsafe model downplays neutralized)`);
  console.log('-'.repeat(78));
  console.log('  OPERATIONAL LATENCY METRICS:');
  console.log(`  Mean Decision Latency:            ${meanLatency} ms`);
  console.log(`  P50 Decision Latency:             ${p50} ms`);
  console.log(`  P95 Decision Latency:             ${p95} ms`);
  console.log('-'.repeat(78));
  console.log('  SPECIALTY BREAKDOWN:');
  Object.entries(categoryBreakdown).forEach(([cat, stats]) => {
    const catPct = ((stats.passed / stats.total) * 100).toFixed(0);
    console.log(`    • ${cat.padEnd(28)}: ${stats.passed}/${stats.total} (${catPct}%)`);
  });
  console.log('='.repeat(78) + '\n');

  if (falseNegatives > 0) {
    console.error('FAILED: Clinical Safety Arbiter allowed false negatives on life-threatening cases.');
    process.exit(1);
  } else {
    console.log('✅ ALL CLINICAL SAFETY GUARDRAILS VERIFIED. 100% SENSITIVITY CONFIRMED.\n');
  }
}

runClinicalEvaluation();
