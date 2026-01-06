import { NextRequest } from "next/server";

/**
 * Generate ElevenLabs single-use token for Scribe (speech-to-text)
 * Returns a time-limited token (expires in 15 minutes) for client-side use
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      console.error("[ELEVENLABS TOKEN] Missing ELEVENLABS_API_KEY");
      return Response.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    console.log("[ELEVENLABS TOKEN] Generating single-use token for Scribe");

    // Create single-use token for realtime Scribe
    // Token expires after 15 minutes
    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ELEVENLABS TOKEN] API Error:", response.status, errorText);
      return Response.json(
        { error: "Failed to generate single-use token" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("[ELEVENLABS TOKEN] ✓ Single-use token generated successfully");

    // Return the token
    return Response.json({ token: data.token });
  } catch (error) {
    console.error("[ELEVENLABS TOKEN] Error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
