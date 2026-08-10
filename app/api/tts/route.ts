import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, language = "en" } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ status: "error", message: "Text parameter is required." }, { status: 400 });
    }

    const res = await fetch(`${BACKEND_URL}/api/v1/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });

    if (res.ok) {
      const audioBuffer = await res.arrayBuffer();
      return new Response(audioBuffer, {
        headers: { "Content-Type": "audio/mpeg" },
      });
    }

    return NextResponse.json({ status: "error", message: "TTS synthesis failed" }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ status: "error", message: error?.message || "Server error" }, { status: 500 });
  }
}
