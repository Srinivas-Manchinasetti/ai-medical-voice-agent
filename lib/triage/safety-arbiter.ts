import { z } from 'zod';

/**
 * CLINICAL FEATURES SCHEMA
 * Structured representation of symptoms extracted from patient utterances.
 */
export const ClinicalFeaturesSchema = z.object({
  // Cardiovascular / Hemodynamic
  chestPain: z.boolean().default(false),
  pressureLikePain: z.boolean().default(false),
  radiationToArm: z.boolean().default(false),
  radiationToJaw: z.boolean().default(false),
  diaphoresis: z.boolean().default(false), // Cold sweats
  palpitations: z.boolean().default(false),
  syncopeOrDizziness: z.boolean().default(false),

  // Neurological (BE-FAST Criteria)
  facialDroop: z.boolean().default(false),
  armWeakness: z.boolean().default(false),
  speechDifficulty: z.boolean().default(false),
  suddenConfusion: z.boolean().default(false),
  thunderclapHeadache: z.boolean().default(false), // 'Worst headache of life'
  neckStiffness: z.boolean().default(false),
  lossOfConsciousness: z.boolean().default(false),

  // Respiratory / Airway
  severeDyspnea: z.boolean().default(false),
  stridor: z.boolean().default(false), // Upper airway obstruction
  cyanosis: z.boolean().default(false), // Blue lips/skin
  inabilityToSpeakFullSentences: z.boolean().default(false),
  wheezing: z.boolean().default(false),

  // Allergic / Anaphylaxis
  throatTightness: z.boolean().default(false),
  tongueSwelling: z.boolean().default(false),
  allergenExposure: z.boolean().default(false),

  // Gastrointestinal / Acute Abdomen
  severeAbdominalPain: z.boolean().default(false),
  rigidAbdomen: z.boolean().default(false),
  rightLowerQuadrantPain: z.boolean().default(false),
  vomitingBloodOrMelena: z.boolean().default(false),

  // Pediatric & Systemic Sepsis
  pediatricPatient: z.boolean().default(false),
  highFever: z.boolean().default(false), // > 103 F / 39.4 C
  infantUnder3Months: z.boolean().default(false),
  lethargyOrInconsolable: z.boolean().default(false),

  // Low Acuity / Chronic / Routine
  mildCoughOrCold: z.boolean().default(false),
  localizedRashWithoutFever: z.boolean().default(false),
  minorSprainWithoutDeformity: z.boolean().default(false),
  prescriptionRefill: z.boolean().default(false),
});

export type ClinicalFeatures = z.infer<typeof ClinicalFeaturesSchema>;

export interface ArbiterResult {
  triageLevel: 'emergency' | 'priority' | 'routine';
  esiScore: 1 | 2 | 3 | 4 | 5;
  esiTitle: string;
  isEmergency: boolean;
  arbiterOverride: boolean; // True when deterministic arbiter overrode an unsafe suggestion
  redFlagsTriggered: string[];
  matchedRules: string[];
  clinicalProtocol: string;
  recommendedAction: string;
  icd10Codes: string[];
  detectedSymptoms: string[];
  latencyMs: number;
}

/**
 * DETERMINISTIC FEATURE EXTRACTOR
 * Clinical regex-powered extraction with context-aware negation detection.
 */
