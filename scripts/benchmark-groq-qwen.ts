import { config } from "dotenv";
config(); // Load .env

import { groqClient, GroqChatMessage } from "../lib/ai/groq-client";
import { validateDoctorReplyTarget, parseAndSanitizeDoctorReply } from "../lib/ai/clinical-llm";
import { ResponsePlan } from "../lib/triage/response-planner";

interface SamplePrompt {
  name: string;
  targetSlot: string;
  plan: ResponsePlan;
  messages: GroqChatMessage[];
}

const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    name: "Pharyngitis Onset Pattern",
    targetSlot: "onset_pattern",
    plan: {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: "Screen onset acuity",
      mustAvoidAsking: ["duration", "two days"],
      nextHighValueInquiry: {
        topic: "onset_pattern",
        clinicalRationale: "Distinguish sudden vs gradual onset",
        suggestedPhrasing: "Did it come on suddenly, or did it gradually get worse?"
      },
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: "Did it come on suddenly, or did it gradually get worse?"
    },
    messages: [
      {
        role: "system",
        content: `You are Dr. Sarah Chen, MD.
CLINICAL CONTEXT: Sore throat for two days.
TARGET INQUIRY (MANDATORY): "onset_pattern" (Distinguish sudden vs gradual onset)
Suggested phrasing: "Did it come on suddenly, or did it gradually get worse?"
FORBIDDEN TOPICS (DO NOT ASK): duration, two days
Ask exactly 1 focused question in 15-25 words.
OUTPUT FORMAT (JSON ONLY):
{"patientResponse": "<1-2 short spoken sentences>"}`
      },
      { role: "user", content: "I have had a bad sore throat for two days." }
    ]
  },
  {
    name: "Mechanical Dysphagia Screening",
    targetSlot: "swallowing_difficulty",
    plan: {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: "Screen mechanical swallowing",
      mustAvoidAsking: ["fever", "duration"],
      nextHighValueInquiry: {
        topic: "swallowing_difficulty",
        clinicalRationale: "Screen for mechanical obstruction or inability to swallow fluids",
        suggestedPhrasing: "When you say it hurts to swallow, are you still able to swallow liquids and saliva normally?"
      },
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: "When you say it hurts to swallow, are you still able to swallow liquids and saliva normally?"
    },
    messages: [
      {
        role: "system",
        content: `You are Dr. Sarah Chen, MD.
CLINICAL CONTEXT: Sore throat, odynophagia.
TARGET INQUIRY (MANDATORY): "swallowing_difficulty" (Screen for mechanical obstruction)
Suggested phrasing: "When you say it hurts to swallow, are you still able to swallow liquids and saliva normally?"
FORBIDDEN TOPICS (DO NOT ASK): fever, duration
Ask exactly 1 focused question in 15-25 words.
OUTPUT FORMAT (JSON ONLY):
{"patientResponse": "<1-2 short spoken sentences>"}`
      },
      { role: "user", content: "It hurts when I swallow." }
    ]
  },
  {
    name: "Chest Pain Character",
    targetSlot: "character",
    plan: {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: "Differentiate pressure vs sharp pain",
      mustAvoidAsking: ["radiation"],
      nextHighValueInquiry: {
        topic: "character",
        clinicalRationale: "Differentiate pressure/squeezing from sharp or pleuritic pain",
        suggestedPhrasing: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, burning, or a sharp pain?"
      },
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, burning, or a sharp pain?"
    },
    messages: [
      {
        role: "system",
        content: `You are Dr. Marcus Vance, Senior Cardiologist.
CLINICAL CONTEXT: Chest discomfort for 30 minutes.
TARGET INQUIRY (MANDATORY): "character" (Differentiate pressure/squeezing from sharp pain)
Suggested phrasing: "Could you describe what the discomfort feels like — is it a tight pressure, squeezing, burning, or a sharp pain?"
FORBIDDEN TOPICS (DO NOT ASK): radiation
Ask exactly 1 focused question in 15-25 words.
OUTPUT FORMAT (JSON ONLY):
{"patientResponse": "<1-2 short spoken sentences>"}`
      },
      { role: "user", content: "I've been feeling this strange discomfort in the center of my chest for 30 minutes." }
    ]
  },
  {
    name: "General Fatigue Severity",
    targetSlot: "severity",
    plan: {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: "Quantify fatigue impact",
      mustAvoidAsking: ["chest pain", "radiation"],
      nextHighValueInquiry: {
        topic: "severity",
        clinicalRationale: "Quantify symptom pain or fatigue intensity",
        suggestedPhrasing: "How severe is that discomfort right now on a scale from zero to ten?"
      },
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: "How severe is that discomfort right now on a scale from zero to ten?"
    },
    messages: [
      {
        role: "system",
        content: `You are Dr. Sarah Chen, MD.
CLINICAL CONTEXT: Low energy and generalized fatigue.
TARGET INQUIRY (MANDATORY): "severity" (Quantify symptom pain or fatigue intensity)
Suggested phrasing: "How severe is that discomfort right now on a scale from zero to ten?"
FORBIDDEN TOPICS (DO NOT ASK): chest pain, radiation
Ask exactly 1 focused question in 15-25 words.
OUTPUT FORMAT (JSON ONLY):
{"patientResponse": "<1-2 short spoken sentences>"}`
      },
      { role: "user", content: "I have just been feeling completely drained and exhausted all week." }
    ]
  },
  {
    name: "Neurology BE-FAST Stroke Screen",
    targetSlot: "neurological_signs",
    plan: {
      primaryGoal: "ADVANCE_CLINICAL_INTAKE",
      conversationalFocus: "Screen stroke signs",
      mustAvoidAsking: ["rash"],
      nextHighValueInquiry: {
        topic: "neurological_signs",
        clinicalRationale: "Screen for BE-FAST stroke signs (facial droop, unilateral arm/leg weakness, speech difficulty)",
        suggestedPhrasing: "Have you noticed any weakness in your arms or legs, facial drooping, or difficulty finding your words?"
      },
      bedsideTone: "attentive_and_methodical",
      suggestedSpokenReply: "Have you noticed any weakness in your arms or legs, facial drooping, or difficulty finding your words?"
    },
    messages: [
      {
        role: "system",
        content: `You are Dr. Arthur Pendelton, Neurology.
CLINICAL CONTEXT: Sudden headache and mild numbness.
TARGET INQUIRY (MANDATORY): "neurological_signs" (Screen for BE-FAST stroke signs)
Suggested phrasing: "Have you noticed any weakness in your arms or legs, facial drooping, or difficulty finding your words?"
FORBIDDEN TOPICS (DO NOT ASK): rash
Ask exactly 1 focused question in 15-25 words.
OUTPUT FORMAT (JSON ONLY):
{"patientResponse": "<1-2 short spoken sentences>"}`
      },
      { role: "user", content: "I got a sudden headache and my left arm feels a little tingling." }
    ]
  }
];

