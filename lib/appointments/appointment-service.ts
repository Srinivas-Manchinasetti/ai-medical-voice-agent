import nodemailer from "nodemailer";
import { appointmentsTable } from "@/config/schema";
import { getDb } from "@/config/db";
import { ALL_INDIA_HOSPITALS, Hospital } from "@/lib/hospitals-india-data";

export interface TimeSlot {
  id: string;
  time: string;
  period: "Morning" | "Afternoon" | "Evening";
  doctorName: string;
  doctorSpecialty: string;
  consultationFee: string;
  available: boolean;
}

export interface DaySlots {
  date: string; // e.g. "Today, Oct 1" or "Tomorrow, Oct 2"
  isoDate: string;
  slots: TimeSlot[];
}

export interface AppointmentRecord {
  id: string;
  patientName: string;
  patientPhone?: string;
  patientEmail: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalPhone: string;
  department: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  chiefComplaint: string;
  urgency: "routine" | "priority" | "urgent";
  status: "confirmed" | "rescheduled" | "cancelled";
  notificationChannels: string[];
  dispatchStatus: {
    emailSent: boolean;
    emailPreviewUrl?: string;
    sentAt?: string;
    error?: string;
  };
  createdAt: string;
}

// In-memory appointments store for instant retrieval
export const memoryAppointments: AppointmentRecord[] = [];

/**
 * Intelligent Department & Specialist matcher based on patient complaints
 */
export function matchClinicalDepartment(complaint: string): {
  department: string;
  specialistTitle: string;
  urgency: "routine" | "priority" | "urgent";
  sampleDoctors: string[];
} {
  const text = complaint.toLowerCase();

  if (
    text.includes("chest") ||
    text.includes("heart") ||
    text.includes("palpitation") ||
    text.includes("blood pressure") ||
    text.includes("hypertension") ||
    text.includes("angina")
  ) {
    const isUrgent = text.includes("crushing") || text.includes("severe") || text.includes("sweat");
    return {
      department: "Cardiology & Vascular Medicine",
      specialistTitle: "Senior Interventional Cardiologist",
      urgency: isUrgent ? "urgent" : "priority",
      sampleDoctors: ["Dr. Marcus Vance, MD, FACC", "Dr. Rajesh K. Sharma, DM (Cardio)"],
    };
  }

  if (
    text.includes("bone") ||
    text.includes("joint") ||
    text.includes("knee") ||
    text.includes("fracture") ||
    text.includes("back pain") ||
    text.includes("backache") ||
    text.includes("spine") ||
    text.includes("shoulder") ||
    text.includes("ortho")
  ) {
    return {
      department: "Orthopedics & Joint Reconstruction",
      specialistTitle: "Orthopedic Surgeon & Joint Specialist",
      urgency: text.includes("severe") || text.includes("fall") ? "priority" : "routine",
      sampleDoctors: ["Dr. Vikramaditya Reddy, MS (Ortho)", "Dr. Anita Desai, DNB Ortho"],
    };
  }

  if (
    text.includes("child") ||
    text.includes("baby") ||
    text.includes("infant") ||
    text.includes("pediatric") ||
    text.includes("kid") ||
    text.includes("daughter") ||
    text.includes("son")
  ) {
    return {
      department: "Pediatrics & Child Health",
      specialistTitle: "Consultant Pediatrician",
      urgency: text.includes("high fever") || text.includes("breathing") ? "urgent" : "routine",
      sampleDoctors: ["Dr. Elena Rostova, MD, FAAP", "Dr. Meenakshi Sundaram, MD (Ped)"],
    };
  }

  if (
    text.includes("headache") ||
    text.includes("migraine") ||
    text.includes("dizz") ||
    text.includes("stroke") ||
    text.includes("numb") ||
    text.includes("nerve") ||
    text.includes("seizure") ||
    text.includes("neuro")
  ) {
    return {
      department: "Neurology & Brain Sciences",
      specialistTitle: "Consultant Neurologist",
      urgency: text.includes("speech") || text.includes("droop") ? "urgent" : "priority",
      sampleDoctors: ["Dr. Arthur Pendelton, MD, PhD", "Dr. Suresh V. Nair, DM (Neuro)"],
    };
  }

  if (
    text.includes("skin") ||
    text.includes("rash") ||
    text.includes("itch") ||
    text.includes("allergy") ||
    text.includes("acne") ||
    text.includes("dermat")
  ) {
    return {
      department: "Dermatology & Skin Wellness",
      specialistTitle: "Consultant Dermatologist",
      urgency: "routine",
      sampleDoctors: ["Dr. Priya Patel, MD, DVD", "Dr. Rohan Mukherjee, MD (Dermat)"],
    };
  }

  if (
    text.includes("stomach") ||
    text.includes("abdomen") ||
    text.includes("vomit") ||
    text.includes("acid") ||
    text.includes("digest") ||
    text.includes("gast") ||
    text.includes("liver")
  ) {
    return {
      department: "Gastroenterology & Hepatology",
      specialistTitle: "Consultant Gastroenterologist",
      urgency: text.includes("severe") || text.includes("blood") ? "urgent" : "routine",
      sampleDoctors: ["Dr. Arvind Swaminathan, DM (Gastro)", "Dr. Sunita Rao, DNB Gastro"],
    };
  }

  if (
    text.includes("eye") ||
    text.includes("vision") ||
    text.includes("cataract") ||
    text.includes("retina") ||
    text.includes("ophthal")
  ) {
    return {
      department: "Ophthalmology & Eye Care",
      specialistTitle: "Senior Ophthalmologist",
      urgency: "routine",
      sampleDoctors: ["Dr. Pranav Chawla, MS (Ophthal)", "Dr. Radhika Sen, DNB Eye"],
    };
  }

  // Default to Internal Medicine / General Practice
  return {
    department: "Internal Medicine & General Practice",
    specialistTitle: "Chief Medical Consultant",
    urgency: "routine",
    sampleDoctors: ["Dr. Sarah Chen, MD", "Dr. K. Srinivas Rao, MD (Med)"],
  };
}

