import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth/rbac";
import {
  getAuditEvents,
  verifyAuditChain,
  logAuditEventAsync,
  syncAuditLedgerFromDb,
  AuditEvent,
} from "@/lib/audit/audit-logger";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);

    // 1. Enforce Authentication (401 Unauthorized for unauthenticated callers)
    if (auth.userId === "unauthenticated") {
      await logAuditEventAsync({
        actorId: "unauthenticated",
        actorRole: "patient",
        action: "ACCESS_DENIED",
        resourceType: "audit",
        resourceId: "audit_ledger",
        status: "DENIED",
        metadata: { reason: "Unauthenticated request attempted to query audit ledger" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Administrator authentication required to inspect the audit ledger.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    // 2. Enforce Role Permissions (403 Forbidden for non-admin roles)
    if (!hasPermission(auth.role, "audit:read")) {
      await logAuditEventAsync({
        actorId: auth.userId,
        actorRole: auth.role,
        action: "ACCESS_DENIED",
        resourceType: "audit",
        resourceId: "audit_ledger",
        status: "DENIED",
        metadata: { attemptedRole: auth.role, requiredPermission: "audit:read" },
      });

      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Administrator credentials (audit:read) required to inspect the audit ledger.",
          code: "FORBIDDEN",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    await syncAuditLedgerFromDb();
    const events = getAuditEvents(limit, offset);
    const verification = verifyAuditChain();

    // Log the audit inspection itself
    await logAuditEventAsync({
      actorId: auth.userId,
      actorRole: auth.role,
      action: "AUDIT_CHAIN_VERIFIED",
      resourceType: "audit",
      resourceId: "chain_head",
      status: "SUCCESS",
      metadata: {
        totalVerifiedEvents: verification.totalEvents,
        chainValid: verification.valid,
        inspectedRange: { offset, limit },
      },
    });

    return NextResponse.json({
      success: true,
      integrity: {
        valid: verification.valid,
        totalEvents: verification.totalEvents,
        genesisHash: verification.genesisHash,
        headHash: verification.headHash,
        corruptedIndex: verification.corruptedIndex,
        reason: verification.reason,
      },
      events,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Audit inspection failure" },
      { status: 500 }
    );
  }
}
