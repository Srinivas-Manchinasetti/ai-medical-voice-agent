import { NextResponse } from "next/server";
import {
  EmergencyDispatchPayloadSchema,
  computeClinicalAuditHash,
  generatePreArrivalDirectives,
  EmergencyDispatchReceipt,
} from "@/lib/emergency/dispatch";

// Simulated receiving hospital in-memory pre-arrival telemetry board
const activeDispatches: EmergencyDispatchReceipt[] = [];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = EmergencyDispatchPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid dispatch payload structure",
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    // Compute cryptographic audit hash
    const auditHash = computeClinicalAuditHash({
      consultationId: payload.consultationId,
      patientId: payload.patientId,
      timestamp: payload.timestamp,
      esiScore: payload.esiScore,
      triageLevel: payload.triageLevel,
      icd10Codes: payload.icd10Codes,
      chiefComplaint: payload.chiefComplaint,
    });

    // Generate clinical pre-arrival directives and bay reservation
    const { bay, physician, directives } = generatePreArrivalDirectives(
      payload.esiScore,
      payload.redFlagsTriggered
    );

    const dispatchId = `DISPATCH-ED-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const receipt: EmergencyDispatchReceipt = {
      dispatchId,
      consultationId: payload.consultationId,
      hospitalName: payload.targetHospitalName,
      intakeQueueStatus: "TRIAGE_BAY_RESERVED",
      assignedHospitalBay: bay,
      attendingPhysicianOnCall: physician,
      etaMinutes: payload.etaMinutes,
      auditHash,
      tamperVerified: true,
      timestamp: new Date().toISOString(),
      preArrivalDirectives: directives,
    };

    // Store in receiving hospital telemetry board
    activeDispatches.unshift(receipt);
    if (activeDispatches.length > 50) activeDispatches.pop();

    return NextResponse.json({
      success: true,
      message: "Emergency pre-arrival alert transmitted and acknowledged by receiving hospital ED.",
      receipt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Emergency dispatch failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const consultationId = searchParams.get("consultationId");

    if (consultationId) {
      const match = activeDispatches.find((d) => d.consultationId === consultationId);
      return NextResponse.json({ success: true, dispatch: match || null });
    }

    return NextResponse.json({
      success: true,
      totalActive: activeDispatches.length,
      dispatches: activeDispatches.slice(0, 10),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to query telemetry board" },
      { status: 500 }
    );
  }
}
