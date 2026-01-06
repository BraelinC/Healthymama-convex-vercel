import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Manual Webhook Registration Endpoint
 * Use this to register webhooks for existing profiles that were created before the auto-registration code
 */
export async function POST(request: NextRequest) {
  try {
    // Check auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if admin
    const user = await convex.query(api.users.queries.getUserById, { userId });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;
    const WEBHOOK_URL = "https://fearless-goldfinch-827.convex.site/mikey/webhook";

    if (!AYRSHARE_API_KEY) {
      return NextResponse.json(
        { error: "AYRSHARE_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Get body - can specify profileKey or auto-detect from user
    const body = await request.json();
    let profileKey = body.profileKey;

    // If no profileKey provided, get from user's profile
    if (!profileKey) {
      const userProfile = await convex.query(api.users.queries.getUserProfile, { userId });
      profileKey = userProfile?.ayrshareProfileKey;

      if (!profileKey) {
        return NextResponse.json(
          { error: "No profileKey found. Either provide profileKey in body or connect Instagram first." },
          { status: 400 }
        );
      }
    }

    console.log(`[Manual Webhook Registration] Registering for profile: ${profileKey}`);

    // Register webhook
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

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Manual Webhook Registration] Failed:`, data);
      return NextResponse.json(
        { error: "Webhook registration failed", details: data },
        { status: response.status }
      );
    }

    console.log("[Manual Webhook Registration] Success:", data);

    return NextResponse.json({
      success: true,
      message: "Webhook registered successfully",
      profileKey,
      data,
    });

  } catch (error: any) {
    console.error("[Manual Webhook Registration] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
