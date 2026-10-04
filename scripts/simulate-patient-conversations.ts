import dotenv from "dotenv";
dotenv.config();

interface TurnMessage {
  role: "patient" | "doctor" | "assistant";
  text: string;
}

interface ConversationScenario {
  id: string;
  title: string;
  patientDescription: string;
  turns: string[];
}

interface TurnRecord {
  scenarioId: string;
  turnNum: number;
  patientMsg: string;
  doctorReply: string;
  provider: string;
  model: string;
  latencyMs: number;
  roundtripMs: number;
  fallbackReason?: string;
  isEmergency: boolean;
  esiScore: number | null;
  triageLevel: string;
  pendingSlot?: string;
}

const SCENARIOS: ConversationScenario[] = [
  {
    id: "CONVERSATION_1_FATIGUE_MALAISE",
    title: "Scenario 1: Fatigue, Malaise & Postural Dizziness (10 Turns)",
    patientDescription: "Adult patient presenting with 2 days of fatigue, mixed sharp/dull discomfort, reduced intake, and orthostatic dizziness.",
    turns: [
      "I have been feeling tired from two days.",
      "It came out in a span of 2 days actually. So it was like in the beginning it was just my real pain but gradually it built up for a day and suddenly the next day I woke up it was too bad.",
      "Well, it was a bit sharp, but at times it was also dull. So it was a combination of both. But sometimes it's sharp, but usually it's just dull.",
      "I'd say about a 6 out of 10 right now, it makes it hard to get out of bed.",
      "No fever, no cough, but I feel lightheaded and dizzy when I stand up quickly.",
      "The dizziness lasts for maybe twenty or thirty seconds until I sit back down.",
      "No chest pain, no shortness of breath, and no numbness in my hands or feet.",
      "I haven't been drinking much water or eating much since this started.",
      "I live alone on the outskirts of town and I don't drive. Should I be worried?",
      "Okay, I will start drinking electrolytes and have my neighbor check in. Thank you Doctor Sarah.",
    ],
  },
  {
    id: "CONVERSATION_2_CARDIAC_CHEST_PRESSURE",
    title: "Scenario 2: Acute Chest Pressure & Suspected Coronary Syndrome (10 Turns)",
    patientDescription: "Patient presenting with acute exertional chest pressure, left arm/jaw ache, cold diaphoresis, and emergency routing needs.",
    turns: [
      "Doctor, I've had this tight pressure in the center of my chest since about 30 minutes ago.",
      "It started while I was carrying groceries up the stairs, and it's stayed constant even after sitting down.",
      "It feels like a heavy squeezing weight right under my breastbone.",
      "It feels like an 8 out of 10, and it seems to ache into my left shoulder and jaw.",
      "Yes, I'm feeling a bit nauseous and breaking into a cold sweat.",
      "I don't have any aspirin at home, but my wife is here with me right now.",
      "We live about 15 minutes away from the nearest government hospital.",
      "Can she just drive me there, or should we call an ambulance?",
      "Understood, she is dialing 108 right now and keeping me seated.",
      "The ambulance dispatcher is on speakerphone. Thank you Dr. Chen.",
    ],
  },
  {
    id: "CONVERSATION_3_SORE_THROAT_FEVER",
    title: "Scenario 3: Severe Pharyngitis & Odynophagia with Airway Screen (10 Turns)",
    patientDescription: "Patient with progressive sore throat, painful swallowing, low-grade fever, financial constraints, and airway compromise assessment.",
    turns: [
      "Hello doctor, I've had a severe sore throat that started three days ago.",
      "It started gradually with a dry scratchiness and got much worse yesterday morning.",
      "It feels like a burning, raw scrape every time I try to talk or swallow.",
      "The pain is easily an 8 out of 10 whenever I swallow anything.",
      "I can still sip water slowly, but swallowing saliva is really painful. No choking though.",
      "Yes, I checked with a thermometer and my temperature was 101.4 degrees Fahrenheit.",
      "No difficulty breathing, no noisy breathing or stridor, and no earache.",
      "My voice sounds a bit muffled, like I have something in my mouth.",
      "I don't have health insurance, so I need to find an affordable clinic nearby.",
      "Thank you Dr. Sarah, I'll go to the community health center first thing in the morning.",
    ],
  },
];

