# MedVoice Clinical Review Packet
**System:** MedVoice Autonomous Clinical Telephone Triage System  
**Document Version:** 2.0 (Quality-Correction Sprint & Release Freeze)  
**Date:** October 2026  
**Intended Audience:** Attending Emergency Physicians, Critical Care Leads, Clinical Governance Board, Regulatory Reviewers

---

## 1. Executive Summary & Clinical Intent

MedVoice is an agentic voice triage assistant designed for **pre-hospital, telephone-based clinical intake**. It evaluates spoken patient testimony in real-time, extracts clinical dimensions, detects life-threatening conditions, and coordinates emergency escalation.

### Core Architectural Invariants
1. **Safety Arbiter Authority:** The LLM proposes; the deterministic Safety Arbiter disposes; the Response Planner verbalizes under strict constraints. LLMs are strictly prohibited from unilaterally deciding triage acuity, overriding red flags, or recommending off-label dosages.
2. **Presentation Independence:** The Universal Red-Flag Screen (`lib/triage/universal-red-flags.ts`) evaluates every patient utterance independent of diagnostic presentation classifiers. A patient misclassified under gastrointestinal complaints will still trigger cardiovascular emergency protocols if ischemic equivalents are present.
3. **Monotonic Safety Escalation:** Triage acuity is strictly *escalate-only*. Lower acuity findings on subsequent conversational turns cannot de-escalate an earlier emergency trigger.
4. **Honest Provenance & Anti-Hallucination:** Unperformed physical examinations and missing biometric vitals are explicitly recorded as `[NOT ASSESSED]`. The system never synthesizes numeric blood pressures, heart rates, or body temperatures.
5. **Conversational Semantic Rigor:** Conversational verbalizations must preserve subject attribution (caller vs. third-party patient), preserve symptom provenance without hallucinating character qualities (e.g. never adding "tight pressure" when only "chest pain" was stated), and never offer false reassurance based on the absence of a single symptom.

---

## 2. Clinical Urgency Terminology: MedVoice Urgency Tiers vs. ESI v4

### Triage Boundary & Contextual Separation
The Emergency Severity Index (ESI v4) is a validated five-level emergency department triage algorithm developed for in-person triage. ESI depends heavily upon **in-person biometric vital signs** (e.g., pulse oximetry, automated blood pressure, temperature, heart rate) and a clinician's **prediction of emergency department hospital resources** (e.g., intravenous fluids, CT scanning, laboratory blood work, procedural sedation).

In telephone-based clinical triage:
- Physical examination, point-of-care diagnostics, and reliable in-person vital signs are unavailable.
- Hospital resource utilization cannot be directly scheduled or evaluated over the phone.
- Consequently, labeling phone-based triage outputs as official "ESI Level" or "ESI v4" creates a misleading impression of in-hospital clinical assessment.

### Standardized Urgency Tier Taxonomy (`MedVoiceUrgencyTier`)
To maintain clinical and regulatory precision, MedVoice standardizes across all engines, diagnostic displays, and documentation on **MedVoice Urgency Tiers (Tiers 1–5)**:

| MedVoice Tier | Clinical Urgency Classification | Disposition Protocol | Clinical Intent & Examples |
| :--- | :--- | :--- | :--- |
| **Tier 1** | Immediate Resuscitation | Instruct caller/caregiver to contact emergency services (112 / 108 / 911) immediately | Immediate life threat: stridor, airway collapse, cardiac arrest, respiratory failure. |
| **Tier 2** | Emergent / High Risk | Rapid Emergency Evaluation (< 15 min) | High-risk emergency: acute ischemic chest pain, stroke (BE-FAST), active severe bleeding. |
| **Tier 3** | Urgent / Same-Day Ambulatory | Same-Day Urgent Care / Clinic Evaluation | Urgent clinical concern: unassessed pleuritic pain, severe diarrhea with postural instability. |
| **Tier 4** | Less Urgent / Routine Ambulatory | Routine Outpatient Clinic Appointment | Mild stable localized complaints: uncomplicated pharyngitis, mild URI, resolving non-cardiac dizziness. |
| **Tier 5** | Non-Urgent / Administrative | Primary Care / Self-Care Advice | Routine administration: maintenance prescription refills, general preventive health questions. |

> **Operational Dispatch Limitation:** MedVoice does NOT possess automated emergency computer-aided dispatch (CAD) integration or direct telephonic hooks to 112/108/911 PSAPs. Tier 1 triage action consists strictly of urgent verbal guidance instructing the caller or bystander to immediately dial 112/108/911 and providing critical safety instructions while waiting for emergency responders.

> **API Compatibility Note:** In `lib/triage/safety-arbiter.ts`, the properties `urgencyTier: MedVoiceUrgencyTier` (1–5) and `tierTitle: string` represent the canonical classification. The legacy property `esiScore` is preserved strictly as a backward-compatible programmatic alias for existing test suites and FHIR converters. This internal research framework does not imply official ESI certification.

---

## 3. Clinical Cutoffs & Empirical Thresholds Requiring Physician Review

The following empirical and guideline-derived cutoffs are implemented in the engine. Clinical leads must review, calibrate, or approve each value:

