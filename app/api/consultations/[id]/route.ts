import { NextResponse } from "next/server";
import { getDb } from "@/config/db";
import { consultationsTable } from "@/config/schema";
import { eq } from "drizzle-orm";
import { memoryConsultations } from "../route";
import { getAuthContext, hasPermission } from "@/lib/auth/rbac";
import { logAuditEventAsync } from "@/lib/audit/audit-logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    const { id } = await params;

    // 1. Enforce Authentication (401 for unauthenticated requests unless in test/demo mode)
    if (auth.userId === "unauthenticated" && !auth.isDemoMode) {
      await logAuditEventAsync({
        actorId: "unauthenticated",
        actorRole: "patient",
        action: "ACCESS_DENIED",
        resourceType: "consultation",
        resourceId: id,
        status: "DENIED",
        metadata: { reason: "Unauthenticated request attempted to read consultation record" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Authentication required to view consultation records.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Lookup record in Neon database or local memory fallback
    let record: any = null;
    const dbClient = getDb();
    if (dbClient) {
      try {
        const records = await dbClient
          .select()
          .from(consultationsTable)
          .where(eq(consultationsTable.id, id))
          .limit(1);

        if (records.length > 0) {
          record = records[0];
        }
      } catch (err) {
        console.warn("DB lookup error:", err);
      }
    }

    // Fallback to memory store
    if (!record) {
      record = memoryConsultations.find((c) => c.id === id);
    }

    if (!record) {
      return NextResponse.json(
        { success: false, message: "Consultation report not found" },
        { status: 404 }
      );
    }

    // 3. Ownership & IDOR Protection:
    // Patients can only view their own consultations (record.userId === auth.userId).
    // Platform administrators (with system:read / analytics:read) have authority to inspect.
    const isOwner = record.userId === auth.userId || (auth.isDemoMode && (record.userId === "anon-user" || record.userId === auth.userId));
    const isAdmin = auth.role === "admin";

    if (!isOwner && !isAdmin) {
      await logAuditEventAsync({
        actorId: auth.userId,
        actorRole: auth.role,
        action: "ACCESS_DENIED",
        resourceType: "consultation",
        resourceId: id,
        status: "DENIED",
        metadata: {
          reason: "IDOR prevention: Patient attempted to access another patient's consultation",
          recordOwnerId: record.userId,
          attemptedBy: auth.userId,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: You are only authorized to access your own clinical consultation records.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // 4. Log consultation access in durable audit ledger
    await logAuditEventAsync({
      actorId: auth.userId,
      actorRole: auth.role,
      action: "CONSULTATION_ACCESSED",
      resourceType: "consultation",
      resourceId: id,
      status: "SUCCESS",
      metadata: {
        triageLevel: record.triageLevel,
        specialty: record.specialty,
        isOwner,
        isAdmin,
      },
    });

    return NextResponse.json({ success: true, consultation: record });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

