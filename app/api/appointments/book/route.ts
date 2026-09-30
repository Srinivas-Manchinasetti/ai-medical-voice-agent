import { NextResponse } from "next/server";
import { getDb } from "@/config/db";
import { appointmentsTable } from "@/config/schema";
import { desc } from "drizzle-orm";
import {
  memoryAppointments,
  AppointmentRecord,
  formatAppointmentHtmlEmail,
  sendAppointmentEmail,
  generateICalendarEvent,
} from "@/lib/appointments/appointment-service";

/**
 * GET: List all booked appointments
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    const db = getDb();
    if (db) {
      try {
        const query = db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.createdAt));
        const results = await query;
        if (results && results.length > 0) {
          return NextResponse.json({ appointments: results });
        }
      } catch (err) {
        console.warn("[DB select fallback to memory]:", err);
      }
    }

    const filtered = email
      ? memoryAppointments.filter((a) => a.patientEmail.toLowerCase().includes(email.toLowerCase()))
      : memoryAppointments;

    return NextResponse.json({ appointments: filtered });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Book appointment and dispatch email confirmation
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      patientName,
      patientPhone = "",
      patientEmail,
      hospitalId,
      hospitalName,
      hospitalAddress,
      hospitalPhone,
      department,
      doctorName,
      appointmentDate,
      appointmentTime,
      chiefComplaint = "Outpatient Consultation",
      urgency = "routine",
    } = body;

    if (!patientName || !patientEmail || !hospitalName || !appointmentTime) {
      return NextResponse.json(
        { error: "Missing required booking fields (patientName, patientEmail, hospitalName, appointmentTime)." },
        { status: 400 }
      );
    }

    const apptId = `APPT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAppointment: AppointmentRecord = {
      id: apptId,
      patientName,
      patientPhone,
      patientEmail: patientEmail.toLowerCase(),
      hospitalId: hospitalId || "apollo-hyderabad-jubilee",
      hospitalName,
      hospitalAddress: hospitalAddress || "Jubilee Hills, Hyderabad, Telangana",
      hospitalPhone: hospitalPhone || "+91-40-23607777",
      department,
      doctorName,
      appointmentDate,
      appointmentTime,
      chiefComplaint,
      urgency,
      status: "confirmed",
      notificationChannels: ["email"],
      dispatchStatus: {
        emailSent: false,
        sentAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    // Dispatch real email
    const emailResult = await sendAppointmentEmail(newAppointment);
    newAppointment.dispatchStatus.emailSent = emailResult.success;
    newAppointment.dispatchStatus.emailPreviewUrl = emailResult.previewUrl;

    // Save to memory store
    memoryAppointments.unshift(newAppointment);

    // Save to DB if available
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
      console.warn("[Appointment DB Insert fallback]:", dbErr);
    }

    const { html, subject } = formatAppointmentHtmlEmail(newAppointment);
    const icsContent = generateICalendarEvent(newAppointment);

    return NextResponse.json({
      success: true,
      appointment: newAppointment,
      emailDetails: {
        subject,
        previewUrl: emailResult.previewUrl,
        htmlPreview: html,
        recipient: newAppointment.patientEmail,
      },
      calendarIcs: icsContent,
    });
  } catch (error: any) {
    console.error("[Appointment Booking API Error]:", error);
    return NextResponse.json({ error: error.message || "Failed to book appointment" }, { status: 500 });
  }
}
