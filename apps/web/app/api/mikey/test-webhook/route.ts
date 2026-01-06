import { NextResponse } from "next/server";

/**
 * Test Webhook Endpoint
 * Simulates an incoming Instagram DM to test if the webhook is properly configured
 * POST /api/mikey/test-webhook
 */
export async function POST(request: Request) {
  try {
    // Convex HTTP endpoints use .site domain, not .cloud
    // Convert https://fearless-goldfinch-827.convex.cloud to https://fearless-goldfinch-827.convex.site
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({
        success: false,
        message: "NEXT_PUBLIC_CONVEX_URL not configured"
      }, { status: 500 });
    }

    const WEBHOOK_URL = convexUrl.replace(".cloud", ".site").replace("/api", "") + "/mikey/webhook";

    console.log("[Test Webhook] Sending test message to:", WEBHOOK_URL);

    // Simulate an Ayrshare webhook payload
    const testPayload = {
      action: "messages",
      subAction: "messageCreated",
      type: "message.received",
      platform: "instagram",
      refId: "test-profile",
      profileKey: "test-profile",
      messageId: `test-${Date.now()}`,
      conversationId: `test-conv-${Date.now()}`,
      message: {
        text: "🧪 TEST MESSAGE - This is a test from the Mikey dashboard"
      },
      senderDetails: {
        id: "test-sender-id",
        username: "test_user",
      },
    };

    // Send to webhook endpoint
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    const responseText = await response.text();
    console.log("[Test Webhook] Response status:", response.status);
    console.log("[Test Webhook] Response body:", responseText);

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: `Webhook responded with ${response.status}: ${responseText}`
      }, { status: 200 }); // Return 200 so frontend can show error in toast
    }

    return NextResponse.json({
      success: true,
      message: "✅ Test webhook sent successfully! Check Convex logs for processing details."
    });

  } catch (error: any) {
    console.error("[Test Webhook] Error:", error);
    return NextResponse.json({
      success: false,
      message: `Error: ${error.message}`
    }, { status: 200 }); // Return 200 so frontend can show error in toast
  }
}
