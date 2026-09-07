import { NextResponse } from "next/server";
import { getDoctorById } from "@/config/doctors";
import { clinicalBoard } from "@/lib/agents/clinical-board";
import { extractSpeechFeatures } from "@/lib/acoustic/speech-features";
import { PatientCase } from "@/lib/agents/schemas";

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
        board: null,
        speech_features: null,
        triage: null
      });
    }

    // Cumulative patient utterances for comprehensive clinical context (filtering out raw greetings)
    const patientHistory = conversationHistory
      .filter((m: any) => m.role === "patient")
      .map((m: any) => m.text.trim())
      .filter((t: string) => !/^(hello|hi|hey|good\s+(morning|afternoon|evening)|can\s+you\s+hear\s+me)[.!?\s]*$/i.test(t));
    
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

    // 2. Assemble Normalized Patient Case
    const ageNum = patientAge !== undefined ? Number(patientAge) : undefined;
    const ageGroup = ageNum !== undefined
      ? (ageNum < 1 ? "infant" : ageNum < 16 ? "pediatric" : ageNum > 65 ? "older_adult" : "adult")
      : "adult";

    const patientCase: PatientCase = {
      patient_id: `PT-${Date.now().toString().slice(-4)}`,
      patient_name: patientName,
      transcript: cumulativeTranscript,
      conversation_history: conversationHistory,
      demographics: {
        age: ageNum,
        age_group: ageGroup as any,
      },
      detected_symptoms: [],
      vitals: {},
      speech_features: speechFeatures,
      pre_safety_flags: [],
      immediate_danger_detected: false,
      provenance_evidence: [],
      is_interruption: Boolean(isInterruption),
      interrupted_agent: interruptedAgent || undefined,
    };

    // 3. Execute Multi-Agent Clinical Board (Pre-Arbiter -> Orchestrator -> Specialists -> Synthesizer -> Post-Arbiter)
    const boardOutput = await clinicalBoard.evaluate(patientCase);

    return NextResponse.json({
      doctorReply: boardOutput.doctor_reply,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        avatarUrl: doctor.avatarUrl,
        voiceGender: doctor.voiceGender,
      },
      board: {
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
