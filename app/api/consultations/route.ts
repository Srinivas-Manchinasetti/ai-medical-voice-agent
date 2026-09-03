import { NextResponse } from "next/server";
import { getDb } from "@/config/db";
import { consultationsTable } from "@/config/schema";
import { desc, eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

// Fallback in-memory store if database is initializing or during local test
const memoryConsultations: any[] = [];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");

    let user = null;
    try {
      user = await currentUser();
    } catch {
      // Clerk optional if not logged in
    }

    const targetUserId = userIdParam || user?.id;

    // Try fetching from Neon database
    const dbClient = getDb();
    if (dbClient) {
      try {
        let results;
        if (targetUserId) {
          results = await dbClient
            .select()
            .from(consultationsTable)
            .where(eq(consultationsTable.userId, targetUserId))
            .orderBy(desc(consultationsTable.createdAt))
            .limit(20);
        } else {
          results = await dbClient
            .select()
            .from(consultationsTable)
            .orderBy(desc(consultationsTable.createdAt))
            .limit(20);
        }
        return NextResponse.json({ success: true, consultations: results });
      } catch (dbErr) {
        console.warn("Neon DB query fallback to local cache:", dbErr);
      }
    }

    // Fallback to local array
    const filtered = targetUserId
      ? memoryConsultations.filter((c) => c.userId === targetUserId)
      : memoryConsultations;

    return NextResponse.json({
      success: true,
      consultations: filtered.slice().reverse()
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch consultations" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id = `MED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      patientName = "Anonymous Patient",
      patientAge,
      patientGender,
      doctorId = "dr-sarah-chen",
      doctorName = "Dr. Sarah Chen, MD",
      specialty = "General Physician",
      chiefComplaint = "",
      transcript = [],
      triageLevel = "routine",
      triageTitle = "LEVEL 3: ROUTINE CLINICAL CARE",
      icd10Codes = [],
      detectedSymptoms = [],
      soapSubjective = "",
      soapObjective = "",
      soapAssessment = "",
      soapPlan = "",
      recommendedSpecialists = [],
      recommendedAction = "",
      durationSeconds = 0,
    } = body;

    const newRecord = {
      id,
      userId: userId || "anon-user",
      patientName,
      patientAge: patientAge ? String(patientAge) : undefined,
      patientGender,
      doctorId,
      doctorName,
      specialty,
      chiefComplaint,
      transcript,
      triageLevel,
      triageTitle,
      icd10Codes,
      detectedSymptoms,
      soapSubjective,
      soapObjective,
      soapAssessment,
      soapPlan,
      recommendedSpecialists,
      recommendedAction,
      durationSeconds,
      createdAt: new Date()
    };

    // Store in Neon DB if configured
    const dbClient = getDb();
    if (dbClient) {
      try {
        await dbClient.insert(consultationsTable).values(newRecord as any);
        return NextResponse.json({ success: true, consultation: newRecord });
      } catch (dbErr) {
        console.warn("Neon DB insert error, saving to memory buffer:", dbErr);
      }
    }

    // Save to memory store
    memoryConsultations.push(newRecord);

    return NextResponse.json({
      success: true,
      consultation: newRecord,
      note: "Saved to clinical consultation session buffer."
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save consultation" },
      { status: 500 }
    );
  }
}
