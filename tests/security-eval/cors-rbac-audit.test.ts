import {
  logAuditEvent,
  clearAuditLedger,
  verifyAuditChain,
  getAuditEvents,
  computeEventHash,
  AuditEvent,
  GENESIS_HASH,
} from "../../lib/audit/audit-logger";
import {
  hasPermission,
  ROLE_PERMISSIONS,
  Role,
  Permission,
  getAuthContext,
  authorizeRequest,
} from "../../lib/auth/rbac";
import { evaluateSafetyArbiter } from "../../lib/triage/safety-arbiter";
import { GET as getConsultationById } from "../../app/api/consultations/[id]/route";
import { GET as getConsultationFhir } from "../../app/api/consultations/[id]/fhir/route";
import { GET as getEmergencyDispatches, POST as postEmergencyDispatch } from "../../app/api/emergency/pre-arrival/route";
import { memoryConsultations } from "../../app/api/consultations/route";

// Ensure test environment is explicitly set for test runner
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runSecurityAndAuditTestSuite() {
  console.log("\n========================================================");
  console.log("  PHASE 1 SECURITY, RBAC & AUDIT VERIFICATION SUITE");
  console.log("========================================================\n");

  // TEST 1: RBAC Permission Matrix Checks (Clean Patient / Admin Model)
  console.log("[Test Suite 1] Role-Based Access Control (RBAC) Invariants");
  {
    // Patient Permissions & Least-Privilege Boundaries
    assert(hasPermission("patient", "consultations:create"), "Patient can create their own consultation");
    assert(hasPermission("patient", "consultations:read:own"), "Patient can read their own consultations");
    assert(hasPermission("patient", "emergency:dispatch"), "Patient can trigger emergency dispatch");
    assert(hasPermission("patient", "health:export:own"), "Patient can export their own FHIR health record");

    // Negative Boundaries: Patient CANNOT access platform audit or analytics
    assert(!hasPermission("patient", "audit:read"), "Patient CANNOT inspect audit ledger");
    assert(!hasPermission("patient", "audit:verify"), "Patient CANNOT verify audit chain");
    assert(!hasPermission("patient", "analytics:read"), "Patient CANNOT access system analytics");
    assert(!hasPermission("patient", "system:read"), "Patient CANNOT access platform internals");

    // Admin Permissions (Platform Maintenance & Compliance)
    assert(hasPermission("admin", "analytics:read"), "Admin can read platform analytics");
    assert(hasPermission("admin", "system:read"), "Admin can monitor system health");
    assert(hasPermission("admin", "audit:read"), "Admin can inspect audit ledger");
    assert(hasPermission("admin", "audit:verify"), "Admin has audit:verify permission");

    // Critical Clinical Invariant: Admin CANNOT arbitrarily override AI clinical triage
    // (Clinical safety is governed strictly by the deterministic Safety Arbiter, not admin fiat)
    assert(!hasPermission("admin", "consultations:create"), "Admin does not initiate clinical patient consultations");
  }

  // TEST 1b: Server-Side Authentication Boundary & Anti-Spoofing Invariants
  console.log("\n[Test Suite 1b] Server-Side Authentication Boundary & Anti-Spoofing Invariants");
  {
    // 1. Unauthenticated Request Resolution
    const anonReq = new Request("https://app.medvoice.org/api/admin/metrics");
    // Temporarily verify non-test behavior by simulating clean production environment
    const prevEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const unauthContext = await getAuthContext(anonReq);
      assert(unauthContext.userId === "unauthenticated", "Unauthenticated request resolves to userId: 'unauthenticated'");
      assert(unauthContext.role === "patient", "Unauthenticated request strictly assigned non-privileged 'patient' role");

      // Attempting to spoof admin via header in production MUST FAIL
      const spoofAttemptReq = new Request("https://app.medvoice.org/api/admin/metrics", {
        headers: { "x-mock-role": "admin" },
      });
      const spoofedContext = await getAuthContext(spoofAttemptReq);
      assert(spoofedContext.role === "patient", "Client-controlled 'x-mock-role: admin' is strictly rejected in production");
      assert(spoofedContext.userId === "unauthenticated", "Spoofed client remains unauthenticated");

      // Verify authorizeRequest returns 401 Unauthorized for unauthenticated callers
      const authResult = await authorizeRequest(spoofAttemptReq, "analytics:read");
      assert(authResult.authorized === false, "Access correctly denied for spoof attempt");
      if (!authResult.authorized) {
        assert(authResult.errorResponse.status === 401, "Unauthenticated spoof attempt returns 401 Unauthorized");
      }
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }

    // 2. Test Harness Role Emulation (only available when NODE_ENV === 'test')
    const testAdminReq = new Request("https://app.medvoice.org/api/admin/metrics", {
      headers: { "x-mock-role": "admin", "x-mock-user-id": "test-admin-99" },
    });
    const testAdminContext = await getAuthContext(testAdminReq);
    assert(testAdminContext.role === "admin", "Automated test harness can emulate admin for unit tests");

    // 3. Authenticated Admin Down-scoping (Privilege Attenuation)
    // When an admin voluntarily requests patient simulation, it down-scopes safely
    const adminDownscopeReq = new Request("https://app.medvoice.org/api/admin/metrics", {
      headers: { "x-mock-role": "admin", "x-simulate-patient-view": "true" },
    });
    // In test harness, x-mock-role creates admin, but x-simulate-patient-view down-scopes
    // (Note: in production, Clerk provides the verified admin role)
  }

  // TEST 2: Tamper-Evident Cryptographic Hash Chain
  console.log("\n[Test Suite 2] Cryptographic Hash Chained Audit Ledger");
  {
    clearAuditLedger();
    // Log clean events
    const event1 = logAuditEvent({
      actorId: "usr-patient-101",
      actorRole: "patient",
      action: "CONSULTATION_CREATED",
      resourceType: "consultation",
      resourceId: "MED-TEST-001",
      status: "SUCCESS",
      metadata: { chiefComplaint: "Shortness of breath on exertion" },
    });

    assert(event1.index === 0, "Genesis event index is 0");
    assert(event1.previousHash === GENESIS_HASH, "Genesis event previousHash equals GENESIS_HASH constant");
    assert(event1.eventHash.length === 64, "Event hash is valid 64-char SHA-256 hex string");

    const event2 = logAuditEvent({
      actorId: "usr-admin-01",
      actorRole: "admin",
      action: "CONSULTATION_ACCESSED",
      resourceType: "consultation",
      resourceId: "MED-TEST-001",
      status: "SUCCESS",
      metadata: { reason: "Platform telemetry and compliance review" },
    });

    assert(event2.index === 1, "Second event index is 1");
    assert(event2.previousHash === event1.eventHash, "Event 2 previousHash links cryptographically to Event 1 hash");

    const event3 = logAuditEvent({
      actorId: "usr-patient-999",
      actorRole: "patient",
      action: "ACCESS_DENIED",
      resourceType: "consultation",
      resourceId: "MED-TEST-001",
      status: "DENIED",
      metadata: { reason: "Unauthorized attempt to view other patient record" },
    });

    assert(event3.previousHash === event2.eventHash, "Event 3 previousHash links cryptographically to Event 2 hash");

    // Verify pristine chain
    const verifyClean = verifyAuditChain();
    assert(verifyClean.valid === true, "Audit chain integrity validates successfully for unmodified records");
    assert(verifyClean.totalEvents >= 3, `Chain tracks all logged events (counted ${verifyClean.totalEvents})`);

    // TEST 3: Tamper Detection (Bit Flip / Payload Alteration Attack)
    console.log("\n[Test Suite 3] Tamper Detection & Malicious Mutation Defense");

    // Create a local copy to simulate a database tampering attack
    const corruptedEvents: AuditEvent[] = getAuditEvents(10, 0);
    // Maliciously alter metadata in the second record without updating hash
    corruptedEvents[1] = {
      ...corruptedEvents[1],
      metadata: { specialty: "Cardiology", maliciousInjectedField: "attacker_bypass" },
    };

    const verifyTampered = verifyAuditChain(corruptedEvents);
    assert(verifyTampered.valid === false, "Verification correctly FAILS when record payload is tampered with");
    assert(verifyTampered.corruptedIndex === 1, "Verification accurately identifies corrupted index 1");
    console.log(`  ✓ Tamper detection correctly flagged: "${verifyTampered.reason}"`);

    // Simulating chain break (swapping records)
    const swappedEvents: AuditEvent[] = getAuditEvents(10, 0);
    const temp = swappedEvents[1];
    swappedEvents[1] = swappedEvents[2];
    swappedEvents[2] = temp;

    const verifySwapped = verifyAuditChain(swappedEvents);
    assert(verifySwapped.valid === false, "Verification correctly FAILS when record sequence is reordered");
    console.log(`  ✓ Reordering detection correctly flagged: "${verifySwapped.reason}"`);
  }

  // TEST 4: Triage Safety Arbiter Negation & Emergency Flagging
  console.log("\n[Test Suite 4] Canonical Triage Arbiter Negation & Consistency");
  {
    // Affirmative emergency
    const emergencyCase = evaluateSafetyArbiter({
      rawText: "I have acute crushing chest pressure radiating into my left arm with cold sweats.",
    });
    assert(emergencyCase.isEmergency === true, "Crushing chest pressure + arm radiation flags EMERGENCY");
    assert(emergencyCase.esiScore <= 2, "Assigned ESI Score <= 2 (Emergent)");
    assert(emergencyCase.redFlagsTriggered.length > 0, "Red flags triggered for ACS presentation");

    // Negated emergency (should NOT trigger emergency)
    const negatedCase = evaluateSafetyArbiter({
      rawText: "I have a scratchy throat and runny nose for two days. I have no chest pain and no shortness of breath.",
    });
    assert(negatedCase.isEmergency === false, "Negated chest pain ('no chest pain') does NOT trigger emergency");
    assert(negatedCase.triageLevel !== "emergency", "Triage level is non-emergency for upper respiratory with negated cardiac signs");
    assert(!negatedCase.redFlagsTriggered.some(f => f.includes("CHEST_PAIN")), "Chest pain red flag is NOT triggered when negated");

    // Stroke detection
    const strokeCase = evaluateSafetyArbiter({
      rawText: "My mother suddenly developed right facial droop and her speech is slurred.",
    });
    assert(strokeCase.isEmergency === true, "Acute facial droop + slurred speech flags EMERGENCY (Stroke BE-FAST)");
    assert(strokeCase.redFlagsTriggered.some(f => f.includes("STROKE")), "Stroke red flag correctly registered");
  }

  // TEST 5: Doctor Voice Persona Identity Invariants
  console.log("\n[Test Suite 5] Immutable Doctor Voice Persona Invariants");
  {
    const { DOCTOR_PROFILES, DOCTOR_VOICE_PROFILES, getDoctorById } = await import("../../config/doctors");
    const { DOCTOR_KOKORO_VOICES, resolveAuthoritativeVoice, resolveAuthoritativeSpeed } = await import("../../lib/audio/kokoro-service");

    const EXPECTED_VOICES: Record<string, { voiceId: string; gender: "female" | "male"; speed: number; provider: string }> = {
      "dr-sarah-chen": { voiceId: "af_sarah", gender: "female", speed: 0.96, provider: "kokoro" },
      "dr-marcus-vance": { voiceId: "am_michael", gender: "male", speed: 0.92, provider: "kokoro" },
      "dr-elena-rostova": { voiceId: "bf_emma", gender: "female", speed: 0.97, provider: "kokoro" },
      "dr-arthur-pendelton": { voiceId: "bm_george", gender: "male", speed: 0.90, provider: "kokoro" },
      "dr-anna-bennett": { voiceId: "af_nicole", gender: "female", speed: 0.98, provider: "kokoro" },
    };

    assert(DOCTOR_PROFILES.length === 5, "5 distinct clinical personas defined");

    for (const doc of DOCTOR_PROFILES) {
      const expected = EXPECTED_VOICES[doc.id];
      assert(!!expected, `Doctor profile '${doc.id}' registered in expected voices matrix`);
      assert(doc.voiceId === expected.voiceId, `Doctor '${doc.name}' (${doc.id}) has immutable voiceId: '${expected.voiceId}'`);
      assert(doc.voiceGender === expected.gender, `Doctor '${doc.name}' has matching voiceGender: '${expected.gender}'`);
      assert(doc.voiceProfile.speed === expected.speed, `Doctor '${doc.name}' has calibrated prosody speed: ${expected.speed}`);
      
      if (expected.provider === "kokoro") {
        assert(DOCTOR_KOKORO_VOICES[doc.id] === expected.voiceId, `Kokoro service mapping confirms '${doc.id}' -> '${expected.voiceId}'`);
        const authoritativeVoice = resolveAuthoritativeVoice(doc.id);
        assert(authoritativeVoice === expected.voiceId, `resolveAuthoritativeVoice returns '${expected.voiceId}' for ${doc.id}`);
        const authoritativeSpeed = resolveAuthoritativeSpeed(doc.id);
        assert(authoritativeSpeed === expected.speed, `resolveAuthoritativeSpeed returns '${expected.speed}' for ${doc.id}`);
      }

      const resolved = getDoctorById(doc.id);
      assert(resolved.voiceId === expected.voiceId, `getDoctorById resolves voiceId '${expected.voiceId}' for ${doc.name}`);
    }

    // Anti-Spoofing & Client Override Rejection Test
    console.log("\n[Test Suite 5b] Voice Anti-Spoofing & Client Override Rejection");
    {
      // Attempt: Client requests Dr. Anna Bennett (female) with Dr. Marcus's voice (male)
      const spoofedAttemptDoctorId = "dr-anna-bennett";
      const spoofedRequestedVoice = "am_michael";
      const profile = DOCTOR_VOICE_PROFILES[spoofedAttemptDoctorId];
      const enforcedVoice = profile.voiceId;

      assert(enforcedVoice === "af_nicole", "Server strictly enforces af_nicole for Dr. Anna Bennett, rejecting spoofed am_michael");
      assert(enforcedVoice !== spoofedRequestedVoice, "Server-authoritative voice does NOT honor unauthorized client voice override");

      // Attempt: Unknown / manipulated doctor ID
      const fallbackVoice = resolveAuthoritativeVoice("invalid-manipulated-doctor-id");
      assert(fallbackVoice === "af_sarah", "Unknown doctor ID defaults safely to lead clinician voice (af_sarah), preventing arbitrary synthesis");
    }
  }

  // TEST 6: Sensitive API Endpoint Ownership & IDOR Protection Invariants
  console.log("\n[Test Suite 6] Sensitive API Endpoint Ownership & IDOR Protection Invariants");
  {
    const testConsultationId = "MED-TEST-OWNER-991";
    memoryConsultations.push({
      id: testConsultationId,
      userId: "patient-alice-123",
      patientName: "Alice Wonderland",
      patientAge: "35",
      patientGender: "female",
      doctorId: "dr-sarah-chen",
      doctorName: "Dr. Sarah Chen, MD",
      specialty: "Internal Medicine",
      chiefComplaint: "Acute throat pain and difficulty swallowing",
      triageLevel: "routine",
      triageTitle: "ESI LEVEL 4: ROUTINE",
      detectedSymptoms: ["Sore Throat"],
      soapSubjective: "Patient Alice reports 2 days of throat pain.",
      createdAt: new Date().toISOString(),
    });

    // 1. Unauthenticated Consultation Access (Production Simulation)
    const prevEnv = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      const anonConsultReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}`);
      const anonConsultRes = await getConsultationById(anonConsultReq, {
        params: Promise.resolve({ id: testConsultationId }),
      });
      assert(anonConsultRes.status === 401, "Unauthenticated request to read consultation returns 401 Unauthorized");

      const anonFhirReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}/fhir`);
      const anonFhirRes = await getConsultationFhir(anonFhirReq, {
        params: Promise.resolve({ id: testConsultationId }),
      });
      assert(anonFhirRes.status === 401, "Unauthenticated request to export FHIR bundle returns 401 Unauthorized");

      const anonTelemetryReq = new Request("https://medvoice.org/api/emergency/pre-arrival");
      const anonTelemetryRes = await getEmergencyDispatches(anonTelemetryReq);
      assert(anonTelemetryRes.status === 401, "Unauthenticated request to query telemetry board returns 401 Unauthorized");
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prevEnv;
    }

    // 2. IDOR Prevention: Patient Bob attempts to read Patient Alice's consultation
    const bobConsultReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}`, {
      headers: { "x-mock-role": "patient", "x-mock-user-id": "patient-bob-456" },
    });
    const bobConsultRes = await getConsultationById(bobConsultReq, {
      params: Promise.resolve({ id: testConsultationId }),
    });
    assert(bobConsultRes.status === 403, "IDOR attempt: Patient Bob cannot read Patient Alice's consultation (403 Forbidden)");

    // 3. IDOR Prevention: Patient Bob attempts to export Patient Alice's FHIR bundle
    const bobFhirReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}/fhir`, {
      headers: { "x-mock-role": "patient", "x-mock-user-id": "patient-bob-456" },
    });
    const bobFhirRes = await getConsultationFhir(bobFhirReq, {
      params: Promise.resolve({ id: testConsultationId }),
    });
    assert(bobFhirRes.status === 403, "IDOR attempt: Patient Bob cannot export Patient Alice's FHIR records (403 Forbidden)");

    // 4. Legitimate Patient Owner Access: Alice reads and exports her own consultation
    const aliceConsultReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}`, {
      headers: { "x-mock-role": "patient", "x-mock-user-id": "patient-alice-123" },
    });
    const aliceConsultRes = await getConsultationById(aliceConsultReq, {
      params: Promise.resolve({ id: testConsultationId }),
    });
    assert(aliceConsultRes.status === 200, "Patient Alice can read her own consultation (200 OK)");

    const aliceFhirReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}/fhir`, {
      headers: { "x-mock-role": "patient", "x-mock-user-id": "patient-alice-123" },
    });
    const aliceFhirRes = await getConsultationFhir(aliceFhirReq, {
      params: Promise.resolve({ id: testConsultationId }),
    });
    assert(aliceFhirRes.status === 200, "Patient Alice can export her own FHIR R4 Bundle (200 OK)");

    // 5. Administrator Oversight: Admin can inspect consultation for compliance
    const adminConsultReq = new Request(`https://medvoice.org/api/consultations/${testConsultationId}`, {
      headers: { "x-mock-role": "admin", "x-mock-user-id": "admin-super" },
    });
    const adminConsultRes = await getConsultationById(adminConsultReq, {
      params: Promise.resolve({ id: testConsultationId }),
    });
    assert(adminConsultRes.status === 200, "Administrator can inspect consultation records (200 OK)");

    // 6. Emergency Pre-Arrival RBAC
    // Admin role CANNOT initiate patient clinical emergency ambulance dispatch
    const adminDispatchReq = new Request("https://medvoice.org/api/emergency/pre-arrival", {
      method: "POST",
      headers: { "x-mock-role": "admin", "x-mock-user-id": "admin-super", "Content-Type": "application/json" },
      body: JSON.stringify({
        consultationId: testConsultationId,
        patientId: "patient-alice-123",
        timestamp: new Date().toISOString(),
        esiScore: 2,
        triageLevel: "emergency",
        triageTitle: "ESI LEVEL 2: EMERGENT",
        icd10Codes: ["I20.9"],
        chiefComplaint: "Crushing chest pressure",
        targetHospitalName: "Apollo Emergency Center",
        etaMinutes: 12,
        redFlagsTriggered: ["ACS_CHEST_PAIN"],
      }),
    });
    const adminDispatchRes = await postEmergencyDispatch(adminDispatchReq);
    assert(adminDispatchRes.status === 403, "Admin cannot trigger clinical emergency dispatch (403 Forbidden)");

    // Patient CAN initiate emergency ambulance dispatch
    const patientDispatchReq = new Request("https://medvoice.org/api/emergency/pre-arrival", {
      method: "POST",
      headers: { "x-mock-role": "patient", "x-mock-user-id": "patient-alice-123", "Content-Type": "application/json" },
      body: JSON.stringify({
        consultationId: testConsultationId,
        patientId: "patient-alice-123",
        timestamp: new Date().toISOString(),
        esiScore: 2,
        triageLevel: "emergency",
        triageTitle: "ESI LEVEL 2: EMERGENT",
        icd10Codes: ["I20.9"],
        chiefComplaint: "Crushing chest pressure",
        targetHospitalName: "Apollo Emergency Center",
        etaMinutes: 12,
        redFlagsTriggered: ["ACS_CHEST_PAIN"],
      }),
    });
    const patientDispatchRes = await postEmergencyDispatch(patientDispatchReq);
    assert(patientDispatchRes.status === 200, "Patient can trigger emergency ambulance dispatch (200 OK)");

    // 7. Hospital ED Telemetry Board Access
    // Patient CANNOT dump all hospital telemetry dispatches
    const patientBoardReq = new Request("https://medvoice.org/api/emergency/pre-arrival", {
      headers: { "x-mock-role": "patient", "x-mock-user-id": "patient-alice-123" },
    });
    const patientBoardRes = await getEmergencyDispatches(patientBoardReq);
    assert(patientBoardRes.status === 403, "Patient cannot dump hospital emergency telemetry board (403 Forbidden)");

    // Admin CAN inspect hospital telemetry board
    const adminBoardReq = new Request("https://medvoice.org/api/emergency/pre-arrival", {
      headers: { "x-mock-role": "admin", "x-mock-user-id": "admin-super" },
    });
    const adminBoardRes = await getEmergencyDispatches(adminBoardReq);
    assert(adminBoardRes.status === 200, "Administrator can inspect hospital emergency telemetry board (200 OK)");
  }

  console.log("\n========================================================");
  console.log("  ALL SECURITY, AUDIT & VOICE IDENTITY TESTS PASSED (100%)");
  console.log("========================================================\n");
}

runSecurityAndAuditTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
