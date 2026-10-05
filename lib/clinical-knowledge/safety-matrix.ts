/**
 * DETERMINISTIC CLINICAL PHARMACOLOGY & CONTRAINDICATION SAFETY MATRIX
 * 
 * Invariants:
 * 1. Zero network latency: operates 100% offline from curated, reviewed pharmacology rules.
 * 2. Deterministic blocking: flags life-threatening drug-allergy, drug-drug interaction (DDI),
 *    and teratogen contraindications before any candidate response or advice reaches the patient.
 * 3. Multilingual & Trade-Name aware: resolves Indian and international trade names (e.g. Dolo,
 *    Combiflam, Augmentin, Sorbitrate) to generic active pharmaceutical ingredients.
 */

import { PatientProfile, ContraindicationAlert } from "./types";

export interface HighRiskDdiRule {
  id: string;
  name: string;
  classA: string;
  agentsA: string[];
  classB: string;
  agentsB: string[];
  severity: "critical" | "warning";
  actionRequired: "block" | "warn";
  clinicalRationale: string;
}

/**
 * Trade name to generic mapping (including prevalent Indian pharmaceutical brands)
 */
export const DRUG_SYNONYMS_AND_BRANDS: Record<string, string[]> = {
  paracetamol: ["dolo", "dolo 650", "calpol", "crocin", "tylenol", "acetaminophen", "pcm"],
  ibuprofen: ["advil", "motrin", "brufen"],
  "ibuprofen + paracetamol": ["combiflam", "flexon"],
  diclofenac: ["voveran", "voltaren", "dynapar"],
  aspirin: ["disprin", "ecosprin", "acetylsalicylic acid", "asa"],
  amoxicillin: ["mox", "novamox", "amoxil"],
  "amoxicillin + clavulanate": ["augmentin", "moxclav", "clavmox"],
  penicillin: ["penicillin v", "penicillin g", "ampicillin", "amoxicillin", "augmentin", "piperacillin"],
  cephalosporin: ["ceftriaxone", "cefixime", "cefpodoxime", "cephalexin", "taxim", "monocef"],
  pantoprazole: ["pantocid", "pan 40", "pan d", "pantop"],
  omeprazole: ["omez", "prilosec", "omizac"],
  nitroglycerin: ["sorbitrate", "nitrostat", "nitrocontin", "nitrolingual", "isosorbide", "mononitrate"],
  sildenafil: ["viagra", "revatio", "penegra", "manforce", "caverta"],
  tadalafil: ["cialis", "adcirca", "megalis"],
  telmisartan: ["telma", "telmikem", "telsartan"],
  lisinopril: ["zestril", "prinivil", "lipril"],
  enalapril: ["vasotec", "envas"],
  atorvastatin: ["lipitor", "atorva", "atocor"],
  metformin: ["glycomet", "glucophage", "gluconorm"],
};