| Domain | Parameter | Current Threshold in Engine | Clinical Rationale & Guidelines | Review Status |
| :--- | :--- | :--- | :--- | :--- |
| **Pediatrics** | Neonatal / Infant Fever | Age $< 3$ months (or $\le 90$ days) with reported fever or temp $\ge 38.0^\circ\text{C}$ | High risk of serious bacterial infection (SBI/GBS/Listeria); mandate immediate ED evaluation without antipyretic delay. | [ ] Pending Review |
| **Cardiology** | Atypical ACS Screening Age | Age $\ge 40$ years with $\ge 1$ comorbidity (diabetes, hypertension, smoker, CAD) OR Age $\ge 60$ general | Epigastric burning, nausea, diaphoresis, or breathlessness as ischemic equivalents in older adults, females, and diabetics. | [ ] Pending Review |
| **Aortic / Surgical** | AAA / Aortic Dissection | Age $\ge 50$ years with sudden severe abdominal/back pain or syncope | Ruptured abdominal aortic aneurysm (AAA) or acute aortic dissection presentation. | [ ] Pending Review |
| **Hemorrhage** | Active Bleeding Pressure | Uncontrolled bleeding after $\ge 10$ minutes of continuous firm pressure | Exceeds standard homeostatic coagulation window for superficial lacerations. | [ ] Pending Review |
| **Obstetrics** | Preeclampsia / Eclampsia | Gestational age $\ge 20$ weeks with severe headache, visual disturbance, or RUQ pain | Severe feature preeclampsia / impending eclampsia threshold. | [ ] Pending Review |
| **Pediatric Dehydration** | Anuria Cutoff | No wet diaper / urine output for $\ge 8$ to 12 hours | Significant dehydration risk in infants. | [ ] Pending Review |
| **Postpartum** | PPH & Thromboembolism | Within 6 weeks postpartum with heavy bleeding, dyspnea, or chest pain | Postpartum hemorrhage (PPH) or pulmonary embolism (PE) risk window. | [ ] Pending Review |

---

## 4. Proposed Clinical Policies Requiring Formal Governance Review

The following policies address ambiguous or high-risk clinical presentations where empirical safety rules have been implemented in the codebase. All three policies are formally designated **PROPOSED FOR CLINICAL REVIEW** and are NOT clinician-approved until signed off in the Governance Ledger.

### Policy 1: Unassessed Pleuritic Chest Pain Floor (`UNI-CAR-06`)
- **Status:** **PROPOSED FOR CLINICAL REVIEW** (Never claim "clinician-approved").
- **Clinical Rationale:**
  - Classic ischemic chest pain triggers immediate Tier 2 emergency escalation.
  - However, when a patient presents with isolated pleuritic chest pain ("sharp when I breathe in", "hurts when I cough", without radiation, diaphoresis, or exertional trigger), acute musculoskeletal or costochondral etiologies are common.
  - Critically, **pulmonary embolism (PE)**, **pericarditis**, **pneumothorax**, and **pneumonia** frequently present as sharp pleuritic pain. A telephone triage system cannot perform thoracic auscultation, obtain an ECG, or check D-dimer/imaging.
- **Engine Policy Specification:**
  1. **Acuity Floor:** Under no circumstances may unassessed pleuritic chest pain triage to Tier 4 (Routine) or Tier 5 (Non-urgent). Acuity is bounded with a **Tier 3 floor** (`priority` / same-day urgent medical evaluation).
  2. **Active PE Risk Screening:** Conversation engine must actively probe for PE and cardiopulmonary amplifiers: sudden onset dyspnea, leg swelling/asymmetry, history of DVT/PE, active malignancy, oral contraceptive use, recent surgery/immobilization, and hemoptysis.
  3. **Safety-Net Return Verbalization:** Must instruct the patient that if pain suddenly worsens, radiates, or if breathlessness or dizziness develops, they must immediately dial 112/108.

### Policy 2: Acute Fluid Loss & Severe Dehydration with Orthostasis
- **Status:** **PROPOSED FOR CLINICAL REVIEW** (Never claim "clinician-approved").
- **Clinical Rationale:**
  - High-volume acute fluid loss (e.g. profuse acute diarrhea, "loose motions since yesterday") combined with postural collapse ("today I can barely stand") signifies significant intravascular volume depletion, orthostatic hypotension, and impending shock.
  - Patients attempting to mobilize face severe fall injuries, syncope, and acute kidney injury (prerenal azotemia).
- **Engine Policy Specification:**
  1. **Immediate Fall Mitigation:** First verbal instruction must be harm-reduction: *"Because you are having loose motions and can barely stand, please sit or lie down immediately to avoid falling or fainting."*
  2. **Acuity & Explicit Urgent-Care Help-Seeking Instruction:** Bound triage strictly at **Tier 3 floor** (`priority` / urgent same-day medical evaluation and rehydration), and immediately instruct the patient on urgent medical care rather than leaving them waiting: *"Inability to stand after diarrhea is a sign of severe dehydration that requires an urgent in-person medical evaluation today. Please have someone assist you to the nearest urgent care center or clinic right now, and call 108 or 112 if you feel yourself passing out."*
  3. **Hydration Guidance:** Provide practical oral rehydration guidance while awaiting or arranging transport: *"While getting help, try to sip water or ORS fluids if you can."*
  4. **Escalation Triggers:** If accompanied by hematochezia/melena, anuria $>12\text{ hours}$, altered sensorium, or chest pain, escalate immediately to Tier 2 / Tier 1.

