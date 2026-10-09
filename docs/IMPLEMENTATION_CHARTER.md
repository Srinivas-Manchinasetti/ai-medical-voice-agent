# MedVoice Engineering Architecture & Implementation Charter
## LLM-First Conversational Intelligence & Deterministic Safety Harness

**Document Version:** 3.1 (Approved Revision Baseline)  
**Date:** October 2026  
**Status:** Architecture Direction Approved · Specification Revised per Engineering Lead Review · Taxonomy Frozen  
**Audience:** Clinical Engineering Team, Emergency Medicine Reviewers, Clinical Governance Board  

---

## Executive Summary & Core Architectural Principle

MedVoice is an agentic clinical voice assistant designed for pre-hospital clinical intake. The system operates on a dual-track paradigm:
1. **The Large Language Model (LLM) is the conversational brain.** It listens actively, reasons over multi-turn context, resolves ambiguous references, incorporates patient history intelligently, handles open-world unfamiliar complaints across defined evidence situations, and generates empathetic, natural spoken bedside dialogue.
2. **The Deterministic Safety Arbiter is the authoritative safety harness.** It independently evaluates raw transcripts and clinical evidence against deterministic safety rules, prevents unsafe downgrades, enforces clinical protocol constraints, and maintains unilateral emergency escalation authority.

MedVoice is not a medical decision tree with an LLM bolted on, nor is it an unconstrained chatbot making unverified clinical diagnoses. The system maintains strict separation between conversational flexibility and deterministic clinical safety.

---

## 1. Dual-Track Evidence & Safety Independence

```
                              [ Raw Patient Utterance ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
         [ Track 1: Deterministic ]                [ Track 2: Generative ]
          Universal Safety Screen                   Discourse & Clinical NLU
                    │                                         │
         • 65 universal safety rules               • Conversational intent & nuances
         • Pre-arbiter regex & boundaries          • Volunteered observations & context
         • Direct on raw text & measurements       • Person references ("mother", "self")
         • Independent of LLM reasoning            • Clinical RAG evidence retrieval
                    │                                         │
                    └────────────────────┬────────────────────┘
                                         ▼
                         [ Safety Arbiter & State Engine ]
                         • Server resolves person references to authorized IDs
                         • Fact-specific reconciliation (no naive numeric ranking)
                         • Enforces non-downgrade invariants
                         • Locks Tier 1/2 emergencies immediately
                         • Establishes safety constraints for LLM
```

### Safety Independence Invariants
1. **Rule Screen Independence:** The deterministic safety screen runs directly on raw transcripts and device measurements. It does not depend on the LLM correctly parsing or classifying an utterance. If the LLM experiences latency, produces malformed output, or hallucinates, the safety screen remains 100% operational.
2. **Unilateral Emergency Escalation:** If the Safety Screen fires (`EMERGENCY_NOW`), it exercises unilateral authority: halts normal intake, locks the emergency tier (MedVoice Tier 1 or 2), and delivers approved emergency guidance instructions (112 / 108 / 911).
3. **Candidate Concern Surfacing:** The LLM is permitted to surface subtle, unscripted clinical danger signs (e.g., atypical clustering of symptoms). These candidate concerns are submitted to the Safety Arbiter and evaluated against the approved triage policy; they are never discarded simply because no predefined regex matched them.
4. **Zero Down-Triage Authority:** The LLM never possesses down-triage authority. It cannot override, dismiss, or downgrade an active safety flag or arbiter emergency tier under any circumstance.

---

## 2. Frozen Presentation Taxonomy vs. Universal Safety Rules

To ensure total architectural clarity, MedVoice explicitly distinguishes the **Nine Clinical Presentation Registries** from the **Independent Universal Safety Screen Rules**.

### Canonical Nine-Presentation Taxonomy (Frozen)
The presentation taxonomy is frozen at exactly nine registries. No new registries (10+) will be created. All non-registry complaints flow through `UNCLASSIFIED` / `OTHER_CONCERN`.

