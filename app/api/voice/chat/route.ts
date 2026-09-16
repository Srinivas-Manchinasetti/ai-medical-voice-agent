import { NextResponse } from "next/server";
import { getDoctorById } from "@/config/doctors";
import { clinicalBoard } from "@/lib/agents/clinical-board";
import { extractSpeechFeatures } from "@/lib/acoustic/speech-features";
import { PatientCase } from "@/lib/agents/schemas";

import { conversationManager } from "@/lib/triage/conversation-manager";
import { clinicalKnowledgeRetriever } from "@/lib/clinical-knowledge/retriever";
import { generateDoctorTurnResponse } from "@/lib/ai/clinical-llm";
import { hospitalRagService } from "@/lib/care-network/hospital-rag";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      doctorId = "dr-sarah-chen",
      message = "",
      conversationHistory = [],
      patientName = "Patient",
      patientAge,
      audioMetrics,
      isInterruption = false,
      interruptedAgent = "",
      userLocation,
      locationPermission,
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const doctor = getDoctorById(doctorId);

    const cleanMsg = message.trim();
    const cleanMsgLower = cleanMsg.toLowerCase();

    // Check if this is a conversational greeting, mic check, or polite small talk without symptoms
    const isGreeting =
      /^(hello|hi|hey|good\s+(morning|afternoon|evening)|can\s+you\s+hear\s+me|testing|greetings)[.!?\s]*$/i.test(cleanMsgLower) ||
      (cleanMsg.length <= 15 && /\b(hello|hi|hey|greetings)\b/i.test(cleanMsgLower));

    const isThankYou = /^(thank\s+you|thanks|thank\s+you\s+so\s+much|ok\s+thanks|bye|goodbye)[.!?\s]*$/i.test(cleanMsgLower);

    if (isGreeting) {
      const greetingReplies: Record<string, string> = {
        "dr-sarah-chen": "Hello! I'm Dr. Sarah Chen, Chief of Internal Medicine. I can hear you clearly. What symptoms or medical concerns brought you in today?",
        "dr-marcus-vance": "Hello, I'm Dr. Marcus Vance, Senior Cardiologist. I'm listening closely. Please describe any chest discomfort, palpitations, or symptoms you're feeling.",
        "dr-elena-rostova": "Hello! I'm Dr. Elena Rostova, Consultant Pediatrician. How can I assist you or your family today?",
        "dr-arthur-pendelton": "Good day, I'm Dr. Arthur Pendelton in Neurology. How are you feeling today, and what symptoms would you like us to evaluate?",
        "dr-priya-patel": "Hello, I'm Dr. Priya Patel, Consultant Dermatologist. Please tell me about any symptoms, skin changes, or reactions you're experiencing."
      };
      const doctorGreeting = greetingReplies[doctor.id] || `Hello! I'm ${doctor.name}. I'm here and ready to help. What symptoms are you experiencing?`;

      return NextResponse.json({
        doctorReply: doctorGreeting,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          avatarUrl: doctor.avatarUrl,
          voiceGender: doctor.voiceGender,
        },
        phase: "greeting",
        board: null,
        speech_features: null,
        triage: null
      });
    }

    if (isThankYou) {
      return NextResponse.json({
        doctorReply: "You're very welcome! Please don't hesitate to reach back out if your symptoms change or worsen. Take care and stay safe.",
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          avatarUrl: doctor.avatarUrl,
          voiceGender: doctor.voiceGender,
        },
        phase: "closing",
        board: null,
        speech_features: null,
        triage: null
      });
    }

    // Cumulative patient utterances for comprehensive clinical context (filtering out raw greetings)
    const patientHistory = conversationHistory
      .filter((m: any) => m.role === "patient" || m.role === "user")
      .map((m: any) => (m.text || m.content || "").trim())
      .filter((t: string) => t.length > 0 && !/^(hello|hi|hey|good\s+(morning|afternoon|evening)|can\s+you\s+hear\s+me)[.!?\s]*$/i.test(t));
    
    const allUtterances = [...patientHistory, cleanMsg];
    // Remove exact duplicate phrases from consecutive submissions
    const uniqueUtterances = allUtterances.filter((u, i) => allUtterances.indexOf(u) === i);
    const cumulativeTranscript = uniqueUtterances.join(". ");

    // 1. Extract measured speech features & paralinguistics
    const speechFeatures = extractSpeechFeatures({
      transcriptText: message,
      durationMs: audioMetrics?.durationMs,
      pauseCount: audioMetrics?.pauseCount,
      totalPauseDurationMs: audioMetrics?.totalPauseDurationMs,
      wordCount: audioMetrics?.wordCount,
      energyVariance: audioMetrics?.energyVariance,
      pitchVariance: audioMetrics?.pitchVariance,
    });

    let ageNum: number | null = null;
    let ageSource: "patient_reported" | "profile" | "unknown" = "unknown";
    let ageGroup: "infant" | "pediatric" | "adult" | "geriatric" | "unknown" = "unknown";

    if (patientAge && !isNaN(parseInt(patientAge, 10))) {
      ageNum = parseInt(patientAge, 10);
      ageSource = "profile";
      ageGroup = ageNum < 1 ? "infant" : ageNum < 18 ? "pediatric" : ageNum > 65 ? "geriatric" : "adult";
    } else {
      // Check if age was explicitly reported in cumulative transcript, e.g. "I am 32 years old", "my 4-year-old"
      const ageMatch = cumulativeTranscript.match(/\b(?:i(?:'m| am)|patient is|aged?)\s+(\d{1,3})\s*(?:years?|yrs?|yo)?\b/i);
      if (ageMatch && parseInt(ageMatch[1], 10) > 0 && parseInt(ageMatch[1], 10) < 120) {
        ageNum = parseInt(ageMatch[1], 10);
        ageSource = "patient_reported";
        ageGroup = ageNum < 1 ? "infant" : ageNum < 18 ? "pediatric" : ageNum > 65 ? "geriatric" : "adult";
      } else {
        const isInfant = /\b(newborn|neonate|infant|baby|\d+\s*-(?:week|month|day)-old|\d+\s+(?:weeks?|months?|days?)\s+old)\b/i.test(cumulativeTranscript);
        if (isInfant) {
          ageNum = 0;
          ageSource = "patient_reported";
          ageGroup = "infant";
        } else {
          ageNum = null;
          ageSource = "unknown";
          ageGroup = "unknown";
        }
      }
    }

    // 2. Stateful Clinical Conversation Manager Turn Execution
    const turnResult = await conversationManager.processTurn(cleanMsg, body.interviewState, {
      age: ageNum ?? undefined,
      age_group: ageGroup === "unknown" ? "adult" : ageGroup,
      age_source: ageSource
    });

    const knownFactsCount = turnResult.state.slots.known_facts.length;
    const slots = turnResult.state.slots;
    const hasAnySymptoms = knownFactsCount > 0 || Boolean(slots.character || slots.onset);

    let calculatedMissingDims: string[] = [];
    if (!hasAnySymptoms) {
      calculatedMissingDims = [
        "Symptoms & chief complaint",
        "Onset & timeline",
        "Episode duration & frequency",
        "Character & severity",
        "Associated symptoms",
      ];
    } else {
      if (!slots.onset) calculatedMissingDims.push("Onset & timeline");
      if (!slots.character) calculatedMissingDims.push("Character & severity");
      if (!slots.duration && !turnResult.state.conversationMemory?.frequencyPattern) {
        calculatedMissingDims.push("Episode duration & frequency");
      }
      if (!slots.radiation && /\b(chest|heart|angina|leg|calf|back)\b/i.test(turnResult.state.cumulativeTranscript)) {
        calculatedMissingDims.push("Radiation & spread");
      }
      if (!slots.exertional && /\b(chest|heart|angina)\b/i.test(turnResult.state.cumulativeTranscript)) {
        calculatedMissingDims.push("Exertional relation");
      }
      if (slots.associated_symptoms.length === 0) {
        calculatedMissingDims.push("Associated symptoms");
      }
    }

    const totalRequired = Math.max(5, knownFactsCount + calculatedMissingDims.length);
    const completenessScore = knownFactsCount === 0
      ? 0
      : Math.min(0.95, Math.round((knownFactsCount / totalRequired) * 100) / 100);

    const missingDims = calculatedMissingDims;

    // Conditioned Care Network RAG Trigger:
    // Only invoke when an access constraint (financial or remote location) is present,
    // OR when the patient specifically mentions outskirts, affordability, or hospital needs.
    const constraints = turnResult.state.structuredHistory?.accessConstraints;
    let nearbyHospitals: any[] = turnResult.state.structuredHistory?.nearbyHospitals || [];
    let careOptions: any[] = [];
    let careNetworkSummary: string | undefined = undefined;

    const needsCareRouting = Boolean(
      constraints?.financial ||
      constraints?.remoteLocation ||
      /\b(outskirts|hospital|far\s+away|remote|village|afford|poor|cost|ambulance)\b/i.test(cleanMsgLower)
    );

    if (needsCareRouting) {
      const isNeuro = turnResult.preArbiterResult.pre_safety_flags.some((f: string) => f.includes("NEURO")) ||
        /\b(droop|facial|arm|weakness|speech|slur|stroke|tia)\b/i.test(turnResult.state.cumulativeTranscript);
      const isCardio = turnResult.preArbiterResult.pre_safety_flags.some((f: string) => f.includes("ACS") || f.includes("CARDIO")) ||
        /\b(chest|crushing|pressure|radiat|angina)\b/i.test(turnResult.state.cumulativeTranscript);

      const specialtyRequired = isNeuro ? "Neurology" : isCardio ? "Cardiology" : undefined;
      const prioritizeAffordable = Boolean(constraints?.financial);

      const userCoords = userLocation?.latitude && userLocation?.longitude
        ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
        : undefined;

      const ragResult = await hospitalRagService.findEmergencyCareFacilities({
        userCoords,
        cityOrLandmark: userLocation?.city,
        specialtyRequired,
        prioritizeAffordable,
        maxResults: 3,
      });

      nearbyHospitals = ragResult.facilities;
      careOptions = ragResult.careOptions;
      careNetworkSummary = ragResult.summaryForLLM;

      if (turnResult.state.structuredHistory) {
        turnResult.state.structuredHistory.nearbyHospitals = nearbyHospitals;
      }
    }

    // 3. Generative Clinical Turn Response (NVIDIA NIM LLM with Pre-Arbiter Emergency Invariant)
    const llmResult = await generateDoctorTurnResponse({
      patientUtterance: cleanMsg,
      conversationHistory,
      interviewState: turnResult.state,
      preArbiterResult: turnResult.preArbiterResult,
      demographics: { age: ageNum ?? undefined, age_group: ageGroup, age_source: ageSource },
      doctor,
      missingDimensions: missingDims,
      fallbackReply: turnResult.doctorReply,
      careNetworkSummary,
    });

    const activeDoctorReply = llmResult.reply || turnResult.doctorReply;

    // If conversation manager determined patient follow-up or clarification is needed
    if (turnResult.action === "ASK_PATIENT" || turnResult.action === "CLARIFY") {
      return NextResponse.json({
        doctorReply: activeDoctorReply,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          avatarUrl: doctor.avatarUrl,
          voiceGender: doctor.voiceGender,
        },
        phase: turnResult.state.phase,
        interviewState: turnResult.state,
        nearbyHospitals: nearbyHospitals.length > 0 ? nearbyHospitals : undefined,
        careOptions: careOptions.length > 0 ? careOptions : undefined,
        llmMeta: {
          provider: llmResult.provider,
          model: llmResult.model,
          latencyMs: llmResult.latencyMs,
        },
        board: {
          phase: turnResult.state.phase,
          information_state: turnResult.state.informationState,
          status_summary: turnResult.state.informationState === "sufficient_for_specialist"
            ? "Specialist Review Active · Inquiring"
            : "Clinical History Gathering",
          active_specialists: turnResult.state.agentRequests.some(r => r.fromAgent === "cardiology" && r.status === "pending")
            ? ["Dr. Marcus Vance, MD, FACC (Cardiology)"]
            : turnResult.state.agentRequests.some(r => r.fromAgent === "neurology" && r.status === "pending")
            ? ["Dr. Arthur Pendelton, MD, PhD (Neurology)"]
            : ["Dr. Sarah Chen, MD (Lead)"],
          active_requests: turnResult.state.agentRequests.filter(r => r.status === "pending"),
          pending_question: turnResult.state.pendingQuestion,
          completeness_score: completenessScore,
          known_facts: turnResult.state.slots.known_facts,
          missing_dimensions: calculatedMissingDims,
          slots: turnResult.state.slots,
          opinions: [],
          consensus_summary: "Awaiting sufficient clinical evidence before disposition.",
          differential: [],
          conflicts: [],
          key_findings: turnResult.state.slots.known_facts,
          deliberation_messages: [],
          trace: null,
        },
        speech_features: speechFeatures,
        triage: {
          triageLevel: "gathering_history",
          triageTitle: "Clinical History Gathering",
          esiScore: null,
          isEmergency: false,
          arbiterOverride: false,
          overrideRationale: null,
          redFlagsTriggered: turnResult.preArbiterResult.pre_safety_flags,
          detectedSymptoms: turnResult.state.slots.known_facts,
          icdCodes: [],
          recommendedAction: "Clinical history in progress. Triage disposition will lock once evidence is sufficient.",
          soap: null,
        },
      });
    }

    // 3. Assemble Normalized Patient Case for Full Board Deliberation (Convene Board or Emergency Preemption)
    const patientCase: PatientCase = {
      patient_id: `PT-${Date.now().toString().slice(-4)}`,
      patient_name: patientName,
      transcript: turnResult.state.cumulativeTranscript,
      conversation_history: conversationHistory,
      demographics: {
        age: ageNum ?? undefined,
        age_group: ageGroup as any,
      },
      detected_symptoms: turnResult.state.slots.known_facts,
      vitals: {},
      speech_features: speechFeatures,
      pre_safety_flags: turnResult.preArbiterResult.pre_safety_flags,
      immediate_danger_detected: turnResult.preArbiterResult.immediate_danger,
      provenance_evidence: [],
      is_interruption: Boolean(isInterruption),
      interrupted_agent: interruptedAgent || undefined,
      case_version: turnResult.state.caseVersion,
    };

    // 4. Execute Multi-Agent Clinical Board (Pre-Arbiter -> Orchestrator -> Specialists -> Synthesizer -> Post-Arbiter)
    const boardOutput = await clinicalBoard.evaluate(patientCase);

    const sufficiency = {
      is_sufficient: true,
      completeness_score: Math.min(100, Math.round((knownFactsCount / (knownFactsCount + missingDims.length || 1)) * 100)),
      dimensions: {
        known_facts: turnResult.state.slots.known_facts,
        missing_dimensions: missingDims,
      },
    };

    const resolvedCitations: Record<string, any> = {};
    const allCitationIds = new Set<string>();

    boardOutput.trace.opinions?.forEach((o: any) => {
      o.retrieved_citations?.forEach((c: string) => allCitationIds.add(c));
    });
    boardOutput.trace.deliberation_messages?.forEach((m: any) => {
      m.references?.forEach((r: string) => {
        if (typeof r === "string" && (r.startsWith("GUIDELINE-") || r.startsWith("MPLUS-") || r.startsWith("RXNORM-") || r.startsWith("DAILYMED-") || r.startsWith("OPENFDA-"))) {
          allCitationIds.add(r);
        }
      });
    });

    for (const id of allCitationIds) {
      const p = clinicalKnowledgeRetriever.resolveCitation(id);
      if (p) {
        resolvedCitations[id] = {
          id: p.id,
          title: p.title,
          authority: p.authority,
          source: p.source,
          section: p.section,
          content: p.content,
          releaseDate: p.releaseDate,
          organization: p.source,
          criteria: p.keyTerms || [],
        };
      }
    }

    const finalDoctorReply = activeDoctorReply || turnResult.doctorReply || boardOutput.doctor_reply;

    return NextResponse.json({
      doctorReply: finalDoctorReply,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        avatarUrl: doctor.avatarUrl,
        voiceGender: doctor.voiceGender,
      },
      phase: "board_decision",
      interviewState: {
        ...turnResult.state,
        phase: "decided",
        informationState: "sufficient_for_decision",
      },
      nearbyHospitals: nearbyHospitals.length > 0 ? nearbyHospitals : undefined,
      careOptions: careOptions.length > 0 ? careOptions : undefined,
      llmMeta: {
        provider: llmResult.provider,
        model: llmResult.model,
        latencyMs: llmResult.latencyMs,
      },
      sufficiency,
      board: {
        phase: "board_decision",
        status_summary: "Clinical Context Complete · Deliberation Active",
        completeness_score: sufficiency.completeness_score,
        known_facts: sufficiency.dimensions.known_facts,
        missing_dimensions: sufficiency.dimensions.missing_dimensions,
        orchestrator_summary: boardOutput.consensus.orchestrator_summary,
        active_specialists: boardOutput.consensus.active_specialists,
        specialists_summoned: boardOutput.trace.specialists_summoned,
        opinions: boardOutput.trace.opinions,
        differential: boardOutput.consensus.differential,
        conflicts: boardOutput.consensus.conflicts,
        key_findings: boardOutput.consensus.key_findings,
        consensus_risk: boardOutput.consensus.consensus_risk,
        deliberation_rounds: boardOutput.trace.deliberation_rounds,
        tools_executed: boardOutput.trace.tools_executed,
        tools_executed_details: boardOutput.trace.tools_executed_details,
        peer_challenges_count: boardOutput.trace.peer_challenges_count,
        peer_challenges: boardOutput.trace.peer_challenges,
        deliberation_messages: boardOutput.trace.deliberation_messages || [],
        citations: resolvedCitations,
        trace: {
          pre_arbiter_latency_us: boardOutput.trace.pre_arbiter_latency_us,
          orchestrator_latency_ms: boardOutput.trace.orchestrator_latency_ms,
          synthesis_latency_ms: boardOutput.trace.synthesis_latency_ms,
          post_arbiter_latency_us: boardOutput.trace.post_arbiter_latency_us,
          total_board_latency_ms: boardOutput.trace.total_board_latency_ms,
          audit_sha256: boardOutput.trace.root_audit_hash,
          audit_hash_chain: boardOutput.trace.audit_hash_chain,
        },
      },
      speech_features: speechFeatures,
      triage: {
        triageLevel: boardOutput.post_arbiter.final_triage_level,
        triageTitle: boardOutput.post_arbiter.final_esi_title,
        esiScore: boardOutput.post_arbiter.final_esi_level,
        isEmergency: boardOutput.post_arbiter.final_triage_level === "emergency",
        arbiterOverride: boardOutput.post_arbiter.arbiter_override_applied,
        overrideRationale: boardOutput.post_arbiter.override_rationale,
        redFlagsTriggered: boardOutput.post_arbiter.red_flags,
        detectedSymptoms: boardOutput.consensus.key_findings,
        icdCodes: boardOutput.post_arbiter.icd10_codes,
        recommendedAction: boardOutput.post_arbiter.final_disposition,
        soap: boardOutput.soap_note,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error during multi-agent clinical consultation." },
      { status: 500 }
    );
  }
}