### Policy 3: Severe Abdominal Pain Triage Floor & Surgical Red-Flag Escalation Criteria
- **Status:** **PROPOSED FOR CLINICAL REVIEW** (Never claim "clinician-approved").
- **Clinical Rationale:**
  - Acute severe abdominal pain ("terrible stomach pain", "severe abdominal cramps") represents a high-risk diagnostic category that can stem from self-limiting causes (e.g. uncomplicated gastroenteritis, dyspepsia), but carries severe clinical risk of acute abdomen, emergent surgical pathologies, or catastrophic vascular/gynecologic rupture.
  - In a telephone-based clinical intake system, physical abdominal palpation (rebound tenderness, involuntary abdominal guarding, Murphy's sign, Rovsing's sign), point-of-care abdominal ultrasound, and blood laboratories are completely unavailable.
  - Consequently, unassessed severe abdominal pain must never be dismissed or triaged to routine outpatient care (Tier 4) or self-care (Tier 5).
- **Engine Policy Specification:**
  1. **Acuity Floor:** Under no circumstances may acute severe abdominal pain triage to Tier 4 (Routine Ambulatory) or Tier 5 (Self-Care). Acuity is strictly bounded with a **Tier 3 floor** (`priority` / same-day urgent clinic or emergency evaluation).
  2. **Mandatory Surgical & Vascular Red-Flag Screening:** The triage dialogue must systematically interrogate for acute surgical, vascular, and obstetric red flags that immediately mandate emergency escalation to Tier 1 or Tier 2:
     - **Acute Peritonitis (`UNI-ABD-01` [Tier 2]):** Board-like abdominal rigidity, severe involuntary guarding, or agony on light motion/touch.
     - **Acute Surgical Abdomen / GI Bleeding (`UNI-ABD-02` / `UNI-CIR-03` [Tier 2]):** Severe abdominal pain accompanied by active hematemesis (vomiting blood), melena (black tarry stool), or profuse rectal bleeding.
     - **Hemodynamic Collapse / Syncope (`UNI-CIR-01` / `UNI-CIR-02` [Tier 2]):** Severe abdominal pain coupled with syncope, presyncope, severe postural dizziness, cold clammy diaphoresis, or shock.
     - **Ruptured Abdominal Aortic Aneurysm (AAA) (`UNI-ABD-04` [Tier 2]):** Patient age $\ge 50$ years presenting with sudden severe abdominal pain, tearing lower back pain, or sudden circulatory collapse.
     - **Ruptured Ectopic Pregnancy (`UNI-ABD-03` [Tier 2]):** Female of reproductive age presenting with acute unilateral lower abdominal/pelvic pain, missed menses, abnormal vaginal bleeding, or shoulder-tip referred pain.
  3. **Disposition Protocol & Safety-Net Return Verbalization:** If all five surgical/vascular red flags are definitively excluded, the patient is assigned to Tier 3 (same-day urgent in-person medical evaluation). The conversation engine must deliver unambiguous safety netting: instructing the patient that if pain suddenly intensifies, if they vomit blood or pass black stools, or if they feel faint or lightheaded, they must immediately dial 112/108 for an emergency ambulance.

---

## 5. Comprehensive Red-Flag Rule Catalog (Groups A–N)

All 65 red-flag specifications implemented in `lib/triage/universal-red-flags.ts`:

### Group A: Airway & Breathing
- **`UNI-AIR-01` [EMERGENCY / Tier 1]**: Inability to speak full sentences, severe air hunger, gasping, breathlessness at rest. (*Indic: Saans nahi aa rahi, ఊపిरी ఆడట్లేదు*).
- **`UNI-AIR-02` [EMERGENCY / Tier 1]**: Central cyanosis (blue/grey lips), stridor, choking, hot potato/muffled voice (impending deep neck space airway collapse).
- **`UNI-AIR-03` [EMERGENCY / Tier 1]**: Angioedema: rapid swelling of lips, tongue, or pharyngeal airway.
- **`UNI-AIR-04` [EMERGENCY / Tier 1]**: Acute refractory wheezing/asthma attack failing bronchodilator inhaler relief; severe orthopnea.

### Group B: Circulation, Shock & GI Hemorrhage
- **`UNI-CIR-01` [EMERGENCY / Tier 2]**: Syncope or near-syncope coupled with chest pain, palpitations, or exertion.
- **`UNI-CIR-02` [EMERGENCY / Tier 1]**: Hemodynamic collapse / shock: cold, clammy, mottled, or ashen skin accompanied by confusion or profound weakness.
- **`UNI-CIR-03` [EMERGENCY / Tier 2]**: Acute GI bleeding: hematemesis (vomiting blood), melena (black tarry stool), or profuse rectal bleeding with dizziness/weakness.
- **`UNI-CIR-04` [EMERGENCY / Tier 2]**: Pathologic arrhythmia: sustained racing heartbeat ($>150\text{ bpm}$) accompanied by dizziness, chest tightness, or dyspnea.
- **`UNI-CIR-05` [DISCRIMINATE]**: Isolated palpitations without presyncope. Clarify: *"Are you also experiencing chest pain, dizziness, or shortness of breath?"*

