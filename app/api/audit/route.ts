import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth/rbac";
import {
  getAuditEvents,
  verifyAuditChain,
  logAuditEvent,
  AuditEvent,
} from "@/lib/audit/audit-logger";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);

    // Only auditors and administrators may inspect the audit chain
    if (!hasPermission(auth.role, "audit:read")) {
      logAuditEvent({
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
          error: "Forbidden: Administrator credentials required to inspect the audit ledger.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const events = getAuditEvents(limit, offset);
    const verification = verifyAuditChain();

    // Log the audit inspection itself
    logAuditEvent({
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
