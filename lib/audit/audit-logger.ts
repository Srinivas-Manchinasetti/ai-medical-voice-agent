import { createHash } from "crypto";

export type AuditAction =
  | "CONSULTATION_CREATED"
  | "CONSULTATION_ACCESSED"
  | "CONSULTATION_OVERRIDE"
  | "TRIAGE_EVALUATION"
  | "EMERGENCY_DISPATCH"
  | "AUDIT_CHAIN_VERIFIED"
  | "ACCESS_DENIED"
  | "ROLE_ELEVATION_ATTEMPT";

export type AuditActorRole = "patient" | "doctor" | "auditor" | "admin" | "system";

export interface AuditEvent {
  index: number;
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  resourceType: "consultation" | "dispatch" | "patient" | "audit" | "auth" | "system";
  resourceId: string;
  status: "SUCCESS" | "DENIED" | "FAILED";
  clientIp?: string;
  metadata?: Record<string, any>;
  previousHash: string;
  eventHash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  genesisHash: string;
  headHash: string | null;
  corruptedIndex?: number;
  reason?: string;
}

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

// Deterministic canonical hash computation
export function computeEventHash(event: Omit<AuditEvent, "eventHash">): string {
  // Sort metadata keys deterministically to guarantee reproducible hashing
  const sortedMetadata = event.metadata
    ? Object.keys(event.metadata)
        .sort()
        .reduce((acc, key) => {
          acc[key] = event.metadata![key];
          return acc;
        }, {} as Record<string, any>)
    : {};

  const payload = [
    event.index,
    event.id,
    event.timestamp,
    event.actorId,
    event.actorRole,
    event.action,
    event.resourceType,
    event.resourceId,
    event.status,
    event.previousHash,
    JSON.stringify(sortedMetadata),
  ].join("|");

  return createHash("sha256").update(payload, "utf8").digest("hex");
}

// In-memory append-only ledger for rapid access & fallback
const auditLedger: AuditEvent[] = [];

/**
 * Log a security or clinical event to the tamper-evident cryptographic hash chain.
 */
export function logAuditEvent(params: {
  actorId: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  resourceType: AuditEvent["resourceType"];
  resourceId: string;
  status?: "SUCCESS" | "DENIED" | "FAILED";
  clientIp?: string;
  metadata?: Record<string, any>;
}): AuditEvent {
  const index = auditLedger.length;
  const previousHash = index === 0 ? GENESIS_HASH : auditLedger[index - 1].eventHash;
  const id = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  const status = params.status || "SUCCESS";

  const partialEvent: Omit<AuditEvent, "eventHash"> = {
    index,
    id,
    timestamp,
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    status,
    clientIp: params.clientIp,
    metadata: params.metadata,
    previousHash,
  };

  const eventHash = computeEventHash(partialEvent);
  const fullEvent: AuditEvent = { ...partialEvent, eventHash };

  auditLedger.push(fullEvent);
  return fullEvent;
}

/**
 * Verify cryptographic integrity of an audit event sequence.
 * Detects any data mutation, record insertion, deletion, or reordering.
 */
export function verifyAuditChain(events: AuditEvent[] = auditLedger): ChainVerificationResult {
  if (events.length === 0) {
    return {
      valid: true,
      totalEvents: 0,
      genesisHash: GENESIS_HASH,
      headHash: null,
    };
  }

  for (let i = 0; i < events.length; i++) {
    const current = events[i];

    // 1. Verify index continuity
    if (current.index !== i) {
      return {
        valid: false,
        totalEvents: events.length,
        genesisHash: GENESIS_HASH,
        headHash: events[events.length - 1]?.eventHash || null,
        corruptedIndex: i,
        reason: `Index mismatch at position ${i}: expected ${i}, found ${current.index}`,
      };
    }

    // 2. Verify previousHash pointer
    const expectedPrevious = i === 0 ? GENESIS_HASH : events[i - 1].eventHash;
    if (current.previousHash !== expectedPrevious) {
      return {
        valid: false,
        totalEvents: events.length,
        genesisHash: GENESIS_HASH,
        headHash: events[events.length - 1]?.eventHash || null,
        corruptedIndex: i,
        reason: `Broken chain pointer at index ${i}: expected previousHash '${expectedPrevious}', got '${current.previousHash}'`,
      };
    }

    // 3. Verify eventHash integrity
    const computedHash = computeEventHash(current);
    if (computedHash !== current.eventHash) {
      return {
        valid: false,
        totalEvents: events.length,
        genesisHash: GENESIS_HASH,
        headHash: events[events.length - 1]?.eventHash || null,
        corruptedIndex: i,
        reason: `Payload hash tampering detected at index ${i}: stored hash does not match computed SHA-256`,
      };
    }
  }

  return {
    valid: true,
    totalEvents: events.length,
    genesisHash: GENESIS_HASH,
    headHash: events[events.length - 1].eventHash,
  };
}

/**
 * Read-only accessor for the audit ledger (safe copy).
 */
export function getAuditEvents(limit: number = 50, offset: number = 0): AuditEvent[] {
  return auditLedger.slice(offset, offset + limit).map((e) => ({ ...e }));
}