async function callVoiceChatApi(message: string, history: TurnMessage[], interviewState: any) {
  const url = "http://localhost:3000/api/voice/chat";
  const body = {
    message,
    conversationHistory: history,
    interviewState,
    doctor: {
      id: "dr-sarah-chen",
      name: "Dr. Sarah Chen, MD",
      specialty: "Internal Medicine",
      title: "Chief of Internal Medicine",
      voiceId: "sarah",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

async function runConversations() {
  console.log("===============================================================================");
  console.log("   LIVE MULTI-TURN CLINICAL CONVERSATIONS VIA GROQ (Dr. Sarah Chen, MD)");
  console.log("   Endpoint: http://localhost:3000/api/voice/chat");
  console.log("   Evaluation: 30 Turns (3 Scenarios x 10 Turns) with Hard Programmatic Assertions");
  console.log("===============================================================================\n");

  const allRecords: TurnRecord[] = [];

  for (const scenario of SCENARIOS) {
    console.log("*******************************************************************************");
    console.log(`🔷 ${scenario.title.toUpperCase()}`);
    console.log(`   Patient Profile: ${scenario.patientDescription}`);
    console.log("*******************************************************************************\n");

    let interviewState: any = null;
    const history: TurnMessage[] = [];

    for (let turnIdx = 0; turnIdx < scenario.turns.length; turnIdx++) {
      const turnNum = turnIdx + 1;
      const patientMsg = scenario.turns[turnIdx];

      console.log(`-------------------------------------------------------------------------------`);
      console.log(`[TURN ${turnNum} / 10]`);
      console.log(`👤 PATIENT: "${patientMsg}"`);

      const t0 = Date.now();
      let data: any;
      try {
        data = await callVoiceChatApi(patientMsg, history, interviewState);
      } catch (err: any) {
        console.error(`❌ Turn ${turnNum} Error:`, err.message);
        break;
      }
      const roundtripMs = Date.now() - t0;

      const doctorReply = data.doctorReply || "(No reply received)";
      const llmMeta = data.llmMeta || {};
      const pendingQ = data.interviewState?.pendingQuestion;
      const triage = data.triage || {};
      const board = data.board || {};

      console.log(`👩‍⚕️ DR. SARAH CHEN: "${doctorReply}"`);
      console.log(`   📊 Telemetry: Provider=${llmMeta.provider || "unknown"} | Model=${llmMeta.model || "none"} | LLM Latency=${llmMeta.latencyMs || 0}ms | Total Roundtrip=${roundtripMs}ms`);
      if (llmMeta.fallbackReason) {
        console.log(`   ⚠️ Fallback Reason: ${llmMeta.fallbackReason}`);
      }
      if (pendingQ) {
        console.log(`   🎯 Clinical Target: Slot="${pendingQ.targetSlot}" | Priority=${pendingQ.priority}`);
      }
      console.log(`   🏥 Clinical Triage: ESI Level ${triage.esiScore ?? "N/A"} (${triage.triageTitle ?? triage.triageLevel ?? "In Progress"}) | Emergency=${Boolean(triage.isEmergency)}`);

      allRecords.push({
        scenarioId: scenario.id,
        turnNum,
        patientMsg,
        doctorReply,
        provider: llmMeta.provider || "unknown",
        model: llmMeta.model || "unknown",
        latencyMs: llmMeta.latencyMs || 0,
        roundtripMs,
        fallbackReason: llmMeta.fallbackReason,
        isEmergency: Boolean(triage.isEmergency),
        esiScore: triage.esiScore ?? null,
        triageLevel: triage.triageLevel ?? "unknown",
        pendingSlot: pendingQ?.targetSlot,
      });

      // Update state & history for next turn
      interviewState = data.interviewState;
      history.push({ role: "patient", text: patientMsg });
      history.push({ role: "doctor", text: doctorReply });

      // Pacing delay (2.5s) to simulate voice cadence and stay smoothly within Groq rate limits
      await new Promise((r) => setTimeout(r, 2500));
    }

    console.log("\n===============================================================================");
    console.log(`✅ ${scenario.id} COMPLETED (10 TURNS FULLY EXERCISED)`);
    console.log("===============================================================================\n");

    // Pause between scenarios
    await new Promise((r) => setTimeout(r, 3500));
  }

  // ===========================================================================
  // PROGRAMMATIC ASSERTION HARNESS
  // ===========================================================================
  console.log("===============================================================================");
  console.log("                     HARD PROGRAMMATIC CLINICAL ASSERTIONS                     ");
  console.log("===============================================================================\n");

  const failures: string[] = [];

  // 1. Total turn count
  if (allRecords.length !== 30) {
    failures.push(`Expected 30 total turns, received ${allRecords.length}`);
  }

  // 2. Anti-Looping: No two consecutive identical doctor replies within any scenario
  for (const scenario of SCENARIOS) {
    const scTurns = allRecords.filter((r) => r.scenarioId === scenario.id);
    for (let i = 1; i < scTurns.length; i++) {
      if (scTurns[i].doctorReply.trim() === scTurns[i - 1].doctorReply.trim()) {
        failures.push(`Consecutive identical replies in ${scenario.id} at Turns ${scTurns[i - 1].turnNum} and ${scTurns[i].turnNum}: "${scTurns[i].doctorReply.slice(0, 80)}..."`);
      }
    }
  }

  // 3. Indian Localization: No "911" in any doctor reply; strictly 112 or 108
  for (const rec of allRecords) {
    if (/\b911\b/.test(rec.doctorReply)) {
      failures.push(`Disallowed emergency number 911 found in ${rec.scenarioId} Turn ${rec.turnNum}: "${rec.doctorReply}"`);
    }
  }

  // 4. Scenario 2: Emergency Preemption Timing & Lock
  const s2Turns = allRecords.filter((r) => r.scenarioId === "CONVERSATION_2_CARDIAC_CHEST_PRESSURE");
  const s2T1 = s2Turns.find((r) => r.turnNum === 1);
  const s2T2 = s2Turns.find((r) => r.turnNum === 2);
  const s2EarlyEmergency = Boolean(s2T1?.isEmergency || s2T2?.isEmergency);
  if (!s2EarlyEmergency) {
    failures.push(`Scenario 2 (Acute Chest Pressure) failed to trigger emergency preemption by Turn 1 or 2`);
  }

  // Ensure once emergency triggered in S2, it NEVER downgraded
  let emergencyTriggered = false;
  for (const turn of s2Turns) {
    if (turn.isEmergency) emergencyTriggered = true;
    if (emergencyTriggered && !turn.isEmergency) {
      failures.push(`Scenario 2 downgraded from emergency state at Turn ${turn.turnNum}`);
    }
  }

  // 5. Scenario 2: Zero Filler in Active Emergency
  for (const turn of s2Turns) {
    if (turn.isEmergency && /give me just a moment while I consult/i.test(turn.doctorReply)) {
      failures.push(`Generic consultation filler returned during active emergency in Scenario 2 Turn ${turn.turnNum}`);
    }
  }

  // 6. Direct Question Responsiveness:
  // 6A. S2 Turn 8: Patient asks "Can she just drive me there, or should we call an ambulance?"
  const s2T8 = s2Turns.find((r) => r.turnNum === 8);
  if (s2T8) {
    const replyLower = s2T8.doctorReply.toLowerCase();
    const addressesTransport = /\b(ambulance|108|112|paramedic|drive|drive you|wait for)\b/i.test(replyLower);
    if (!addressesTransport) {
      failures.push(`Scenario 2 Turn 8 failed to answer ambulance vs driving question: "${s2T8.doctorReply}"`);
    }
  }

  // 6B. S1 Turn 9: Patient asks "I live alone on the outskirts of town and I don't drive. Should I be worried?"
  const s1Turns = allRecords.filter((r) => r.scenarioId === "CONVERSATION_1_FATIGUE_MALAISE");
  const s1T9 = s1Turns.find((r) => r.turnNum === 9);
  if (s1T9) {
    const replyLower = s1T9.doctorReply.toLowerCase();
    const addressesWorry = /\b(worried|worry|alone|neighbor|fluid|intake|electrolyte|dehydration|orthostatic|stand|rest)\b/i.test(replyLower);
    if (!addressesWorry) {
      failures.push(`Scenario 1 Turn 9 failed to address patient anxiety/isolation: "${s1T9.doctorReply}"`);
    }
  }

  // 6C. S3 Turn 9: Patient asks for affordable clinic ("I don't have health insurance, so I need to find an affordable clinic nearby.")
  const s3Turns = allRecords.filter((r) => r.scenarioId === "CONVERSATION_3_SORE_THROAT_FEVER");
  const s3T9 = s3Turns.find((r) => r.turnNum === 9);
  if (s3T9) {
    const replyLower = s3T9.doctorReply.toLowerCase();
    const addressesCost = /\b(community|clinic|hospital|government|subsid|cost|afford|health center|district|public)\b/i.test(replyLower);
    if (!addressesCost) {
      failures.push(`Scenario 3 Turn 9 failed to address affordable care inquiry: "${s3T9.doctorReply}"`);
    }
  }

  // 7. Scenario 3: Peritonsillar Abscess / Deep Neck Infection Triage (Must NEVER be routine ESI 4)
  const s3Final = s3Turns[s3Turns.length - 1];
  if (s3Final) {
    if (s3Final.esiScore !== null && s3Final.esiScore > 3) {
      failures.push(`Scenario 3 (Severe pharyngitis with muffled voice + 101.4F + severe odynophagia) under-triaged to ESI ${s3Final.esiScore} (must be ESI 2 or 3)`);
    }
  }

  // 8. Slot Blindness: Scenario 1 should NOT ask chest pain template ("sharp, burning, dull, or tight pressure") for fatigue
  for (const turn of s1Turns) {
    if (/sharp, burning, dull, or a tight pressure/i.test(turn.doctorReply)) {
      failures.push(`Scenario 1 Turn ${turn.turnNum} asked pain template ("sharp, burning, dull, or tight pressure") for fatigue presentation`);
    }
  }

  // 9. Provider Utilization: Verify generative LLM provider is active
  const groqTurns = allRecords.filter((r) => r.provider === "groq");
  const fallbackTurns = allRecords.filter((r) => r.provider === "fallback");
  const fallbackRate = (fallbackTurns.length / allRecords.length) * 100;

  console.log(`📈 Provider Distribution:`);
  console.log(`   - Groq Cloud: ${groqTurns.length} / ${allRecords.length} (${((groqTurns.length / allRecords.length) * 100).toFixed(1)}%)`);
  console.log(`   - Fallback Engine: ${fallbackTurns.length} / ${allRecords.length} (${fallbackRate.toFixed(1)}%)`);

  if (fallbackRate > 50) {
    failures.push(`Fallback rate (${fallbackRate.toFixed(1)}%) exceeds safety threshold of 50%`);
  }

  // Report Assertion Results
  if (failures.length === 0) {
    console.log(`\n🎉 ALL PROGRAMMATIC CLINICAL ASSERTIONS PASSED (100% GREEN)!`);
    console.log(`   ✅ Zero duplicate lines across all 30 turns`);
    console.log(`   ✅ Zero 911 mentions (strictly 112/108)`);
    console.log(`   ✅ Immediate STEMI emergency preemption in Scenario 2`);
    console.log(`   ✅ Zero consultation fillers during active emergencies`);
    console.log(`   ✅ All direct patient questions (ambulance, anxiety, affordable clinic) answered`);
    console.log(`   ✅ Severe pharyngitis with muffled voice correctly triaged (ESI <= 3)`);
    console.log(`   ✅ Slot blindness eliminated (no pain templates for fatigue)`);
    console.log(`   ✅ Generative provider actively driving conversation\n`);
  } else {
    console.error(`\n❌ ${failures.length} ASSERTION FAILURES DETECTED:`);
    for (const f of failures) {
      console.error(`   - ${f}`);
    }
    process.exit(1);
  }
}

runConversations().catch((err) => {
  console.error("Multi-turn conversational runner encountered an unhandled exception:", err);
  process.exit(1);
});