export const HIGH_RISK_DDI_RULES: HighRiskDdiRule[] = [
  // 1. Nitrates + PDE5 Inhibitors (Profound Vasodilatory Collapse)
  {
    id: "DDI-NITRATE-PDE5-001",
    name: "Nitrate & PDE-5 Inhibitor Co-Administration",
    classA: "organic_nitrates",
    agentsA: ["nitroglycerin", "sorbitrate", "isosorbide", "mononitrate", "nitrostat", "nitrocontin"],
    classB: "pde5_inhibitors",
    agentsB: ["sildenafil", "viagra", "tadalafil", "cialis", "vardenafil", "penegra", "manforce", "megalis"],
    severity: "critical",
    actionRequired: "block",
    clinicalRationale: "Absolute contraindication: PDE5 inhibitors impair cyclic GMP degradation, potentiating nitrate hypotensive effects to cause fatal refractory cardiogenic shock, syncope, and myocardial hypoperfusion.",
  },
  // 2. NSAIDs + Active Peptic Ulcer Disease / GI Bleeding
  {
    id: "DDI-NSAID-PUD-002",
    name: "NSAID Administration in Peptic Ulcer Disease",
    classA: "nsaids",
    agentsA: ["ibuprofen", "advil", "combiflam", "diclofenac", "voveran", "naproxen", "aleve", "aspirin", "ecosprin", "disprin", "ketorolac", "piroxicam"],
    classB: "gastrointestinal_mucosal_damage",
    agentsB: ["peptic ulcer", "gastric ulcer", "duodenal ulcer", "gi bleed", "melena", "hematemesis"],
    severity: "critical",
    actionRequired: "block",
    clinicalRationale: "NSAIDs inhibit protective gastric prostaglandin synthesis (COX-1), precipitating severe peptic mucosal ulceration, acute upper GI hemorrhage, or gastric perforation.",
  },
  // 3. Dengue / Vector-borne Thrombocytopenia + NSAIDs / Aspirin (Hemorrhagic Crisis)
  {
    id: "DDI-DENGUE-NSAID-003",
    name: "NSAIDs/Aspirin Prohibition in Dengue / Thrombocytopenia",
    classA: "nsaids_aspirin",
    agentsA: ["ibuprofen", "combiflam", "aspirin", "disprin", "ecosprin", "diclofenac", "voveran"],
    classB: "dengue_bleeding_risk",
    agentsB: ["dengue", "thrombocytopenia", "petechiae", "low platelets", "purpura"],
    severity: "critical",
    actionRequired: "block",
    clinicalRationale: "MoHFW STG & NVBDCP Invariant: Strictly avoid NSAIDs and Aspirin in suspected dengue; antiplatelet effects combined with dengue capillary leakage cause severe internal hemorrhage. Use Paracetamol only.",
  },
  // 4. Pregnancy + ACE Inhibitors / ARBs (Fetotoxicity)
  {
    id: "DDI-PREG-ACEI-004",
    name: "ACE Inhibitor / ARB Teratogenicity in Pregnancy",
    classA: "raas_blockers",
    agentsA: ["lisinopril", "enalapril", "ramipril", "telmisartan", "telma", "losartan", "valsartan"],
    classB: "pregnancy",
    agentsB: ["pregnancy", "pregnant", "gestational"],
    severity: "critical",
    actionRequired: "block",
    clinicalRationale: "ACE inhibitors and ARBs cause fetal renal dysgenesis, oligohydramnios sequence, pulmonary hypoplasia, and intrauterine growth restriction when taken during pregnancy.",
  },
  // 5. Pregnancy + 3rd Trimester NSAIDs (Ductus Arteriosus Premature Closure)
  {
    id: "DDI-PREG-NSAID-005",
    name: "NSAID Prohibition in 3rd Trimester Pregnancy",
    classA: "nsaids",
    agentsA: ["ibuprofen", "combiflam", "naproxen", "diclofenac", "voveran", "aspirin"],
    classB: "pregnancy_third_trimester",
    agentsB: ["pregnancy", "pregnant", "gestational", "trimester"],
    severity: "critical",
    actionRequired: "block",
    clinicalRationale: "NSAIDs in late pregnancy induce premature closure of the fetal ductus arteriosus, persistent pulmonary hypertension of the newborn (PPHN), and prolonged labor.",
  },
];

/**
 * Standardizes drug/brand strings to normalized active molecules.
 */
export function normalizeDrugName(rawName: string): string[] {
  const clean = rawName.toLowerCase().trim();
  const matched = new Set<string>();
  matched.add(clean);

  for (const [generic, synonyms] of Object.entries(DRUG_SYNONYMS_AND_BRANDS)) {
    if (clean === generic || synonyms.some((s) => clean.includes(s) || s.includes(clean))) {
      matched.add(generic);
      synonyms.forEach((s) => matched.add(s));
    }
  }

  return Array.from(matched);
}

/**
 * DETERMINISTIC SCREENER: Drug Allergies
 * Evaluates patient profile allergies against proposed text or medications.
 */
export function screenPatientAllergies(
  patient: PatientProfile | undefined,
  targetText: string
): ContraindicationAlert[] {
  if (!patient || !patient.drugAllergies || patient.drugAllergies.length === 0) {
    return [];
  }

  const alerts: ContraindicationAlert[] = [];
  const textLower = targetText.toLowerCase();

  for (const allergy of patient.drugAllergies) {
    const allergenNormalized = normalizeDrugName(allergy.drugName);
    const hasMatch = allergenNormalized.some((name) => textLower.includes(name));

    if (hasMatch) {
      alerts.push({
        category: "allergy",
        triggerItem: allergy.drugName,
        conflictingItem: targetText,
        severity: "critical",
        clinicalRationale: `Documented patient allergy: ${allergy.drugName.toUpperCase()} (${allergy.reactionType}, severity: ${allergy.severity}). Conflicting agent detected in candidate plan. Must not recommend or administer.`,
        actionRequired: "block",
      });
    }
  }

  return alerts;
}

/**
 * DETERMINISTIC SCREENER: Drug-Drug & Condition-Drug Interactions
 */
