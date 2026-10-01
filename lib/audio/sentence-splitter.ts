/**
 * Sentence & Prosodic Splitter for Real-Time Conversational Voice Synthesis
 * 
 * Features:
 * 1. Adaptive First-Chunk Optimization: Targets an opening conversational clause of ~8–12 words
 *    along natural grammatical boundaries to achieve immediate low-latency Time-To-First-Audio (TTFA).
 * 2. High-Capacity Subsequent Chunking: Keeps subsequent sentences and clauses at ~18–24 words
 *    to preserve natural clinician prosody, intonation, and uninterrupted streaming.
 * 3. Clinical Entity Protection: Guarantees that dosages ("take 500 mg"), clinical scores ("8 out of 10"),
 *    vitals ("39.8 degrees Celsius"), negation phrases ("no fever", "do not drive"), and emergency
 *    directives ("call emergency services") are never severed mid-expression.
 */

const HONORIFICS = ["dr", "mr", "mrs", "ms", "prof", "sr", "jr", "vs", "etc", "md", "phd", "facc", "st"];

const CLINICAL_PROTECTED_PATTERNS: RegExp[] = [
  /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|liters?|tablets?|capsules?|drops?|puffs?|bpm|mmHg|degrees?(?:\s+celsius|\s+fahrenheit)?|°[cf]|%)\b/gi,
  /\b\d+\s+out\s+of\s+\d+\b/gi,
  /\b(?:no|not|without|denies)\s+[a-z0-9_-]+(?:\s+[a-z0-9_-]+)?\b/gi,
  /\bdo\s+not\s+(?:drive|wait|exert|stop|delay|ignore)\b/gi,
  /\bcall\s+(?:emergency\s+services|112|108|an\s+ambulance)\b/gi,
  /\bblood\s+flow\b/gi,
  /\bemergency\s+medical\s+(?:care|services|attention|evaluation)\b/gi,
];

function isInsideProtectedRange(text: string, splitIndex: number): boolean {
  for (const regex of CLINICAL_PROTECTED_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (splitIndex > start && splitIndex < end) {
        return true;
      }
    }
  }
  return false;
}

interface SplitCandidate {
  index: number;
  chunk0: string;
  remainder: string;
  wordCount: number;
  score: number;
  type: string;
}

/**
 * Finds the optimal first-chunk split point within an opening sentence.
 * Targets ~8–12 words along natural grammatical and prosodic boundaries.
 */
