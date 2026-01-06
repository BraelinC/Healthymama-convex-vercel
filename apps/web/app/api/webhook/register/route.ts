import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook Registration API Route
 * Registers webhook with Ayrshare for a given profile
 */
export async function POST(request: NextRequest) {
  try {
    console.log("[Webhook API] ========================================");
    console.log("[Webhook API] WEBHOOK REGISTRATION REQUEST RECEIVED");

    const { profileKey } = await request.json();
    console.log("[Webhook API] Profile Key:", profileKey);

    if (!profileKey) {
      console.error("[Webhook API] ❌ No profileKey provided");
      return NextResponse.json(
        { error: "profileKey is required" },
        { status: 400 }
      );
    }

    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;
    const WEBHOOK_URL = "https://fearless-goldfinch-827.convex.site/mikey/webhook";

    console.log("[Webhook API] API Key present:", !!AYRSHARE_API_KEY);
    console.log("[Webhook API] Webhook URL:", WEBHOOK_URL);

    if (!AYRSHARE_API_KEY) {
      console.error("[Webhook API] ❌ AYRSHARE_API_KEY not configured");
      return NextResponse.json(
        { error: "AYRSHARE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    console.log(`[Webhook API] Calling Ayrshare API...`);
    console.log(`[Webhook API] URL: ${AYRSHARE_BASE_URL}/api/hook/webhook`);
    console.log(`[Webhook API] Request body:`, JSON.stringify({ action: "messages", url: WEBHOOK_URL }, null, 2));

    const response = await fetch(`${AYRSHARE_BASE_URL}/api/hook/webhook`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
        "Profile-Key": profileKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "messages",
        url: WEBHOOK_URL,
      }),
    });

    console.log("[Webhook API] Ayrshare response status:", response.status, response.statusText);

    const data = await response.json();
    console.log("[Webhook API] Ayrshare response data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error(`[Webhook API] ❌ Registration failed`);
      console.error(`[Webhook API] Status: ${response.status}`);
      console.error(`[Webhook API] Data:`, data);
      return NextResponse.json(
        { error: "Webhook registration failed", details: data },
        { status: response.status }
      );
    }

    console.log("[Webhook API] ✅ Registration successful!");
    console.log("[Webhook API] ========================================");
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("[Webhook API] ❌ Exception occurred:");
    console.error("[Webhook API] Error:", error.message);
    console.error("[Webhook API] Stack:", error.stack);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