export function screenDrugInteractions(
  patient: PatientProfile | undefined,
  targetText: string
): ContraindicationAlert[] {
  if (!patient) return [];

  const alerts: ContraindicationAlert[] = [];
  const textLower = targetText.toLowerCase();

  const activeMeds = (patient.currentMedications || []).flatMap((m) =>
    normalizeDrugName(m.name + " " + (m.brandName || ""))
  );
  const activeConditions = (patient.knownConditions || []).map((c) =>
    c.toLowerCase().replace(/_/g, " ")
  );

  for (const rule of HIGH_RISK_DDI_RULES) {
    // Check if targetText matches Class A and patient has Class B (or vice versa)
    const textHasA = rule.agentsA.some((a) => textLower.includes(a));
    const textHasB = rule.agentsB.some((b) => textLower.includes(b));

    const patientHasA = activeMeds.some((m) => rule.agentsA.some((a) => m.includes(a)));
    const patientHasB =
      activeMeds.some((m) => rule.agentsB.some((b) => m.includes(b))) ||
      activeConditions.some((c) => rule.agentsB.some((b) => c.includes(b)));

    if (textHasA && patientHasB) {
      alerts.push({
        category: "drug_interaction",
        triggerItem: rule.classB,
        conflictingItem: rule.name,
        severity: rule.severity,
        clinicalRationale: rule.clinicalRationale,
        actionRequired: rule.actionRequired,
      });
    } else if (textHasB && patientHasA) {
      alerts.push({
        category: "drug_interaction",
        triggerItem: rule.classA,
        conflictingItem: rule.name,
        severity: rule.severity,
        clinicalRationale: rule.clinicalRationale,
        actionRequired: rule.actionRequired,
      });
    }
  }

  return alerts;
}

/**
 * DETERMINISTIC SCREENER: Pregnancy Contraindications
 */
export function screenPregnancySafety(
  patient: PatientProfile | undefined,
  targetText: string
): ContraindicationAlert[] {
  if (!patient || patient.pregnancyStatus !== "pregnant") {
    return [];
  }

  const alerts: ContraindicationAlert[] = [];
  const textLower = targetText.toLowerCase();

  const pregnancyProhibitedAgents = [
    { name: "ibuprofen / nsaids", agents: ["ibuprofen", "combiflam", "naproxen", "diclofenac", "voveran", "aspirin"], rationale: "Risk of premature closure of fetal ductus arteriosus and fetal renal impairment." },
    { name: "ace inhibitors / arbs", agents: ["lisinopril", "enalapril", "ramipril", "telmisartan", "telma", "losartan"], rationale: "Proven teratogenicity: fetal calvarial hypoplasia, renal failure, and death." },
    { name: "methotrexate", agents: ["methotrexate"], rationale: "Potent teratogen and abortifacient causing congenital skeletal anomalies." },
    { name: "statins", agents: ["atorvastatin", "rosuvastatin", "simvastatin"], rationale: "Interferes with fetal cholesterol and steroid hormone biosynthesis; avoid in pregnancy." },
  ];

  for (const item of pregnancyProhibitedAgents) {
    if (item.agents.some((a) => textLower.includes(a))) {
      alerts.push({
        category: "pregnancy",
        triggerItem: "Pregnancy Status: Confirmed Pregnant",
        conflictingItem: item.name,
        severity: "critical",
        clinicalRationale: `Contraindicated in pregnancy: ${item.rationale}`,
        actionRequired: "block",
      });
    }
  }

  return alerts;
}

/**
 * Consolidated master safety screener evaluating allergies, interactions, and pregnancy.
 */
export function evaluatePharmacologySafetyShield(
  patient: PatientProfile | undefined,
  candidateText: string
): {
  isSafe: boolean;
  alerts: ContraindicationAlert[];
  blockedReason?: string;
} {
  const allergyAlerts = screenPatientAllergies(patient, candidateText);
  const ddiAlerts = screenDrugInteractions(patient, candidateText);
  const pregnancyAlerts = screenPregnancySafety(patient, candidateText);

  const alerts = [...allergyAlerts, ...ddiAlerts, ...pregnancyAlerts];
  const hasCriticalBlock = alerts.some((a) => a.actionRequired === "block");

  return {
    isSafe: !hasCriticalBlock,
    alerts,
    blockedReason: hasCriticalBlock ? alerts.map((a) => a.clinicalRationale).join(" | ") : undefined,
  };
}
