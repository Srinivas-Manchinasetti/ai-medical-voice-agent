/**
 * CLINICAL PRESENTATION & DIMENSION REGISTRY
 *
 * Invariants:
 * 1. ABDOMINAL_PAIN is the reference presentation implementation.
 * 2. Dimensions explicitly distinguish core history, associated findings, and safety screens.
 * 3. Does not choose next questions directly; evaluates ClinicalState satisfaction deterministically.
 */

import {
  PresentationId,
  PresentationDefinition,
  DimensionEvaluation,
  ClinicalDimension,
} from "./presentation-types";

export const ABDOMINAL_PAIN_PRESENTATION: PresentationDefinition = {
  id: "ABDOMINAL_PAIN",
  name: "Acute / Subacute Abdominal Pain",
  category: "gastroenterology",
  screeningConcepts: [
    "abdominal pain",
    "stomach ache",
    "pet dard",
    "kadupu noppi",
    "belly ache",
    "cramps in stomach",
  ],
  dimensions: [
    // Core History Dimensions
    {
      id: "location",
      name: "Abdominal Location / Quadrant",
      type: "core_history",
      clinicalRationale: "Localize pain to a quadrant or specific anatomical region to narrow differential diagnosis (e.g. RLQ appendicitis vs RUQ biliary).",
      suggestedPhrasing: "Where in your abdomen does the pain feel strongest — upper, lower, right, left, around the navel, or all over?",
      evaluatorSlot: "location",
    },
    {
      id: "onset",
      name: "Onset Timeline",
      type: "core_history",
      clinicalRationale: "Establish roughly when the abdominal pain began.",
      suggestedPhrasing: "Roughly when did this abdominal pain first begin?",
      evaluatorSlot: "onset",
    },
    {
      id: "onset_pattern",
      name: "Onset Pattern (Sudden vs Gradual)",
      type: "core_history",
      clinicalRationale: "Differentiate catastrophic vascular/perforated event (sudden/instant) from progressive inflammatory pathology (gradual buildup).",
      suggestedPhrasing: "Did the abdominal pain start suddenly, or did it build up gradually?",
      evaluatorSlot: "onset_pattern",
    },
    {
      id: "duration",
      name: "Episode Duration & Pattern",
      type: "core_history",
      clinicalRationale: "Establish whether the discomfort is continuous or intermittent.",
      suggestedPhrasing: "Is the pain constant, or does it come and go in waves?",
      evaluatorSlot: "duration",
    },
    {
      id: "character",
      name: "Pain Character & Quality",
      type: "core_history",
      clinicalRationale: "Differentiate visceral colic (cramping), peritonitis (sharp, constant), or mucosal ulceration (burning/gnawing).",
      suggestedPhrasing: "Does the pain feel more sharp, cramping, burning, or dull?",
      evaluatorSlot: "character",
    },
    {
      id: "severity",
      name: "Severity Rating (0-10)",
      type: "core_history",
      clinicalRationale: "Quantify usual and peak severity on a 0 to 10 scale.",
      suggestedPhrasing: "On a scale from zero to ten, how severe is the pain right now?",
      evaluatorSlot: "severity",
    },
    {
      id: "radiation",
      name: "Radiation / Referral",
      type: "core_history",
      clinicalRationale: "Screen for pain radiating to back (pancreatitis/aorta), right scapula (cholecystitis), or groin (renal colic).",
      suggestedPhrasing: "Does the abdominal pain travel anywhere else, such as your back, shoulder, or groin?",
      evaluatorSlot: "radiation",
    },

    // Associated Dimensions
    {
      id: "vomiting",
      name: "Vomiting / Emesis",
      type: "associated",
      clinicalRationale: "Screen for mechanical bowel obstruction, severe gastroenteritis, or acute pancreatitis.",
      suggestedPhrasing: "Have you had any vomiting or nausea with this?",
      evaluatorSlot: "vomiting",
    },
    {
      id: "diarrhea",
      name: "Diarrhea / Loose Stools",
      type: "associated",
      clinicalRationale: "Screen for enteritis, infectious colitis, or food-borne illness.",
      suggestedPhrasing: "Have your bowel movements been loose or watery?",
      evaluatorSlot: "diarrhea",
    },
    {
      id: "constipation",
      name: "Constipation / Obstipation",
      type: "associated",
      clinicalRationale: "Screen for paralytic ileus or distal colonic obstruction.",
      suggestedPhrasing: "Have you been able to pass gas or have a normal bowel movement?",
      evaluatorSlot: "constipation",
    },
    {
      id: "fever",
      name: "Fever / Systemic Chills",
      type: "associated",
      clinicalRationale: "Screen for intra-abdominal sepsis, peritonitis, or abscess.",
      suggestedPhrasing: "Have you had a fever, chills, or sweating?",
      evaluatorSlot: "fever",
    },
    {
      id: "gi_bleeding",
      name: "GI Bleeding (Melena / Hematochezia / Hematemesis)",
      type: "associated",
      clinicalRationale: "Screen for active upper or lower gastrointestinal hemorrhage.",
      suggestedPhrasing: "Have you noticed any blood in your stool, dark black tarry stools, or vomiting blood?",
      evaluatorSlot: "blood_in_stool",
    },
    {
      id: "urinary_symptoms",
      name: "Urinary Symptoms (Dysuria / Hematuria)",
      type: "associated",
      clinicalRationale: "Differentiate GI source from nephrolithiasis or urinary tract infection.",
      suggestedPhrasing: "Are you having any burning when you urinate or needing to urinate much more often than usual?",
      evaluatorSlot: "urinary_symptoms",
    },
    {
      id: "pregnancy_context",
      name: "Pregnancy / Gynecological Context",
      type: "associated",
      clinicalRationale: "Rule out ectopic pregnancy or ovarian torsion in reproductive-age females.",
      suggestedPhrasing: "If applicable, is there any possibility you might be pregnant, or when was your last menstrual period?",
      evaluatorSlot: "pregnancy_context",
    },

    // Safety-Screen Concepts
    {
      id: "rigid_abdomen",
      name: "Board-Like Abdominal Rigidity / Involuntary Guarding",
      type: "safety_screen",
      clinicalRationale: "Indicator of generalized peritonitis and acute surgical abdomen.",
      suggestedPhrasing: "Does your belly feel unusually hard or rigid like a board to the touch?",
      evaluatorSlot: "rigid_abdomen",
    },
    {
      id: "severe_worsening_pain",
      name: "Excruciating or Rapidly Escalating Pain",
      type: "safety_screen",
      clinicalRationale: "Identifies ischemia (mesenteric ischemia) or imminent perforation.",
      suggestedPhrasing: "Has the pain suddenly become agonizing or completely unbearable?",
      evaluatorSlot: "severe_worsening_pain",
    },
    {
      id: "syncope_collapse",
      name: "Syncope / Presyncope / Dizziness on Standing",
      type: "safety_screen",
      clinicalRationale: "Indicator of hypovolemic shock from internal hemorrhage or ruptured aortic aneurysm/ectopic pregnancy.",
      suggestedPhrasing: "Have you felt faint, lightheaded when standing, or passed out?",
      evaluatorSlot: "syncope",
    },
    {
      id: "hematemesis",
      name: "Vomiting Blood / Coffee-Ground Emesis",
      type: "safety_screen",
      clinicalRationale: "Life-threatening upper gastrointestinal hemorrhage from peptic ulcer or varices.",
      suggestedPhrasing: "Have you vomited any bright red blood or material that looks like dark coffee grounds?",
      evaluatorSlot: "hematemesis",
    },
  ],
};

