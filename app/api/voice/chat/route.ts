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
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const doctor = getDoctorById(doctorId);

    // Cumulative patient utterances for comprehensive clinical context
    const allUserUtterances = [
      ...conversationHistory.filter((m: any) => m.role === "patient").map((m: any) => m.text),
      message
    ].join(" ");

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
      transcript: allUserUtterances,
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
        trace: {
          pre_arbiter_latency_us: boardOutput.trace.pre_arbiter_latency_us,
          orchestrator_latency_ms: boardOutput.trace.orchestrator_latency_ms,
          synthesis_latency_ms: boardOutput.trace.synthesis_latency_ms,
          post_arbiter_latency_us: boardOutput.trace.post_arbiter_latency_us,
          total_board_latency_ms: boardOutput.trace.total_board_latency_ms,
          audit_sha256: boardOutput.trace.audit_sha256,
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
