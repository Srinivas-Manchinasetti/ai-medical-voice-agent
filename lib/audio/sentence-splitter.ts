/**
 * Sentence & Clause Splitter for Real-Time Conversational Voice Synthesis
 * 
 * Splits conversational doctor responses into natural acoustic chunks along
 * sentence and grammatical clause boundaries.
 * 
 * Invariants:
 * 1. Never splits on abbreviations/honorifics (Dr., Mr., Ms., Prof., MD, etc.)
 * 2. Preserves natural punctuation and prosodic phrasing.
 * 3. Keeps chunks within calibrated word budgets (default: 12-14 words) for low TTFA (Time-To-First-Audio).
 */

const HONORIFICS = ["dr", "mr", "mrs", "ms", "prof", "sr", "jr", "vs", "etc", "md", "phd", "facc", "st"];

export function splitIntoSpeechChunks(text: string, maxWordsPerChunk: number = 13): string[] {
  const clean = text
    .replace(/[*_#`\[\]]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  // Protect honorifics and medical abbreviations (e.g. "Dr. Sarah" -> "Dr__DOT__ Sarah")
  let protectedText = clean;
  for (const h of HONORIFICS) {
    const re = new RegExp(`\\b(${h})\\.(\\s+)`, "gi");
    protectedText = protectedText.replace(re, "$1__DOT__$2");
  }

  // 1. Split by major sentence terminators (. ? ! \n)
  const sentenceRegex = /([^.?!]+[.?!]+["']?|[^.?!]+$)/g;
  const rawSentences = protectedText.match(sentenceRegex) || [protectedText];

  const chunks: string[] = [];

  for (const rawSentence of rawSentences) {
    // Restore protected dots
    const sentence = rawSentence.replace(/__DOT__/g, ".").trim();
    if (!sentence) continue;

    const words = sentence.split(/\s+/);

    // If sentence is short enough, keep it intact as a single natural prosodic unit
    if (words.length <= maxWordsPerChunk) {
      chunks.push(sentence);
      continue;
    }

    // For longer compound sentences, split along major clause boundaries (, ; : —)
    const clauseRegex = /([^,;:—]+[,;:—]+|[^,;:—]+$)/g;
    const rawClauses = sentence.match(clauseRegex) || [sentence];

    let currentChunk = "";
    for (const rawClause of rawClauses) {
      const clause = rawClause.trim();
      if (!clause) continue;

      if (!currentChunk) {
        currentChunk = clause;
      } else {
        const combined = `${currentChunk} ${clause}`;
        if (combined.split(/\s+/).length <= maxWordsPerChunk) {
          currentChunk = combined;
        } else {
          chunks.push(currentChunk);
          currentChunk = clause;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }

  return chunks.length > 0 ? chunks : [clean];
}
