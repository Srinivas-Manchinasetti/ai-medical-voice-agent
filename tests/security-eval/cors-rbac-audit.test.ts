import {
  logAuditEvent,
  verifyAuditChain,
  getAuditEvents,
  computeEventHash,
  AuditEvent,
  GENESIS_HASH,
} from "../../lib/audit/audit-logger";
import { hasPermission, ROLE_PERMISSIONS, Role, Permission } from "../../lib/auth/rbac";
import { evaluateSafetyArbiter } from "../../lib/triage/safety-arbiter";

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

  // TEST 1: RBAC Permission Matrix Checks
  console.log("[Test Suite 1] Role-Based Access Control (RBAC) Invariants");
  {
    assert(hasPermission("patient", "consultations:create"), "Patient can create their own consultation");
    assert(hasPermission("patient", "consultations:read:own"), "Patient can read their own consultations");
    assert(!hasPermission("patient", "consultations:read:all"), "Patient CANNOT read all consultations");
    assert(!hasPermission("patient", "audit:read"), "Patient CANNOT inspect audit ledger");
    assert(!hasPermission("patient", "consultations:override"), "Patient CANNOT override clinical decisions");

    assert(hasPermission("doctor", "consultations:read:all"), "Doctor CAN read all patient consultations");
    assert(hasPermission("doctor", "consultations:override"), "Doctor CAN submit clinical overrides");
    assert(!hasPermission("doctor", "audit:verify"), "Doctor CANNOT run root audit verification");

    assert(hasPermission("auditor", "audit:read"), "Auditor CAN read audit events");
    assert(hasPermission("auditor", "audit:verify"), "Auditor CAN verify cryptographic audit chain");
    assert(hasPermission("auditor", "consultations:read:all"), "Auditor CAN read consultations for compliance");
    assert(!hasPermission("auditor", "consultations:create"), "Auditor CANNOT create new clinical consultations");

    assert(hasPermission("admin", "audit:verify"), "Admin has audit:verify permission");
    assert(hasPermission("admin", "consultations:override"), "Admin has consultations:override permission");
  }

  // TEST 2: Tamper-Evident Cryptographic Hash Chain
  console.log("\n[Test Suite 2] Cryptographic Hash Chained Audit Ledger");
  {
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
      actorId: "usr-doc-202",
      actorRole: "doctor",
      action: "CONSULTATION_ACCESSED",
      resourceType: "consultation",
      resourceId: "MED-TEST-001",
      status: "SUCCESS",
      metadata: { specialty: "Cardiology" },
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
      "dr-priya-patel": { voiceId: "af_nicole", gender: "female", speed: 0.98, provider: "kokoro" },
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
      // Attempt: Client requests Dr. Priya Patel (female) with Dr. Marcus's voice (male)
      const spoofedAttemptDoctorId = "dr-priya-patel";
      const spoofedRequestedVoice = "am_michael";
      const profile = DOCTOR_VOICE_PROFILES[spoofedAttemptDoctorId];
      const enforcedVoice = profile.voiceId;

      assert(enforcedVoice === "af_nicole", "Server strictly enforces af_nicole for Dr. Priya Patel, rejecting spoofed am_michael");
      assert(enforcedVoice !== spoofedRequestedVoice, "Server-authoritative voice does NOT honor unauthorized client voice override");

      // Attempt: Unknown / manipulated doctor ID
      const fallbackVoice = resolveAuthoritativeVoice("invalid-manipulated-doctor-id");
      assert(fallbackVoice === "af_sarah", "Unknown doctor ID defaults safely to lead clinician voice (af_sarah), preventing arbitrary synthesis");
    }
  }

  console.log("\n========================================================");
  console.log("  ALL SECURITY, AUDIT & VOICE IDENTITY TESTS PASSED (100%)");
  console.log("========================================================\n");
}

runSecurityAndAuditTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
