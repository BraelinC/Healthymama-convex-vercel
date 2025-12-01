import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Refresh status endpoint - fetches Instagram accounts from Ayrshare
 * POST /api/mikey/arshare/refresh-status
 *
 * This endpoint calls Ayrshare's /api/user endpoint to fetch connected accounts
 * for a specific profile. This is the pattern used by the Kev codebase instead of webhooks.
 */
export async function POST(request: Request) {
  try {
    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    console.log("[Refresh Status] === STARTING REFRESH STATUS ===");
    console.log(`[Refresh Status] API Key present: ${!!AYRSHARE_API_KEY}`);
    console.log(`[Refresh Status] API Key prefix: ${AYRSHARE_API_KEY?.substring(0, 8)}...`);

    if (!AYRSHARE_API_KEY) {
      console.error("[Refresh Status] ERROR: AYRSHARE_API_KEY not configured");
      return NextResponse.json({ error: "AYRSHARE_API_KEY not configured" }, { status: 500 });
    }

    // Get profileKey and refId from request body
    const { profileKey, refId } = await request.json();

    console.log(`[Refresh Status] Request body - profileKey: ${profileKey}`);
    console.log(`[Refresh Status] Request body - refId: ${refId}`);

    if (!profileKey) {
      console.error("[Refresh Status] ERROR: profileKey is missing");
      return NextResponse.json({ error: "profileKey is required" }, { status: 400 });
    }

    console.log(`[Refresh Status] === CALLING AYRSHARE API ===`);
    console.log(`[Refresh Status] URL: ${AYRSHARE_BASE_URL}/api/user`);
    console.log(`[Refresh Status] Profile-Key: ${profileKey}`);

    // Call Ayrshare /api/user endpoint with Profile-Key header
    const userResponse = await fetch(`${AYRSHARE_BASE_URL}/api/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AYRSHARE_API_KEY}`,
        "Profile-Key": profileKey,
        "Content-Type": "application/json",
      },
    });

    console.log(`[Refresh Status] Response status: ${userResponse.status} ${userResponse.statusText}`);

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error(`[Refresh Status] Failed to fetch user for profile ${profileKey}:`, errorText);
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
    }

    const userData = await userResponse.json();

    console.log(`[Refresh Status] === PARSING RESPONSE ===`);
    console.log(`[Refresh Status] Response keys:`, Object.keys(userData));
    console.log(`[Refresh Status] Has displayNames: ${!!userData.displayNames}`);
    console.log(`[Refresh Status] Has activeSocialAccounts: ${!!userData.activeSocialAccounts}`);
    console.log(`[Refresh Status] displayNames type:`, typeof userData.displayNames);
    console.log(`[Refresh Status] displayNames length:`, userData.displayNames?.length);
    console.log(`[Refresh Status] Full user data:`, JSON.stringify(userData, null, 2));

    // Check if displayNames exists
    if (!userData.displayNames || userData.displayNames.length === 0) {
      console.log("[Refresh Status] === NO ACCOUNTS FOUND ===");
      console.log("[Refresh Status] WARNING: No displayNames found in user data");
      console.log("[Refresh Status] This means no social accounts have been connected yet");
      console.log("[Refresh Status] Profile title:", userData.title);
      console.log("[Refresh Status] Profile refId:", userData.refId);
      console.log("[Refresh Status] lastUpdated:", userData.lastUpdated);
      console.log("[Refresh Status] nextUpdate:", userData.nextUpdate);

      return NextResponse.json({
        success: false,
        error: "No social accounts connected",
        message: "No Instagram account was found. Make sure you clicked 'Connect Instagram' in the Ayrshare popup and logged into Instagram.",
        userData: userData,
      }, { status: 200 }); // Return 200 to avoid error, but indicate failure
    }

    // Extract Instagram accounts from displayNames[]
    const instagramAccounts = (userData.displayNames || []).filter(
      (account: any) => account.platform === "instagram"
    );

    console.log(`[Refresh Status] displayNames array:`, JSON.stringify(userData.displayNames, null, 2));
    console.log(`[Refresh Status] Found ${instagramAccounts.length} Instagram account(s) in profile ${profileKey}`);

    const accountsAdded = [];

    // Save each Instagram account to database
    for (const account of instagramAccounts) {
      const username = account.displayName || account.username;

      try {
        await convex.mutation(api.mikey.mutations.addInstagramAccountWithProfileKey, {
          username,
          ayrshareProfileKey: profileKey,
          ayrshareRefId: refId || "",
          maxUsers: 95,
          createdBy: "admin",
        });

        accountsAdded.push({
          username,
          profileKey,
          refId,
        });

        console.log(`[Refresh Status] Added Instagram account: ${username}`);
      } catch (error: any) {
        console.error(`[Refresh Status] Error adding account ${username}:`, error.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Connected ${accountsAdded.length} Instagram account(s)`,
      accounts: accountsAdded,
    });
  } catch (error: any) {
    console.error("[Refresh Status] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
