/**
 * Sentence & Prosodic Splitter for Real-Time Conversational Voice Synthesis
 * 
 * Splits conversational doctor responses into natural acoustic units along
 * sentence and grammatical clause boundaries.
 * 
 * Priority Hierarchy:
 * 1. Sentence boundaries (. ? ! \n) first and foremost.
 * 2. Honorific & medical abbreviation protection (Dr., Mr., Ms., Prof., MD, PhD, etc.).
 * 3. Natural prosodic integrity: Sentences up to 24 words are kept whole to
 *    preserve the clinician's natural cadence and intonation without awkward mid-sentence breaks.
 * 4. Only very long compound sentences (> 24 words) are split along major grammatical
 *    clause boundaries (semicolons, colons, em-dashes, or coordinating conjunctions).
 */

const HONORIFICS = ["dr", "mr", "mrs", "ms", "prof", "sr", "jr", "vs", "etc", "md", "phd", "facc", "st"];

export function splitIntoSpeechChunks(text: string, maxWordsPerChunk: number = 24): string[] {
  const clean = text
    .replace(/[*_#`\[\]]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return [];

  // 1. Protect honorifics and medical abbreviations (e.g. "Dr. Sarah" -> "Dr__DOT__ Sarah")
  let protectedText = clean;
  for (const h of HONORIFICS) {
    const re = new RegExp(`\\b(${h})\\.(\\s+)`, "gi");
    protectedText = protectedText.replace(re, "$1__DOT__$2");
  }

  // 2. Primary split: Major sentence terminators (. ? ! \n)
  const sentenceRegex = /([^.?!]+[.?!]+["']?|[^.?!]+$)/g;
  const rawSentences = protectedText.match(sentenceRegex) || [protectedText];

  const chunks: string[] = [];

  for (const rawSentence of rawSentences) {
    // Restore protected dots
    const sentence = rawSentence.replace(/__DOT__/g, ".").trim();
    if (!sentence) continue;

    const words = sentence.split(/\s+/);

    // If the sentence is short to moderate in length (<= maxWordsPerChunk),
    // preserve it as a unified, natural prosodic unit without artificial fragmentation.
    if (words.length <= maxWordsPerChunk) {
      chunks.push(sentence);
      continue;
    }

    // 3. Secondary split for very long compound sentences (> maxWordsPerChunk):
    // Split along major grammatical clause boundaries (; : — or coordinating conjunctions)
    const clauseRegex = /([^;:]+[;:]|[^—]+—|[^,]+,\s*(?:and|but|or|yet|so)\b|[^,]+,|.+$)/gi;
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
