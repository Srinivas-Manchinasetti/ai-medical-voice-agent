# MedVoice Universal Red-Flag Screen: Specification (DRAFT v0.1)

> **Status:** developer draft. Every trigger, age cut-off and time threshold below is a *placeholder for clinician review*. Nothing here is validated clinical content. Mark each rule `reviewed_by` / `reviewed_on` before it ships.
> **Label:** outputs are *ESI-style telephone triage acuity*, not formal ESI (no vitals, no bedside exam).

---

## 1. Design principles

1. **Classifier-independent.** The screen runs every turn in `safety-arbiter.ts` on normalized text + `ClinicalState` + modifiers. It never reads `PresentationContext`. Classifier output (including `UNCLASSIFIED` or a wrong label) must not be able to suppress a rule.
2. **Escalate-only (monotonic).** The screen can raise acuity, never lower it. Only an explicit, specific patient denial of the *same* finding can clear a rule (see 4).
3. **Fail-safe on uncertainty.** "Not sure", "maybe", silence, or low-confidence ASR on a high-lethality trigger = treat as positive-uncertain and ask one discriminator question; do not treat as negative.
4. **Negation is local.** "No chest pain" negates only chest pain, not the sweating mentioned next to it.
5. **Deterministic and auditable.** Same input gives same output. Every firing logs `ruleId`, matched span, source (utterance vs state), and modifiers that amplified it.
6. **No diagnosis, no medication advice** in the emergency script unless clinician-approved wording exists (e.g. aspirin has contraindications; do not include by default).
7. **Does not depend on the LLM.** The LLM only verbalizes the arbiter's decision.

## 2. Output contract

```ts
type RedFlagLevel = "NONE" | "DISCRIMINATE" | "URGENT_SAME_DAY" | "EMERGENCY_NOW";

interface RedFlagResult {
  level: RedFlagLevel;
  firedRules: { ruleId: string; spans: string[]; amplifiers: string[]; confidence: number }[];
  discriminatorQuestion?: { ruleId: string; intent: string; text: string }; // max 1 per turn
  reason: string; // internal, never shown verbatim to patient
}
```

| Level | Meaning | System behaviour |
|---|---|---|
| `EMERGENCY_NOW` | Possible immediate life threat | Stop intake, deliver emergency script, no further questions except location/safety logistics |
| `URGENT_SAME_DAY` | Needs clinician within hours | Continue short intake, then recommend same-day care |
| `DISCRIMINATE` | A dangerous cause cannot be excluded yet | Ask exactly one targeted question (highest lethality first), then re-evaluate |
| `NONE` | No universal flag | Normal presentation-driven flow |

**Evaluation order:** A (airway) → B (circulation) → C (neuro) → D (cardiac) → ... → N. First `EMERGENCY_NOW` short-circuits.

**India configuration (put in config, not code, and verify per state):** national emergency number `112`; ambulance `108` in many states; `102` maternal/child transport in many states; Tele-MANAS mental-health helpline `14416`. Never hard-code `911`.

---

## 3. Rule catalogue

Notation: **E** = EMERGENCY_NOW, **U** = URGENT_SAME_DAY, **D** = DISCRIMINATE. "Any" = any one listed finding.

### A. Airway / breathing
| ID | Trigger | Level |
|---|---|---|
| UNI-AIR-01 | Cannot speak full sentences, gasping, struggling for breath at rest | E |
| UNI-AIR-02 | Blue/grey lips or face, stridor, choking, drooling with muffled voice | E |
| UNI-AIR-03 | Swelling of lips/tongue/throat, throat closing | E |
| UNI-AIR-04 | Wheeze or breathlessness + cannot lie flat / speak, or no relief from usual inhaler | E |
| UNI-AIR-05 | New breathlessness with exertion only, no rest symptoms | D |

### B. Circulation / shock
| ID | Trigger | Level |
|---|---|---|
| UNI-CIR-01 | Fainted / near-faint **with** chest pain, palpitations, or exertion | E |
| UNI-CIR-02 | Cold, clammy, grey, or mottled skin with weakness/confusion | E |
| UNI-CIR-03 | Vomiting blood, black tarry stool, or large red rectal bleeding **with** dizziness/weakness | E |
| UNI-CIR-04 | Racing/irregular heartbeat with dizziness, chest pain, or breathlessness | E |
| UNI-CIR-05 | Isolated palpitations, no associated symptoms | D |