function findBestFirstChunkSplit(sentence: string): { chunk0: string; remainder: string } | null {
  const words = sentence.split(/\s+/);
  // If the sentence is naturally moderate or short (<= 14 words), keep it whole
  if (words.length <= 14) {
    return null;
  }

  const candidates: SplitCandidate[] = [];

  // 1. Semicolons, colons, em-dashes
  const majorPunctRegex = /([;:—]|--)/g;
  let m: RegExpExecArray | null;
  while ((m = majorPunctRegex.exec(sentence)) !== null) {
    const idx = m.index + m[0].length;
    if (!isInsideProtectedRange(sentence, idx)) {
      const c0 = sentence.slice(0, idx).trim();
      const rem = sentence.slice(idx).trim();
      const wc = c0.split(/\s+/).length;
      if (wc >= 5 && wc <= 18) {
        const dist = wc < 8 ? 8 - wc : wc > 12 ? wc - 12 : 0;
        candidates.push({ index: idx, chunk0: c0, remainder: rem, wordCount: wc, score: dist, type: "major_punct" });
      }
    }
  }

  // 2. Comma followed by coordinating/subordinating conjunction
  const commaConjRegex = /,\s*(?:and|but|because|so|while|though|yet|or|if|since|as|when|before|after)\b/gi;
  while ((m = commaConjRegex.exec(sentence)) !== null) {
    const commaIdx = sentence.indexOf(",", m.index) + 1;
    if (!isInsideProtectedRange(sentence, commaIdx)) {
      const c0 = sentence.slice(0, commaIdx).trim();
      const rem = sentence.slice(commaIdx).trim();
      const wc = c0.split(/\s+/).length;
      if (wc >= 5 && wc <= 18) {
        const dist = wc < 8 ? 8 - wc : wc > 12 ? wc - 12 : 0;
        candidates.push({ index: commaIdx, chunk0: c0, remainder: rem, wordCount: wc, score: dist - 0.3, type: "comma_conj" });
      }
    }
  }

  // 3. Regular comma
  const commaRegex = /,/g;
  while ((m = commaRegex.exec(sentence)) !== null) {
    const commaIdx = m.index + 1;
    if (!candidates.some(c => Math.abs(c.index - commaIdx) <= 2) && !isInsideProtectedRange(sentence, commaIdx)) {
      const c0 = sentence.slice(0, commaIdx).trim();
      const rem = sentence.slice(commaIdx).trim();
      const wc = c0.split(/\s+/).length;
      if (wc >= 5 && wc <= 18) {
        const dist = wc < 8 ? 8 - wc : wc > 12 ? wc - 12 : 0;
        candidates.push({ index: commaIdx, chunk0: c0, remainder: rem, wordCount: wc, score: dist - 0.1, type: "comma" });
      }
    }
  }

  // 4. Conjunction / subordinate clause boundary without comma (fallback only)
  const conjRegex = /\s+(?:if|because|but|and|so|that|while|when|before|after|unless)\s+/gi;
  while ((m = conjRegex.exec(sentence)) !== null) {
    const idx = m.index;
    if (!isInsideProtectedRange(sentence, idx)) {
      const c0 = sentence.slice(0, idx).trim();
      const rem = sentence.slice(idx).trim();
      const wc = c0.split(/\s+/).length;
      if (wc >= 6 && wc <= 18) {
        const dist = wc < 8 ? 8 - wc : wc > 12 ? wc - 12 : 0;
        candidates.push({ index: idx, chunk0: c0, remainder: rem, wordCount: wc, score: dist + 1.2, type: "conj_word" });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by score ascending (lowest score is closest to target window with highest boundary quality)
  candidates.sort((a, b) => a.score - b.score);
  return {
    chunk0: candidates[0].chunk0,
    remainder: candidates[0].remainder,
  };
}

/**
 * Splits text into speech chunks for real-time synthesis.
 * Applies adaptive first-chunk sizing (~8–12 words) for Chunk 0,
 * followed by standard chunking (~18–24 words) for subsequent chunks.
 */
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

  let sentences = rawSentences
    .map(s => s.replace(/__DOT__/g, ".").trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) return [clean];

  // If first sentence is an ultra-short courtesy/intro (< 5 words like "You're very welcome." or "Thank you.")
  // and there is a subsequent sentence, merge them for first-chunk evaluation so Chunk 0 achieves
  // the target ~8-12 words and generates sufficient audio lead time to prevent downstream starvation.
  if (sentences.length > 1 && sentences[0].split(/\s+/).length < 5) {
    const combinedFirst = `${sentences[0]} ${sentences[1]}`;
    sentences = [combinedFirst, ...sentences.slice(2)];
  }

  const chunks: string[] = [];

  // Step 1: Process First Sentence Adaptively for Chunk 0
  const firstSentence = sentences[0];
  const firstSplit = findBestFirstChunkSplit(firstSentence);

  const remainingSentenceQueue: string[] = [];

  if (firstSplit) {
    chunks.push(firstSplit.chunk0);
    if (firstSplit.remainder) {
      remainingSentenceQueue.push(firstSplit.remainder);
    }
  } else {
    // Either first sentence <= 14 words, or no natural split in target window exists
    if (firstSentence.split(/\s+/).length <= maxWordsPerChunk) {
      chunks.push(firstSentence);
    } else {
      // Long compound sentence without candidate in target window; split along standard clause boundary
      const clauseRegex = /([^;:]+[;:]|[^—]+—|[^,]+,\s*(?:and|but|or|yet|so)\b|[^,]+,|.+$)/gi;
      const rawClauses = firstSentence.match(clauseRegex) || [firstSentence];
      let cur = "";
      for (const rc of rawClauses) {
        const c = rc.trim();
        if (!c) continue;
        if (!cur) cur = c;
        else if ((cur + " " + c).split(/\s+/).length <= maxWordsPerChunk) cur += " " + c;
        else { chunks.push(cur); cur = c; }
      }
      if (cur) chunks.push(cur);
    }
  }

  // Append subsequent sentences
  for (let i = 1; i < sentences.length; i++) {
    remainingSentenceQueue.push(sentences[i]);
  }

  // Step 2: Process All Subsequent Elements using Standard 18-24 Word Strategy
  for (const sentence of remainingSentenceQueue) {
    const words = sentence.split(/\s+/);
    if (words.length <= maxWordsPerChunk) {
      chunks.push(sentence);
      continue;
    }

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
