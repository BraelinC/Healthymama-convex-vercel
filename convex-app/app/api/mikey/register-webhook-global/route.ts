import { NextResponse } from "next/server";

/**
 * Register webhook at ACCOUNT level (not per profile)
 * This should work for ALL Instagram profiles under your Ayrshare account
 * POST /api/mikey/register-webhook-global
 */
export async function POST(request: Request) {
  try {
    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    // Build webhook URL from Convex deployment URL
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({
        success: false,
        error: "NEXT_PUBLIC_CONVEX_URL not configured"
      }, { status: 500 });
    }

    const WEBHOOK_URL = convexUrl.replace(".cloud", ".site").replace("/api", "") + "/mikey/webhook";

    if (!AYRSHARE_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "AYRSHARE_API_KEY not configured"
      }, { status: 500 });
    }

    console.log("[Register Global Webhook] Registering webhook at ACCOUNT level");
    console.log("[Register Global Webhook] Webhook URL:", WEBHOOK_URL);

    // Register webhook WITHOUT Profile-Key header (account-level)
    const response = await fetch(`${AYRSHARE_BASE_URL}/api/hook/webhook`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
        "Content-Type": "application/json",
        // NOTE: NO Profile-Key header - this makes it account-wide
      },
      body: JSON.stringify({
        action: "messages",
        url: WEBHOOK_URL,
      }),
    });

    const responseText = await response.text();
    console.log("[Register Global Webhook] Response status:", response.status);
    console.log("[Register Global Webhook] Response body:", responseText);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Registration failed: ${response.status} - ${responseText}`
      }, { status: 200 });
    }

    const data = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      message: "✅ Webhook registered at account level - should work for ALL Instagram accounts",
      data
    });

  } catch (error: any) {
    console.error("[Register Global Webhook] Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 200 });
  }
}
