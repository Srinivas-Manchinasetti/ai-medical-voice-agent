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

export type AuditActorRole = "patient" | "admin" | "system";

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

import { getDb } from "@/config/db";
import { auditEventsTable } from "@/config/schema";
import { asc } from "drizzle-orm";

// In-memory append-only ledger for rapid access & fallback
let auditLedger: AuditEvent[] = [];

/**
 * Persist an audit event asynchronously to Neon PostgreSQL
 */
export async function persistAuditEventToDb(event: AuditEvent): Promise<boolean> {
  const dbClient = getDb();
  if (!dbClient) return false;
  try {
    await dbClient.insert(auditEventsTable).values({
      index: event.index,
      id: event.id,
      timestamp: event.timestamp,
      actorId: event.actorId,
      actorRole: event.actorRole,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      status: event.status,
      clientIp: event.clientIp,
      metadata: event.metadata,
      previousHash: event.previousHash,
      eventHash: event.eventHash,
    });
    return true;
  } catch (err) {
    console.warn("Failed to persist audit event to Neon DB:", err);
    return false;
  }
}

/**
 * Synchronize and hydrate the in-memory ledger from Neon PostgreSQL.
 * If the database has records and in-memory is empty or stale, loads the durable chain.
 */
export async function syncAuditLedgerFromDb(): Promise<AuditEvent[]> {
  const dbClient = getDb();
  if (!dbClient) return auditLedger;

  try {
    const records = await dbClient
      .select()
      .from(auditEventsTable)
      .orderBy(asc(auditEventsTable.index));

    if (records && records.length > 0) {
      // Map database rows to typed AuditEvent
      const dbEvents: AuditEvent[] = records.map((r: any) => ({
        index: r.index,
        id: r.id,
        timestamp: r.timestamp,
        actorId: r.actorId,
        actorRole: r.actorRole as AuditActorRole,
        action: r.action as AuditAction,
        resourceType: r.resourceType as AuditEvent["resourceType"],
        resourceId: r.resourceId,
        status: r.status as AuditEvent["status"],
        clientIp: r.clientIp || undefined,
        metadata: (r.metadata as Record<string, any>) || undefined,
        previousHash: r.previousHash,
        eventHash: r.eventHash,
      }));

      // Validate cryptographic chain before adopting
      const check = verifyAuditChain(dbEvents);
      if (check.valid) {
        // If DB has more events than memory, hydrate
        if (dbEvents.length >= auditLedger.length) {
          auditLedger = dbEvents;
        }
      } else {
        console.error("Cryptographic corruption detected in Neon DB audit records:", check.reason);
      }
    }
  } catch (err) {
    console.warn("Could not sync audit ledger from Neon DB, using memory cache:", err);
  }

  return auditLedger;
}

/**
 * Clear in-memory audit ledger (primarily for isolated test fixtures)
 */
export function clearAuditLedger(): void {
  auditLedger = [];
}

/**
 * Log a security or clinical event to the tamper-evident cryptographic hash chain.
 * Immediately registers in memory and dispatches background persistence to Neon PostgreSQL.
 */
export function logAuditEvent(
  params: {
    actorId: string;
    actorRole: AuditActorRole;
    action: AuditAction;
    resourceType: AuditEvent["resourceType"];
    resourceId: string;
    status?: "SUCCESS" | "DENIED" | "FAILED";
    clientIp?: string;
    metadata?: Record<string, any>;
  },
  skipBackgroundPersist: boolean = false
): AuditEvent {
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

  // Background persist to Neon DB if configured (non-blocking)
  if (!skipBackgroundPersist) {
    persistAuditEventToDb(fullEvent).catch((err) => {
      console.warn("Async audit persistence notice:", err?.message);
    });
  }

  return fullEvent;
}

/**
 * Log a security or clinical event and await confirmation of persistence to Neon PostgreSQL.
 */
export async function logAuditEventAsync(params: {
  actorId: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  resourceType: AuditEvent["resourceType"];
  resourceId: string;
  status?: "SUCCESS" | "DENIED" | "FAILED";
  clientIp?: string;
  metadata?: Record<string, any>;
}): Promise<AuditEvent> {
  const event = logAuditEvent(params, true);
  await persistAuditEventToDb(event);
  return event;
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