export function extractClinicalFeatures(text: string, patientAge?: number): ClinicalFeatures {
  const lower = ' ' + text.toLowerCase() + ' ';

  // Checks pattern with robust 60-character negation lookbehind window
  const matchesPattern = (regex: RegExp): boolean => {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const gRegex = new RegExp(regex.source, flags);
    let match: RegExpExecArray | null;
    let foundUnnegated = false;

    while ((match = gRegex.exec(lower)) !== null) {
      const preceding = lower.substring(Math.max(0, match.index - 70), match.index);
      const isNegated = /\b(no|not|never|never had|denies|denied|without|negative for|neither|none of|asked if|checking if|wondering if)\b/i.test(preceding);
      if (!isNegated) {
        foundUnnegated = true;
        break;
      }
    }
    return foundUnnegated;
  };

  const isPediatric = (patientAge !== undefined && patientAge <= 14) ||
    /\b(child|baby|infant|toddler|pediatric|my son|my daughter|newborn)\b|\b\d+\s*(months?|weeks?|years?)\s*old\b/i.test(lower);

  const chestMentioned = /chest|heart|sternal|substernal|ribs/i.test(lower);
  const painOrPressure = /pain|pressure|tight|crush|heav|squeez|burn|weight|elephant/i.test(lower);
  const hasChestPainOrPressure = matchesPattern(/(chest|precordial|substernal).*?(pain|pressure|tight|crush|weight|elephant|discomfort)|(pain|pressure|crush|tight|weight|elephant).*?(chest|precordium|substernal)/i) ||
    (chestMentioned && painOrPressure && !matchesPattern(/no\s+chest/i));

  const features: ClinicalFeatures = {
    // Cardiovascular
    chestPain: hasChestPainOrPressure,
    pressureLikePain: matchesPattern(/crush|elephant|heavy weight|squeezing|tight band|intense pressure|(severe|heavy|crushing)\s+(tight\s+)?(chest\s+)?pressure|(severe|intense)\s+(chest\s+)?tight/i),
    radiationToArm: matchesPattern(/(radiat|spread|travel).*?(arm|arms|shoulder)|(left|both).*?arm.*?(pain|numb|heav|ach)|(pain|heav).*?(down|in).*?(left|both).*?arm/i),
    radiationToJaw: matchesPattern(/(radiat|spread|travel).*?(jaw|neck|teeth)|(jaw|neck).*?(pain|ache|tight)/i),
    diaphoresis: matchesPattern(/sweat|diaphoresis|clammy|cold sweat/i),
    palpitations: matchesPattern(/heart.*?(rac|flutter|pound|skip)|palpitation|racing heart|irregular beat/i),
    syncopeOrDizziness: matchesPattern(/pass(ed)? out|black(ed)? out|faint|syncope|dizzy|lightheaded/i),

    // Neurological (BE-FAST Criteria)
    facialDroop: matchesPattern(/face.*?(droop|drop|asymmetr|crooked|numb)|(droop|crooked).*?(face|mouth|smile)|mouth.*?droop/i),
    armWeakness: matchesPattern(/(arm|hand|leg|limb).*?(weak|numb|heavy|cannot lift|unable to lift)|one-?sided weakness|hemiparesis/i),
    speechDifficulty: matchesPattern(/(speech|talk|words).*?(slur|garbl|troubl|cannot find|incoherent)|(slur|garbl).*?(speech|words)|aphasia|dysarthria/i),
    suddenConfusion: matchesPattern(/sudden confusion|disoriented|does not recognize|confused/i),
    thunderclapHeadache: matchesPattern(/worst headache|thunderclap|sudden explosive headache|head.*?explod/i),
    neckStiffness: matchesPattern(/stiff neck|nuchal rigidity|neck pain with fever/i),
    lossOfConsciousness: matchesPattern(/unresponsive|passed out|unconscious|cannot wake/i),

    // Respiratory
    severeDyspnea: matchesPattern(/cannot breathe|shortness of breath|gasping|suffocating|fighting for breath/i),
    stridor: matchesPattern(/stridor|high pitched breathing|choking sound|airway closing/i),
    cyanosis: matchesPattern(/blue lips|turning blue|cyanosis|fingertips blue/i),
    inabilityToSpeakFullSentences: matchesPattern(/cannot speak full sentences|words between breaths|struggling to speak/i),
    wheezing: matchesPattern(/wheez|asthma attack|bronchospasm|tight lungs/i),

    // Allergic / Anaphylaxis
    throatTightness: matchesPattern(/throat.*?(clos|tight|chok)|cannot swallow/i),
    tongueSwelling: matchesPattern(/swollen tongue|tongue.*?swell|lips.*?swell|facial swelling/i),
    allergenExposure: matchesPattern(/peanut|bee sting|wasp|shellfish|penicillin|allergic reaction/i),

    // Gastrointestinal
    severeAbdominalPain: matchesPattern(/severe stomach pain|excruciating abdominal|belly pain|stomach cramps/i),
    rigidAbdomen: matchesPattern(/hard as a rock|board like|rigid belly|guarding/i),
    rightLowerQuadrantPain: matchesPattern(/right lower|appendix|right side of stomach|lower right belly/i),
    vomitingBloodOrMelena: matchesPattern(/vomiting blood|coffee ground emesis|black tarry stool|blood in stool/i),

    // Pediatric
    pediatricPatient: isPediatric,
    highFever: matchesPattern(/103|104|105|high fever|burning up|fever of 39|fever of 40/i),
    infantUnder3Months: matchesPattern(/newborn|\b[1-8]\s*weeks?\s*old\b|\b[1-2]\s*months?\s*old\b|neonat/i),
    lethargyOrInconsolable: matchesPattern(/unusually sleepy|cannot wake|limp|inconsolable|will not stop crying|lethargic/i),

    // Low Acuity
    mildCoughOrCold: matchesPattern(/runny nose|mild cough|sneezing|scratchy throat|cold symptoms|congestion/i),
    localizedRashWithoutFever: matchesPattern(/mild rash|itchy spot|dry skin|eczema|dermatitis/i),
    minorSprainWithoutDeformity: matchesPattern(/twisted ankle|mild sprain|ankle hurts|wrist sprain/i),
    prescriptionRefill: matchesPattern(/refill|renew prescription|routine checkup|medication renewal/i),
  };

  return features;
}

