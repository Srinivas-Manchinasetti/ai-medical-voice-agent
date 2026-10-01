import { kokoroService } from "../lib/audio/kokoro-service";

async function testColdStartBreakdown() {
  console.log("================================================================================");
  console.log("             KOKORO COLD-START INFERENCE DECOMPOSITION BENCHMARK               ");
  console.log("================================================================================\n");

  const mem0 = process.memoryUsage();
  console.log(`[Baseline Memory] RSS: ${Math.round(mem0.rss / 1024 / 1024)} MB | Heap: ${Math.round(mem0.heapUsed / 1024 / 1024)} MB`);

  // Phase 1: ONNX Model Loading from Disk Cache
  console.log("\n[Phase 1] KokoroTTS.from_pretrained() model loading...");
  const t0 = performance.now();
  const tts = await kokoroService.getModel();
  const tModelLoaded = performance.now();
  const modelLoadMs = Math.round(tModelLoaded - t0);
  const mem1 = process.memoryUsage();
  console.log(`✓ Model file read & ONNX graph constructed: ${modelLoadMs} ms`);
  console.log(`  Memory delta: +${Math.round((mem1.rss - mem0.rss) / 1024 / 1024)} MB RSS`);

  // Phase 2: First-Ever Dummy Synthesis (Cold Runtime Initialization)
  console.log("\n[Phase 2] First-ever dummy generation ('hello') to trigger voice tensor load & ONNX memory allocation...");
  const t1 = performance.now();
  await tts.generate("hello", { voice: "af_sarah" as any, speed: 0.96 });
  const tFirstGen = performance.now();
  const dummyGenMs = Math.round(tFirstGen - t1);
  const mem2 = process.memoryUsage();
  console.log(`✓ Cold JIT / memory buffer allocation / voice embedding load: ${dummyGenMs} ms`);
  console.log(`  Memory delta: +${Math.round((mem2.rss - mem1.rss) / 1024 / 1024)} MB RSS`);

  // Phase 3: Actual Turn 1 Chunk 0 Synthesis (Warm State)
  const turn1Chunk0Text = "Hello, I'm glad you reached out. I'd like to understand what you're experiencing";
  console.log(`\n[Phase 3] Turn 1 Chunk 0 synthesis ("${turn1Chunk0Text}")...`);
  const t2 = performance.now();
  const res = await kokoroService.synthesize(turn1Chunk0Text, { doctorId: "dr-sarah-chen" });
  const turn1Ms = Math.round(performance.now() - t2);
  console.log(`✓ Turn 1 Chunk 0 synthesis: ${turn1Ms} ms (Audio duration: ${res.durationSec.toFixed(2)}s)`);

  // Phase 4: Subsequent Short Query ("Do you have a fever?")
  const shortText = "Do you have a fever?";
  console.log(`\n[Phase 4] Short query synthesis ("${shortText}")...`);
  const t3 = performance.now();
  const resShort = await kokoroService.synthesize(shortText, { doctorId: "dr-sarah-chen" });
  const shortMs = Math.round(performance.now() - t3);
  console.log(`✓ Short query synthesis: ${shortMs} ms (Audio duration: ${resShort.durationSec.toFixed(2)}s)`);

  console.log("\n================================================================================");
  console.log("                        DECOMPOSITION SUMMARY REPORT                             ");
  console.log("================================================================================\n");
  console.table({
    "1. Model Graph Init": `${modelLoadMs} ms`,
    "2. Cold Voice/Buffer Allocation": `${dummyGenMs} ms`,
    "3. Turn 1 (Post-Warmup)": `${turn1Ms} ms`,
    "4. Short Turn (Post-Warmup)": `${shortMs} ms`,
    "Total Cold TTFA without Prewarm": `${modelLoadMs + dummyGenMs + turn1Ms} ms`,
    "Total Warm TTFA with Prewarm": `${turn1Ms} ms`,
    "Latency Saved by Background Prewarm": `${modelLoadMs + dummyGenMs} ms`,
    "Net Memory Impact (RSS)": `${Math.round((mem2.rss - mem0.rss) / 1024 / 1024)} MB`,
  });
}

testColdStartBreakdown().catch(console.error);
