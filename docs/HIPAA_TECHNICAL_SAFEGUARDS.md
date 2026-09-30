# MedVoice — HIPAA-Aligned Technical Safeguards (45 CFR § 164.312)

> **Document Status**: Authoritative Architecture Specification  
> **Target Scope**: Application-Layer Technical Security & Privacy Controls  
> **System Classification**: AI-assisted clinical voice intake, triage, documentation, and emergency-routing system (Research & Pilot Prototype)

---

## 1. Executive Summary & Compliance Posture

MedVoice handles electronic Protected Health Information (ePHI) during patient voice intake, multi-specialty clinical reasoning, deterministic ESI-style triage, SOAP documentation, and HL7 FHIR R4 document bundle generation.

### Grounded Compliance Stance

> **Important**: MedVoice does **NOT** claim full organizational "HIPAA Compliance" or formal third-party certification.  
> The Health Insurance Portability and Accountability Act (HIPAA) Security Rule (45 CFR Part 160 and Part 164, Subparts A and C) mandates a comprehensive triad of **Administrative**, **Physical**, and **Technical** safeguards, alongside Business Associate Agreements (BAAs), institutional workforce training, and enterprise risk management protocols.

Software architecture alone can only satisfy **Technical Safeguards (45 CFR § 164.312)**. MedVoice has engineered and verified strict, application-layer technical controls aligned directly with these federal standards, while maintaining full honesty regarding out-of-scope administrative and physical prerequisites.

---

## 2. Technical Safeguards Implementation Matrix (45 CFR § 164.312)

| HIPAA Regulation | Required / Addressable | MedVoice Technical Implementation | Verification Mechanism | Status |
| :--- | :---: | :--- | :--- | :---: |
| **§ 164.312(a)(1) Access Control** | **Required** | Strict RBAC (`patient` vs `admin`). IDOR ownership controls ensure patients can only access their own records. | Automated test suite (`cors-rbac-audit.test.ts`), server-side auth | 🟢 Implemented |
| **§ 164.312(a)(2)(i) Unique User ID** | **Required** | Clerk server-side authentication assigns immutable, unique user IDs (`userId`). Client headers cannot elevate privileges. | Anti-spoofing tests in `cors-rbac-audit.test.ts` | 🟢 Implemented |
| **§ 164.312(a)(2)(ii) Emergency Access** | **Required** | Algorithmic ESI v4 safety arbiter executes deterministically without authentication delay to preserve patient safety. | Deterministic arbiter tests | 🟢 Implemented |
| **§ 164.312(a)(2)(iii) Automatic Logoff** | Addressable | Client session tokens expire via Clerk auth policies; local voice intake re-arms only during active consultation turns. | Session management | 🟢 Implemented |
| **§ 164.312(b) Audit Controls** | **Required** | SHA-256 hash-chained immutable audit ledger backed by PostgreSQL persistence. Logs all creations, access, denied attempts, and dispatches. | Hash chain verification (`verifyAuditChain`) & tamper detection | 🟢 Implemented |
| **§ 164.312(c)(1) Integrity Controls** | **Required** | Cryptographic payload hashing (`eventHash`), Zod payload validation schemas, tamper-detection alarms on ledger reordering. | Tamper mutation tests (`cors-rbac-audit.test.ts`) | 🟢 Implemented |
| **§ 164.312(d) Authentication** | **Required** | Authoritative Clerk server-side session token verification. Rejects client-supplied `x-mock-role` in production. | Server-side `authorizeRequest()` | 🟢 Implemented |
| **§ 164.312(e)(1) Transmission Security** | **Required** | HTTPS deployment, HSTS preload (`max-age=63072000`), secure CORS origin restriction, `no-store` cache controls on all `/api/*` endpoints. | Next.js & FastAPI security headers | 🟢 Implemented |

---

## 3. Detailed Technical Safeguards Architecture

### A. Access Control & Minimum Necessary (45 CFR § 164.312(a)(1))

1. **Role-Based Access Control (RBAC)**:
   * **`patient`**: Authorized exclusively for `consultations:create`, `consultations:read` (own records only), `emergency:dispatch`, and `health:export` (own records only).
   * **`admin`**: Authorized exclusively for `analytics:read`, `system:read`, `audit:read`, and `audit:verify`. Admins do *not* participate in clinical intake.
   * **Internal AI Clinicians (Dr. Sarah Chen, Dr. Marcus Vance, etc.)**: Modeled as system reasoning modules and internal persona profiles—**never** as human user accounts with login privileges.
