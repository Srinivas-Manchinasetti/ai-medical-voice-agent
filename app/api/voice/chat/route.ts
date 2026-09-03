import { NextResponse } from "next/server";
import { getDoctorById } from "@/config/doctors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      doctorId = "dr-sarah-chen",
      message = "",
      conversationHistory = [],
      patientName = "Patient"
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const doctor = getDoctorById(doctorId);
    const textLower = message.toLowerCase();

    // Clinical Emergency & Red Flag Rules
    const isEmergency = [
      "chest pain", "crushing", "heart attack", "can't breathe", "cannot breathe",
      "stroke", "facial droop", "slurred speech", "paralysis", "anaphylaxis",
      "blue lips", "unconscious", "hemorrhage", "severe bleeding", "radiating to left arm"
    ].some((k) => textLower.includes(k));

    const isPriority = [
      "fever", "high temp", "vomiting", "asthma", "wheezing", "severe pain",
      "fracture", "headache", "dizziness", "blood in stool", "rash spreading", "dehydration"
    ].some((k) => textLower.includes(k));

    // Dynamic symptoms & ICD code extraction
    const detectedSymptoms: string[] = [];
    const icdCodes: string[] = [];

    if (textLower.includes("chest pain") || textLower.includes("heart")) {
      detectedSymptoms.push("Substernal Chest Pain", "Precordial Discomfort");
      icdCodes.push("R07.9", "I20.9");
    }
    if (textLower.includes("fever") || textLower.includes("temperature")) {
      detectedSymptoms.push("Pyrexia / Fever");
      icdCodes.push("R50.9");
    }
    if (textLower.includes("cough") || textLower.includes("breath") || textLower.includes("wheez")) {
      detectedSymptoms.push("Acute Dyspnea / Cough");
      icdCodes.push("J06.9", "R06.02");
    }
    if (textLower.includes("headache") || textLower.includes("migraine")) {
      detectedSymptoms.push("Cephalea / Acute Headache");
      icdCodes.push("G43.9", "R51.9");
    }
    if (textLower.includes("rash") || textLower.includes("skin") || textLower.includes("itch")) {
      detectedSymptoms.push("Pruritic Dermatitis / Cutaneous Eruption");
      icdCodes.push("L30.9", "L50.9");
    }
    if (textLower.includes("stomach") || textLower.includes("abdomen") || textLower.includes("nausea")) {
      detectedSymptoms.push("Abdominal Pain / Dyspepsia");
      icdCodes.push("R10.9");
    }
    if (detectedSymptoms.length === 0) {
      detectedSymptoms.push("General Symptom Consultation");
      icdCodes.push("Z76.0");
    }

    let triageLevel: "emergency" | "priority" | "routine" = "routine";
    let triageTitle = "LEVEL 3: ROUTINE CLINICAL ASSESSMENT";
    let recommendedAction = "Schedule outpatient consultation or standard clinical follow-up.";
    let doctorReply = "";

    if (isEmergency) {
      triageLevel = "emergency";
      triageTitle = "LEVEL 1: CRITICAL EMERGENCY ESCALATION";
      recommendedAction = "Immediate EMS dispatch (911 / 108 / 112) and transfer to nearest Cardiac/Trauma Emergency facility.";
      
      if (doctor.specialty.includes("Cardio")) {
        doctorReply = `I am detecting signs of critical cardiac distress. Please stay completely still, sit upright, and if someone is with you, have them call 911 or emergency services immediately. Do not attempt to drive yourself.`;
      } else if (doctor.specialty.includes("Neuro")) {
        doctorReply = `These symptoms suggest an acute neurological emergency. Emergency evaluation is critical within the thrombolytic window. We must alert emergency responders right away.`;
      } else {
        doctorReply = `I am hearing symptoms that require urgent immediate emergency attention. Please dial emergency services or head to the nearest 24/7 trauma center immediately.`;
      }
    } else if (isPriority) {
      triageLevel = "priority";
      triageTitle = "LEVEL 2: PRIORITY URGENT CARE";
      recommendedAction = "Same-day urgent clinic or tele-triage physician evaluation within 4-6 hours.";
      
      doctorReply = `Thank you for sharing that with me. Based on what you've described regarding your ${detectedSymptoms[0].toLowerCase()}, it is important to monitor your vitals and have a priority clinical evaluation today. How long have you had this, and has it gotten worse?`;
    } else {
      triageLevel = "routine";
      triageTitle = "LEVEL 3: ROUTINE CLINICAL CARE";
      recommendedAction = "Standard outpatient clinic appointment and symptomatic home care.";
      
      doctorReply = `I understand. I've noted your ${detectedSymptoms[0].toLowerCase()}. To help determine the best plan for you, are you experiencing any fever, body aches, or other changes in how you feel?`;
    }

    // Build structured SOAP notes
    const allUserUtterances = [
      ...conversationHistory.filter((m: any) => m.role === "patient").map((m: any) => m.text),
      message
    ].join(" ");

    const soapSubjective = `Patient (${patientName}) presents with chief complaints: "${message}". Cumulative patient statements: "${allUserUtterances}".`;
    const soapObjective = `Spoken triage analysis parsed. Detected entities: ${detectedSymptoms.join(", ")}. ICD-10 Diagnostic Tags: ${icdCodes.join(", ")}. Triage Urgency: ${triageLevel.toUpperCase()}.`;
    const soapAssessment = `${triageTitle} under clinical specialty review by ${doctor.name} (${doctor.specialty}). Differential diagnosis includes ${detectedSymptoms.join(" / ")}.`;
    const soapPlan = `1. Recommended Action: ${recommendedAction}\n2. Specialist Follow-up: ${doctor.specialty}\n3. Vitals & symptomatic monitoring with emergency contingency instructions provided.`;

    return NextResponse.json({
      doctorReply,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        avatarUrl: doctor.avatarUrl,
        voiceGender: doctor.voiceGender
      },
      triage: {
        triageLevel,
        triageTitle,
        detectedSymptoms,
        icdCodes,
        recommendedAction,
        soap: {
          subjective: soapSubjective,
          objective: soapObjective,
          assessment: soapAssessment,
          plan: soapPlan
        }
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error during doctor consultation." },
      { status: 500 }
    );
  }
}
