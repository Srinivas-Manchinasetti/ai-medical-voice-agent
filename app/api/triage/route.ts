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

    // Next.js direct clinical triage engine
    const textLower = transcript.toLowerCase();

    // 1. CARDIAC / LEVEL 1 EMERGENCY (ESI 1 or 2)
    const isCardiac = ["chest pain", "pressure", "heart", "cardiac", "left arm", "sweat", "diaphoresis", "crushing"].some((k) => textLower.includes(k));
    // 2. STROKE / NEUROLOGICAL EMERGENCY (ESI 1)
    const isStroke = ["slurred speech", "facial droop", "arm weakness", "stroke", "paralysis", "vision loss"].some((k) => textLower.includes(k));
    // 3. RESPIRATORY EMERGENCY (ESI 2)
    const isRespiratory = ["shortness of breath", "gasping", "suffocating", "asthma", "stridor", "cannot breathe", "breathing difficulty"].some((k) => textLower.includes(k));
    // 4. ONCOLOGY / CHEMO EMERGENCY (ESI 2)
    const isOncology = ["cancer", "oncology", "chemo", "tumor", "neutropenic", "radiation", "carcinoma"].some((k) => textLower.includes(k));
    // 5. PEDIATRIC ACUTE (ESI 3)
    const isPediatric = ["child", "infant", "toddler", "baby", "pediatric", "4yo", "3yo", "2yo", "5yo", "febrile"].some((k) => textLower.includes(k));
    // 6. ACUTE ABDOMINAL / TRAUMA (ESI 3)
    const isAcuteAbdomen = ["abdominal pain", "right lower quadrant", "appendix", "nausea", "vomiting", "stomach cramp"].some((k) => textLower.includes(k));
    // 7. GENERAL PRIORITY (ESI 3 or 4)
    const isPriority = ["fever", "cough", "lethargy", "flu", "migraine", "infection", "pain"].some((k) => textLower.includes(k));

    let triageLevel = "routine";
    let triageTitle = "LEVEL 4: ROUTINE CLINICAL CONSULTATION";
    let esiScore = 4;
    let icdCodes = ["Z76.0"];
    let symptoms = ["Routine Medical Inquiry"];
    let action = "Schedule standard outpatient telehealth or clinic follow-up.";
    let spokenResponse = "I've logged your symptoms for routine clinical review. Our medical team recommends scheduling a standard outpatient consultation.";
    let specialty = "general";

    if (isStroke) {
      triageLevel = "emergency";
      triageTitle = "LEVEL 1: CRITICAL STROKE / NEUROLOGICAL EMERGENCY (ESI 1)";
      esiScore = 1;
      icdCodes = ["I63.9", "R47.01", "G81.9"];
      symptoms = ["Acute Neurological Deficit", "Possible Cerebral Ischemia", "Urgent CT Angiography Indicated"];
      action = "Immediate EMS Dispatch to Nearest Comprehensive Stroke Center.";
      spokenResponse = "Emergency alert registered. Your symptoms indicate acute neurological distress. Please remain stationary while we initiate emergency dispatch to the nearest Comprehensive Stroke Center.";
      specialty = "neurology";
    } else if (isCardiac) {
      triageLevel = "emergency";
      triageTitle = "LEVEL 1: ACUTE CORONARY SYNDROME / CARDIAC ER (ESI 1)";
      esiScore = 1;
      icdCodes = ["I20.9", "R07.9", "R06.02"];
      symptoms = ["Substernal Chest Pain", "Radiating Left Arm Pressure", "Diaphoresis", "High Risk Myocardial Infarction"];
      action = "Dispatch Emergency Cardiology Team & Transfer to 24/7 Cath Lab Facility.";
      spokenResponse = "I have detected acute cardiac distress indicators. This is classified as a Level 1 Emergency. Please rest comfortably and avoid exertion while we connect you with the nearest emergency cardiac trauma center.";
      specialty = "cardiology";
    } else if (isRespiratory) {
      triageLevel = "emergency";
      triageTitle = "LEVEL 2: ACUTE RESPIRATORY DISTRESS (ESI 2)";
      esiScore = 2;
      icdCodes = ["J96.00", "R06.00", "J45.901"];
      symptoms = ["Acute Dyspnea", "Respiratory Distress", "Hypoxia Risk"];
      action = "Urgent Emergency Room Transfer with Supplemental Oxygen Preparedness.";
      spokenResponse = "Your breathing difficulty requires immediate emergency medical attention. We are locating the closest emergency facility with active pulmonary care.";
      specialty = "emergency";
    } else if (isOncology) {
      triageLevel = "priority";
      triageTitle = "LEVEL 2: ONCOLOGY CLINICAL ESCALATION (ESI 2)";
      esiScore = 2;
      icdCodes = ["C80.1", "R50.81", "D70.9"];
      symptoms = ["Immunocompromised Risk", "Acute Oncological Complication", "Specialist Review Required"];
      action = "Same-Day Transfer to Comprehensive Cancer Institute & On-Call Oncologist Alert.";
      spokenResponse = "I've registered your oncological symptoms. Due to high-risk clinical factors, you are being directed to the nearest verified Comprehensive Cancer Care hospital.";
      specialty = "cancer";
    } else if (isPediatric && isPriority) {
      triageLevel = "priority";
      triageTitle = "LEVEL 3: ACUTE PEDIATRIC TRIAGE (ESI 3)";
      esiScore = 3;
      icdCodes = ["R50.9", "J06.9", "R11.0"];
      symptoms = ["Pediatric Pyrexia", "Acute Upper Respiratory / Lethargy", "Pediatrician Review"];
      action = "Urgent Pediatric Emergency or Dedicated Children's Clinic Evaluation.";
      spokenResponse = "I've recorded the pediatric symptoms. We recommend an urgent consultation at a dedicated pediatric emergency department to monitor temperature and hydration.";
      specialty = "pediatrics";
    } else if (isAcuteAbdomen) {
      triageLevel = "priority";
      triageTitle = "LEVEL 3: ACUTE ABDOMINAL / SURGICAL TRIAGE (ESI 3)";
      esiScore = 3;
      icdCodes = ["R10.31", "K35.80", "R11.10"];
      symptoms = ["Right Lower Quadrant Pain", "Nausea", "Possible Appendicitis Evaluation"];
      action = "Urgent Ultrasound / General Surgery Evaluation at Emergency Center.";
      spokenResponse = "Your acute abdominal symptoms require timely physical and surgical evaluation. Directing you to the closest hospital with emergency diagnostics.";
      specialty = "emergency";
    } else if (isPriority) {
      triageLevel = "priority";
      triageTitle = "LEVEL 3: URGENT CLINICAL EVALUATION (ESI 3)";
      esiScore = 3;
      icdCodes = ["R50.9", "J00", "M79.1"];
      symptoms = ["Pyrexia / Fever", "Acute Symptom Flare", "Primary Care Review"];
      action = "Same-Day Urgent Care or Priority Telehealth Consultation.";
      spokenResponse = "Your symptoms have been logged as priority. We suggest visiting an urgent care facility or booking a same-day clinical consultation.";
      specialty = "general";
    }

    return NextResponse.json({
      status: "success",
      patient_id,
      patient_name,
      triage: {
        triage_level: triageLevel,
        triage_title: triageTitle,
        esi_score: esiScore,
        specialty,
        icd10_codes: icdCodes,
        detected_symptoms: symptoms,
        recommended_action: action,
        spoken_response: spokenResponse,
        soap_summary: `S: Patient reports: "${transcript}". O: NLP parsed clinical markers: ${symptoms.join(", ")}. A: ${triageTitle} (ESI ${esiScore}, ICD-10: ${icdCodes.join(", ")}). P: ${action}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
