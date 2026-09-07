import fs from "fs";
import path from "path";
import {
  ClinicalPassage,
  KnowledgeContext,
  ClinicalDomain,
  ClinicalSection,
  AuthorityTier,
  MedicationTaskType,
  MedicationQueryResult,
} from "./types";
import { CURATED_GUIDELINES } from "./guidelines";

let cachedPassages: ClinicalPassage[] | null = null;

const AUTHORITY_PRIORITY: Record<AuthorityTier, number> = {
  deterministic_safety: 100,
  clinical_guideline: 80,
  government_reference: 60,
  medication_label: 55,
  medication_identity: 50,
  regulatory_adverse: 45,
};

function inferDomainFromTopic(topicTitle: string, content: string): ClinicalDomain {
  const text = (topicTitle + " " + content).toLowerCase();
  if (
    text.includes("heart") ||
    text.includes("cardiac") ||
    text.includes("coronary") ||
    text.includes("chest pain") ||
    text.includes("angina") ||
    text.includes("arrhythmia") ||
    text.includes("hypertension") ||
    text.includes("cholesterol")
  ) {
    return "cardiology";
  }
  if (
    text.includes("stroke") ||
    text.includes("brain") ||
    text.includes("neurolog") ||
    text.includes("headache") ||
    text.includes("seizure") ||
    text.includes("paralysis") ||
    text.includes("tia") ||
    text.includes("dementia")
  ) {
    return "neurology";
  }
  if (
    text.includes("pediatric") ||
    text.includes("child") ||
    text.includes("infant") ||
    text.includes("newborn") ||
    text.includes("baby") ||
    text.includes("birth")
  ) {
    return "pediatrics";
  }
  if (
    text.includes("drug") ||
    text.includes("medication") ||
    text.includes("prescription") ||
    text.includes("dose") ||
    text.includes("contraindic")
  ) {
    return "medications";
  }
  return "general";
}

function loadAllPassages(): ClinicalPassage[] {
  if (cachedPassages) return cachedPassages;

  const passages: ClinicalPassage[] = [...CURATED_GUIDELINES];

  const passagesPath = path.join(process.cwd(), "data", "medlineplus", "processed", "passages.jsonl");
  if (fs.existsSync(passagesPath)) {
    try {
      const lines = fs.readFileSync(passagesPath, "utf-8").split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = JSON.parse(line);
        const domain = inferDomainFromTopic(parsed.title, parsed.content);
        passages.push({
          id: parsed.id,
          topicId: parsed.topicId,
          title: parsed.title,
          section: parsed.section as ClinicalSection,
          source: parsed.source || "MedlinePlus",
          sourceUrl: parsed.sourceUrl,
          releaseDate: parsed.releaseDate || "2026-09-05",
          authority: parsed.authority || "government_reference",
          domain,
          content: parsed.content,
          keyTerms: parsed.keyTerms || [],
        });
      }
    } catch (err) {
      console.warn("[Retriever] Error reading MedlinePlus passages.jsonl:", err);
    }
  }

  cachedPassages = passages;
  return passages;
}

export class ClinicalKnowledgeRetriever {
  private passages: ClinicalPassage[];

  constructor() {
    this.passages = loadAllPassages();
  }

  public resolveCitation(passageId: string): ClinicalPassage | null {
    return this.passages.find((p) => p.id === passageId) || null;
  }

