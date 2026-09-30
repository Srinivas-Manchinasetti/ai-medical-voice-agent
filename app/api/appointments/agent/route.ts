import { NextResponse } from "next/server";
import { ALL_INDIA_HOSPITALS, Hospital } from "@/lib/hospitals-india-data";
import {
  matchClinicalDepartment,
  generateAvailableHospitalSlots,
  sendAppointmentEmail,
  formatAppointmentHtmlEmail,
  memoryAppointments,
  AppointmentRecord,
} from "@/lib/appointments/appointment-service";
import { getDb } from "@/config/db";
import { appointmentsTable } from "@/config/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      hospitalId = "apollo-hyderabad-jubilee",
      message = "",
      conversationHistory = [],
      currentState = "identify_issue", // "identify_issue" | "select_slot" | "collect_name" | "collect_email" | "confirmed"
      sessionData = {},
    } = body;

    const hospital: Hospital =
      ALL_INDIA_HOSPITALS.find((h) => h.id === hospitalId) || ALL_INDIA_HOSPITALS[0];

    const cleanMsg = message.trim();
    const cleanMsgLower = cleanMsg.toLowerCase();

    // Check if greeting
    const isGreeting =
      /^(hello|hi|hey|good\s+(morning|afternoon|evening)|can\s+you\s+hear\s+me|testing)[.!?\s]*$/i.test(
        cleanMsgLower
      );

    if (isGreeting && conversationHistory.length <= 1) {
      return NextResponse.json({
        receptionistReply: `Hello! Thank you for calling the Appointment Desk at ${hospital.name}. I am Priya, your AI receptionist. Please tell me what health concern or symptoms you'd like to consult for today?`,
        nextState: "identify_issue",
        extractedData: {
          hospitalId: hospital.id,
          hospitalName: hospital.name,
        },
      });
    }

    // Step 1: Identifying issue & matching department
    if (currentState === "identify_issue" || !sessionData.department) {
      const match = matchClinicalDepartment(cleanMsg);
      const chosenDoctor = match.sampleDoctors[0];
      const availableDays = generateAvailableHospitalSlots(match.department, chosenDoctor);

      const todaySlot = availableDays[0].slots[0].time;
      const tomorrowSlot = availableDays[1].slots[0].time;

      const reply = `I understand. Based on your symptoms, I recommend scheduling with our ${match.department}, led by ${chosenDoctor}. We have an open slot today at ${todaySlot}, or tomorrow morning at ${tomorrowSlot}. Which of these works best for you?`;

      return NextResponse.json({
        receptionistReply: reply,
        nextState: "select_slot",
        extractedData: {
          chiefComplaint: cleanMsg,
          department: match.department,
          doctorName: chosenDoctor,
          urgency: match.urgency,
          availableDays,
        },
      });
    }

    // Step 2: Selecting slot
    if (currentState === "select_slot") {
      let selectedDate = sessionData.availableDays?.[0]?.date || "Today";
      let selectedTime = "04:15 PM";

      if (cleanMsgLower.includes("tomorrow") || cleanMsgLower.includes("morning")) {
        selectedDate = sessionData.availableDays?.[1]?.date || "Tomorrow";
        selectedTime = cleanMsgLower.includes("11") ? "11:30 AM" : "10:00 AM";
      } else if (cleanMsgLower.includes("2:30") || cleanMsgLower.includes("two thirty")) {
        selectedTime = "02:30 PM";
      } else if (cleanMsgLower.includes("4:15") || cleanMsgLower.includes("four fifteen")) {
        selectedTime = "04:15 PM";
      } else if (cleanMsgLower.includes("6") || cleanMsgLower.includes("six")) {
        selectedTime = "06:00 PM";
      } else if (cleanMsgLower.includes("3:45")) {
        selectedDate = "Tomorrow";
        selectedTime = "03:45 PM";
      } else if (cleanMsgLower.includes("5:30")) {
        selectedDate = "Tomorrow";
        selectedTime = "05:30 PM";
      }

      const reply = `Perfect, I have held the ${selectedTime} slot on ${selectedDate} for you with ${sessionData.doctorName}. To begin your booking, could you please tell me your full name?`;

      return NextResponse.json({
        receptionistReply: reply,
        nextState: "collect_name",
        extractedData: {
          ...sessionData,
          selectedDate,
          selectedTime,
        },
      });
    }

    // Step 3: Collecting Patient Name
    if (currentState === "collect_name" || (!sessionData.patientName && !sessionData.patientEmail)) {
      // Check if user also provided email in the same message
      const emailMatch = cleanMsg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

      let name = cleanMsg
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "")
        .replace(/(?:\+91[\-\s]?)?[6789]\d{9}/g, "")
        .replace(/\d+/g, "")
        .replace(/\b(my name is|i am|this is|call me|name|is)\b/gi, "")
        .trim()
        .replace(/[,\.:;!\?]+$/, "")
        .trim();

      if (!name || name.length < 2) {
        name = "Valued Patient";
      }

      if (emailMatch) {
        // User provided both name and email! Skip to confirmation
        const patientEmail = emailMatch[0].toLowerCase();
        return await finalizeBooking({
          hospital,
          sessionData: { ...sessionData, patientName: name, patientEmail },
        });
      }

      const reply = `Thank you, ${name}! What email address should we send your official hospital appointment pass and confirmation to?`;

      return NextResponse.json({
        receptionistReply: reply,
        nextState: "collect_email",
        extractedData: {
          ...sessionData,
          patientName: name,
        },
      });
    }

    // Step 4: Collecting Patient Email
    if (currentState === "collect_email" || (sessionData.patientName && !sessionData.patientEmail)) {
      const emailMatch = cleanMsg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

      if (!emailMatch) {
        // User didn't type/speak a valid email format
        return NextResponse.json({
          receptionistReply: `I didn't quite catch a valid email address. Could you please provide your email address (for example: name@example.com) so I can email your clinic pass?`,
          nextState: "collect_email",
          extractedData: sessionData,
        });
      }

      const patientEmail = emailMatch[0].toLowerCase();

      return await finalizeBooking({
        hospital,
        sessionData: { ...sessionData, patientEmail },
      });
    }

    // Default conversational reply
    return NextResponse.json({
      receptionistReply: `Thank you for contacting ${hospital.name} Appointment Desk. Your appointment is scheduled. Is there anything else I can assist you with before you hang up?`,
      nextState: "confirmed",
    });
  } catch (error: any) {
    console.error("[Appointment Agent Route Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process receptionist agent call." },
      { status: 500 }
    );
  }
}