/**
 * DETERMINISTIC SAFETY ARBITER
 * Pure rule-based clinical decision engine according to ESI v4.
 * Never delegates emergency/life-threat classification to a probabilistic model.
 */
export function evaluateSafetyArbiter(input: {
  features?: Partial<ClinicalFeatures>;
  rawText?: string;
  llmSuggestedLevel?: string;
  patientAge?: number;
}): ArbiterResult {
  const start = performance.now();

  // 1. Build consolidated features
  const textFeatures = input.rawText ? extractClinicalFeatures(input.rawText, input.patientAge) : ({} as ClinicalFeatures);
  const features: ClinicalFeatures = ClinicalFeaturesSchema.parse({
    ...textFeatures,
    ...(input.features || {}),
  });

  const redFlags: string[] = [];
  const rules: string[] = [];
  const icd10: Set<string> = new Set();
  const symptoms: Set<string> = new Set();

  const rawTextLower = (input.rawText || '').toLowerCase();
  const hasNitratePde5Contraindication =
    (/sildenafil|viagra|tadalafil|cialis/i.test(rawTextLower)) &&
    (/nitroglycerin|nitrate|nitrostat/i.test(rawTextLower));

  let esiScore: 1 | 2 | 3 | 4 | 5 = 4; // Default baseline: Less Urgent
  let triageLevel: 'emergency' | 'priority' | 'routine' = 'routine';
  let esiTitle = 'ESI LEVEL 4: LESS URGENT CLINICAL EVALUATION';
  let protocol = 'Standard outpatient clinical evaluation recommended within 24-48 hours.';
  let action = 'Schedule outpatient consultation or visit general urgent care.';

  // =========================================================================
  // RULE 1: ESI TIER 1 - IMMEDIATE RESUSCITATION (Life-Threatening Collapse)
  // =========================================================================
  if (features.lossOfConsciousness || features.stridor || (features.throatTightness && features.tongueSwelling)) {
    esiScore = 1;
    triageLevel = 'emergency';
    esiTitle = 'ESI LEVEL 1: IMMEDIATE RESUSCITATION REQUIRED';
    redFlags.push('IMMEDIATE_AIRWAY_OR_HEMODYNAMIC_COLLAPSE');
    rules.push('ESI-1.1: Airway obstruction / Unresponsive state / Anaphylactic shock');
    protocol = 'CRITICAL: Call 911 / 108 immediately. Prepare bag-valve-mask, IM Epinephrine 0.3mg if anaphylaxis, continuous cardiac telemetry.';
    action = 'Immediate emergency medical dispatch. Do NOT drive self. Call 108 / 911 now.';
    if (features.throatTightness || features.tongueSwelling) icd10.add('T78.2XXA'); // Anaphylaxis
    if (features.lossOfConsciousness) icd10.add('R55'); // Syncope / Unresponsive
    if (features.stridor) icd10.add('R06.1'); // Stridor
    symptoms.add('Loss of consciousness or severe airway obstruction');
  }

  // =========================================================================
  // RULE 2: ESI TIER 2 - ACUTE CORONARY SYNDROME / STEMI RISK & LETHAL CONTRAINDICATIONS
  // =========================================================================
  else if (
    ((features.chestPain || features.pressureLikePain) &&
    (features.radiationToArm || features.radiationToJaw || features.diaphoresis || features.pressureLikePain)) ||
    (features.chestPain && hasNitratePde5Contraindication)
  ) {
    esiScore = 2;
    triageLevel = 'emergency';
    esiTitle = 'ESI LEVEL 2: EMERGENT — SUSPECTED ACUTE CORONARY SYNDROME (ACS)';
    if (hasNitratePde5Contraindication) {
      redFlags.push('LETHAL_DRUG_CONTRAINDICATION_NITRATE_PDE5');
      rules.push('ESI-2.1b: Lethal pharmacotherapy contraindication (Nitrates + PDE-5 inhibitors in acute chest pain)');
      protocol = 'CRITICAL CONTRAINDICATION: DO NOT ADMINISTER NITROGLYCERIN. High risk of refractory hypotension/cardiovascular collapse. Urgent 12-lead ECG, fluid resuscitation, telemetry.';
      action = 'Proceed immediately to the Emergency Department. Do NOT take nitroglycerin.';
      icd10.add('T46.3X5A');
      symptoms.add('Chest pressure with lethal nitrate/PDE5 drug contraindication');
    } else {
      redFlags.push('ACS_CHEST_PAIN_WITH_HIGH_RISK_RADIATION_OR_DIAPHORESIS');
      rules.push('ESI-2.1: High-risk ischemic cardiac features (Angina / STEMI equivalent)');
      protocol = 'Urgent 12-lead ECG within 10 minutes of ED arrival. Serial cardiac troponins. Administer 325mg chewable aspirin if no contraindication. Maintain SpO2 > 90%.';
      action = 'Proceed immediately to the nearest Emergency Department equipped with 24/7 Cardiac Cath Lab / PCI.';
      symptoms.add('Crushing substernal chest pressure');
    }
    icd10.add('I20.9'); // Angina pectoris
    icd10.add('I21.9'); // Acute myocardial infarction
    if (features.radiationToArm) symptoms.add('Pain radiating to left arm');
    if (features.diaphoresis) symptoms.add('Diaphoresis / cold sweats');
  }

  // =========================================================================
  // RULE 3: ESI TIER 2 - ACUTE STROKE / NEUROLOGICAL EMERGENCY (BE-FAST)
  // =========================================================================
  else if (features.facialDroop || features.armWeakness || features.speechDifficulty || features.thunderclapHeadache) {
    esiScore = 2;
    triageLevel = 'emergency';
    esiTitle = 'ESI LEVEL 2: EMERGENT — ACUTE STROKE / NEUROLOGICAL RED FLAG';
    if (features.thunderclapHeadache) {
      redFlags.push('THUNDERCLAP_HEADACHE_SUBARACHNOID_HEMORRHAGE_RISK');
      rules.push('ESI-2.2B: Thunderclap onset headache (< 1 min to peak)');
      protocol = 'Immediate non-contrast head CT to rule out Subarachnoid Hemorrhage (SAH) or cerebral aneurysm rupture. Lumbar puncture if CT negative.';
      action = 'Urgent transfer to Comprehensive Stroke / Neurosurgical Emergency Department.';
      icd10.add('I60.9'); // Nontraumatic subarachnoid hemorrhage
      symptoms.add('Sudden explosive thunderclap headache');
    } else {
      redFlags.push('BE_FAST_ACUTE_ISCHEMIC_STROKE_SYMPTOMS');
      rules.push('ESI-2.2A: Focal neurological deficit within acute thrombolytic window');
      protocol = 'Emergency Code Stroke activation. Non-contrast CT scan within 20 minutes. Evaluate for IV thrombolysis (tPA/TNK) and endovascular thrombectomy. NPO.';
      action = 'Immediate ambulance dispatch to certified Primary Stroke Center.';
      icd10.add('I63.9'); // Cerebral infarction
      icd10.add('R47.01'); // Aphasia / Dysarthria
    }
    if (features.facialDroop) symptoms.add('Facial droop');
    if (features.armWeakness) symptoms.add('Unilateral arm weakness');
    if (features.speechDifficulty) symptoms.add('Speech slurring or difficulty');
  }

  // =========================================================================
  // RULE 4: ESI TIER 2 - SEVERE RESPIRATORY DISTRESS / ASTHMA HYPOXIA
  // =========================================================================
  else if (features.severeDyspnea || features.cyanosis || features.inabilityToSpeakFullSentences) {
    esiScore = 2;
    triageLevel = 'emergency';
    esiTitle = 'ESI LEVEL 2: EMERGENT — ACUTE RESPIRATORY COMPROMISE';
    redFlags.push('ACUTE_RESPIRATORY_FAILURE_RISK');
    rules.push('ESI-2.3: Severe dyspnea / inability to speak in sentences / hypoxia risk');
    protocol = 'Immediate high-flow oxygen, continuous pulse oximetry, nebulized Albuterol/Ipratropium, prepare for non-invasive positive pressure ventilation (BiPAP) if tiring.';
    action = 'Emergency department evaluation required immediately.';
    icd10.add('J96.00'); // Acute respiratory failure
    icd10.add('J45.901'); // Asthma exacerbation
    symptoms.add('Acute respiratory distress');
    if (features.cyanosis) symptoms.add('Cyanosis / peripheral hypoxia');
  }

  // =========================================================================
  // RULE 5: ESI TIER 2 - PEDIATRIC FEBRILE SEPSIS CRISIS
  // =========================================================================
  else if (features.pediatricPatient && (features.infantUnder3Months || (features.highFever && features.lethargyOrInconsolable))) {
    esiScore = 2;
    triageLevel = 'emergency';
    esiTitle = 'ESI LEVEL 2: EMERGENT — PEDIATRIC HIGH-RISK FEVER / SEPSIS SCREEN';
    redFlags.push('PEDIATRIC_LETHARGY_OR_NEONATAL_FEVER');
    rules.push('ESI-2.4: Pediatric pyrexia with altered behavior or neonatal age < 90 days');
    protocol = 'Full neonatal/pediatric sepsis workup: blood cultures, urinalysis/culture, rapid viral panel, prompt empiric antibiotic coverage.';
    action = 'Transport immediately to Pediatric Emergency Department or specialized Children\'s Hospital.';
    icd10.add('R50.9'); // Fever in pediatric patient
    icd10.add('A41.9'); // Sepsis unspecified risk
    symptoms.add('High pediatric fever');
    symptoms.add('Lethargy / Inconsolable crying');
  }

  // =========================================================================
  // RULE 6: ESI TIER 3 - URGENT ACUTE ABDOMEN / SURGICAL SUSPICION
  // =========================================================================
  else if (features.severeAbdominalPain || features.rightLowerQuadrantPain || features.rigidAbdomen || features.vomitingBloodOrMelena) {
    esiScore = features.rigidAbdomen || features.vomitingBloodOrMelena ? 2 : 3;
    triageLevel = esiScore === 2 ? 'emergency' : 'priority';
    esiTitle = esiScore === 2 ? 'ESI LEVEL 2: EMERGENT — ACUTE SURGICAL ABDOMEN / GI BLEED' : 'ESI LEVEL 3: URGENT — ACUTE ABDOMINAL EVALUATION';
    if (features.rigidAbdomen || features.vomitingBloodOrMelena) {
      redFlags.push('ACUTE_PERITONITIS_OR_UPPER_GI_HEMORRHAGE');
      rules.push('ESI-2.5: Board-like abdominal rigidity or active hematemesis');
      protocol = 'Two large-bore IVs, type and screen, urgent surgical consultation, NPO.';
      action = 'Immediate surgical emergency department transfer.';
      if (features.vomitingBloodOrMelena) icd10.add('K92.0'); // Hematemesis
      if (features.rigidAbdomen) icd10.add('R19.8'); // Rigid abdomen
    } else {
      rules.push('ESI-3.1: Acute RLQ abdominal pain (Appendicitis risk) requiring multiple resources');
      protocol = 'Abdominal ultrasound / IV contrast CT scan, CBC with differential, surgical consult, serial abdominal exams.';
      action = 'Urgent emergency or surgical clinic evaluation within 2-4 hours.';
      icd10.add('K35.80'); // Unspecified acute appendicitis
      icd10.add('R10.31'); // Right lower quadrant pain
    }
    symptoms.add('Acute abdominal pain');
  }

  // =========================================================================
  // RULE 7: ESI TIER 3 - MODERATE ISOLATED SYSTEMIC SYMPTOMS
  // =========================================================================
  else if (features.chestPain || features.highFever || features.palpitations) {
    esiScore = 3;
    triageLevel = 'priority';
    esiTitle = 'ESI LEVEL 3: URGENT CLINICAL EVALUATION';
    rules.push('ESI-3.2: Significant clinical complaint requiring multiple diagnostic resources');
    protocol = 'Baseline diagnostic workup (ECG, vitals monitoring, focused lab panel).';
    action = 'Urgent clinical evaluation at an emergency clinic or urgent care facility today.';
    if (features.chestPain) icd10.add('R07.9'); // Chest pain unspecified
    if (features.highFever) icd10.add('R50.9'); // Fever unspecified
    if (features.palpitations) icd10.add('R00.2'); // Palpitations
    symptoms.add('Cardiorespiratory or febrile symptom without immediate red-flags');
  }

  // =========================================================================
  // RULE 8: ESI TIER 4 & 5 - ROUTINE / MINOR OUTPATIENT
  // =========================================================================
  else {
    esiScore = features.prescriptionRefill ? 5 : 4;
    triageLevel = 'routine';
    esiTitle = esiScore === 5 ? 'ESI LEVEL 5: NON-URGENT (Refill / Administrative)' : 'ESI LEVEL 4: LESS URGENT (Single Resource Needed)';
    rules.push(esiScore === 5 ? 'ESI-5.1: Zero resource medical refill or chronic maintenance' : 'ESI-4.1: Minor localized symptoms suitable for outpatient clinic');
    protocol = 'Routine ambulatory care evaluation. Supportive symptomatic care.';
    action = 'Schedule visit with primary care physician or walk-in outpatient clinic.';
    if (features.mildCoughOrCold) icd10.add('J06.9'); // Acute URI
    if (features.localizedRashWithoutFever) icd10.add('L30.9'); // Dermatitis
    if (features.minorSprainWithoutDeformity) icd10.add('S93.40'); // Ankle sprain
    if (features.prescriptionRefill) icd10.add('Z76.0'); // Repeat prescription
    symptoms.add('Mild non-emergent outpatient complaint');
  }

  // =========================================================================
  // SAFETY ARBITER OVERRIDE GUARANTEE
  // If an upstream model suggested 'routine' or 'priority' when red flags were
  // triggered, the Arbiter forcefully overrides it and logs the discrepancy.
  // =========================================================================
  const llmSuggested = input.llmSuggestedLevel?.toLowerCase();
  const isEmergency = esiScore <= 2;
  const arbiterOverride = Boolean(isEmergency && llmSuggested && llmSuggested !== 'emergency');

  const latencyMs = Number((performance.now() - start).toFixed(2));

  return {
    triageLevel,
    esiScore,
    esiTitle,
    isEmergency,
    arbiterOverride,
    redFlagsTriggered: redFlags,
    matchedRules: rules,
    clinicalProtocol: protocol,
    recommendedAction: action,
    icd10Codes: Array.from(icd10),
    detectedSymptoms: Array.from(symptoms),
    latencyMs,
  };
}