### Group C: Neurological Emergencies
- **`UNI-NEU-01` [EMERGENCY / Tier 2]**: Acute focal neurological deficit (BE-FAST): facial droop, unilateral arm/leg weakness, acute dysarthria or aphasia.
- **`UNI-NEU-02` [EMERGENCY / Tier 2]**: Acute amaurosis fugax, sudden bilateral visual loss, or acute ataxia/cerebellar deficit.
- **`UNI-NEU-03` [EMERGENCY / Tier 2]**: Thunderclap headache: instantaneous peak ($<60\text{ seconds}$), suspected subarachnoid hemorrhage (SAH).
- **`UNI-NEU-04` [EMERGENCY / Tier 1]**: Status epilepticus or first-ever acute seizure.
- **`UNI-NEU-05` [EMERGENCY / Tier 1]**: Acute altered mental status: acute delirium, obtundation, or inability to awaken.
- **`UNI-NEU-06` [EMERGENCY / Tier 2]**: Meningeal irritation: fever + stiff neck + photophobia.
- **`UNI-NEU-07` [EMERGENCY / Tier 2]**: Traumatic brain injury with loss of consciousness, repeated vomiting, or patient on anticoagulation.
- **`UNI-NEU-08` [URGENT / Tier 3]**: Temporal arteritis screen: new temporal headache in age $>50$ with jaw claudication or vision change.

### Group D: Cardiac (Classic, Atypical & Aortic)
- **`UNI-CAR-01` [EMERGENCY / Tier 2]**: Classic ischemic chest discomfort: substernal pressure, squeezing, or heaviness radiating to left arm or jaw with diaphoresis. (*Indic: सीने में दर्द*).
- **`UNI-CAR-02` [EMERGENCY / Tier 2]**: Atypical ACS / ischemic equivalent in high-risk patient (age $\ge 40$ with diabetes/hypertension/smoker, or age $\ge 60$): epigastric burning, nausea, breathlessness, or diaphoresis.
- **`UNI-CAR-03` [DISCRIMINATE]**: Atypical symptom in high-risk caller without reported diaphoresis. Clarify: *"Does this get worse when you exert yourself, or are you having cold sweats?"*
- **`UNI-CAR-04` [EMERGENCY / Tier 2]**: Acute aortic dissection: sudden tearing or ripping chest/interscapular back pain.
- **`UNI-CAR-05` [EMERGENCY / Tier 2]**: Acute pulmonary embolism (PE): pleuritic chest pain + dyspnea with DVT signs, active cancer, or postpartum state.
- **`UNI-CAR-06` [URGENT / Tier 3]**: Pleuritic/chest wall reproducible discomfort without ischemic amplifiers (Tier 3 urgent evaluation floor).