### C. Neurological
| ID | Trigger | Level |
|---|---|---|
| UNI-NEU-01 | Face droop, arm/leg weakness or numbness one side, slurred or lost speech (any, sudden) | E |
| UNI-NEU-02 | Sudden loss of vision, double vision, or sudden severe loss of balance with other neuro signs | E |
| UNI-NEU-03 | "Worst headache of life" / thunderclap (peak within seconds to a minute) | E |
| UNI-NEU-04 | Seizure now, or first-ever seizure, or seizure that doesn't stop | E |
| UNI-NEU-05 | New confusion, unusual drowsiness, or cannot be woken | E |
| UNI-NEU-06 | Headache + fever + stiff neck, or light sensitivity, or rash | E |
| UNI-NEU-07 | Head injury + vomiting, loss of consciousness, drowsiness, or on blood thinners | E |
| UNI-NEU-08 | Age > 50 new headache with jaw pain on chewing or vision change | U |

### D. Cardiac: classic, atypical, aortic
| ID | Trigger | Level |
|---|---|---|
| UNI-CAR-01 | Chest pressure/tightness/heaviness/squeezing, **any** duration while active | E |
| UNI-CAR-02 (atypical) | Epigastric burning / "indigestion" / unusual fatigue / nausea / breathlessness / jaw, neck, arm, shoulder, or back discomfort **+** (sweating, or exertional onset, or no relief with antacid) **+** amplifier (age ≥ 40 [placeholder], diabetes, HTN, smoker, prior heart disease, postmenopausal) | E |
| UNI-CAR-03 | Same atypical symptoms without sweating/exertion, but amplifier present | D (ask: exertional? sweating? radiation? known heart disease?) |
| UNI-CAR-04 | Sudden tearing/ripping chest or back pain, or pain radiating to back, esp. with HTN/Marfan/pregnancy/postpartum | E |
| UNI-CAR-05 | Sudden breathlessness + sharp pain on breathing, or leg swelling/calf pain, or recent surgery/long travel/immobility/pregnancy/postpartum (possible PE) | E |
| UNI-CAR-06 | Chest pain with sharp, positional, reproducible features, no amplifiers, no associated symptoms | U (do not de-escalate below U in the voice setting) |

### E. Abdominal / surgical
| ID | Trigger | Level |
|---|---|---|
| UNI-ABD-01 | Rigid/board-like abdomen, cannot move or cough without severe pain | E |
| UNI-ABD-02 | Severe abdominal pain + vomiting blood / black stool / fainting | E |
| UNI-ABD-03 | Woman of reproductive age with abdominal/pelvic pain + (missed period or pregnancy, or vaginal bleeding, or dizziness, or shoulder-tip pain) | E |
| UNI-ABD-04 | Age ≥ 60 [placeholder] sudden severe abdominal/back pain, or pain out of proportion to exam, or known AAA | E |
| UNI-ABD-05 | Sudden severe testicular pain | E |
| UNI-ABD-06 | Persistent vomiting + cannot pass stool/gas + distension | U (E if severe pain) |
| UNI-ABD-07 | Pain migrating to right lower abdomen with fever/vomiting | U |

### F. Allergy / anaphylaxis
| ID | Trigger | Level |
|---|---|---|
| UNI-ALL-01 | Exposure (food, drug, sting) + hives/swelling + (breathing difficulty OR dizziness OR repeated vomiting) | E |
| UNI-ALL-02 | Hives/rash alone, no systemic symptoms | U/ROUTINE per clinician |

### G. Hemorrhage / trauma
| ID | Trigger | Level |
|---|---|---|
| UNI-BLD-01 | Bleeding that doesn't stop after 10 min firm pressure | E |
| UNI-BLD-02 | Heavy vaginal bleeding (soaking ≥ 1 pad/hour) or any bleeding in pregnancy ≥ [X] weeks | E |
| UNI-BLD-03 | Coughing up more than streaks of blood | E |
| UNI-BLD-04 | Major trauma, penetrating injury, fall from height, road accident with pain/confusion | E |

### H. Pregnancy / postpartum
| ID | Trigger | Level |
|---|---|---|
| UNI-PRG-01 | Pregnant ≥ 20 wk + severe headache, visual disturbance, upper-abdominal pain, facial/hand swelling, or seizure | E |
| UNI-PRG-02 | Pregnancy + vaginal bleeding, fluid leak, regular painful contractions < 37 wk, or markedly reduced fetal movement | E |
| UNI-PRG-03 | Postpartum (≤ 6 wk) heavy bleeding, fever, chest pain, breathlessness, severe headache, leg swelling | E |
| UNI-PRG-04 | Pregnancy + fever, or persistent vomiting with inability to keep fluids | U |

