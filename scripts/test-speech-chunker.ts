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

console.log("=== Speech Chunk Splitter Tests (Adaptive First-Chunk & Prosody) ===");

// 1. Short response (1 chunk, never split)
assertEqual(
  splitIntoSpeechChunks("Do you have a fever?"),
  ["Do you have a fever?"],
  "Short single question remains 1 intact chunk"
);

// 2. Medium compound question (1 chunk, preserved natural prosody)
assertEqual(
  splitIntoSpeechChunks("When did the sore throat begin, and has it been getting better or worse?"),
  ["When did the sore throat begin, and has it been getting better or worse?"],
  "Medium compound question remains whole (14 words <= 14 words)"
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

// 4. Complex clinical triage response with adaptive first chunk
assertEqual(
  splitIntoSpeechChunks("Based on what you've told me, I want to ask a few more questions before we decide what level of care you need. First, are you having any difficulty breathing, swallowing liquids, or managing your saliva?"),
  [
    "Based on what you've told me,",
    "I want to ask a few more questions before we decide what level of care you need.",
    "First, are you having any difficulty breathing, swallowing liquids, or managing your saliva?"
  ],
  "Complex multi-clause triage response adapts first chunk to opening clause and preserves subsequent sentences"
);

// 5. Regression Case A: 22-word response splits opening clause adaptively
assertEqual(
  splitIntoSpeechChunks("Based on what you have told me, I want to ask you a few more questions before we decide what level of care you need."),
  [
    "Based on what you have told me,",
    "I want to ask you a few more questions before we decide what level of care you need."
  ],
  "Regression Case A: 22-word response splits opening clause for low TTFA"
);

// 6. Regression Case B: Compound warning preserves clinical clause integrity
assertEqual(
  splitIntoSpeechChunks("You do not have a fever, but because you are having difficulty breathing, I want you to seek urgent medical attention."),
  [
    "You do not have a fever, but because you are having difficulty breathing,",
    "I want you to seek urgent medical attention."
  ],
  "Regression Case B: Conjunction clause preserves negation and respiratory warning"
);

// 7. Regression Case C: Protects clinical pain score "8 out of 10"
assertEqual(
  splitIntoSpeechChunks("Your pain is 8 out of 10 and started two days ago."),
  ["Your pain is 8 out of 10 and started two days ago."],
  "Regression Case C: Pain score '8 out of 10' kept intact, short sentence unfragmented"
);

// 8. Regression Case D: Preserves "do not drive" and "emergency services"
assertEqual(
  splitIntoSpeechChunks("Please do not drive yourself. Call emergency services now."),
  [
    "Please do not drive yourself.",
    "Call emergency services now."
  ],
  "Regression Case D: Safety directives preserved along sentence boundary"
);

// 9. Regression Case E: Very short response remains intact
assertEqual(
  splitIntoSpeechChunks("Do you have a fever?"),
  ["Do you have a fever?"],
  "Regression Case E: Very short question not artificially split"
);

// 10. Preserves doctor honorifics
assertEqual(
  splitIntoSpeechChunks("Hello, I am Dr. Sarah Chen. What symptoms brought you in today?"),
  [
    "Hello, I am Dr. Sarah Chen.",
    "What symptoms brought you in today?"
  ],
  "Doctor honorific Dr. Sarah Chen is preserved"
);

console.log("✅ All adaptive first-chunk and prosody tests passed successfully!");