  public queryMedicationTask(drugName: string, task: MedicationTaskType): MedicationQueryResult {
    const cleanDrug = drugName.toLowerCase().trim();
    let targetAuthority: AuthorityTier = "medication_label";
    let primarySource: "RxNorm" | "DailyMed" | "openFDA" = "DailyMed";

    if (task === "identity") {
      targetAuthority = "medication_identity";
      primarySource = "RxNorm";
    } else if (task === "contraindication") {
      targetAuthority = "medication_label";
      primarySource = "DailyMed";
    } else if (task === "adverse_event") {
      targetAuthority = "regulatory_adverse";
      primarySource = "openFDA";
    }

    const matches = this.passages.filter((p) => {
      if (p.domain !== "medications") return false;
      const text = (p.title + " " + p.content + " " + p.keyTerms.join(" ")).toLowerCase();
      const hasDrug = text.includes(cleanDrug);
      return hasDrug && p.authority === targetAuthority;
    });

    const findings = matches.map((m) => m.content);

    return {
      task,
      primarySource,
      drugName,
      findings,
      passages: matches,
    };
  }

  public retrieveKnowledge(
    query: string,
    domain?: ClinicalDomain,
    options: {
      topK?: number;
      targetSection?: ClinicalSection;
      minScore?: number;
    } = {}
  ): KnowledgeContext {
    const topK = options.topK || 4;
    const cleanQuery = query.toLowerCase().trim();
    const queryTokens = cleanQuery
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length > 2);

    const isAcuteSymptomQuery =
      /sudden|acute|crushing|pressure|radiat|droop|weakness|numb|speech|fever|lethargy|grunting|pain/i.test(
        cleanQuery
      );
    const isDiagnosisQuery = /diagnos|test|workup|criteria|score/i.test(cleanQuery);
    const isPreventionQuery = /prevent|lifestyle|diet|exercise/i.test(cleanQuery);

    const scored = this.passages.map((passage) => {
      let score = 0;
      const titleLower = passage.title.toLowerCase();
      const contentLower = passage.content.toLowerCase();

      // 1. Lexical Exact Matches
      if (titleLower.includes(cleanQuery)) score += 35;
      if (cleanQuery.includes(titleLower)) score += 25;

      for (const token of queryTokens) {
        if (titleLower.includes(token)) score += 10;
        if (passage.keyTerms.some((k) => k.includes(token))) score += 5;
        if (contentLower.includes(token)) score += 2;
      }

      // 2. Domain Alignment
      if (domain && domain !== "general") {
        if (passage.domain === domain) {
          score += 15;
        } else if (passage.domain !== "general" && passage.domain !== "medications") {
          // Penalize wrong clinical specialist domain
          score -= 10;
        }
      }

      // 3. Section-Aware Boosting
      if (options.targetSection) {
        if (passage.section === options.targetSection) {
          score += 25;
        }
      } else {
        if (isAcuteSymptomQuery) {
          if (passage.section === "symptoms") score *= 1.8;
          else if (passage.section === "emergency_guidance") score *= 2.0;
          else if (passage.section === "prevention") score *= 0.4;
          else if (passage.section === "overview") score *= 1.1;
        } else if (isDiagnosisQuery) {
          if (passage.section === "diagnosis") score *= 2.0;
        } else if (isPreventionQuery) {
          if (passage.section === "prevention") score *= 2.0;
        }
      }

      // 4. Authority Multi-Tier Weighting
      const authorityWeight = AUTHORITY_PRIORITY[passage.authority] || 50;
      score += (authorityWeight / 100) * 8;

      return {
        ...passage,
        relevanceScore: Math.round(score * 10) / 10,
      };
    });

    // Sort by relevance score descending, breaking ties by authority tier
    scored.sort((a, b) => {
      if ((b.relevanceScore || 0) !== (a.relevanceScore || 0)) {
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      }
      return (AUTHORITY_PRIORITY[b.authority] || 0) - (AUTHORITY_PRIORITY[a.authority] || 0);
    });

    const minScore = options.minScore || 5;
    const filtered = scored.filter((p) => (p.relevanceScore || 0) >= minScore);
    const topPassages = filtered.slice(0, topK);

    return {
      retrievedAt: new Date().toISOString(),
      query,
      domain: domain || "general",
      passages: topPassages,
      authorityHierarchyApplied: true,
    };
  }
}

export const clinicalKnowledgeRetriever = new ClinicalKnowledgeRetriever();
