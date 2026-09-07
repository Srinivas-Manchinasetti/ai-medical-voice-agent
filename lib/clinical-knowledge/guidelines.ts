import { ClinicalPassage } from "./types";

export const CURATED_GUIDELINES: ClinicalPassage[] = [
  // CARDIOLOGY (AHA/ACC)
  {
    id: "GUIDELINE-CARDIO-ACS-001",
    topicId: "acs-nsteacs",
    title: "AHA/ACC NSTE-ACS Clinical Practice Guidelines",
    section: "symptoms",
    source: "American Heart Association / American College of Cardiology",
    sourceUrl: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000134",
    releaseDate: "2023-08-15",
    authority: "clinical_guideline",
    domain: "cardiology",
    content: "Acute Coronary Syndrome (ACS) presentation classically includes substernal chest discomfort, pressure, or heaviness that may radiate to the left arm, both arms, neck, jaw, or epigastrium. Radiation to the left arm (likelihood ratio 2.3) and bilateral arm radiation (LR 4.0) strongly increase pre-test probability of acute myocardial infarction. Co-presenting diaphoresis, nausea, and dyspnea represent high-risk autonomic manifestations.",
    keyTerms: ["chest pressure", "substernal", "radiation", "left arm", "diaphoresis", "sweat", "acs", "stemi", "myocardial infarction", "jaw"]
  },
  {
    id: "GUIDELINE-CARDIO-ACS-002",
    topicId: "acs-nsteacs",
    title: "AHA/ACC NSTE-ACS Clinical Practice Guidelines",
    section: "emergency_guidance",
    source: "American Heart Association / American College of Cardiology",
    sourceUrl: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000000134",
    releaseDate: "2023-08-15",
    authority: "clinical_guideline",
    domain: "cardiology",
    content: "Emergency disposition: Patients presenting with acute chest discomfort lasting >20 minutes, exertional onset, or ischemic radiation require immediate 12-lead ECG acquisition within 10 minutes of medical contact and urgent transport via emergency medical services (EMS) to a percutaneous coronary intervention (PCI) capable facility. Pre-hospital physical exertion must be strictly restricted.",
    keyTerms: ["emergency", "ecg", "ems", "10 minutes", "pci", "exertion", "rest"]
  },
  {
    id: "GUIDELINE-CARDIO-CHESTPAIN-001",
    topicId: "chest-pain-eval",
    title: "ACC/AHA Guideline for the Evaluation and Diagnosis of Chest Pain",
    section: "diagnosis",
    source: "American College of Cardiology / American Heart Association",
    sourceUrl: "https://www.ahajournals.org/doi/10.1161/CIR.0000000000001029",
    releaseDate: "2021-11-30",
    authority: "clinical_guideline",
    domain: "cardiology",
    content: "Chest pain stratification: Features favoring cardiac ischemia include retrosternal location, exertional provocation, relief with rest or nitroglycerin, and dull pressure-like quality. Features making ischemia less likely include pleuritic character (sharp, worsens with inspiration), positional variation, or pain reproducible by chest wall palpation. However, atypical presentations in females, diabetics, and elderly require low threshold for cardiac workup.",
    keyTerms: ["exertional", "rest", "pleuritic", "sharp", "palpation", "ischemia", "nitroglycerin"]
  },

  // NEUROLOGY (AHA/ASA)
  {
    id: "GUIDELINE-NEURO-STROKE-001",
    topicId: "stroke-guidelines",
    title: "AHA/ASA Guidelines for the Early Management of Acute Ischemic Stroke",
    section: "symptoms",
    source: "American Heart Association / American Stroke Association",
    sourceUrl: "https://www.ahajournals.org/doi/10.1161/STR.0000000000000211",
    releaseDate: "2023-05-12",
    authority: "clinical_guideline",
    domain: "neurology",
    content: "Acute stroke symptom recognition: The BE-FAST algorithm (Balance loss, Eyes vision change, Facial droop, Arm weakness, Speech difficulty, Time to call emergency) provides >90% sensitivity for acute ischemic stroke. Sudden unilateral motor deficit or hemiparesis and facial asymmetry carry the highest specificity for middle cerebral artery (MCA) territory ischemia.",
    keyTerms: ["stroke", "be-fast", "facial droop", "arm weakness", "speech", "unilateral", "hemiparesis", "mca", "slurred speech"]
  },
  {
    id: "GUIDELINE-NEURO-STROKE-002",
    topicId: "stroke-guidelines",
    title: "AHA/ASA Guidelines for the Early Management of Acute Ischemic Stroke",
    section: "emergency_guidance",
    source: "American Heart Association / American Stroke Association",
    sourceUrl: "https://www.ahajournals.org/doi/10.1161/STR.0000000000000211",
    releaseDate: "2023-05-12",
    authority: "clinical_guideline",
    domain: "neurology",
    content: "Emergency time targets: 'Time is Brain'. Intravenous thrombolysis (IV alteplase or tenecteplase) is indicated within 4.5 hours of Last Known Well (LKW). Endovascular thrombectomy (EVT) for large vessel occlusion is indicated up to 24 hours in selected patients. Emergency pre-hospital notification to a Comprehensive or Thrombectomy-Capable Stroke Center must occur immediately.",
    keyTerms: ["emergency", "time is brain", "lkw", "last known well", "thrombolysis", "thrombectomy", "stroke center"]
  },

  // PEDIATRICS (AAP)
  {
    id: "GUIDELINE-PEDS-FEVER-001",
    topicId: "pediatric-fever-sepsis",
    title: "AAP Clinical Practice Guideline: Evaluation of Well-Appearing Febrile Infants",
    section: "emergency_guidance",
    source: "American Academy of Pediatrics (AAP)",
    sourceUrl: "https://publications.aap.org/pediatrics/article/148/2/e2021052228/179997",
    releaseDate: "2021-08-01",
    authority: "clinical_guideline",
    domain: "pediatrics",
    content: "Neonatal fever red flag: Any infant aged 8 to 60 days with a measured rectal temperature >=100.4 F (38.0 C) or hypothermia (<96.8 F / 36.0 C), or associated lethargy, poor feeding, or grunting, is at high risk for Invasive Bacterial Infection (IBI, bacteremia, bacterial meningitis). Immediate emergency department evaluation, blood cultures, lumbar puncture, and empiric parenteral antibiotics are mandatory.",
    keyTerms: ["pediatric", "infant", "fever", "rectal temperature", "lethargy", "sepsis", "grunting", "feeding"]
  },
  {
    id: "GUIDELINE-PEDS-RESP-001",
    topicId: "pediatric-respiratory-pews",
    title: "Pediatric Early Warning Score (PEWS) & Respiratory Distress Protocol",
    section: "symptoms",
    source: "American Academy of Pediatrics / National Pediatric Sepsis Collaboration",
    sourceUrl: "https://publications.aap.org/pediatrics",
    releaseDate: "2022-04-10",
    authority: "clinical_guideline",
    domain: "pediatrics",
    content: "Pediatric respiratory failure signs: Sternal, intercostal, and subcostal retractions; tachypnea exceeding age-adjusted thresholds; audible expiratory grunting; nasal flaring; and head bobbing in infants indicate severe airway resistance or alveolar collapse. Lethargy combined with respiratory distress indicates impending respiratory exhaustion.",
    keyTerms: ["respiratory distress", "retractions", "grunting", "flaring", "pews", "stridor", "exhaustion"]
  },

  // TASK-SPECIFIC MEDICATION KNOWLEDGE (RxNorm, DailyMed, openFDA)
  {
    id: "MED-DAILYMED-CONTRA-001",
    topicId: "sildenafil-nitroglycerin-contraindication",
    title: "DailyMed Authoritative Label: Sildenafil & Nitroglycerin Coadministration",
    section: "contraindications",
    source: "DailyMed / U.S. National Library of Medicine & FDA",
    sourceUrl: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=sildenafil",
    releaseDate: "2024-01-10",
    authority: "medication_label",
    domain: "medications",
    content: "ABSOLUTE CONTRAINDICATION: Administration of sildenafil (Viagra, Revatio) or tadalafil (Cialis) to patients who are using organic nitrates, such as nitroglycerin, isosorbide mononitrate, or isosorbide dinitrate, is contraindicated. Phosphodiesterase type 5 (PDE5) inhibitors potentiate the hypotensive effects of nitrates by impairing cyclic GMP degradation, producing profound systemic vasodilation, life-threatening refractory hypotension, coronary hypoperfusion, and cardiovascular collapse. Nitrates must not be given within 24 hours of sildenafil or within 48 hours of tadalafil.",
    keyTerms: ["sildenafil", "viagra", "nitroglycerin", "cialis", "tadalafil", "nitrate", "contraindication", "hypotension", "collapse"]
  },
  {
    id: "MED-RXNORM-IDENTITY-001",
    topicId: "rxnorm-cardiovascular-normalization",
    title: "RxNorm Concept Unique Identifier (RxCUI) Mapping",
    section: "overview",
    source: "RxNorm / U.S. National Library of Medicine",
    sourceUrl: "https://www.nlm.nih.gov/research/umls/rxnorm/",
    releaseDate: "2026-08-01",
    authority: "medication_identity",
    domain: "medications",
    content: "Medication Identity & Synonyms: Nitroglycerin (RxCUI 7434, Nitrostat, Nitro-Bid, sublingual tablet, transdermal patch); Sildenafil (RxCUI 136443, Viagra, Revatio, PDE-5 inhibitor); Tadalafil (RxCUI 358263, Cialis, Adcirca); Lisinopril (RxCUI 29046, Zestril, Prinivil, ACE inhibitor); Aspirin (RxCUI 1191, acetylsalicylic acid, antiplatelet).",
    keyTerms: ["rxnorm", "rxcui", "nitroglycerin", "sildenafil", "viagra", "cialis", "lisinopril", "aspirin"]
  },
  {
    id: "MED-OPENFDA-ADVERSE-001",
    topicId: "openfda-adverse-cardiac-events",
    title: "openFDA Adverse Event Reporting System (FAERS): Nitrate-PDE5 Interaction",
    section: "adverse_events",
    source: "openFDA / Food and Drug Administration",
    sourceUrl: "https://open.fda.gov/apis/drug/event/",
    releaseDate: "2026-07-15",
    authority: "regulatory_adverse",
    domain: "medications",
    content: "Regulatory Post-Marketing Safety Surveillance: FAERS reports document multiple fatal and near-fatal episodes of hemodynamic syncope, cardiac arrest, and refractory cardiogenic shock when emergency providers administered sublingual nitroglycerin to patients presenting with acute chest pain who had taken a PDE-5 inhibitor within the preceding 24-48 hours.",
    keyTerms: ["openfda", "faers", "adverse event", "nitroglycerin", "sildenafil", "cardiac arrest", "syncope"]
  }
];