export const ACUTE_DIARRHEA_PRESENTATION: PresentationDefinition = {
  id: "ACUTE_DIARRHEA",
  name: "Acute Diarrhea & Dehydration Risk",
  category: "gastroenterology",
  screeningConcepts: [
    "diarrhea",
    "loose motions",
    "loose stools",
    "watery stools",
    "virochanalu",
    "dast",
  ],
  dimensions: [
    {
      id: "duration",
      name: "Duration of Diarrhea",
      type: "core_history",
      clinicalRationale: "Differentiate acute (<14 days) from persistent or chronic diarrhea.",
      suggestedPhrasing: "How many days have you had loose or watery stools?",
      evaluatorSlot: "duration",
    },
    {
      id: "frequency",
      name: "Stool Frequency per 24h",
      type: "core_history",
      clinicalRationale: "Quantify fluid loss rate to grade dehydration risk.",
      suggestedPhrasing: "Roughly how many times in the past 24 hours have you had loose motions?",
      evaluatorSlot: "frequency",
    },
    {
      id: "blood_mucus",
      name: "Blood or Mucus in Stool",
      type: "associated",
      clinicalRationale: "Differentiate non-invasive secretory diarrhea from invasive dysentery (Shigella/Campylobacter/Amoeba).",
      suggestedPhrasing: "Have you noticed any visible blood or slime/mucus in your stool?",
      evaluatorSlot: "blood_in_stool",
    },
    {
      id: "hydration_status",
      name: "Hydration & Fluid Intake Tolerance",
      type: "safety_screen",
      clinicalRationale: "Assess dehydration risk (thirst, oral rehydration tolerance, urine output).",
      suggestedPhrasing: "Are you able to keep fluids down, and have you been urinating normally?",
      evaluatorSlot: "hydration",
    },
    {
      id: "vomiting",
      name: "Co-occurring Vomiting",
      type: "associated",
      clinicalRationale: "Persistent vomiting impedes oral rehydration therapy and accelerates electrolyte derangements.",
      suggestedPhrasing: "Are you also vomiting, and are you able to keep liquids down?",
      evaluatorSlot: "vomiting",
    },
    {
      id: "fever",
      name: "Fever",
      type: "associated",
      clinicalRationale: "Screen for invasive bacterial enteric infection.",
      suggestedPhrasing: "Have you had a fever or chills along with the diarrhea?",
      evaluatorSlot: "fever",
    },
  ],
};

