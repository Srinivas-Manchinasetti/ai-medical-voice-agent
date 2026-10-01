import { kokoroService } from "../lib/audio/kokoro-service";
import { splitIntoSpeechChunks } from "../lib/audio/sentence-splitter";

async function investigateTurn10() {
  console.log("================================================================================");
  console.log("                   TURN 10 BUFFER LEAD & TIMING INVESTIGATION                  ");
  console.log("================================================================================\n");

  await kokoroService.warmup("dr-sarah-chen");

  const turn10Text = "You're very welcome. Please seek prompt emergency care if you develop any difficulty swallowing your own saliva, high fever, or stiff neck. Take care and rest well.";
  const chunks = splitIntoSpeechChunks(turn10Text, 24);

  console.log(`Turn 10 text: "${turn10Text}"`);
  console.log(`Generated ${chunks.length} chunks:`);
  chunks.forEach((c, idx) => console.log(`  [Chunk ${idx}] (${c.split(/\s+/).length} words): "${c}"`));

  console.log("\nSynthesizing each chunk individually to measure exact duration and latency...");
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
      rtf: Math.round((lat / (res.durationSec * 1000)) * 100) / 100,
    });
  }

  console.table(chunkAudios);

  console.log("\nSimulating Sequential Synthesis vs. Pipelined Playback:");
  // In single-thread Node.js or sequential server execution:
  // Chunk 0 synthesizes: takes c0.latencyMs
  // Chunk 0 playback begins immediately at t = c0.latencyMs
  // Chunk 0 playback ends at t = c0.latencyMs + c0.durationMs
  // Chunk 1 synthesis starts at t = c0.latencyMs (when Chunk 0 finished synthesis)
  // Chunk 1 synthesis finishes at t = c0.latencyMs + c1.latencyMs
  const c0 = chunkAudios[0];
  const c1 = chunkAudios[1];

  const t_chunk0_ready = c0.latencyMs;
  const t_chunk0_play_end = c0.latencyMs + c0.durationMs;
  const t_chunk1_ready = c0.latencyMs + c1.latencyMs;

  const bufferLead = t_chunk0_play_end - t_chunk1_ready;
  const gap = t_chunk1_ready - t_chunk0_play_end;

  console.log(`• Chunk 0 ready (voice start): ${t_chunk0_ready} ms`);
  console.log(`• Chunk 0 playback finishes:  ${t_chunk0_play_end} ms (duration: ${c0.durationMs} ms)`);
  console.log(`• Chunk 1 synthesis finishes: ${t_chunk1_ready} ms (latency: ${c1.latencyMs} ms)`);
  console.log(`• Buffer Lead Time:           ${bufferLead >= 0 ? `+${bufferLead} ms (Healthy)` : `${bufferLead} ms (Starvation)`}`);
  if (gap > 0) {
    console.log(`• Audible Playback Gap:       ${gap} ms`);
  } else {
    console.log(`• Audible Playback Gap:       0 ms (Continuous seamless transition)`);
  }
}

investigateTurn10().catch(console.error);