/**
 * Generates realistic dynamic slots for today and tomorrow
 */
export function generateAvailableHospitalSlots(departmentName: string, doctorName: string): DaySlots[] {
  const now = new Date();
  
  const todayStr = "Today (" + now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ")";
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = "Tomorrow (" + tomorrow.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ")";

  return [
    {
      date: todayStr,
      isoDate: now.toISOString().split("T")[0],
      slots: [
        {
          id: "slot-t1",
          time: "02:30 PM",
          period: "Afternoon",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
        {
          id: "slot-t2",
          time: "04:15 PM",
          period: "Evening",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
        {
          id: "slot-t3",
          time: "06:00 PM",
          period: "Evening",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
      ],
    },
    {
      date: tomorrowStr,
      isoDate: tomorrow.toISOString().split("T")[0],
      slots: [
        {
          id: "slot-m1",
          time: "10:00 AM",
          period: "Morning",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
        {
          id: "slot-m2",
          time: "11:30 AM",
          period: "Morning",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
        {
          id: "slot-m3",
          time: "03:45 PM",
          period: "Afternoon",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
        {
          id: "slot-m4",
          time: "05:30 PM",
          period: "Evening",
          doctorName,
          doctorSpecialty: departmentName,
          consultationFee: "₹800",
          available: true,
        },
      ],
    },
  ];
}

/**
 * Generate formatted HTML Email for appointment confirmation
 */
export function formatAppointmentHtmlEmail(appt: AppointmentRecord): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Confirmed: Your Medical Appointment Pass #${appt.id} at ${appt.hospitalName}`;

  const text = `
APPOINTMENT CONFIRMATION
Hospital: ${appt.hospitalName}
Booking Ref: ${appt.id}
Patient: ${appt.patientName}
Department: ${appt.department}
Doctor: ${appt.doctorName}
Date: ${appt.appointmentDate}
Time: ${appt.appointmentTime}
Address: ${appt.hospitalAddress}
Hotline: ${appt.hospitalPhone}

Instructions: Please arrive 15 minutes before your scheduled slot. Present this reference number at the reception desk for priority OPD check-in.
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #faf9f6; margin: 0; padding: 24px; color: #0f172a; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }
    .header { background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: -0.02em; }
    .subtitle { font-size: 13px; opacity: 0.9; margin: 0; }
    .body-content { padding: 32px 28px; }
    .ticket { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 24px; }
    .ticket-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 13px; }
    .ticket-row:last-child { border-bottom: none; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; text-align: right; }
    .ref-highlight { font-family: monospace; font-size: 15px; color: #0891b2; font-weight: 800; }
    .instructions { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 8px; font-size: 12px; color: #1e3a8a; line-height: 1.5; margin-bottom: 24px; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; padding: 20px; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">Official Outpatient Pass</div>
      <h1 class="title">${appt.hospitalName}</h1>
      <p class="subtitle">AI Reception Desk • Appointment Booking Confirmation</p>
    </div>
    
    <div class="body-content">
      <p style="font-size: 14px; margin-top: 0; color: #334155;">
        Dear <strong>${appt.patientName}</strong>,<br>
        Your outpatient clinic appointment has been successfully scheduled. Here are your booking and arrival details:
      </p>

      <div class="ticket">
        <div class="ticket-row">
          <span class="label">Reference ID</span>
          <span class="value ref-highlight">${appt.id}</span>
        </div>
        <div class="ticket-row">
          <span class="label">Department</span>
          <span class="value">${appt.department}</span>
        </div>
        <div class="ticket-row">
          <span class="label">Consulting Doctor</span>
          <span class="value">${appt.doctorName}</span>
        </div>
        <div class="ticket-row">
          <span class="label">Appointment Date</span>
          <span class="value">${appt.appointmentDate}</span>
        </div>
        <div class="ticket-row">
          <span class="label">Time Slot</span>
          <span class="value" style="color: #059669;">${appt.appointmentTime}</span>
        </div>
        <div class="ticket-row">
          <span class="label">Hospital Address</span>
          <span class="value" style="max-width: 250px;">${appt.hospitalAddress}</span>
        </div>
        <div class="ticket-row">
          <span class="label">Reception Hotline</span>
          <span class="value">${appt.hospitalPhone}</span>
        </div>
      </div>

      <div class="instructions">
        <strong>Important Patient Instructions:</strong><br>
        • Please arrive <strong>15 minutes prior</strong> to your time slot for registration and vitals triage.<br>
        • Present this email or quote Ref <strong>${appt.id}</strong> at the front desk for priority queue access.<br>
        • Bring any prior prescriptions, diagnostic lab results, or imaging scans.
      </div>
    </div>

    <div class="footer">
      This is an automated confirmation sent by MedVoice AI on behalf of ${appt.hospitalName}.<br>
      For questions or rescheduling, please contact the hospital desk directly at ${appt.hospitalPhone}.
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html, text };
}

/**
 * Sends real email to the patient using Nodemailer (with custom SMTP or live Ethereal test inbox fallback)
 */
export async function sendAppointmentEmail(appt: AppointmentRecord): Promise<{
  success: boolean;
  previewUrl?: string;
  error?: string;
}> {
  try {
    const { subject, html, text } = formatAppointmentHtmlEmail(appt);

    const resendApiKey = process.env.RESEND_API_KEY;
    const gmailUser = process.env.GMAIL_USER || (process.env.SMTP_USER && process.env.SMTP_USER.includes("@gmail.com") ? process.env.SMTP_USER : undefined);
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM || gmailUser || `MedVoice AI <onboarding@resend.dev>`;

    // 1. Resend API Dispatch
    if (resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: smtpFrom.includes("<") ? smtpFrom : `MedVoice AI <${smtpFrom}>`,
          to: [appt.patientEmail],
          subject,
          text,
          html,
        }),
      });

      if (res.ok) {
        return { success: true };
      } else {
        const errJson = await res.json();
        console.warn("[Resend Dispatch Warning]:", errJson);
      }
    }

    let transporter: nodemailer.Transporter;

    // 2. Direct Gmail Service
    if (gmailUser && gmailPass) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass.replace(/\s+/g, ""), // strip any spaces in app passwords
        },
      });
    } else if (smtpHost && smtpUser && smtpPass) {
      // 3. Custom SMTP Server
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      // 4. Fallback: Ethereal test inbox (instant preview, but doesn't reach real Google servers)
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await transporter.sendMail({
      from: gmailUser ? `"MedVoice AI" <${gmailUser}>` : smtpFrom,
      to: appt.patientEmail,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || undefined;

    return {
      success: true,
      previewUrl: previewUrl || undefined,
    };
  } catch (err: any) {
    console.error("[Nodemailer Error]:", err);
    return {
      success: false,
      error: err?.message || "Failed to dispatch email",
    };
  }
}

/**
 * Generate iCalendar (.ics) content for one-click add to Google Calendar / Apple Calendar
 */
export function generateICalendarEvent(appt: AppointmentRecord): string {
  const created = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MedVoice AI//Hospital Appointment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appt.id}@medvoice.ai`,
    `DTSTAMP:${created}`,
    `SUMMARY:Medical Appt: ${appt.doctorName} (${appt.hospitalName})`,
    `DESCRIPTION:Appointment for ${appt.patientName} - ${appt.department}\\nChief Complaint: ${appt.chiefComplaint}\\nHospital Contact: ${appt.hospitalPhone}`,
    `LOCATION:${appt.hospitalName}, ${appt.hospitalAddress}`,
    `STATUS:CONFIRMED`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
