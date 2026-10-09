/**
 * CLINICAL PRESENTATION CLASSIFIER
 *
 * Invariants:
 * 1. Takes normalized clinical concepts and transcript context.
 * 2. Classifies multiple simultaneous active presentations without dropping comorbid syndromes.
 * 3. Never chooses the next question directly; only emits PresentationContext.
 * 4. PresentationContext describes what clinical presentation is active; ClinicalState remains
 *    the ONLY source of truth for patient-reported findings.
 */

import { normalizeClinicalSymptoms } from "./synonyms";
import {
  PresentationId,
  PresentationContext,
  ActivePresentation,
} from "./presentation-types";
import { ALL_PRESENTATION_DEFINITIONS } from "./presentation-registry";

export class PresentationClassifier {
  /**
   * Classifies all active clinical presentations from patient text and cumulative transcript.
   */
  public classify(
    currentUtterance: string,
    cumulativeTranscript: string = "",
    knownConcepts: string[] = []
  ): PresentationContext {
    const combinedText = `${cumulativeTranscript} ${currentUtterance}`.trim();
    const normalized = normalizeClinicalSymptoms(combinedText);
    const allConcepts = new Set<string>([
      ...normalized.detectedConcepts.map((c) => c.toLowerCase()),
      ...knownConcepts.map((c) => c.toLowerCase()),
    ]);

    const textLower = combinedText.toLowerCase();
    const active: ActivePresentation[] = [];

    // Evaluate each registered presentation against detected concepts and clinical text patterns
    for (const [id, def] of Object.entries(ALL_PRESENTATION_DEFINITIONS)) {
      const presId = id as PresentationId;
      const matchedTriggers: string[] = [];

      for (const screeningConcept of def.screeningConcepts) {
        const scLower = screeningConcept.toLowerCase();
        const inText = textLower.includes(scLower);
        const inConcepts = allConcepts.has(scLower);

        if (inText || inConcepts) {
          // Check if this screening concept is explicitly negated in text within its clause
          if (inText) {
            const idx = textLower.indexOf(scLower);
            const preceding = textLower.substring(Math.max(0, idx - 45), idx);
            const lastBoundary = Math.max(
              preceding.lastIndexOf('.'),
              preceding.lastIndexOf(';'),
              preceding.lastIndexOf('!'),
              preceding.lastIndexOf('?'),
              preceding.lastIndexOf('\n'),
              preceding.lastIndexOf(' but ')
            );
            const windowBefore = lastBoundary !== -1 ? preceding.slice(lastBoundary) : preceding;
            const isNegated = /\b(?:no|not|don'?t\s+have|without|denies|denied|free\s+of|neither|never)\b/i.test(windowBefore);
            if (isNegated) {
              continue;
            }
          }
          matchedTriggers.push(screeningConcept);
        }
      }

      // Domain-specific heuristic boosters for abdominal pain
      if (presId === "ABDOMINAL_PAIN") {
        if (/\b(stomach|abdom|belly|gut|epigastr|tummy)\b/i.test(textLower)) {
          const idx = textLower.search(/\b(stomach|abdom|belly|gut|epigastr|tummy)\b/i);
          const preceding = idx !== -1 ? textLower.substring(Math.max(0, idx - 45), idx) : "";
          const lastBoundary = Math.max(
            preceding.lastIndexOf('.'),
            preceding.lastIndexOf(';'),
            preceding.lastIndexOf('!'),
            preceding.lastIndexOf('?'),
            preceding.lastIndexOf('\n'),
            preceding.lastIndexOf(' but ')
          );
          const windowBefore = lastBoundary !== -1 ? preceding.slice(lastBoundary) : preceding;
          const isNegated = /\b(?:no|not|don'?t\s+have|without|denies|denied)\b/i.test(windowBefore);
          if (!isNegated && !matchedTriggers.includes("anatomical: abdomen/stomach")) {
            matchedTriggers.push("anatomical: abdomen/stomach");
          }
        }
      }

      // Domain-specific booster for dizziness/vertigo
      if (presId === "DIZZINESS_VERTIGO") {
        if (/\b(dizz\w*|spinning|chakkar|tala\s+thiragadam)\b/i.test(textLower)) {
          const idx = textLower.search(/\b(dizz\w*|spinning|chakkar|tala\s+thiragadam)\b/i);
          const windowBefore = idx !== -1 ? textLower.substring(Math.max(0, idx - 45), idx) : "";
          const isNegated = /\b(?:no|not|without|denies|never)\b/i.test(windowBefore);
          if (!isNegated && !matchedTriggers.includes("dizziness / vertigo sensation")) {
            matchedTriggers.push("dizziness / vertigo sensation");
          }
        }
      }

      // If any screening triggers matched, activate presentation with computed confidence
      if (matchedTriggers.length > 0) {
        const confidence = Math.min(1.0, 0.5 + matchedTriggers.length * 0.25);
        active.push({
          id: presId,
          confidence,
          triggeredBy: matchedTriggers,
        });
      }
    }

    // Sort active presentations by confidence descending
    active.sort((a, b) => b.confidence - a.confidence);

    // Apply classifier override mode if set (used for classifier-independence testing)
    if (this.overrideMode === "stub_unclassified") {
      return {
        active: [],
        primary: "UNCLASSIFIED",
        supporting: [],
      };
    }

    if (this.overrideMode === "forced_wrong_label") {
      const wrong = this.forcedWrongLabel || "PHARYNGITIS_ODYNOPHAGIA";
      return {
        active: [{ id: wrong, confidence: 1.0, triggeredBy: ["forced_override"] }],
        primary: wrong,
        supporting: [],
      };
    }

    const primary = active.length > 0 ? active[0].id : "UNCLASSIFIED";
    const supporting = active.length > 1 ? active.slice(1).map((a) => a.id) : [];

    return {
      active,
      primary,
      supporting,
    };
  }

  private overrideMode: "normal" | "stub_unclassified" | "forced_wrong_label" = "normal";
  private forcedWrongLabel?: PresentationId;

  public setOverrideMode(
    mode: "normal" | "stub_unclassified" | "forced_wrong_label",
    wrongLabel?: PresentationId
  ) {
    this.overrideMode = mode;
    this.forcedWrongLabel = wrongLabel;
  }

  public getOverrideMode(): string {
    return this.overrideMode;
  }
}

export const presentationClassifier = new PresentationClassifier();