| Canonical Registry ID | Presentation Display Name | Primary Category | Evaluated Dimensions |
| :--- | :--- | :--- | :--- |
| `ABDOMINAL_PAIN` | Acute / Subacute Abdominal Pain | Gastroenterology | Location, onset, onset pattern, duration, severity, radiation, character, GI symptoms, peritoneal signs |
| `ACUTE_DIARRHEA` | Acute Diarrheal Illness & Fluid Loss | Gastroenterology | Stool frequency, duration, blood/mucus, fever, hydration/thirst, postural dizziness, anuria |
| `CHEST_DISCOMFORT` | Acute Chest Discomfort / Anginal Equivalence | Cardiology | Onset, character, radiation, exertional trigger, associated diaphoresis/dyspnea/nausea, cardiac risk |
| `ACUTE_DYSPNEA` | Acute Dyspnea / Breathlessness | Pulmonology | Onset, positional/orthopnea, exertion, stridor/wheezing, chest pain, fever, prior cardiopulmonary disease |
| `HEADACHE` | Acute / Secondary Headache | Neurology | Onset (thunderclap vs gradual), severity, neck stiffness, fever, neurological deficits, visual changes |
| `FEBRILE_ILLNESS` | Systemic Febrile Illness & Infectious Symptoms | Infectious Disease | Measured temp, duration, chills, localized focal signs, neck stiffness, rash, oral intake |
| `DIZZINESS_VERTIGO` | Dizziness, Vertigo & Presyncope | Neurology / Cardio | Spinning vs lightheadedness, positional triggers, syncope/loss of consciousness, focal neuro signs |
| `PHARYNGITIS_ODYNOPHAGIA` | Acute Sore Throat & Odynophagia | ENT | Onset, severity, swallowing difficulty, fever (Centor), cough absence, voice changes, trismus |
| `PEDIATRIC_CRISIS` | Pediatric Crisis / Lethargy | Pediatrics | Age in months, symptom timeline, oral intake/feeding, wet diapers, lethargy, respiratory distress |

### Independent Universal Safety Rules (Separate Architectural Object)
Universal safety rules (e.g. `UNI-STR-01` through `UNI-STR-04` for acute stroke BE-FAST, `UNI-ACS-01` for acute coronary syndrome, `UNI-RES-01` for immediate airway compromise) are **not presentation registries**. They are independent safety filters that execute on the raw transcript across every turn regardless of which presentation is active. A patient with pharyngitis who suddenly exhibits facial droop will trigger the stroke safety rule immediately without re-classifying the presentation.

---

## 3. Open-World Complaint Handling Across Defined Evidence Situations

Presentations outside the nine frozen registries (e.g., persistent yellow urine with high water intake, sudden localized muscle fasciculations, unilateral burning skin without rash) are designated `UNCLASSIFIED` or `OTHER_CONCERN`.

The system does not assume that clinical RAG will always retrieve a perfect passage. Instead, it operates across three well-defined situations:

| Evidence Situation | Operational Condition | Required Conversational Behavior |
| :--- | :--- | :--- |
| **Situation A: Relevant Evidence Retrieved** | RAG returns high-relevance clinical passages (e.g. differential on chromaturia, riboflavin vs bilirubinuria). | LLM incorporates retrieved facts to ask focused, proportionate follow-up questions (timeline, jaundice, pale stools, supplements). Avoids jumping to conclusions. |
| **Situation B: Weak or Irrelevant Evidence Retrieved** | RAG returns low-confidence or empty results for rare or idiosyncratic phrasing. | LLM acknowledges uncertainty honestly: gathers foundational clinical context (onset timeline, duration, constant vs intermittent, functional impact, associated sensations) without pretending evidence supports any diagnosis. |
| **Situation C: Serious Concern Emerges Without Specific Rule** | Utterance describes an unscripted yet alarming symptom (e.g., sudden severe unclassified pain or collapse). | State preserves the concern; false reassurance and down-triage are strictly prohibited. LLM asks safe clarifying questions and routes to clinician-approved urgent ambulatory or emergency care. |

### Clinical Reasoning Standard: Persistent Dark/Yellow Urine
- **Observation:** The urine appears persistently yellow or dark, and the patient reports drinking plenty of water.
- **Epistemic Restraint:** High water intake does **not** rule out dehydration (e.g., impaired concentrating ability, osmotic diuresis, fluid misperception). Urine color alone does **not** prove liver or biliary disease (it may stem from B-complex/riboflavin, dietary pigments, medications, hemolysis, or rhabdomyolysis).
- **Follow-up:** Explore duration, eye/skin yellowing (jaundice), stool color changes, flank/abdominal pain, and recent vitamins/supplements.

