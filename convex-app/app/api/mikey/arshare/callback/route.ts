import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Arshare OAuth callback
 * GET /api/mikey/arshare/callback?code=xxx&state=userId
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId from connect route

    if (!code) {
      return NextResponse.redirect("/mikey?error=no_code");
    }

    // 1. Verify user is authenticated and matches state
    const { userId } = await auth();
    if (!userId || userId !== state) {
      return NextResponse.redirect("/mikey?error=unauthorized");
    }

    // 2. Exchange code for access token
    const arshareClientId = process.env.ARSHARE_CLIENT_ID;
    const arshareClientSecret = process.env.ARSHARE_CLIENT_SECRET;

    if (!arshareClientId || !arshareClientSecret) {
      return NextResponse.redirect("/mikey?error=config_missing");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const callbackUrl = `${appUrl}/api/mikey/arshare/callback`;

    const tokenResponse = await fetch("https://api.arshare.io/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: arshareClientId,
        client_secret: arshareClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("[Arshare Callback] Token exchange error:", errorText);
      return NextResponse.redirect("/mikey?error=token_exchange_failed");
    }

    const tokenData = await tokenResponse.json();
    const { access_token, account_id, username } = tokenData;

    if (!access_token || !account_id || !username) {
      console.error("[Arshare Callback] Missing token data:", tokenData);
      return NextResponse.redirect("/mikey?error=invalid_token_response");
    }

    // 3. Save Instagram account to database
    await convex.mutation(api.mikey.mutations.addInstagramAccount, {
      username,
      arshareAccountId: account_id,
      arshareAccessToken: access_token, // TODO: Encrypt in production
      maxUsers: 95,
      createdBy: userId,
    });

    // 4. Set up webhook
    const webhookUrl = `${appUrl}/api/mikey/arshare/webhook`;
    const webhookResponse = await fetch(`https://api.arshare.io/v1/accounts/${account_id}/webhooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["message.received"],
      }),
    });

    if (!webhookResponse.ok) {
      console.error("[Arshare Callback] Webhook setup failed:", await webhookResponse.text());
      // Don't fail the whole flow - account was still added
    }

    // 5. Redirect back to Mikey dashboard
    return NextResponse.redirect("/mikey?success=account_added");
  } catch (error: any) {
    console.error("[Arshare Callback] Error:", error);
    return NextResponse.redirect(`/mikey?error=${encodeURIComponent(error.message)}`);
  }
}
