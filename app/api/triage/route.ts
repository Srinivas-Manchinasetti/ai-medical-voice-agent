import { NextResponse } from "next/server";
import { evaluateSafetyArbiter } from "@/lib/triage/safety-arbiter";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      transcript,
      patient_id = "P-1002",
      patient_name = "Anonymous Patient",
      patient_age
    } = body;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { status: "error", message: "Transcript text is required." },
        { status: 400 }
      );
    }

    let upstreamTriage: any = null;
    try {
      // Forward to Python FastAPI backend service if running
      const res = await fetch(`${BACKEND_URL}/api/v1/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, patient_id, patient_name }),
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        upstreamTriage = await res.json();
      }
    } catch (backendError) {
      // FastAPI backend optional
    }

    // Run deterministic ESI v4 safety arbiter (with context-aware negation & override guarantee)
    const arbiter = evaluateSafetyArbiter({
      rawText: transcript,
      patientAge: patient_age ? Number(patient_age) : undefined,
      llmSuggestedLevel: upstreamTriage?.triage?.triage_level,
    });

    // Specialty routing based on detected clinical red flags
    let specialty = "general";
    if (arbiter.redFlagsTriggered.some((r) => r.includes("ACS") || r.includes("CARDIAC"))) {
      specialty = "cardiology";
    } else if (arbiter.redFlagsTriggered.some((r) => r.includes("STROKE") || r.includes("BE_FAST") || r.includes("THUNDERCLAP"))) {
      specialty = "neurology";
    } else if (arbiter.redFlagsTriggered.some((r) => r.includes("RESPIRATORY") || r.includes("AIRWAY") || r.includes("COLLAPSE"))) {
      specialty = "emergency";
    } else if (arbiter.redFlagsTriggered.some((r) => r.includes("PEDIATRIC"))) {
      specialty = "pediatrics";
    } else if (arbiter.isEmergency) {
      specialty = "emergency";
    }

    // Build synthesized clinical voice response
    let spokenResponse = "";
    if (arbiter.isEmergency) {
      if (specialty === "cardiology") {
        spokenResponse = "Emergency alert registered. I have detected acute cardiac distress indicators. Please rest and avoid exertion while we connect you with emergency services.";
      } else if (specialty === "neurology") {
        spokenResponse = "Critical emergency registered. Your symptoms indicate acute neurological distress. Please remain stationary while emergency dispatch is initiated.";
      } else {
        spokenResponse = `Emergency warning. Your symptoms require immediate emergency medical attention. Please call 911 or 108 immediately. ${arbiter.recommendedAction}`;
      }
    } else if (arbiter.triageLevel === "priority") {
      spokenResponse = `Your symptoms have been logged as priority. We recommend an urgent medical evaluation today. ${arbiter.recommendedAction}`;
    } else {
      spokenResponse = `I've logged your symptoms for routine outpatient review. ${arbiter.recommendedAction}`;
    }

    const soapSummary = `S: Patient reports: "${transcript}". O: Deterministic clinical features: ${arbiter.detectedSymptoms.join(", ") || "None"}. A: ${arbiter.esiTitle} (ESI ${arbiter.esiScore}, ICD-10: ${arbiter.icd10Codes.join(", ")}). P: ${arbiter.clinicalProtocol}`;

    return NextResponse.json({
      status: "success",
      patient_id,
      patient_name,
      triage: {
        triage_level: arbiter.triageLevel,
        triage_title: arbiter.esiTitle,
        esi_score: arbiter.esiScore,
        is_emergency: arbiter.isEmergency,
        arbiter_override: arbiter.arbiterOverride,
        red_flags_triggered: arbiter.redFlagsTriggered,
        matched_rules: arbiter.matchedRules,
        clinical_protocol: arbiter.clinicalProtocol,
        specialty,
        icd10_codes: arbiter.icd10Codes,
        detected_symptoms: arbiter.detectedSymptoms,
        recommended_action: arbiter.recommendedAction,
        spoken_response: spokenResponse,
        soap_summary: soapSummary,
        latency_ms: arbiter.latencyMs,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