### I. Mental health / safety
| ID | Trigger | Level |
|---|---|---|
| UNI-PSY-01 | Suicidal thoughts with plan, means, intent, or recent attempt; thoughts of harming others | E (route to 112 + Tele-MANAS; stay supportive, no method information) |
| UNI-PSY-02 | Passive thoughts of not wanting to live, self-harm urges without plan | U (supportive response, helpline, human follow-up) |
| UNI-PSY-03 | Acute psychosis, severe agitation, unable to care for self | U/E per clinician |

> Suicidality must never be gated by the classifier or by "ask-once" logic. If it fires, no end-conversation, no deflection, no cheerful tone.

### J. Neonate / infant / child
| ID | Trigger | Level |
|---|---|---|
| UNI-PED-01 | Age < 3 months [placeholder] + fever ≥ 38.0 °C (or hypothermia, or "feels very hot/cold") | E |
| UNI-PED-02 | Any age: unresponsive/floppy/very hard to wake, inconsolable high-pitched cry, bulging fontanelle | E |
| UNI-PED-03 | Fast breathing, grunting, chest/rib retractions, flaring nostrils, blue lips | E |
| UNI-PED-04 | Seizure, or fever with non-blanching (does not fade on pressing) rash or stiff neck | E |
| UNI-PED-05 | Green (bilious) vomit, blood in stool, or episodic severe crying with drawing up legs | E |
| UNI-PED-06 | No urine ≥ 8 h [placeholder], sunken eyes/fontanelle, no tears, not drinking | E (infant) / U (older child) |
| UNI-PED-07 | Possible ingestion of medicine, pesticide, kerosene, battery, or magnets | E |
| UNI-PED-08 | Poor feeding in an infant < 6 months | U |

### K. Sepsis-like / infection
| ID | Trigger | Level |
|---|---|---|
| UNI-SEP-01 | Fever or feeling very unwell + confusion, very fast breathing, cold mottled skin, or very low urine | E |
| UNI-SEP-02 | Fever in immunosuppressed/chemotherapy/transplant/steroid patient | U (E if any systemic sign) |
| UNI-SEP-03 | **Dengue/malaria-region warning signs:** fever 2-7 days + (persistent vomiting, severe abdominal pain, bleeding gums/nose/stool, restlessness, cold extremities) | E |
| UNI-SEP-04 | Fever with rash that doesn't blanch | E |

### L. Metabolic
| ID | Trigger | Level |
|---|---|---|
| UNI-MET-01 | Diabetes + vomiting + fast/deep breathing, fruity breath, or drowsiness | E |
| UNI-MET-02 | Diabetes/insulin + sweating, shaking, confusion, or unconsciousness | E |
| UNI-MET-03 | Heat exposure + confusion, hot dry/flushed skin, or collapse | E |

### M. Poisoning / envenomation / environmental (India-relevant)
| ID | Trigger | Level |
|---|---|---|
| UNI-TOX-01 | Snakebite or suspected snakebite, any symptom or none | E |
| UNI-TOX-02 | Ingestion of pesticide / organophosphate / rat poison / unknown substance, or intentional overdose | E |
| UNI-TOX-03 | Headache/dizziness/drowsiness in several people in the same enclosed space, or with a gas heater, charcoal, generator (CO exposure) | E |
| UNI-TOX-04 | Scorpion sting with sweating, breathlessness, or child < 5 y | E |

### N. Catch-all
| ID | Trigger | Level |
|---|---|---|
| UNI-GEN-01 | Patient or caller says "I think I'm dying", "something is very wrong", or caregiver "he/she looks very sick" | E |
| UNI-GEN-02 | `UNCLASSIFIED` presentation + any amplifier (age extreme, pregnancy, immunosuppression) | D → ask 1 discriminator, then at least U |

---

## 4. Cross-presentation mimic rules

These fire from **raw findings**, whatever the classifier tagged. The classifier tag is metadata only.

