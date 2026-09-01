import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey =
      process.env.ASSEMBLYAI_API_KEY ||
      process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        hasAssemblyKey: false,
        token: null,
        message: "No ASSEMBLYAI_API_KEY provided in environment. Using browser Web Speech recognition as fallback."
      });
    }

    // Request temporary token from AssemblyAI for WebSocket real-time transcription
    const response = await fetch("https://api.assemblyai.com/v2/realtime/token?expires_in=3600", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({
        hasAssemblyKey: false,
        error: `AssemblyAI token generation failed: ${errText}`,
        fallback: true
      });
    }

    const data = await response.json();
    return NextResponse.json({
      hasAssemblyKey: true,
      token: data.token,
      expires_in: 3600
    });
  } catch (error: any) {
    return NextResponse.json({
      hasAssemblyKey: false,
      error: error?.message || "Internal server error fetching voice token",
      fallback: true
    }, { status: 500 });
  }
}
