import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Debug endpoint to list ALL Ayrshare profiles and their connected accounts
 * GET /api/mikey/arshare/debug-profiles
 */
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await convex.query(api.users.queries.getUserById, { userId });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Access denied - admin only" }, { status: 403 });
    }

    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    if (!AYRSHARE_API_KEY) {
      return NextResponse.json({ error: "AYRSHARE_API_KEY not configured" }, { status: 500 });
    }

    console.log("[Debug] Fetching all Ayrshare profiles...");

    // 1. Get all profiles
    const profilesResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AYRSHARE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!profilesResponse.ok) {
      const errorText = await profilesResponse.text();
      console.error("[Debug] Failed to fetch profiles:", errorText);
      return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    const profilesData = await profilesResponse.json();
    console.log("[Debug] Total profiles returned:", profilesData.profiles?.length || 0);

    // Log first profile structure to see what fields are available
    if (profilesData.profiles && profilesData.profiles.length > 0) {
      console.log("[Debug] First profile structure:", JSON.stringify(profilesData.profiles[0], null, 2));
    }

    if (!profilesData.profiles || profilesData.profiles.length === 0) {
      return NextResponse.json({
        message: "No profiles found",
        profiles: [],
        rawData: profilesData
      });
    }

    const profileDetails = [];

    // 2. For each profile, get user data to see connected accounts
    // Only check first 5 to avoid overwhelming the API
    const profilesToCheck = profilesData.profiles.slice(0, 5);

    for (const profile of profilesToCheck) {
      console.log(`[Debug] Profile object keys:`, Object.keys(profile));
      const profileKey = profile.profileKey || profile.key;

      if (!profileKey) {
        console.log(`[Debug] No profileKey found for profile: ${profile.title}`);
        profileDetails.push({
          title: profile.title,
          refId: profile.refId,
          error: "No profileKey in profile object",
          availableFields: Object.keys(profile),
        });
        continue;
      }

      console.log(`[Debug] Checking profile ${profile.title} (${profileKey})...`);

      // Get user data for this profile
      const userResponse = await fetch(`${AYRSHARE_BASE_URL}/api/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AYRSHARE_API_KEY}`,
          "Profile-Key": profileKey,
          "Content-Type": "application/json",
        },
      });

      if (!userResponse.ok) {
        console.error(`[Debug] Failed to fetch user for profile ${profileKey}`);
        profileDetails.push({
          title: profile.title,
          profileKey: profileKey,
          refId: profile.refId,
          error: "Failed to fetch user data",
        });
        continue;
      }

      const userData = await userResponse.json();
      console.log(`[Debug] User data for ${profile.title}:`, JSON.stringify(userData, null, 2));

      // Extract Instagram accounts
      const instagramAccounts = (userData.displayNames || []).filter(
        (account: any) => account.platform === "instagram"
      );

      profileDetails.push({
        title: profile.title,
        profileKey: profileKey,
        refId: profile.refId,
        activeSocialAccounts: userData.activeSocialAccounts || [],
        instagramAccounts: instagramAccounts.map((acc: any) => ({
          username: acc.username || acc.displayName,
          displayName: acc.displayName,
          userImage: acc.userImage,
        })),
        totalConnectedAccounts: (userData.displayNames || []).length,
      });
    }

    return NextResponse.json({
      success: true,
      totalProfiles: profilesData.profiles.length,
      profiles: profileDetails,
    });
  } catch (error: any) {
    console.error("[Debug] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