/**
 * Helper to finalize booking and dispatch email
 */
async function finalizeBooking({
  hospital,
  sessionData,
}: {
  hospital: Hospital;
  sessionData: any;
}) {
  const apptId = `APPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const newAppointment: AppointmentRecord = {
    id: apptId,
    patientName: sessionData.patientName || "Valued Patient",
    patientPhone: sessionData.patientPhone || "+91-9876543210",
    patientEmail: sessionData.patientEmail,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    hospitalAddress: hospital.address,
    hospitalPhone: hospital.phone || hospital.emergencyPhone || "+91-40-23607777",
    department: sessionData.department || "Internal Medicine & General Practice",
    doctorName: sessionData.doctorName || "Dr. Sarah Chen, MD",
    appointmentDate: sessionData.selectedDate || "Today",
    appointmentTime: sessionData.selectedTime || "04:15 PM",
    chiefComplaint: sessionData.chiefComplaint || "Routine Health Evaluation",
    urgency: sessionData.urgency || "routine",
    status: "confirmed",
    notificationChannels: ["email"],
    dispatchStatus: {
      emailSent: false,
      sentAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };

  // Dispatch Email via Nodemailer
  const emailResult = await sendAppointmentEmail(newAppointment);
  newAppointment.dispatchStatus.emailSent = emailResult.success;
  newAppointment.dispatchStatus.emailPreviewUrl = emailResult.previewUrl;

  // Persist in memory store
  memoryAppointments.unshift(newAppointment);

  // Attempt DB persistence if configured
  try {
    const db = getDb();
    if (db) {
      await db.insert(appointmentsTable).values({
        id: newAppointment.id,
        patientName: newAppointment.patientName,
        patientPhone: newAppointment.patientPhone || "",
        patientEmail: newAppointment.patientEmail,
        hospitalId: newAppointment.hospitalId,
        hospitalName: newAppointment.hospitalName,
        hospitalAddress: newAppointment.hospitalAddress,
        hospitalPhone: newAppointment.hospitalPhone,
        department: newAppointment.department,
        doctorName: newAppointment.doctorName,
        appointmentDate: newAppointment.appointmentDate,
        appointmentTime: newAppointment.appointmentTime,
        chiefComplaint: newAppointment.chiefComplaint,
        urgency: newAppointment.urgency,
        status: newAppointment.status,
        notificationChannels: newAppointment.notificationChannels,
        dispatchStatus: newAppointment.dispatchStatus,
      });
    }
  } catch (dbErr) {
    console.warn("[Appointment DB Persistence Fallback to Memory]:", dbErr);
  }

  const { html, subject } = formatAppointmentHtmlEmail(newAppointment);

  const reply = `Your appointment is confirmed! Reference number is ${apptId}. You are scheduled with ${newAppointment.doctorName} for ${newAppointment.appointmentDate} at ${newAppointment.appointmentTime}. I have dispatched your digital appointment pass to ${newAppointment.patientEmail}. Thank you for calling ${hospital.name}, and have a wonderful day!`;

  return NextResponse.json({
    receptionistReply: reply,
    nextState: "confirmed",
    appointment: newAppointment,
    emailDetails: {
      subject,
      previewUrl: emailResult.previewUrl,
      htmlPreview: html,
      recipient: newAppointment.patientEmail,
    },
  });
}
