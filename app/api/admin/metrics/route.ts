import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth/rbac";
import {
  logAuditEventAsync,
  syncAuditLedgerFromDb,
  verifyAuditChain,
  getAuditEvents,
} from "@/lib/audit/audit-logger";
import { getDb } from "@/config/db";
import { consultationsTable } from "@/config/schema";
import { memoryConsultations } from "../../consultations/route";
import { DOCTOR_PROFILES } from "@/config/doctors";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);

    // 1. Enforce Authentication (401 Unauthorized for unauthenticated callers)
    if (auth.userId === "unauthenticated") {
      await logAuditEventAsync({
        actorId: "unauthenticated",
        actorRole: "patient",
        action: "ACCESS_DENIED",
        resourceType: "system",
        resourceId: "admin_metrics",
        status: "DENIED",
        metadata: { reason: "Unauthenticated request attempted to query admin telemetry" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Administrator authentication required.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Enforce Role Permissions (403 Forbidden for non-admin roles)
    if (!hasPermission(auth.role, "analytics:read") && !hasPermission(auth.role, "system:read")) {
      await logAuditEventAsync({
        actorId: auth.userId,
        actorRole: auth.role,
        action: "ACCESS_DENIED",
        resourceType: "system",
        resourceId: "admin_metrics",
        status: "DENIED",
        metadata: { attemptedRole: auth.role, requiredPermission: "analytics:read" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Administrator privileges (analytics:read) required.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // 1. Fetch consultations from DB or fallback memory
    let consultations: any[] = [];
    let dbStatus: "connected" | "fallback_memory" = "fallback_memory";
    let dbLatencyMs = 0;

    const dbClient = getDb();
    if (dbClient) {
      try {
        const start = performance.now();
        consultations = await dbClient.select().from(consultationsTable);
        dbLatencyMs = Math.round(performance.now() - start);
        dbStatus = "connected";
      } catch (err) {
        console.warn("Admin metrics Neon query fallback:", err);
        consultations = memoryConsultations;
      }
    } else {
      consultations = memoryConsultations;
    }

    // 2. Fetch and verify audit chain
    await syncAuditLedgerFromDb();
    const auditVerification = verifyAuditChain();
    const auditEvents = getAuditEvents(100, 0);

    // 3. Compute clinical metrics
    const totalConsultations = consultations.length;
    let emergencyCount = 0;
    let priorityCount = 0;
    let routineCount = 0;
    let totalDuration = 0;
    const specialtyDistribution: Record<string, number> = {};
    const doctorDistribution: Record<string, number> = {};

    for (const c of consultations) {
      if (c.triageLevel === "emergency") emergencyCount++;
      else if (c.triageLevel === "priority") priorityCount++;
      else routineCount++;

      totalDuration += c.durationSeconds || 0;

      const spec = c.specialty || "General Medicine";
      specialtyDistribution[spec] = (specialtyDistribution[spec] || 0) + 1;

      const doc = c.doctorName || c.doctorId || "Unassigned";
      doctorDistribution[doc] = (doctorDistribution[doc] || 0) + 1;
    }

    const avgDurationSeconds = totalConsultations > 0 ? Math.round(totalDuration / totalConsultations) : 0;

    // 4. Compute safety metrics
    const accessDeniedCount = auditEvents.filter((e) => e.status === "DENIED").length;
    const emergencyDispatches = auditEvents.filter((e) => e.action === "EMERGENCY_DISPATCH").length;
    const triageEvaluations = auditEvents.filter((e) => e.action === "TRIAGE_EVALUATION").length;

    // Log the analytics read
    await logAuditEventAsync({
      actorId: auth.userId,
      actorRole: auth.role,
      action: "CONSULTATION_ACCESSED",
      resourceType: "system",
      resourceId: "admin_dashboard_metrics",
      status: "SUCCESS",
      metadata: { totalConsultations, totalAuditEvents: auditVerification.totalEvents },
    });

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalConsultations,
          emergencyCases: emergencyCount,
          priorityCases: priorityCount,
          routineCases: routineCount,
          avgDurationSeconds,
          emergencyRatePercent: totalConsultations > 0 ? Math.round((emergencyCount / totalConsultations) * 100) : 0,
        },
        systemHealth: {
          database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
            engine: "Neon Serverless PostgreSQL",
          },
          audioEngine: {
            status: "ready",
            provider: "Kokoro TTS (ONNX / WebAssembly + REST)",
            loadedVoices: ["af_sarah", "af_nicole", "am_michael", "bf_emma", "bm_george"],
            activePersona: "Dr. Anna Bennett, MD (af_nicole)",
          },
          safetyArbiter: {
            status: "active",
            protocol: "Emergency Severity Index (ESI) v4 Deterministic Rules",
            preArbiterBypassShield: "enforced",
          },
          cryptographicAudit: {
            status: auditVerification.valid ? "verified" : "corrupted",
            totalEvents: auditVerification.totalEvents,
            genesisHash: auditVerification.genesisHash,
            headHash: auditVerification.headHash,
            algorithm: "Canonical Chained SHA-256",
          },
        },
        distributions: {
          bySpecialty: specialtyDistribution,
          byDoctor: doctorDistribution,
        },
        safetyMetrics: {
          accessDeniedEvents: accessDeniedCount,
          emergencyDispatches,
          triageEvaluations,
          auditChainIntegrity: auditVerification.valid,
        },
        registeredDoctors: DOCTOR_PROFILES.map((d) => ({
          id: d.id,
          name: d.name,
          specialty: d.specialty,
          voiceId: d.voiceId,
          voiceGender: d.voiceGender,
        })),
      },
    });
  } catch (error: any) {
    console.error("[AdminMetricsError]", error);
    return NextResponse.json(
      { success: false, error: process.env.NODE_ENV === "production" ? "Failed to retrieve administrative metrics" : (error?.message || "Failed to generate admin metrics") },
      { status: 500 }
    );
  }
}