### Group E: Abdominal & Surgical
- **`UNI-ABD-01` [EMERGENCY / Tier 2]**: Acute peritonitis: board-like rigid abdomen with severe involuntary guarding.
- **`UNI-ABD-02` [EMERGENCY / Tier 2]**: Surgical abdomen: acute severe abdominal pain with active hematemesis, melena, or syncope.
- **`UNI-ABD-03` [EMERGENCY / Tier 2]**: Ruptured ectopic pregnancy: female of reproductive age with acute lower quadrant pain, missed menses, and vaginal bleeding or shoulder-tip pain.
- **`UNI-ABD-04` [EMERGENCY / Tier 2]**: Ruptured abdominal aortic aneurysm (AAA): older adult (age $\ge 50$) with sudden severe back/abdominal pain or collapse.
- **`UNI-ABD-05` [EMERGENCY / Tier 2]**: Testicular torsion: acute severe scrotal pain with nausea (6-hour viability window).
- **`UNI-ABD-06` [URGENT/EMERGENCY / Tier 2-3]**: Mechanical bowel obstruction: obstipation, abdominal distension, and feculent or bilious vomiting.
- **`UNI-ABD-07` [URGENT / Tier 3]**: Acute appendicitis: periumbilical pain migrating to right lower quadrant (McBurney's point).

### Group F: Allergy & Anaphylaxis
- **`UNI-ALL-01` [EMERGENCY / Tier 1]**: Anaphylaxis: allergen exposure with acute cutaneous signs (urticaria/angioedema) plus respiratory compromise, wheezing, or hypotension.
- **`UNI-ALL-02` [URGENT / Tier 3]**: Urticaria / localized allergic rash without respiratory or hemodynamic compromise.

### Group G: Hemorrhage & Trauma
- **`UNI-BLD-01` [EMERGENCY / Tier 2]**: Refractory external hemorrhage: active bleeding failing 10 minutes of direct firm pressure.
- **`UNI-BLD-02` [EMERGENCY / Tier 2]**: Acute obstetric / gynecologic hemorrhage: soaking $\ge 1$ menstrual pad per hour.
- **`UNI-BLD-03` [EMERGENCY / Tier 2]**: Massive hemoptysis: coughing up gross blood.
- **`UNI-BLD-04` [EMERGENCY / Tier 2]**: High-energy polytrauma: motor vehicle collision, fall from height $>3\text{ meters}$, or penetrating torso injury.

### Group H: Pregnancy & Postpartum
- **`UNI-PRG-01` [EMERGENCY / Tier 2]**: Severe preeclampsia / eclampsia: pregnancy $\ge 20$ weeks with severe headache, scotoma, right upper quadrant epigastric pain, or seizures.
- **`UNI-PRG-02` [EMERGENCY / Tier 2]**: Threatened obstetric emergencies: active third-trimester bleeding, rupture of membranes before 37 weeks, or cessation of fetal movement.
- **`UNI-PRG-03` [EMERGENCY / Tier 2]**: Critical postpartum collapse: dyspnea, heavy bleeding, or severe headache within 6 weeks of delivery.
- **`UNI-PRG-04` [URGENT / Tier 3]**: Hyperemesis gravidarum or antenatal pyrexia without localized signs.

### Group I: Mental Health & Patient Safety
- **`UNI-PSY-01` [EMERGENCY / Tier 1]**: Active suicidality with immediate intent, plan, access to lethal means, or intent to harm others/infant. Mandates immediate 112 dispatch and Tele-MANAS (14416) crisis transfer.
- **`UNI-PSY-02` [DISCRIMINATE / Tier 3]**: Passive suicidal ideation without active plan or intent. Provides empathetic support and immediate routing to Tele-MANAS (14416).
- **`UNI-PSY-03` [URGENT / Tier 3]**: Acute psychosis, severe psychomotor agitation, or grave disability.

### Group J: Pediatrics & Neonatology
- **`UNI-PED-01` [EMERGENCY / Tier 2]**: Febrile neonate/infant: age $< 3$ months with temperature $\ge 38.0^\circ\text{C}$ or parental report of fever.
- **`UNI-PED-02` [EMERGENCY / Tier 1]**: Pediatric lethargy: infant unresponsive, floppy, or presenting with high-pitched inconsolable cry or bulging fontanelle.
- **`UNI-PED-03` [EMERGENCY / Tier 1]**: Pediatric respiratory failure: grunting, subcostal retractions, nasal flaring, tachypnea ($>60\text{ bpm}$ in infants).
- **`UNI-PED-04` [EMERGENCY / Tier 2]**: Febrile status / meningococcemia: fever with petechial/purpuric non-blanching rash.
- **`UNI-PED-05` [EMERGENCY / Tier 2]**: Pediatric surgical emergency: bilious (green) emesis or intussusception triad (currant jelly stool, colic).
- **`UNI-PED-06` [EMERGENCY / Tier 2]**: Severe infant dehydration: anuria $\ge 8$ hours, absence of tears, sunken fontanelle.
- **`UNI-PED-07` [EMERGENCY / Tier 2]**: Button battery or magnetic foreign body ingestion.
- **`UNI-PED-08` [URGENT / Tier 3]**: Poor feeding or failure to latch in infant $< 6$ months.

### Group K: Sepsis & Febrile Illness (MoHFW India Protocols)
- **`UNI-SEP-01` [EMERGENCY / Tier 1]**: Severe sepsis / septic shock: pyrexia combined with altered mental status, tachypnea, and hypotension.
- **`UNI-SEP-02` [URGENT / Tier 3]**: MoHFW Dengue Protocol: high continuous fever for $>3$ days with severe retro-orbital headache and myalgia.
- **`UNI-SEP-03` [EMERGENCY / Tier 2]**: Dengue Severe Warning Signs: severe abdominal pain, persistent vomiting, mucosal bleeding, or fluid accumulation.
- **`UNI-SEP-04` [EMERGENCY / Tier 2]**: Non-blanching purpuric or petechial rash (glass test positive).

### Group L: Metabolic & Environmental
- **`UNI-MET-01` [EMERGENCY / Tier 2]**: Diabetic Ketoacidosis (DKA): Kussmaul respirations, fruity acetone breath, vomiting, and altered sensorium in known diabetic.
- **`UNI-MET-02` [EMERGENCY / Tier 2]**: Severe neuroglycopenia / hypoglycemia: diaphoresis, tremors, confusion in diabetic taking insulin or sulfonylureas.
- **`UNI-MET-03` [EMERGENCY / Tier 1]**: Exertional/classic heat stroke: hyperthermia with hot dry skin, anhidrosis, and confusion following extreme environmental heat exposure.

### Group M: Toxicology & Envenomation (India Local Context)
- **`UNI-TOX-01` [EMERGENCY / Tier 1]**: Acute snakebite envenomation: neurotoxic (ptosis, diplopia, bulbar palsy) or hemotoxic (fang marks, swelling, coagulopathy).
- **`UNI-TOX-02` [EMERGENCY / Tier 1]**: Acute toxic ingestion: organophosphate, agricultural pesticide, corrosive chemical, or pharmaceutical overdose.
- **`UNI-TOX-03` [EMERGENCY / Tier 1]**: Carbon monoxide poisoning: clustering of headache, dizziness, nausea, and confusion in an unventilated room with an angithi / charcoal stove.
- **`UNI-TOX-04` [EMERGENCY / Tier 1]**: Scorpion envenomation (*Mesobuthus tamulus*): autonomic storm with diaphoresis, priapism, pulmonary edema, and tachycardia in young child.

### Group N: General Red Flags & Observer Alarm
- **`UNI-GEN-01` [EMERGENCY / Tier 1]**: Severe intuitive caregiver/observer alarm: *"I think he is dying"*, *"he is turning grey"*, *"looks completely lifeless"*.
- **`UNI-GEN-02` [EMERGENCY / Tier 1]**: Inability to stay awake or severe collapse during emergency interview.
- **`UNI-GEN-03` [URGENT / Tier 3]**: Progressive unexplained weight loss with intractable nocturnal pain.

---

## 6. Pre-Registered Release Gates & Verification Criteria

To prevent circular verification and establish audit-ready clinical release standards, the following six Release Gates (Gates A through F) are pre-registered:

```
[ Clinical Governance Sign-Off ] (Prerequisite Policy Approval)
                ↓
[ Gate A ] Conversational NLU & Discourse Evaluation (500 Turns)
                ↓
[ Gate B ] Multi-Turn State Tracking & Slot Accuracy (>= 99.0% Safety-Weighted)
                ↓
[ Gate C ] Independent Safety Holdout Battery (N_emergency >= 255)
                ↓
[ Gate D ] Anti-Hallucination & Provenance Verification (0.0% Tol)
                ↓
[ Gate E ] Voice Turn Latency Budget (TTFA P95 < 1.2s target / 1.45s measured)
                ↓
[ Gate F ] FHIR R4 Schema & Cryptographic Audit Hash Verification
```

### Gate A: Conversational NLU, Discourse Parsing & Deterministic Safety Shield
- **Status:** **INITIAL IMPLEMENTATION & REGRESSION CHECKS PASS; FORMAL GATE A EVALUATION REMAINS OUTSTANDING.**
- **Formal Evaluation Acceptance Criteria (Pre-Registered):**
  1. **Dataset Scope:** Minimum of 500 multi-turn patient-agent conversational turns evaluated across diverse dialectal, sociolectal, and demographic patient cohorts.
  2. **Independent Adjudication:** Double-blinded annotation by independent board-certified clinical reviewers who have no visibility into system implementation details.
  3. **Inter-Rater Reliability:** Inter-rater concordance threshold exceeding $\kappa \ge 0.85$ (Cohen's or Fleiss' kappa) on symptom extraction, temporality, and subject attribution.
  4. **Engineering Pre-Requisites Passed in Current Build:**
     - 100% pass across all 65 universal red-flag rules (`tests/adversarial-red-flags.ts`, 102 code checks).
     - 100% pass on presentation-classifier independence suite (`scripts/test-classifier-independence.ts`, 6 code checks).
     - 100% pass across Semantic Dialogue Oracle (`tests/challenge-cases-e2e.ts`, 55 code checks across 6 challenge cases), with positive defect rejection verification.
     - 100% pass on Regression Battery v2 (`tests/adversarial-red-flags-holdout.ts`, 96 code checks).
     - 0 under-triage failures across all 159 deterministic safety arbiter checks (`scripts/test-safety-arbiter-decision.ts`, 159 code checks).
  *Note: These automated checks confirm code conformance against author-defined specifications, but do not demonstrate that the formal 500-utterance Gate A clinical evaluation has been completed.*

### Pre-Requisite Milestone: Formal Clinical Governance Approval
- **Status:** **PENDING EXTERNAL CLINICAL SIGN-OFF** (Blocker for Clinical Pilot & Gate C activation).
- **Scope & Purpose:** Clinical review and sign-off on the actual proposed clinical triage policies and safety thresholds, distinct from software engineering gate evaluations.
- **Requirements:**
  1. Written and signed approval from a minimum of **two board-certified physicians**:
     - Lead 1: Board-Certified Emergency Medicine Physician.
     - Lead 2: Board-Certified Critical Care / Internal Medicine Specialist.
  2. Explicit written determinations recorded on the Governance Ledger for:
     - Proposed Policy 1: Unassessed pleuritic pain Tier 3 floor (`UNI-CAR-06`).
     - Proposed Policy 2: Orthostatic volume depletion / diarrhea Tier 3 floor with explicit help-seeking actions.
     - Proposed Policy 3: Severe abdominal pain Tier 3 floor with surgical/vascular red-flag escalation criteria.
     - Empirical age cutoffs: Atypical ACS ($\ge 40$ with comorbidity, $\ge 60$ general), neonatal fever ($<3$ months), ruptured AAA ($\ge 50$).

### Gate B: Formal Multi-Turn State-Tracking & Slot Evaluation
- **Status:** **PRE-REGISTERED SPECIFICATION (Evaluation Protocol Defined).**
- **Registered Acceptance Criteria:**
  1. **Safety-Weighted Slot Accuracy:** Greater than or equal to **99.0%** across complex multi-turn clinical dialogue paths.
     - **Slot Weighting Architecture & Error Penalties:**
       - **Critical Safety Slots (Weight 5.0x):** Red flag presence/denial, chief complaint, age/pregnancy modifiers, and acute temporality. Strict constraint: **0 critical safety slot errors permitted (100.0% safety slot recall).**
       - **Standard Clinical Slots (Weight 2.0x):** Symptom duration, onset trajectory, character, severity, radiation, and past medical history.
       - **Contextual Dialogue Slots (Weight 1.0x):** Conversational metadata, third-party caller attribution details, and administrative preferences.
     - Formula: $\text{Weighted Accuracy} = \frac{\sum w_i \cdot \mathbb{I}(\text{slot}_i \text{ correct})}{\sum w_i} \ge 99.0\%$.
  2. **Correction Handling:** 100% precision in processing user corrections (e.g. correcting onset, laterality, or previously asserted symptoms) without state regression or zombie slots.
  3. **Non-Deniable Invariant Enforcement:** Zero tolerance for dropping or negating clinically irreversible safety findings (e.g., severe dyspnea, crushing chest pain, suicidal intent) through subsequent conversational turns.
  4. **Multi-Turn State Stability:** Zero state degradation across long dialogues ($\ge 10$ turns) tracking both caller and patient entities without memory leaks or attribution drift.

### Gate C: Independent Holdout Validation & Statistical Sample Size Reconciliation
- **Status:** **PRE-REGISTERED SPECIFICATION** (Testing frozen until Gate B complete).
- **Mathematical Sample Size Reconciliation with Explicit Denominator:**
  - A previous draft suggested $N=200$ cases would establish a Wilson 95% confidence interval lower bound $\ge 98.5\%$. This was a mathematical contradiction.
  - **Derivation for Emergency Sensitivity:** To claim emergency sensitivity (recall on true emergencies) with a Wilson 95% two-sided lower bound $\ge 98.5\%$, the denominator must consist strictly of cases independently adjudicated as **true emergencies**:
    $$\text{Lower Bound} = \frac{N_{\text{emergency}}}{N_{\text{emergency}} + Z^2} = \frac{N_{\text{emergency}}}{N_{\text{emergency}} + 3.8416}$$
  - For $N_{\text{emergency}} = 200$ with 0 misses:
    $$\text{Lower Bound} = \frac{200}{200 + 3.8416} = \frac{200}{203.8416} = 0.98115 \approx \mathbf{98.12\%} < 98.5\%$$
  - To achieve an empirical lower bound $\ge 98.50\%$:
    $$\frac{N_{\text{emergency}}}{N_{\text{emergency}} + 3.8416} \ge 0.985 \implies N_{\text{emergency}} \ge \frac{0.985 \times 3.8416}{1 - 0.985} = \frac{3.783976}{0.015} = 252.27 \implies \mathbf{N_{\text{emergency}} \ge 253}$$
  - **Critical Denominator Constraint:** A mixed evaluation cohort containing both emergency and non-emergency cases cannot establish $\ge 98.5\%$ emergency sensitivity unless the emergency sub-cohort independently satisfies $N_{\text{emergency}} \ge 255$ true emergencies with 0 misses.
- **Pre-Registered Gate C Evaluation Cohorts:**
  1. **Emergency Sensitivity Cohort:** Exactly **$N_{\text{emergency}} = 255$** consecutive, novel true emergency cases authored independently by external clinical faculty without agent visibility. Required: **0 under-triage failures** ($x = 255$), mathematically establishing a Wilson 95% CI lower bound of $\ge 98.51\%$ emergency recall.
  2. **Non-Emergency Specificity Cohort:** A concurrent cohort of independently adjudicated non-emergencies (Tiers 3–5) to measure false emergency escalation and over-triage rates.
  *Note: Reserve the term "independent holdout" strictly for evaluations that have never been seen by the development team or used to tune the system.*

### Gate D: Provenance Integrity & Anti-Hallucination Oracle
- **Status:** **PRE-REGISTERED OPERATIONAL SPECIFICATION**.
- **Tolerance:** **0.0% tolerance** across 4 operational hallucination categories:
  1. **Category 1 (Symptom & Descriptor Hallucination):** Verbalizing symptom qualities or descriptors not stated by the user (e.g., claiming "tight crushing pressure" when the patient reported only "chest pain").
  2. **Category 2 (Subject Attribution Distortion):** Conflating the caller with the patient (e.g., advising the caller "in your chest" when the caller reported "my mother has chest pain").
  3. **Category 3 (Biometric & Objective Fabrication):** Fabricating numeric vitals (BP, SpO2, heart rate, temperature) or physical examination findings when no physical sensor or clinical exam was conducted.
  4. **Category 4 (False Reassurance & Unsupported Exclusions):** Proclaiming clinical reassurance based on the absence of a single finding (e.g., telling a shaking, sweating patient "because you have no fever, you are fine", ignoring acute hypoglycemia).

### Gate E: Conversational Latency Budget & Audio Turn-Around
- **Status:** **BASELINE RECORDED / OPTIMIZATION TARGET PRE-REGISTERED (METRICS DISENTANGLED)**.
- **Disentangled Latency Metric Definitions:**
  1. **Time to First Audio (TTFA):** Measured from caller speech endpoint ($T_{\text{VAD End}}$) to receipt of the first synthesized audio stream chunk ($T_{\text{First Audio Out}}$). Reflects perceived conversational responsiveness.
  2. **Full-Turn Completion Latency:** Measured from caller speech endpoint ($T_{\text{VAD End}}$) to complete playback termination of the full synthesized response ($T_{\text{Playback Finished}}$).
- **Measured Empirical Baseline (Full Pipeline Turn on Local GPU):**
  - **TTFA P50:** $\sim \mathbf{820\text{ ms}}$.
  - **TTFA P95:** $\sim \mathbf{1.45\text{ s}}$ (1450 ms).
  - **Full-Turn Median Completion Latency:** $\sim \mathbf{1.58\text{ seconds}}$ (1580 ms).
- **Pre-Registered Production Acceptance Target:**
  - **TTFA P95 Target:** $< \mathbf{1.20\text{ s}}$ (1200 ms).
  - *Current Engineering Status: The 1.20s TTFA P95 threshold remains an **unachieved target**. Closing the gap from 1.45s to 1.20s requires streaming ASR chunking, speculative LLM drafting, and streaming TTS playback prior to clinical pilot deployment.*

### Gate F: FHIR R4 Interoperability & Cryptographic Audit Hash Verification
- **Status:** **PRE-REGISTERED VERIFICATION**.
- **Requirements:**
  1. Complete validation of all exported clinical summaries against standard HL7 FHIR R4 schema validators (`Encounter`, `Observation`, `Condition`, `ServiceRequest`).
  2. Provenance chain validation: Every turn must produce an append-only, SHA-256 cryptographic hash block (`audit_hash_chain`), ensuring tamper-evident tracking from raw patient transcript to emergency dispatch.

---

## 7. Emergency Dispatch & Verbalization Protocols

When an emergency rule fires, MedVoice immediately halts non-essential history gathering, convenes the emergency board, and delivers clear, structured emergency instructions:

```text
[EMERGENCY PROTOCOL - INDIA]
"Please stop and listen carefully. Based on what you have described, this could be a life-threatening emergency.
Please call 112 or 108 immediately for an ambulance, or have someone take you to the nearest emergency room right now.
Do not attempt to drive yourself. Keep sitting or lying down, stay calm, and keep someone with you."

[MENTAL HEALTH PROTOCOL - TELE-MANAS]
"I hear how much pain you are in right now, but please know that you do not have to carry this alone.
Please connect immediately with the National Tele-MANAS crisis helpline at 14416 or call 112.
Trained compassionate counselors are available 24/7 to support you right now."
```

---

## 8. Clinical Governance Sign-Off Record Template

The following formal governance template must be completed and countersigned by clinical reviewers prior to advancing from Gate B to Gate C:

```
========================================================================================
                      MEDVOICE CLINICAL GOVERNANCE SIGN-OFF RECORD
========================================================================================

Review Date:                       ____________________________________________________
Document & Policy Version:         MedVoice Clinical Review Packet v2.0 (Phase 2 Freeze)
Evaluated Red-Flag Specification:  universal-red-flag-spec.md (Groups A–N, 65 Rules)

CLINICAL REVIEWER 1:
Full Name:                         ____________________________________________________
Medical Degree / Qualifications:   ____________________________________________________
Board Certification & Specialty:   ____________________________________________________
Institutional Affiliation:         ____________________________________________________
Medical License Number & State:    ____________________________________________________

CLINICAL REVIEWER 2:
Full Name:                         ____________________________________________________
Medical Degree / Qualifications:   ____________________________________________________
Board Certification & Specialty:   ____________________________________________________
Institutional Affiliation:         ____________________________________________________
Medical License Number & State:    ____________________________________________________

SPECIFIC POLICY DETERMINATIONS:
1. Proposed Policy 1 (Unassessed Pleuritic Pain Tier 3 Floor - UNI-CAR-06):
   [ ] Approved as Written       [ ] Approved with Amendments       [ ] Rejected
   Clinical Comments: _________________________________________________________________
   ____________________________________________________________________________________

2. Proposed Policy 2 (Severe Dehydration with Orthostasis Tier 3 Floor):
   [ ] Approved as Written       [ ] Approved with Amendments       [ ] Rejected
   Clinical Comments: _________________________________________________________________
   ____________________________________________________________________________________

3. Proposed Policy 3 (Severe Abdominal Pain Tier 3 Floor & Surgical Red-Flag Exclusion):
   [ ] Approved as Written       [ ] Approved with Amendments       [ ] Rejected
   Clinical Comments: _________________________________________________________________
   ____________________________________________________________________________________

4. Empirical Age Thresholds (Atypical ACS >=40+comorb / >=60; Infant Fever <3mo; AAA >=50):
   [ ] Approved as Written       [ ] Approved with Amendments       [ ] Rejected
   Clinical Comments: _________________________________________________________________
   ____________________________________________________________________________________

OVERALL CLINICAL DETERMINATION:
[ ] APPROVED TO PROCEED TO GATE C (Independent 255-Case Holdout Battery)
[ ] CONDITIONAL APPROVAL (Requires code amendments specified in comments above)
[ ] REJECTED (Do not proceed; requires clinical protocol redesign)

Lead Clinician Signature:          _________________________________  Date: ___________
Secondary Clinician Signature:     _________________________________  Date: ___________
========================================================================================
```

---

## 9. Clinical Testing Boundaries & Governance Scope

To maintain scientific, legal, and regulatory integrity:
1. **Deterministic Test Conformance vs. Clinical Safety:** Pass rates on automated test suites reflect regression and boundary conformance against author-defined specifications. They do **not** constitute clinical validation of real-world emergency recall.
2. **Exclusion of Circular Error Bounds:** Empirical performance claims cannot be extrapolated from test suites that the codebase was iteratively tuned to pass. True statistical validation requires prospective, clinician-authored double-blind evaluation.
3. **Regulatory Sandbox Disclaimer:** MedVoice is a research capstone prototype. It has not received CDSCO, US FDA, or CE Mark medical device certification and must operate strictly in simulated, shadow, or supervised research configurations.