---

## 4. Decoupled Context, Attribution & Fact-Specific Reconciliation

### Server-Side Person Reference Resolution (No DB IDs in LLM Output)
To prevent prompt injection, identity confusion, or cross-patient database manipulation:
- The LLM output contract **never accepts database identifiers** (`targetPatientId`, `userId`, etc.).
- The LLM proposes a natural person reference: `subjectReference: "self" | "mother" | "father" | "child" | "spouse" | "caregiver" | "other"`.
- The **Server Reconciliation Layer** resolves `subjectReference` against authorized relationships established in the active session.
- If the caller says *"My mother has diabetes"*, the model outputs `subjectReference: "mother"`. The server verifies that the caller is authorized to evaluate the mother, maps it to the mother's record, and leaves the caller's profile untouched.
- If a person reference is ambiguous or unauthorized, the fact is quarantined as `unresolved_attribution` until clarified.

### Fact-Specific Reconciliation (Elimination of Naive Numeric Ranking)
MedVoice rejects a single global scalar (Device: 5 > Clinician: 4 > Patient: 3...) because evidence credibility depends on the clinical nature of the fact:
1. **Objective Physiological Measurements (SpO2, Blood Pressure, Heart Rate):** Current device readings (`device_measured`) outrank subjective estimates of that same measurement.
2. **Subjective Clinical Symptoms (Pain, Nausea, Fatigue, Dizziness):** Patient self-report (`patient_reported`) is primary. A device reading cannot override a patient's report that they feel severe pain or nausea.
3. **Incapacitated / Pediatric Observations (Infant Lethargy, Witnessed Syncope):** Caregiver report (`caregiver_reported`) is authoritative for observable behavior when the patient cannot self-report.
4. **Historical Diagnoses vs. Acute Presentations:** Prior clinician records establish chronic baseline history, while current acute symptoms govern the active encounter. An old chart entry does not erase acute complaints.
5. **Contradiction Management:** Conflicting reports (e.g., previously no allergies, now reports rash with amoxicillin) are flagged explicitly as contradictions for clarification, never silently overwritten.

### Intelligent Profile Reuse
- Current confirmed information is reused without redundant questioning.
- Missing fields are asked only when clinically relevant to triage urgency or medication safety.
- Stale or safety-critical data (e.g., active medications, allergies) are reconfirmed when context warrants it.
- Patient age is dynamically derived at runtime from `dateOfBirth` via `calculateAgeFromDOB`, preventing stale age drift across encounters.

---

## 5. Conversational Action Palette & Emergency Boundary

### Emergency Control Boundary
- **Active Emergency (Deterministic Safety Rule Fires):** The approved clinical safety policy controls the mandatory emergency instruction (e.g. call 112/108/ambulance, sit down, do not drive) and its urgency. The LLM cannot delay, cancel, soften, or alter this required directive.
- **Normal Conversational Turns:** The LLM generates the response dynamically, selecting from diverse conversational actions:
  - `INQUIRE`: Asks a focused, relevant follow-up question.
  - `ANSWER_QUESTION`: Directly answers a patient inquiry.
  - `ACKNOWLEDGE_CORRECTION`: Warmly acknowledges when the patient corrects a misunderstanding.
  - `EXPLAIN_CLINICAL_RATIONALE`: Explains why a particular screening question matters to reduce anxiety.
  - `SUMMARIZE_AND_CHECK`: Summarizes gathered findings before transitioning to next steps.
  - `EMERGENCY_DIRECTIVE`: Reinforces pre-arrival guidance during active emergencies.
  - `PROVIDE_SUPPORT`: Offers emotional validation when distress or fear is expressed.
- **Validator Rejection & Fallback Handling:**
  - If a generated reply fails deterministic validation (e.g., hallucinated symptom or transposed identity), the system performs up to **1 retry** with explicit validation error guidance.
  - If retry fails, or if a provider outage occurs, a calibrated context-preserving fallback is delivered immediately without hanging.
  - The fallback preserves the chief complaint and conversational context, and its activation is recorded in server telemetry.

---

## 6. Proposed Technical Privacy & Authorization Model

