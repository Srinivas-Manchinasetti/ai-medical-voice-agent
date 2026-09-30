import { NextResponse } from "next/server";
import { ttsDispatcher } from "@/lib/audio/tts-dispatcher";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, doctorId = "dr-sarah-chen", speed } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text parameter is required." }, { status: 400 });
    }

    const dispatchResult = await ttsDispatcher.dispatch(text, doctorId, speed);

    // If provider is unavailable (e.g. cloud credentials not set in dev) or failed
    if (!dispatchResult.success) {
      return NextResponse.json(dispatchResult.fallback, { status: 200 });
    }

    const { audio } = dispatchResult;
    const engineLabel = audio.provider === "kokoro" ? "Kokoro" : "Azure Speech";

    return new Response(new Uint8Array(audio.buffer), {
      status: 200,
      headers: {
        "Content-Type": audio.contentType,
        "Content-Length": audio.buffer.length.toString(),
        "X-TTS-Engine": engineLabel,
        "X-TTS-Provider": audio.provider,
        "X-TTS-Doctor-Id": doctorId,
        "X-TTS-Voice": audio.voice,
        "X-TTS-Locale": audio.locale,
        "X-TTS-Latency-Ms": audio.latencyMs.toString(),
        "X-TTS-Duration-Sec": audio.durationSec.toFixed(2),
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err: any) {
    console.error("[TTS Route Critical Error]:", err?.message || err);
    return NextResponse.json(
      {
        error: err?.message || "Failed to synthesize speech.",
        fallbackRequired: true,
      },
      { status: 500 }
    );
  }
}