async function runBenchmark() {
  const model = groqClient.getDefaultModel();
  console.log("===============================================================================");
  console.log(`   GROQ CLOUD BENCHMARK HARNESS: ${model}`);
  console.log(`   Measuring Latency (p50, p95), Rate Limits, Concurrency & Target Rejection Rate`);
  console.log("===============================================================================\n");

  if (!groqClient.isConfigured()) {
    console.log("⚠️ GROQ_API_KEY is not configured or kill switch active. Benchmark requires active key.");
    return;
  }

  const TOTAL_CALLS = 50;
  const CONCURRENCY = 5;
  const latencies: number[] = [];
  let successfulCalls = 0;
  let rateLimitCalls = 0;
  let rejectedByValidator = 0;
  let acceptedByValidator = 0;

  console.log(`Executing ${TOTAL_CALLS} calls in batches of ${CONCURRENCY} concurrent requests...\n`);

  for (let i = 0; i < TOTAL_CALLS; i += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_CALLS - i);
    const batchPromises = Array.from({ length: batchSize }, async (_, batchIdx) => {
      const callIndex = i + batchIdx;
      const sample = SAMPLE_PROMPTS[callIndex % SAMPLE_PROMPTS.length];
      const t0 = Date.now();

      try {
        const res = await groqClient.createChatCompletion(sample.messages, {
          model,
          max_tokens: 128,
          temperature: 0.2,
          reasoning_effort: "none",
          timeoutMs: 15000,
        });

        const elapsed = Date.now() - t0;
        latencies.push(elapsed);
        successfulCalls++;

        const { cleanReply } = parseAndSanitizeDoctorReply(res.content, sample.plan.suggestedSpokenReply);
        const validation = validateDoctorReplyTarget(cleanReply, sample.plan);

        if (validation.isValid) {
          acceptedByValidator++;
        } else {
          rejectedByValidator++;
        }

        return { success: true, latency: elapsed, valid: validation.isValid };
      } catch (err: any) {
        const elapsed = Date.now() - t0;
        if (err.status === 429 || err.message?.includes("429") || err.category === "RATE_LIMIT_EXCEEDED") {
          rateLimitCalls++;
        }
        return { success: false, latency: elapsed, error: err.message };
      }
    });

    await Promise.all(batchPromises);
    process.stdout.write(`Completed ${Math.min(i + CONCURRENCY, TOTAL_CALLS)} / ${TOTAL_CALLS} calls...\r`);
    
    // Polite breather between batches to avoid immediate hard 429 burst trips on free tier
    await new Promise(r => setTimeout(r, 600));
  }

  console.log("\n");

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const mean = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const rejectRate = successfulCalls > 0 ? ((rejectedByValidator / successfulCalls) * 100).toFixed(1) : "0.0";

  console.log("===============================================================================");
  console.log("   BENCHMARK RESULTS & METRICS SUMMARY");
  console.log("===============================================================================");
  console.log(`   Model Tested:             ${model}`);
  console.log(`   Total Invocations:        ${TOTAL_CALLS}`);
  console.log(`   Successful Invocations:   ${successfulCalls} (${((successfulCalls / TOTAL_CALLS) * 100).toFixed(1)}%)`);
  console.log(`   HTTP 429 Rate Limits:     ${rateLimitCalls}`);
  console.log(`   ----------------------------------------------------------------------------`);
  console.log(`   Min Latency:              ${min} ms`);
  console.log(`   Mean Latency:             ${mean} ms`);
  console.log(`   Median (p50) Latency:     ${p50} ms`);
  console.log(`   p95 Latency:              ${p95} ms`);
  console.log(`   Max Latency:              ${max} ms`);
  console.log(`   ----------------------------------------------------------------------------`);
  console.log(`   Validator Accepted:       ${acceptedByValidator}`);
  console.log(`   Validator Rejected:       ${rejectedByValidator}`);
  console.log(`   Validator Rejection Rate: ${rejectRate}%`);
  console.log("===============================================================================\n");
}

runBenchmark().catch(err => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