2. **Insecure Direct Object Reference (IDOR) Defense**:
   * Endpoint `GET /api/consultations/[id]` and `GET /api/consultations/[id]/fhir` inspect the authenticated `userId`.
   * If a patient attempts to access another user's clinical consultation or FHIR record, the request is immediately rejected with `403 Forbidden`, and an `ACCESS_DENIED` event is written into the durable audit ledger.

### B. Audit Controls & Non-Repudiation (45 CFR § 164.312(b))

1. **Cryptographic SHA-256 Hash Chaining**:
   Every clinical transaction is sealed into an append-only block:
   $$\text{eventHash} = \text{SHA-256}(\text{index} \parallel \text{id} \parallel \text{timestamp} \parallel \text{actorId} \parallel \text{action} \parallel \text{resourceType} \parallel \text{resourceId} \parallel \text{status} \parallel \text{previousHash} \parallel \text{sortedMetadata})$$
2. **Durable Persistence**:
   Backed by PostgreSQL (`audit_events` table). Any out-of-order insertion, payload tampering, or sequence truncation is caught by `verifyAuditChain()`.
3. **Data Minimization in Audit Logs**:
   Audit metadata records operational identifiers (`consultationId`, `esiLevel`, `action`) rather than raw conversational transcripts, adhering to the HIPAA Minimum Necessary rule.

### C. Voice Data Minimization & Ephemeral Audio Lifecycle

1. **Local Audio Ingestion**:
   * The patient's voice is captured via browser `MediaRecorder` in 250ms chunks and uploaded in-memory as a `FormData` audio blob.
   * Next.js bridges the blob directly to the local FastAPI Whisper ASR service over localhost (`127.0.0.1:8000`).
2. **Guaranteed Ephemeral Scrub**:
   * In `backend/services/audio_service.py`, temporary audio files used by `ffmpeg`/Whisper are created using `tempfile.NamedTemporaryFile` and deleted immediately inside a guaranteed `finally:` block:
     ```python
     finally:
         if temp_path and os.path.exists(temp_path):
             os.remove(temp_path)
     ```
3. **Zero Audio Persistence**:
   * Raw audio recordings are **never stored** in the database, file system, or external object storage.
4. **Log Sanitization (Zero PHI Exposure in stdout)**:
   * FastAPI logging masks transcript contents, recording only character counts and byte lengths with `[PHI masked]` notices.

### D. Transmission Security & Defense-in-Depth (45 CFR § 164.312(e)(1))

1. **HTTP Strict Transport Security (HSTS)**:
   * Configured in `next.config.ts` with `max-age=63072000; includeSubDomains; preload`.
2. **No-Cache Directives on Clinical Endpoints**:
   * FastAPI and Next.js apply `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` and `Pragma: no-cache` to ensure intermediary proxies, CDNs, and browser caches never persist sensitive clinical responses.
3. **Framing & Content Protection**:
   * `X-Frame-Options: DENY` (anti-clickjacking).
   * `X-Content-Type-Options: nosniff` (anti-MIME-confusion).
   * `Referrer-Policy: strict-origin-when-cross-origin`.
   * `Permissions-Policy: camera=(), microphone=(self), geolocation=(self)`.

---

## 4. Boundaries: What Is NOT Claimed

To preserve technical integrity during clinical, academic, and enterprise evaluation:

| Dimension | Compliance Reality | MedVoice Implementation Boundary |
| :--- | :--- | :--- |
| **Formal HIPAA Certification** | Requires an accredited institutional compliance audit. | **NOT claimed.** Prototype is a research and clinical engineering demonstration. |
| **Business Associate Agreements (BAAs)** | Legal contracts between healthcare covered entities and third-party cloud vendors (e.g. Clerk, Neon, Vercel). | **NOT executed.** Demonstration environment operates under developer sandbox terms. |
| **Physical Safeguards (45 CFR § 164.310)** | Data center access badges, camera monitoring, workstation security, device media destruction. | **Infrastructure-dependent.** Managed by cloud hosting providers (e.g., AWS/Neon), not the application codebase. |
| **Administrative Safeguards (45 CFR § 164.308)** | Formal security officer designation, workforce sanction policies, disaster recovery plans, employee training. | **Organizational responsibility.** Lies outside the scope of a software application. |

---

## 5. Reviewer FAQ & Defense Script

**Question: "Is MedVoice HIPAA compliant?"**

> **Defensible Response**:  
> *"No formal HIPAA certification is claimed. MedVoice is a clinical engineering prototype. We have implemented several key HIPAA-aligned technical safeguards under 45 CFR § 164.312, including role-based access control, cryptographic SHA-256 audit chaining, patient-owned IDOR boundaries, ephemeral audio handling with zero persistent voice storage, and strict transport security. Full organizational HIPAA compliance requires administrative policies, physical facility controls, and Business Associate Agreements that are outside the scope of this application."*