| Surface complaint | Hidden danger | Fire when | Discriminator (max 1/turn, in this order) |
|---|---|---|---|
| Epigastric pain, indigestion, nausea, "gas" | ACS | amplifier present (see UNI-CAR-02) | "Does it come on with walking or effort, or with sweating?" → "Does it spread to your jaw, arm or back?" |
| Abdominal pain, woman of reproductive age | Ectopic pregnancy | any chance of pregnancy | "Could you be pregnant, or have you missed a period?" |
| Abdominal / back / flank pain, age ≥ 60 | AAA, dissection, mesenteric ischemia | sudden or severe | "Did it start suddenly? Is it the worst pain you have had?" |
| Dizziness / vertigo | Posterior stroke, arrhythmia, GI bleed, hypoglycemia | vascular risk factors, or any neuro sign, or palpitations | "Any trouble speaking, double vision, weakness, or inability to walk?" (**never ask the patient to perform HINTS or any examination maneuver**) |
| Headache | SAH, stroke, meningitis, preeclampsia, CO poisoning, hypertensive crisis | thunderclap, fever/stiff neck, pregnancy, others affected | "Did it reach full pain within a minute?" |
| Breathlessness | ACS, PE, HF, anaphylaxis, DKA | any amplifier | "Is it there at rest? Any chest pain or leg swelling?" |
| Sore throat | Epiglottitis, deep neck infection, cardiac (jaw/throat pressure) | drooling, muffled voice, can't open mouth, or effort-related | "Can you swallow your saliva and open your mouth fully?" |
| Fever | Sepsis, meningitis, dengue, malaria, typhoid | per UNI-SEP rules | "Any confusion, rash, stiff neck, bleeding, or very fast breathing?" |
| Diarrhea / vomiting | Dehydration, DKA, ischemic bowel, cholera | infant, elderly, diabetic, bloody stool, no urine | "When did you last pass urine? Any blood in stool?" |
| Fatigue / weakness | ACS, anemia, stroke, hyperkalemia | amplifier present | "Any chest discomfort, sweating, or one-sided weakness?" |
| Jaw, arm, shoulder, back pain | ACS, dissection | exertional or amplifier | as ACS |

**Amplifiers (global modifiers, independent of presentation):** age < 3 mo / < 5 y / ≥ 60 y; pregnancy/postpartum; diabetes; HTN; known heart disease; smoker; CKD; cancer/immunosuppression; anticoagulants; recent surgery or immobility; lives alone / no immediate help.

---

## 5. Engine semantics

- **Normalization first:** lowercase, strip ASR filler, expand common mishearings, transliterate Hindi/Telugu/Hinglish tokens to canonical concepts *before* matching.
- **Concept lexicon, not regex on English only.** Each concept needs English, Hindi, Telugu, and code-mixed surface forms. Examples to seed (**native-speaker review required**): "saans nahi aa rahi" (Hindi: not able to breathe), "seene mein dard" (chest pain), "ఛాతీ నొప్పి" / "chaati noppi" (chest pain), "ఊపిరి ఆడట్లేదు" / "oopiri aadatledu" (can't breathe), "mukham okavaipu vanchipoyindi" (face drooped to one side).
- **Negation scope:** a negation clears only the concept it is attached to, within the same clause. "No chest pain but I'm sweating a lot" leaves sweating active.
- **Source of facts:** read both the current utterance and accumulated `ClinicalState`. A finding mentioned on turn 1 still counts on turn 6.
- **Discriminator rules:** max one per turn; order by lethality, then by how cheaply it splits the differential; never re-ask something already answered; counts toward the turn budget but **overrides** it (a pending `DISCRIMINATE` must be resolved or escalated before intake ends).
- **De-escalation:** only via explicit, specific denial of the discriminator ("no, it doesn't spread anywhere and I'm not sweating"). A vague answer or silence stays positive-uncertain; if still unresolved at the turn limit, escalate one level.
- **Emergency script:** short, directive, non-diagnostic, in the patient's language: call 112/108 now, don't travel alone/don't drive yourself, unlock the door, stay with someone, share your location. No diet, drug, or home-remedy advice unless clinician-approved.

## 6. Required tests for this module

1. **Classifier independence:** every emergency eval case must produce the same level with the classifier stubbed to `UNCLASSIFIED`, and with it forced to a wrong label.
2. **Monotonicity:** no input sequence lowers acuity once raised, except explicit specific denial.
3. **Determinism:** 100 repeated runs, identical output.
4. **Negation:** paired cases (with and without negation) for every `E` rule.
5. **Code-mixing:** each `E` rule has at least one Hindi, one Telugu/Telugu-English, and one noisy-ASR variant.
6. **Over-trigger guard:** benign negatives (see eval set) must not reach `EMERGENCY_NOW`.
7. **Turn-budget interaction:** a pending discriminator at the turn limit escalates, never silently ends intake.

## 7. Open items for clinician review

- All age cut-offs, time thresholds (8 h urine, 10 min pressure, 3-month fever) and gestational-age thresholds.
- Whether UNI-CAR-06 and UNI-ALL-02 should sit at `U` or lower.
- Approved emergency-script wording in English, Hindi, Telugu.
- Regional disease triggers (dengue/malaria/typhoid season and geography) and snakebite/scorpion wording.
- Whether the "E" level for psychiatric triggers should route to 112 or Tele-MANAS first, in line with local protocol.