export const ALL_PRESENTATION_DEFINITIONS: Record<PresentationId, PresentationDefinition> = {
  ABDOMINAL_PAIN: ABDOMINAL_PAIN_PRESENTATION,
  ACUTE_DIARRHEA: ACUTE_DIARRHEA_PRESENTATION,
  CHEST_DISCOMFORT: {
    id: "CHEST_DISCOMFORT",
    name: "Acute / Exertional Chest Discomfort",
    category: "cardiology",
    screeningConcepts: ["chest pain", "chest pressure", "chhati me dard", "gunde noppi", "chest tightness", "chest discomfort", "crushing chest"],
    dimensions: [
      { id: "location", name: "Location", type: "core_history", clinicalRationale: "Substernal vs chest wall.", suggestedPhrasing: "Where in your chest do you feel the discomfort?", evaluatorSlot: "location" },
      { id: "character", name: "Quality", type: "core_history", clinicalRationale: "Pressure/tightness vs pleuritic/sharp.", suggestedPhrasing: "Does it feel like a pressure, tightness, squeezing, or sharp pain?", evaluatorSlot: "character" },
      { id: "radiation", name: "Radiation", type: "core_history", clinicalRationale: "Radiation to arm, neck, jaw, back.", suggestedPhrasing: "Does the chest discomfort travel to your left arm, jaw, neck, or back?", evaluatorSlot: "radiation" },
      { id: "exertional", name: "Exertional Relationship", type: "core_history", clinicalRationale: "Ischemic angina worsens with exertion.", suggestedPhrasing: "Does this happen when you're physically active, or at rest?", evaluatorSlot: "exertional" },
      { id: "diaphoresis", name: "Diaphoresis / Cold Sweats", type: "safety_screen", clinicalRationale: "Strong predictor of acute myocardial infarction.", suggestedPhrasing: "Are you breaking out into cold sweats?", evaluatorSlot: "diaphoresis" },
    ],
  },
  ACUTE_DYSPNEA: {
    id: "ACUTE_DYSPNEA",
    name: "Acute Shortness of Breath / Dyspnea",
    category: "pulmonology",
    screeningConcepts: ["shortness of breath", "breathlessness", "dyspnea", "saans phoolna", "aayasam", "gasping", "trouble breathing", "difficulty breathing"],
    dimensions: [
      { id: "onset", name: "Timeline of Onset", type: "core_history", clinicalRationale: "Establish when breathlessness started.", suggestedPhrasing: "When did your difficulty breathing first begin?", evaluatorSlot: "onset" },
      { id: "onset_pattern", name: "Onset Pattern (Sudden vs Gradual)", type: "core_history", clinicalRationale: "Differentiate acute vascular/airway event (sudden PE/pneumothorax) from progressive infectious/cardiac failure (gradual pneumonia/COPD).", suggestedPhrasing: "Did the shortness of breath start suddenly out of nowhere, or did it build up gradually?", evaluatorSlot: "onset_pattern" },
      { id: "exertional", name: "Exertional vs Rest Dyspnea", type: "core_history", clinicalRationale: "Determine whether breathlessness is present at rest (higher acuity) or with exertion.", suggestedPhrasing: "Are you short of breath while resting, or does it happen mainly when moving around?", evaluatorSlot: "exertional" },
      { id: "orthopnea", name: "Orthopnea / PND", type: "core_history", clinicalRationale: "Differentiate left heart failure / pulmonary venous congestion from pulmonary parenchymal disease.", suggestedPhrasing: "Does your breathing feel noticeably worse when you lie down flat?", evaluatorSlot: "orthopnea" },
      { id: "cough", name: "Associated Cough", type: "associated", clinicalRationale: "Screen for respiratory tract infection, bronchospasm, or pulmonary edema.", suggestedPhrasing: "Do you have a cough, and are you bringing up any phlegm or mucus?", evaluatorSlot: "cough" },
      { id: "chest_pain", name: "Associated Chest Discomfort", type: "associated", clinicalRationale: "Screen for acute coronary syndrome, pulmonary embolism, or pleurisy.", suggestedPhrasing: "Are you feeling any chest pain, tightness, or pain when breathing in?", evaluatorSlot: "chest_pain" },
      { id: "wheezing", name: "Wheezing / Stridor", type: "associated", clinicalRationale: "Assess reactive airway bronchoconstriction (asthma/COPD) vs upper airway narrowing.", suggestedPhrasing: "Have you noticed any wheezing, whistling sounds, or tight chest breathing?", evaluatorSlot: "wheezing" },
      { id: "fever", name: "Fever", type: "associated", clinicalRationale: "Screen for pneumonia or respiratory sepsis.", suggestedPhrasing: "Have you had a fever or chills?", evaluatorSlot: "fever" },
      { id: "speech_difficulty", name: "Speech Limitation / Air Hunger", type: "safety_screen", clinicalRationale: "Objective indicator of impending respiratory failure.", suggestedPhrasing: "Are you struggling to complete a full sentence without pausing for breath?", evaluatorSlot: "speech_difficulty" },
      { id: "stridor", name: "Stridor / Airway Compromise", type: "safety_screen", clinicalRationale: "Indicator of acute upper airway obstruction.", suggestedPhrasing: "Are you making a harsh, high-pitched choking sound when breathing in?", evaluatorSlot: "stridor" },
      { id: "cyanosis", name: "Cyanosis / Peripheral Hypoxia", type: "safety_screen", clinicalRationale: "Severe arterial hypoxemia.", suggestedPhrasing: "Have you noticed any bluish tint around your lips or fingertips?", evaluatorSlot: "cyanosis" },
    ],
  },
  HEADACHE: {
    id: "HEADACHE",
    name: "Acute / Severe Headache",
    category: "neurology",
    screeningConcepts: ["headache", "migraine", "headache migraine", "sir dard", "tala noppi", "head hurts", "throbbing head"],
    dimensions: [
      { id: "onset", name: "Onset Timeline", type: "core_history", clinicalRationale: "Establish when the headache began.", suggestedPhrasing: "Roughly when did this headache start?", evaluatorSlot: "onset" },
      { id: "onset_pattern", name: "Onset Pattern (Thunderclap vs Gradual)", type: "core_history", clinicalRationale: "Screen for subarachnoid hemorrhage (thunderclap headache peaking in <1 min).", suggestedPhrasing: "Did the headache peak instantly like a thunderclap within seconds, or did it build up gradually?", evaluatorSlot: "onset_pattern" },
      { id: "character", name: "Pain Quality", type: "core_history", clinicalRationale: "Differentiate vascular pulsatile migraine from band-like tension or sharp neuralgic pain.", suggestedPhrasing: "How does the pain feel — is it throbbing, a tight pressure band, or sharp?", evaluatorSlot: "character" },
      { id: "severity", name: "Severity (0-10)", type: "core_history", clinicalRationale: "Quantify intensity ('worst headache of life').", suggestedPhrasing: "On a scale from zero to ten, how severe is the headache right now?", evaluatorSlot: "severity" },
      { id: "location", name: "Headache Location", type: "core_history", clinicalRationale: "Unilateral vs bilateral vs occipital/neck radiation.", suggestedPhrasing: "Is the pain located on one side of your head, across your forehead, or in the back of your head?", evaluatorSlot: "location" },
      { id: "photophobia", name: "Photophobia", type: "associated", clinicalRationale: "Indicator of meningeal irritation or migrainous cortical hyperexcitability.", suggestedPhrasing: "Are bright lights uncomfortable or making your headache worse?", evaluatorSlot: "photophobia" },
      { id: "phonophobia", name: "Phonophobia", type: "associated", clinicalRationale: "Sound sensitivity associated with migraine.", suggestedPhrasing: "Are loud noises or everyday sounds bothering your head?", evaluatorSlot: "phonophobia" },
      { id: "nausea", name: "Nausea / Vomiting", type: "associated", clinicalRationale: "Elevated ICP screen and migraine feature.", suggestedPhrasing: "Have you felt nauseous or vomited with the headache?", evaluatorSlot: "vomiting" },
      { id: "neck_stiffness", name: "Nuchal Rigidity / Stiff Neck", type: "safety_screen", clinicalRationale: "Indicator of acute bacterial meningitis or subarachnoid hemorrhage.", suggestedPhrasing: "Does your neck feel unusually stiff, or does it hurt to bend your chin down toward your chest?", evaluatorSlot: "neck_stiffness" },
      { id: "neurological_signs", name: "Focal Neurological Deficits", type: "safety_screen", clinicalRationale: "Intracranial mass, hemorrhage, or stroke screen.", suggestedPhrasing: "Have you noticed any weakness on one side, vision loss, or difficulty speaking?", evaluatorSlot: "neurological_signs" },
    ],
  },
  FEBRILE_ILLNESS: {
    id: "FEBRILE_ILLNESS",
    name: "Acute Febrile Illness",
    category: "infectious_disease",
    screeningConcepts: ["fever", "chills", "fever chills", "high temperature", "tez bukhar", "jwaram", "feverish", "shivering"],
    dimensions: [
      { id: "duration", name: "Fever Duration", type: "core_history", clinicalRationale: "Duration in days differentiates early viral/dengue (<5d) from prolonged malaria/typhoid (>7d).", suggestedPhrasing: "How many days have you had a fever?", evaluatorSlot: "duration" },
      { id: "onset", name: "Timeline of Onset", type: "core_history", clinicalRationale: "Pinpoint onset timeline.", suggestedPhrasing: "When did your temperature or feverish feeling first start?", evaluatorSlot: "onset" },
      { id: "temperature_pattern", name: "Temperature Pattern & Chills", type: "core_history", clinicalRationale: "Paroxysmal rigors suggest malaria; step-ladder curve suggests typhoid.", suggestedPhrasing: "Does the fever come with shaking chills, or is it continuous throughout the day?", evaluatorSlot: "temperature_pattern" },
      { id: "rash_bleeding", name: "Rash & Bleeding Tendency", type: "safety_screen", clinicalRationale: "MoHFW Dengue STG: Early warning for thrombocytopenic bleeding, petechiae, or purpura.", suggestedPhrasing: "Have you noticed any red spots on your skin, unusual bruising, or bleeding from your gums or nose?", evaluatorSlot: "rash_bleeding" },
      { id: "retroorbital_pain", name: "Retro-orbital Pain & Myalgia", type: "associated", clinicalRationale: "Classic Dengue triad (fever, retro-orbital pain, severe body aches).", suggestedPhrasing: "Are you having pain behind your eyes or intense bone and muscle aching?", evaluatorSlot: "retroorbital_pain" },
      { id: "respiratory_symptoms", name: "Respiratory Signs (Cough / Dyspnea)", type: "associated", clinicalRationale: "Screen for lower respiratory tract infection / pneumonia.", suggestedPhrasing: "Do you have any cough, throat pain, or difficulty breathing?", evaluatorSlot: "cough" },
      { id: "gi_symptoms", name: "Co-occurring Vomiting or Diarrhea", type: "associated", clinicalRationale: "Assess hydration risk and enteritis.", suggestedPhrasing: "Have you had any vomiting or loose motions?", evaluatorSlot: "vomiting" },
      { id: "altered_sensorium", name: "Sensorium / Mental Status", type: "safety_screen", clinicalRationale: "Indicator of cerebral malaria, severe sepsis, or encephalitis.", suggestedPhrasing: "Have you felt unusually confused, drowsy, or disoriented?", evaluatorSlot: "neurological_signs" },
    ],
  },
  DIZZINESS_VERTIGO: {
    id: "DIZZINESS_VERTIGO",
    name: "Dizziness & Vertigo",
    category: "neurology",
    screeningConcepts: ["dizziness", "vertigo", "dizziness vertigo", "lightheaded", "chakkar", "tala thiragadam", "spinning", "room spinning", "unsteady"],
    dimensions: [
      { id: "character", name: "Sensation Character (Spinning vs Lightheaded)", type: "core_history", clinicalRationale: "Differentiate true vestibular vertigo (spinning sensation) from orthostatic lightheadedness or ataxia.", suggestedPhrasing: "Does it feel like the room is spinning around you, or is it more of a lightheaded, faint feeling?", evaluatorSlot: "character" },
      { id: "onset", name: "Onset Timeline", type: "core_history", clinicalRationale: "Establish when dizziness episodes began.", suggestedPhrasing: "When did you first notice this dizziness or spinning sensation?", evaluatorSlot: "onset" },
      { id: "duration", name: "Episode Duration", type: "core_history", clinicalRationale: "Seconds: BPPV; Minutes/Hours: Meniere / TIA; Days: Vestibular neuritis / cerebellar stroke.", suggestedPhrasing: "When you feel dizzy, roughly how long does each spell last?", evaluatorSlot: "duration" },
      { id: "postural", name: "Postural / Positional Triggers", type: "core_history", clinicalRationale: "Positional head changes (BPPV) vs standing up from sitting (Orthostatic hypotension).", suggestedPhrasing: "Does this happen mainly when turning your head in bed, or when standing up quickly?", evaluatorSlot: "postural" },
      { id: "hearing_loss", name: "Hearing Changes & Tinnitus", type: "associated", clinicalRationale: "Screen for inner ear pathology (Meniere, labyrinthitis, acoustic neuroma).", suggestedPhrasing: "Have you noticed any ringing in your ears, muffled hearing, or ear fullness?", evaluatorSlot: "hearing_loss" },
      { id: "nausea", name: "Nausea & Emesis", type: "associated", clinicalRationale: "Assess autonomic vestibulo-ocular response.", suggestedPhrasing: "Does the dizziness cause nausea or vomiting?", evaluatorSlot: "vomiting" },
      { id: "neurological_signs", name: "Central Neurological Signs (HINTS Screen)", type: "safety_screen", clinicalRationale: "Posterior circulation stroke screen: diplopia, dysarthria, ataxia, limb weakness.", suggestedPhrasing: "Have you had double vision, slurred speech, facial numbness, or unsteadiness when walking?", evaluatorSlot: "neurological_signs" },
      { id: "syncope", name: "Blackouts / Syncope", type: "safety_screen", clinicalRationale: "Cardiovascular arrhythmogenic syncope screen.", suggestedPhrasing: "Have you completely lost consciousness or blacked out?", evaluatorSlot: "syncope" },
    ],
  },
  PHARYNGITIS_ODYNOPHAGIA: {
    id: "PHARYNGITIS_ODYNOPHAGIA",
    name: "Acute Sore Throat & Odynophagia",
    category: "ent",
    screeningConcepts: ["sore throat", "throat pain", "pharyngitis", "throat pain pharyngitis", "gale me dard", "gonthu noppi", "hurts to swallow"],
    dimensions: [
      { id: "onset", name: "Timeline of Throat Pain", type: "core_history", clinicalRationale: "Establish onset and duration of pharyngeal symptoms.", suggestedPhrasing: "Roughly when did this sore throat first start?", evaluatorSlot: "onset" },
      { id: "onset_pattern", name: "Onset Pattern (Sudden vs Gradual)", type: "core_history", clinicalRationale: "Differentiate acute inflammatory infection (gradual) from sudden foreign body or acute epiglottitis (sudden).", suggestedPhrasing: "Did the throat pain start suddenly, or did it build up gradually?", evaluatorSlot: "onset_pattern" },
      { id: "severity", name: "Pain Severity (0-10)", type: "core_history", clinicalRationale: "Quantify throat pain severity.", suggestedPhrasing: "On a scale from zero to ten, how severe is the throat pain?", evaluatorSlot: "severity" },
      { id: "odynophagia", name: "Painful Swallowing (Odynophagia)", type: "core_history", clinicalRationale: "Assess painful swallowing of solids vs liquids vs saliva.", suggestedPhrasing: "Does it hurt when you swallow food, liquids, or your own saliva?", evaluatorSlot: "odynophagia" },
      { id: "fever", name: "Fever (Centor Score)", type: "associated", clinicalRationale: "History of fever is a primary Centor criterion for bacterial streptococcal infection.", suggestedPhrasing: "Have you had a fever or chills?", evaluatorSlot: "fever" },
      { id: "cough", name: "Absence of Cough (Centor Score)", type: "associated", clinicalRationale: "Absence of cough increases probability of Group A Strep pharyngitis.", suggestedPhrasing: "Do you have a cough along with the sore throat, or is there no cough?", evaluatorSlot: "cough" },
      { id: "voice_character", name: "Voice Changes / Hot Potato Voice", type: "associated", clinicalRationale: "Assess hoarseness (laryngitis) vs muffled 'hot potato' voice (peritonsillar phlegmon).", suggestedPhrasing: "Has your voice changed or become hoarse or muffled?", evaluatorSlot: "voice_change" },
      { id: "ear_pain", name: "Referred Otalgia", type: "associated", clinicalRationale: "Glossopharyngeal nerve referred pain to ear.", suggestedPhrasing: "Are you feeling any ear pain or pain radiating up toward your ears?", evaluatorSlot: "ear_pain" },
      { id: "swallowing_difficulty", name: "True Dysphagia / Fluid Inability", type: "safety_screen", clinicalRationale: "Inability to swallow liquids or saliva indicates upper airway threat.", suggestedPhrasing: "Are you still able to swallow liquids and keep them down without choking?", evaluatorSlot: "swallowing_difficulty" },
      { id: "trismus", name: "Trismus / Limited Jaw Opening", type: "safety_screen", clinicalRationale: "Key physical indicator of peritonsillar or deep neck space infection.", suggestedPhrasing: "Can you open your mouth fully, or is your jaw feeling stiff and painful to open wide?", evaluatorSlot: "trismus" },
    ],
  },
  PEDIATRIC_CRISIS: {
    id: "PEDIATRIC_CRISIS",
    name: "Pediatric Crisis / Lethargy",
    category: "pediatrics",
    screeningConcepts: ["pediatric lethargy", "pediatric lethargy poor feeding", "infant grunting", "sust hai", "baby won't feed", "child fever", "baby crying continuously"],
    dimensions: [
      { id: "age", name: "Child Age in Months/Years", type: "core_history", clinicalRationale: "Determines high-risk sepsis pathways (especially < 60-90 days).", suggestedPhrasing: "How old is your child?", evaluatorSlot: "age" },
      { id: "onset", name: "Timeline of Symptoms", type: "core_history", clinicalRationale: "Establish symptom onset.", suggestedPhrasing: "When did your child first become unwell?", evaluatorSlot: "onset" },
      { id: "oral_intake", name: "Oral Intake & Feeding", type: "core_history", clinicalRationale: "Assess caloric and fluid hydration intake in young infants.", suggestedPhrasing: "Is your child able to take feeds, milk, or fluids normally, or are they refusing to drink?", evaluatorSlot: "feeding" },
      { id: "urine_output", name: "Wet Diapers / Urine Output", type: "core_history", clinicalRationale: "Reliable quantitative indicator of pediatric hydration.", suggestedPhrasing: "How many wet diapers has your baby had in the last twelve to twenty-four hours?", evaluatorSlot: "urine_output" },
      { id: "fever", name: "Fever / Temperature", type: "associated", clinicalRationale: "Quantify pediatric pyrexia.", suggestedPhrasing: "What was the highest temperature measured, and have you given any fever medication?", evaluatorSlot: "fever" },
      { id: "vomiting_diarrhea", name: "GI Fluid Losses", type: "associated", clinicalRationale: "Rapid dehydration risk from pediatric diarrhea/vomiting.", suggestedPhrasing: "Has your child had any vomiting or diarrhea?", evaluatorSlot: "vomiting" },
      { id: "neonatal_fever", name: "Neonatal Pyrexia (< 3 Months)", type: "safety_screen", clinicalRationale: "Rectal temp >= 38.0 C in infant under 90 days is a medical emergency requiring full sepsis workup.", suggestedPhrasing: "Is the infant under three months of age with a fever?", evaluatorSlot: "neonatal_fever" },
      { id: "lethargy", name: "Lethargy / Unresponsiveness", type: "safety_screen", clinicalRationale: "Pediatric red flag for systemic sepsis or meningitis.", suggestedPhrasing: "Is your child unusually limp, difficult to wake up, or not making eye contact?", evaluatorSlot: "lethargy" },
      { id: "respiratory_distress", name: "Chest Indrawing / Grunting", type: "safety_screen", clinicalRationale: "Severe pediatric lower respiratory distress.", suggestedPhrasing: "Is your child breathing unusually fast, with chest sucking in or grunting sounds?", evaluatorSlot: "grunting" },
    ],
  },
};

