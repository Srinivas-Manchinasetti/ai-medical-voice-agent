import { NextResponse } from "next/server";
import { kokoroService, resolveAuthoritativeVoice } from "@/lib/audio/kokoro-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, doctorId = "dr-sarah-chen", speed = 1.0 } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text parameter is required." }, { status: 400 });
    }

    // Server-authoritative voice resolution: client cannot override persona voice
    const authoritativeVoice = resolveAuthoritativeVoice(doctorId);

    const result = await kokoroService.synthesize(text, {
      doctorId,
      speed,
    });

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": result.buffer.length.toString(),
        "X-TTS-Doctor-Id": doctorId,
        "X-TTS-Voice": authoritativeVoice,
        "X-TTS-Latency-Ms": result.latencyMs.toString(),
        "X-TTS-Duration-Sec": result.durationSec.toFixed(2),
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err: any) {
    console.error("[Kokoro TTS Route Error]:", err?.message || err);
    return NextResponse.json(
      {
        error: err?.message || "Failed to synthesize speech via Kokoro TTS.",
        fallbackRequired: true,
      },
      { status: 500 }
    );
  }
}
