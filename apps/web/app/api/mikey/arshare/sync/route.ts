import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Manual sync endpoint to fetch Instagram accounts from Ayrshare
 * GET /api/mikey/arshare/sync
 *
 * This endpoint manually queries Ayrshare for all linked Instagram accounts
 * and saves them to the database. Use this for testing when webhooks aren't available.
 */
export async function GET(request: Request) {
  try {
    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API = process.env.AYRSHARE_API_KEY;

    if (!AYRSHARE_API) {
      return NextResponse.json({ error: "AYRSHARE_API_KEY not configured" }, { status: 500 });
    }

    console.log("[Ayrshare Sync] Fetching all profiles...");

    // 1. Get all profiles
    const profilesResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AYRSHARE_API}`,
        "Content-Type": "application/json",
      },
    });

    if (!profilesResponse.ok) {
      const errorText = await profilesResponse.text();
      console.error("[Ayrshare Sync] Failed to fetch profiles:", errorText);
      return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    const profilesData = await profilesResponse.json();
    console.log("[Ayrshare Sync] Profiles response:", JSON.stringify(profilesData, null, 2));

    if (!profilesData.profiles || profilesData.profiles.length === 0) {
      return NextResponse.json({
        message: "No profiles found. Click 'Add Instagram Account' to create one.",
        profiles: []
      });
    }

    const accountsAdded = [];

    // 2. For each profile, check if it has Instagram accounts
    for (const profile of profilesData.profiles) {
      console.log("[Ayrshare Sync] Profile object:", JSON.stringify(profile, null, 2));
      const profileKey = profile.profileKey || profile.key;

      console.log(`[Ayrshare Sync] Checking profile ${profileKey}...`);

      // Get user data for this profile
      const userResponse = await fetch(`${AYRSHARE_BASE_URL}/api/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AYRSHARE_API}`,
          "Profile-Key": profileKey,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        console.error(`[Ayrshare Sync] Failed to fetch user for profile ${profileKey}`);
        continue;
      }

      const userData = await userResponse.json();
      console.log(`[Ayrshare Sync] User data for ${profileKey}:`, userData);

      // Extract Instagram accounts
      const instagramAccounts = (userData.displayNames || []).filter(
        (account: any) => account.platform === "instagram"
      );

      console.log(`[Ayrshare Sync] Found ${instagramAccounts.length} Instagram accounts in profile ${profileKey}`);

      // Save each Instagram account
      for (const account of instagramAccounts) {
        const username = account.displayName || account.username;

        try {
          await convex.mutation(api.mikey.mutations.addInstagramAccountWithProfileKey, {
            username,
            ayrshareProfileKey: profileKey,
            ayrshareRefId: profile.refId || "",
            maxUsers: 95,
            createdBy: "admin",
          });

          console.log(`[Ayrshare Sync] Added Instagram account: ${username}`);
          console.log(`[Ayrshare Sync] ⚠️ Remember to register webhook manually for profile ${profileKey}`);

          accountsAdded.push({
            username,
            profileKey,
            refId: profile.refId,
          });
        } catch (error: any) {
          console.error(`[Ayrshare Sync] Error adding account ${username}:`, error.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${accountsAdded.length} Instagram account(s)`,
      accounts: accountsAdded,
    });
  } catch (error: any) {
    console.error("[Ayrshare Sync] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
