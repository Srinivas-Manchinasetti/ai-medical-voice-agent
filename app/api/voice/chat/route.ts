import { NextResponse } from "next/server";
import { getDoctorById } from "@/config/doctors";
import { evaluateSafetyArbiter } from "@/lib/triage/safety-arbiter";

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

    // Cumulative patient utterances for comprehensive clinical context
    const allUserUtterances = [
      ...conversationHistory.filter((m: any) => m.role === "patient").map((m: any) => m.text),
      message
    ].join(" ");

    // Run deterministic ESI v4 safety arbiter
    const arbiter = evaluateSafetyArbiter({ rawText: allUserUtterances });

    let doctorReply = "";

    if (arbiter.isEmergency) {
      if (doctor.specialty.includes("Cardio")) {
        doctorReply = `I am detecting signs of critical cardiac distress. Please stay completely still, sit upright, and if someone is with you, have them call 911 or emergency services immediately. Do not attempt to drive yourself.`;
      } else if (doctor.specialty.includes("Neuro")) {
        doctorReply = `These symptoms indicate an acute neurological emergency. Immediate emergency evaluation is critical within the acute treatment window. We must alert emergency responders right away.`;
      } else if (arbiter.redFlagsTriggered.some((r) => r.includes("AIRWAY") || r.includes("ANAPHYLAXIS"))) {
        doctorReply = `This presents as an immediate airway or severe allergic emergency. Please dial emergency services right now and administer an epinephrine auto-injector if available.`;
      } else {
        doctorReply = `I am hearing symptoms that require urgent immediate emergency attention. Please dial emergency services or head to the nearest 24/7 trauma emergency center immediately.`;
      }
    } else if (arbiter.triageLevel === "priority") {
      const primarySymptom = arbiter.detectedSymptoms[0] || "symptoms";
      doctorReply = `Thank you for detailing that. Based on what you've described regarding your ${primarySymptom.toLowerCase()}, it is important to monitor your vitals and have an urgent clinical evaluation today. How long has this been present, and has the intensity changed?`;
    } else {
      const primarySymptom = arbiter.detectedSymptoms[0] || "symptoms";
      doctorReply = `I understand. I've noted your ${primarySymptom.toLowerCase()}. To help determine the appropriate care pathway, are you experiencing any fever, body aches, or any recent changes in medication?`;
    }

    // Build structured SOAP notes
    const soapSubjective = `Patient (${patientName}) presents with chief complaints: "${message}". Cumulative clinical statements: "${allUserUtterances}".`;
    const soapObjective = `Clinical features parsed via ESI v4 Arbiter. Identified signs: ${arbiter.detectedSymptoms.join(", ") || "General medical consultation"}. Diagnostic ICD-10 Tags: ${arbiter.icd10Codes.join(", ")}. Triage Urgency: ${arbiter.triageLevel.toUpperCase()} (ESI Tier ${arbiter.esiScore}). Red Flags: ${arbiter.redFlagsTriggered.join(", ") || "None"}.`;
    const soapAssessment = `${arbiter.esiTitle} under specialty consultation by ${doctor.name} (${doctor.specialty}). Clinical protocol: ${arbiter.clinicalProtocol}.`;
    const soapPlan = `1. Recommended Action: ${arbiter.recommendedAction}\n2. Specialty Care: ${doctor.specialty}\n3. Protocol: ${arbiter.clinicalProtocol}\n4. Safety Arbiter Status: ${arbiter.arbiterOverride ? "OVERRIDE_ACTIVATED (Forced Emergency Tier)" : "NOMINAL"}`;

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
        triageLevel: arbiter.triageLevel,
        triageTitle: arbiter.esiTitle,
        esiScore: arbiter.esiScore,
        isEmergency: arbiter.isEmergency,
        arbiterOverride: arbiter.arbiterOverride,
        redFlagsTriggered: arbiter.redFlagsTriggered,
        detectedSymptoms: arbiter.detectedSymptoms,
        icdCodes: arbiter.icd10Codes,
        recommendedAction: arbiter.recommendedAction,
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