/**
 * Evaluates satisfaction of a presentation's dimensions against existing ClinicalState.
 * Invariant: Reads ClinicalState as the single source of truth; never invents duplicate state.
 */
export function evaluatePresentationDimensions(
  presentationId: PresentationId,
  slots: Record<string, any> = {},
  knownFacts: string[] = [],
  deniedSymptoms: string[] = []
): DimensionEvaluation[] {
  const def = ALL_PRESENTATION_DEFINITIONS[presentationId];
  if (!def) return [];

  const factsLower = knownFacts.map((f) => f.toLowerCase());
  const deniedSet = new Set(deniedSymptoms.map((s) => s.toLowerCase()));
  const associated: string[] = Array.isArray(slots.associated_symptoms) ? slots.associated_symptoms : [];

  return def.dimensions.map((dim) => {
    const slotKey = dim.evaluatorSlot;
    const dimIdLower = dim.id.toLowerCase();
    const slotKeyLower = slotKey.toLowerCase();
    const slotVal = slots[slotKey] !== undefined ? slots[slotKey] : slots[dim.id];

    // 1. Explicit denial check
    if (deniedSet.has(dimIdLower) || deniedSet.has(slotKeyLower)) {
      return { dimension: dim, status: "denied" as const, currentValue: "denied" };
    }
    const isDeniedInFacts = factsLower.some(
      (f) =>
        f.includes(`denied: ${dimIdLower}`) ||
        f.includes(`denied: ${slotKeyLower}`) ||
        f.includes(`no ${dimIdLower}`) ||
        f.includes(`no ${slotKeyLower}`) ||
        f.includes(`${dimIdLower}: absent`) ||
        f.includes(`${slotKeyLower}: absent`)
    );
    if (isDeniedInFacts) {
      return { dimension: dim, status: "denied" as const, currentValue: "denied" };
    }

    // 2. Explicit direct slot value check
    if (slotVal !== undefined && slotVal !== null && slotVal !== "") {
      if (typeof slotVal === "string" && /unknown|unspecified/i.test(slotVal)) {
        return { dimension: dim, status: "partial" as const, currentValue: slotVal };
      }
      return { dimension: dim, status: "answered" as const, currentValue: slotVal };
    }

    // 3. Associated symptoms array check
    const inAssoc = associated.some(
      (a) =>
        a.toLowerCase().includes(dimIdLower) ||
        a.toLowerCase().includes(slotKeyLower) ||
        dimIdLower.includes(a.toLowerCase()) ||
        slotKeyLower.includes(a.toLowerCase())
    );
    if (inAssoc) {
      return { dimension: dim, status: "answered" as const, currentValue: "reported in associated symptoms" };
    }

    // 4. Known facts check
    const matchingFact = knownFacts.find((f) => {
      const fl = f.toLowerCase();
      return (
        fl.startsWith(`${dimIdLower}:`) ||
        fl.startsWith(`${slotKeyLower}:`) ||
        fl.includes(`associated: ${dimIdLower}`) ||
        fl.includes(`associated: ${slotKeyLower}`) ||
        (dim.id === "location" && (fl.startsWith("abdominal location:") || fl.startsWith("location:"))) ||
        (dim.id === "onset" && (fl.startsWith("onset:") || fl.startsWith("duration:"))) ||
        (dim.id === "onset_pattern" && fl.startsWith("onset_type:")) ||
        (dim.id === "severity" && fl.startsWith("severity:")) ||
        (dim.id === "character" && fl.startsWith("character:")) ||
        (dim.id === "fever" && (fl.startsWith("fever:") || fl.includes("fever: present"))) ||
        (dim.id === "temperature_pattern" && (fl.startsWith("fever:") || fl.includes("temperature"))) ||
        (dim.id === "rash_bleeding" && (fl.includes("rash") || fl.includes("petechiae") || fl.includes("bleeding"))) ||
        (dim.id === "photophobia" && fl.includes("photophobia")) ||
        (dim.id === "phonophobia" && fl.includes("phonophobia")) ||
        (dim.id === "odynophagia" && (fl.includes("odynophagia") || fl.includes("painful swallowing"))) ||
        (dim.id === "swallowing_difficulty" && (fl.includes("swallowing_difficulty") || fl.includes("dysphagia"))) ||
        (dim.id === "ear_pain" && fl.includes("ear pain"))
      );
    });

    if (matchingFact) {
      return { dimension: dim, status: "answered" as const, currentValue: matchingFact };
    }

    // 5. Default: Unresolved
    return { dimension: dim, status: "unresolved" as const };
  });
}

