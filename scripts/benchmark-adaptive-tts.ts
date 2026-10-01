import { splitIntoSpeechChunks } from "../lib/audio/sentence-splitter";
import { kokoroService } from "../lib/audio/kokoro-service";

interface BenchmarkCase {
  id: string;
  name: string;
  text: string;
}

const CASES: BenchmarkCase[] = [
  {
    id: "words5",
    name: "5 words (Short Single)",
    text: "Do you have a fever?"
  },
  {
    id: "words10",
    name: "10 words (Medium Single)",
    text: "I understand you are having severe discomfort in your chest."
  },
  {
    id: "words16",
    name: "16 words (Moderate Compound)",
    text: "Based on what you have told me, let us go through a few more quick questions."
  },
  {
    id: "words22",
    name: "22 words (Case A)",
    text: "Based on what you have told me, I want to ask you a few more questions before we decide what level of care you need."
  },
  {
    id: "words21",
    name: "21 words (Case B)",
    text: "You do not have a fever, but because you are having difficulty breathing, I want you to seek urgent medical attention."
  },
  {
    id: "caseC",
    name: "12 words (Case C)",
    text: "Your pain is 8 out of 10 and started two days ago."
  },
  {
    id: "caseD",
    name: "9 words (Case D)",
    text: "Please do not drive yourself. Call emergency services now."
  },
  {
    id: "turn10",
    name: "27 words (Turn 10 multi-sentence)",
    text: "You're very welcome. Please seek prompt emergency care if you develop any difficulty swallowing your own saliva, high fever, or stiff neck. Take care and rest well."
  },
  {
    id: "longWarning",
    name: "41 words (Long Safety Warning)",
    text: "A sudden weakness in your arm or facial drooping are critical signs that blood flow to part of the brain has been disrupted. Because time is critical to prevent permanent damage, you must seek emergency medical care right now without delay."
  }
];

async function runBenchmark() {
  console.log("================================================================================");
  console.log("       ADAPTIVE FIRST-CHUNK TTS BENCHMARK & STARVATION EVALUATION               ");
  console.log("================================================================================\n");

  await kokoroService.warmup("dr-sarah-chen");

  const results: any[] = [];

  for (const c of CASES) {
    const chunks = splitIntoSpeechChunks(c.text);
    console.log(`\nEvaluating [${c.id}] ${c.name}:`);
    console.log(`  Text: "${c.text}"`);
    console.log(`  Split into ${chunks.length} chunks:`);
    chunks.forEach((chunk, i) => console.log(`    [Chunk ${i}] (${chunk.split(/\s+/).length} words): "${chunk}"`));

    // Synthesize each chunk
    const chunkAudios = [];
    for (let i = 0; i < chunks.length; i++) {
      const t0 = performance.now();
      const res = await kokoroService.synthesize(chunks[i], { doctorId: "dr-sarah-chen" });
      const lat = Math.round(performance.now() - t0);
      chunkAudios.push({
        idx: i,
        words: chunks[i].split(/\s+/).length,
        latencyMs: lat,
        durationSec: res.durationSec,
        durationMs: Math.round(res.durationSec * 1000),
      });
    }

    // Playback timing calculation:
    // Chunk 0:
    // TTFA = chunk0.latencyMs
    // Playback ends at = chunk0.latencyMs + chunk0.durationMs
    // Chunk 1 finishes synthesis at = chunk0.latencyMs + chunk1.latencyMs
    // Buffer lead for Chunk 1 = (chunk0.latencyMs + chunk0.durationMs) - (chunk0.latencyMs + chunk1.latencyMs)
    //                         = chunk0.durationMs - chunk1.latencyMs
    const c0 = chunkAudios[0];
    const ttfa = c0.latencyMs;
    const dur0 = c0.durationMs;

    let minBufferLead = 999999;
    let maxStarvation = 0;
    let cumulativePlayhead = ttfa + dur0;
    let cumulativeSynthesis = ttfa;

    if (chunkAudios.length > 1) {
      for (let i = 1; i < chunkAudios.length; i++) {
        const prev = chunkAudios[i - 1];
        const cur = chunkAudios[i];
        cumulativeSynthesis += cur.latencyMs;

        const lead = cumulativePlayhead - cumulativeSynthesis;
        if (lead < minBufferLead) minBufferLead = lead;
        if (lead < 0) {
          const starvation = Math.abs(lead);
          if (starvation > maxStarvation) maxStarvation = starvation;
          // Playhead is delayed by starvation
          cumulativePlayhead = cumulativeSynthesis + cur.durationMs;
        } else {
          cumulativePlayhead += cur.durationMs;
        }
      }
    } else {
      minBufferLead = dur0; // No second chunk, full buffer
    }

    const totalPlaybackMs = cumulativePlayhead;

    results.push({
      "Case": c.name,
      "Chunks": chunks.length,
      "C0 Words": c0.words,
      "TTFA (ms)": ttfa,
      "C0 Dur (s)": Number((dur0 / 1000).toFixed(2)),
      "C1 Lat (ms)": chunkAudios.length > 1 ? chunkAudios[1].latencyMs : "N/A",
      "Min Lead (ms)": minBufferLead,
      "Starvation (ms)": maxStarvation,
      "Total Play (s)": Number((totalPlaybackMs / 1000).toFixed(2)),
    });
  }

  console.log("\n================================================================================");
  console.log("                              SUMMARY RESULTS                                   ");
  console.log("================================================================================");
  console.table(results);
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
