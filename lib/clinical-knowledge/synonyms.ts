/**
 * MULTILINGUAL SYMPTOM NORMALIZATION & CANONICAL CONCEPT MAPPING
 * 
 * Invariants:
 * 1. Deterministic normalization: maps colloquial, Hinglish, and Telugu transliterated
 *    expressions to standard clinical terms before lexical and domain evaluation.
 * 2. Non-destructive: enriches the query without stripping vital patient vocabulary.
 */

export interface SymptomConceptMap {
  canonical: string;
  category: string;
  synonyms: string[];
}

export const CANONICAL_SYMPTOMS: SymptomConceptMap[] = [
  {
    canonical: "abdominal pain",
    category: "gastroenterology",
    synonyms: [
      "stomach ache", "stomachache", "belly ache", "bellyache", "tummy pain", "tummy hurts",
      "gut pain", "cramps in stomach", "pet dard", "pet me dard", "pet kharab",
      "kadupu noppi", "kadupulo noppi", "vayarru vali"
    ]
  },
  {
    canonical: "diarrhea",
    category: "gastroenterology",
    synonyms: [
      "loose motions", "loose stools", "watery stools", "the runs", "dast",
      "patla pakhana", "virochanalu", "bedhi", "loose motion"
    ]
  },
  {
    canonical: "chest pain",
    category: "cardiology",
    synonyms: [
      "chest pressure", "chest tightness", "chest discomfort", "crushing chest",
      "heavy chest", "chhati me dard", "chhati me dabav", "chhati bhari",
      "gunde noppi", "rommu noppi", "nenju vali"
    ]
  },
  {
    canonical: "fever chills",
    category: "infectious_disease",
    synonyms: [
      "high temperature", "febrile", "feverish", "shivering with fever", "rigors",
      "thand lagke bukhar", "tez bukhar", "thandi jwaram", "chalito jwaram", "kaachil"
    ]
  },
  {
    canonical: "shortness of breath",
    category: "pulmonology",
    synonyms: [
      "breathlessness", "difficulty breathing", "cannot breathe", "gasping for air",
      "dyspnea", "saans phoolna", "saans lene me dikkat", "saans lene me takleef",
      "swasa kastam", "aayasam", "moochu thinaral"
    ]
  },
  {
    canonical: "vomiting nausea",
    category: "gastroenterology",
    synonyms: [
      "throwing up", "puking", "sick to my stomach", "emesis", "ulti", "jee ghabrana",
      "vaanthulu", "vaanthi", "kakkaal"
    ]
  },
  {
    canonical: "throat pain pharyngitis",
    category: "ent",
    synonyms: [
      "sore throat", "hurts to swallow", "painful swallowing", "scratchy throat",
      "gale me dard", "gala kharab", "kharrash", "gonthu noppi", "thondai vali"
    ]
  },
  {
    canonical: "headache migraine",
    category: "neurology",
    synonyms: [
      "head hurts", "throbbing head", "head pounding", "sir dard", "sar dard",
      "sar me tez dard", "tala noppi", "thala vali"
    ]
  },
  {
    canonical: "dizziness vertigo",
    category: "neurology",
    synonyms: [
      "lightheaded", "room spinning", "feeling faint", "off balance",
      "chakkar", "chakkar aana", "tala thiragadam", "thala suttrudhal"
    ]
  },
  {
    canonical: "pediatric lethargy poor feeding",
    category: "pediatrics",
    synonyms: [
      "baby won't feed", "baby not waking", "child unusually floppy", "infant grunting",
      "bacha dudh nahi pee raha", "sust hai", "baby pale", "pilladu palu tagatledu"
    ]
  }
];

/**
 * Normalizes query string by injecting canonical clinical concepts when synonyms are present.
 */
export function normalizeClinicalSymptoms(rawQuery: string): {
  normalizedQuery: string;
  detectedConcepts: string[];
} {
  const queryLower = rawQuery.toLowerCase();
  const detected = new Set<string>();
  const expansionTokens: string[] = [];

  for (const concept of CANONICAL_SYMPTOMS) {
    const hasCanonical = queryLower.includes(concept.canonical);
    const matchedSynonym = concept.synonyms.find((s) => queryLower.includes(s));

    if (hasCanonical || matchedSynonym) {
      detected.add(concept.canonical);
      // Append canonical terms if missing from the raw query
      if (!hasCanonical) {
        expansionTokens.push(concept.canonical);
      }
    }
  }

  const normalizedQuery = expansionTokens.length > 0
    ? `${rawQuery} ${expansionTokens.join(" ")}`.trim()
    : rawQuery;

  return {
    normalizedQuery,
    detectedConcepts: Array.from(detected),
  };
}
