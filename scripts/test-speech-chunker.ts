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

console.log("=== Speech Chunk Splitter Tests ===");

// 1. Single sentence under max limit
assertEqual(
  splitIntoSpeechChunks("I understand that swallowing has been painful for two days."),
  ["I understand that swallowing has been painful for two days."],
  "Single short sentence remains 1 chunk"
);

// 2. Compound sentence with comma split
assertEqual(
  splitIntoSpeechChunks("When you say it hurts to swallow, are you still able to swallow liquids and saliva normally?"),
  ["When you say it hurts to swallow,", "are you still able to swallow liquids and saliva normally?"],
  "Long compound sentence splits at clause boundary"
);

// 3. Multiple sentences with Dr. honorific
assertEqual(
  splitIntoSpeechChunks("Hello, I am Dr. Sarah Chen. What medical concerns or symptoms brought you in today?"),
  ["Hello, I am Dr. Sarah Chen.", "What medical concerns or symptoms brought you in today?"],
  "Honorific 'Dr. Sarah Chen' is preserved without splitting on 'Dr.'"
);

// 4. Multiple sentences
assertEqual(
  splitIntoSpeechChunks("I am documenting your sore throat. Have you experienced any high fever, shortness of breath, or chest tightness?"),
  [
    "I am documenting your sore throat.",
    "Have you experienced any high fever, shortness of breath, or chest tightness?"
  ],
  "Two natural sentences split cleanly"
);

console.log("✅ All chunk splitter tests passed successfully!");
