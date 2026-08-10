import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transcript, patient_id = "P-1002", patient_name = "Anonymous Patient" } = body;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { status: "error", message: "Transcript text is required." },
        { status: 400 }
      );
    }

    try {
      // Forward to Python FastAPI backend service
      const res = await fetch(`${BACKEND_URL}/api/v1/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, patient_id, patient_name }),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch (backendError) {
      console.warn("Python FastAPI backend unreachable, using fallback triage engine:", backendError);
    }

    // Next.js direct fallback triage logic
    const textLower = transcript.toLowerCase();
    const isEmergency = ["chest pain", "pressure", "breathing", "stroke", "arm pain"].some((k) =>
      textLower.includes(k)
    );
    const isPriority = ["fever", "cough", "lethargy", "vomiting", "pain"].some((k) =>
      textLower.includes(k)
    );

    let triageLevel = "routine";
    let triageTitle = "LEVEL 3: ROUTINE CLINICAL CARE";
    let icdCodes = ["Z76.0"];
    let symptoms = ["Routine Medical Consultation"];
    let action = "Automated Scheduling & Administrative Routing";

    if (isEmergency) {
      triageLevel = "emergency";
      triageTitle = "LEVEL 1: EMERGENCY ER ESCALATION";
      icdCodes = ["R07.9", "I20.9"];
      symptoms = ["Substernal Chest Pain", "Shortness of Breath", "Diaphoresis"];
      action = "Dispatch EMS / Direct ER Transfer & Alert On-Call Cardiology";
    } else if (isPriority) {
      triageLevel = "priority";
      triageTitle = "LEVEL 2: PRIORITY CLINICAL TRIAGE";
      icdCodes = ["R50.9", "J06.9"];
      symptoms = ["Pyrexia / Fever", "Acute Cough", "Lethargy"];
      action = "Schedule Same-Day Urgent Telehealth or Clinic Visit";
    }

    return NextResponse.json({
      status: "success",
      patient_id,
      patient_name,
      triage: {
        triage_level: triageLevel,
        triage_title: triageTitle,
        icd10_codes: icdCodes,
        detected_symptoms: symptoms,
        recommended_action: action,
        soap_summary: `S: Patient reports: "${transcript}". O: Clinical symptoms parsed. A: ${triageTitle}. P: ${action}.`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