*(Subject to Formal Legal and Privacy Governance Sign-off)*

1. **Server-Side Authorization Contract:** Before assembling clinical context for model execution, the server validates session authentication and caller-patient delegation rights. Unauthenticated or unauthorized context access is rejected at the API gateway.
2. **Untrusted Input Doctrine:** Patient speech and retrieved passages are treated as untrusted data. Server authorization, tool permissions, and fact persistence controls remain fully effective even if an LLM is manipulated by an adversarial prompt injection.
3. **Context Sanitization & Data Minimization:** Direct PII (phone numbers, full national IDs, street addresses) is scrubbed before context is transmitted to third-party model inference providers. Only clinically relevant parameters (calculated age, sex, relevant history, symptoms) are passed.
4. **Provider Data Handling Terms:** Providers (Groq / NVIDIA) are configured with zero-retention / no-training processing agreements.
5. **Tenant & Patient Isolation:** Multi-tenant boundaries strictly isolate records. Family members under a single caller account maintain distinct, encrypted profile stores.

---

## 7. Tightened Five-Point Acceptance Verification Gates

| Gate | Acceptance Requirement | Definitive Verification Method |
| :--- | :--- | :--- |
| **Gate 1: Live Generation Proof** | Ordinary conversational intake turns are dynamically generated by the live LLM. Fallbacks are isolated to outages or emergency overrides. | Server-measured telemetry logs confirming live provider, model, latency, and cryptographic integrity hash across normal turns. Model self-declarations are untrusted. |
| **Gate 2: Open-World Complaint Handling** | System handles unfamiliar complaints (`UNCLASSIFIED`) across all 3 evidence situations (strong retrieval, weak retrieval, serious unclassified concern). | Automated evaluation across unfamiliar complaints (yellow urine with high hydration, localized twitches, paresthesias) asserting proportionate inquiry, honest uncertainty, and zero canned questionnaire errors. |
| **Gate 3: Memory & Attribution Correctness** | Server-side person reference resolution (`subjectReference: "mother"`) prevents ID spoofing; fact-specific reconciliation avoids naive scalar errors; runtime DOB calculates age (62y); contradictions are flagged. | Multi-turn testing of caregiver reporting for patient, asserting correct record binding, caller record isolation, no raw DB IDs from model, and fact-specific precedence. |
| **Gate 4: Response Quality & Semantic Variability** | Expanded live-model evaluation across diverse complaints, multi-turn corrections, and unfamiliar symptoms. | Multi-scenario evaluation scoring naturalness, factual consistency, and bedside empathy separately from hard deterministic safety invariants. |
| **Gate 5: Operational Readiness, Latency & Security** | Turn latency budget separates Time to First Audio (TTFA target $\le 1200\text{ms}$) from whole turn completion ($\le 2000\text{ms}$); prompt injection defense holds under untrusted input doctrine; provider failover is seamless. | Automated benchmarks measuring TTFA and turn latency, adversarial injection attempts (neutralized without permission bypass), and simulated provider outage fallback. |

---

## 8. Milestone Governance & Work Sequence

```
[ Milestone Frozen: Commit 8f95222 ] (Deterministic Safety Quality-Correction Baseline)
                 │
                 ▼
[ LLM-First Conversational Milestone Commences ]
├── Step 1: Data Model Refactoring (types.ts & clinical-state.ts)
│   • Person references (subjectReference) instead of DB IDs
│   • Fact-specific reconciliation engine
│   • Dynamic runtime DOB age calculation
├── Step 2: Open-World Pipeline & 3-Situation Retrieval (retriever.ts & guidelines.ts)
├── Step 3: LLM Engine & Response Validator (clinical-llm.ts)
│   • Structured JSON contract with subjectReference
│   • Server-measured HMAC-SHA256 telemetry
│   • Prompt injection defense & data minimization
│   • 1-attempt retry on validator rejection before safe fallback
├── Step 4: ConversationManager Live Path Wiring (conversation-manager.ts)
│   • Normal turns route through live LLM
│   • Emergency turns strictly preserve approved emergency guidance
├── Step 5: Comprehensive 5-Point Live Acceptance Test Battery (tests/llm-first-acceptance.ts)
                 │
                 ▼
[ Pre-Requisite for Prospective Clinical Evaluation (Gate A) ]
```
