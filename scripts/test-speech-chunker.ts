import { splitIntoSpeechChunks } from "../lib/audio/sentence-splitter";

function assertEqual(actual: string[], expected: string[], desc: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`  ✓ ${desc}`);
  } else {
    console.error(`  ❌ ${desc}`);
    console.error(`     Expected: ${expectedStr}`);
    console.error(`     Actual:   ${actualStr}`);
    throw new Error(`Test failed: ${desc}`);
  }
}

console.log("=== Speech Chunk Splitter Tests (Prosody-First) ===");

// 1. Short response (1 chunk)
assertEqual(
  splitIntoSpeechChunks("Do you have a fever?"),
  ["Do you have a fever?"],
  "Short single question remains 1 intact chunk"
);

// 2. Medium compound question (1 chunk, preserved natural prosody)
assertEqual(
  splitIntoSpeechChunks("When did the sore throat begin, and has it been getting better or worse?"),
  ["When did the sore throat begin, and has it been getting better or worse?"],
  "Medium compound question remains whole (14 words <= 18 words)"
);

// 3. Clinical multi-sentence response (2 chunks at sentence boundary)
assertEqual(
  splitIntoSpeechChunks("You mentioned that the pain started two days ago. I'd like to clarify whether you're having any difficulty swallowing liquids or saliva."),
  [
    "You mentioned that the pain started two days ago.",
    "I'd like to clarify whether you're having any difficulty swallowing liquids or saliva."
  ],
  "Clinical multi-sentence response splits cleanly along sentence boundary"
);

// 4. Complex clinical triage response (2 chunks at sentence boundary)
assertEqual(
  splitIntoSpeechChunks("Based on what you've told me, I want to ask a few more questions before we decide what level of care you need. First, are you having any difficulty breathing, swallowing liquids, or managing your saliva?"),
  [
    "Based on what you've told me, I want to ask a few more questions before we decide what level of care you need.",
    "First, are you having any difficulty breathing, swallowing liquids, or managing your saliva?"
  ],
  "Complex multi-clause triage response splits at sentence boundary"
);

// 5. Preserves doctor honorifics
assertEqual(
  splitIntoSpeechChunks("Hello, I am Dr. Sarah Chen. What symptoms brought you in today?"),
  [
    "Hello, I am Dr. Sarah Chen.",
    "What symptoms brought you in today?"
  ],
  "Doctor honorific Dr. Sarah Chen is preserved"
);

console.log("✅ All prosody-first chunk splitter tests passed successfully!");
