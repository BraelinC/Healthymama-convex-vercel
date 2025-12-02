import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Disconnect Instagram Account
 * Completely removes the Ayrshare profile and Instagram connection
 * Use this for a fresh start
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[Instagram Disconnect] User: ${userId}`);

    // Get user's current profile
    const userProfile = await convex.query(api.users.queries.getUserProfile, { userId });
    const profileKey = userProfile?.ayrshareProfileKey;

    if (!profileKey) {
      return NextResponse.json({
        success: true,
        message: "No Instagram connection found"
      });
    }

    console.log(`[Instagram Disconnect] Profile Key: ${profileKey}`);

    const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
    const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;

    if (!AYRSHARE_API_KEY) {
      return NextResponse.json(
        { error: "AYRSHARE_API_KEY not configured" },
        { status: 500 }
      );
    }

    // 1. Disconnect Instagram from Ayrshare profile
    try {
      console.log("[Instagram Disconnect] Disconnecting Instagram from Ayrshare...");
      const disconnectResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles/delete-social`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
          "Profile-Key": profileKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "instagram"
        }),
      });

      if (disconnectResponse.ok) {
        const data = await disconnectResponse.json();
        console.log("[Instagram Disconnect] Instagram disconnected:", data);
      } else {
        console.error("[Instagram Disconnect] Failed to disconnect Instagram (continuing anyway)");
      }
    } catch (error) {
      console.error("[Instagram Disconnect] Error disconnecting Instagram:", error);
    }

    // 2. Delete the Ayrshare profile entirely (for complete fresh start)
    try {
      console.log("[Instagram Disconnect] Deleting Ayrshare profile...");
      const deleteResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles/${profileKey}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (deleteResponse.ok) {
        const data = await deleteResponse.json();
        console.log("[Instagram Disconnect] Profile deleted:", data);
      } else {
        console.error("[Instagram Disconnect] Failed to delete profile (continuing anyway)");
      }
    } catch (error) {
      console.error("[Instagram Disconnect] Error deleting profile:", error);
    }

    // 3. Clear profile data from database
    try {
      console.log("[Instagram Disconnect] Clearing profile from database...");
      await convex.mutation(api.users.mutations.clearAyrshareProfile, { userId });
      console.log("[Instagram Disconnect] Database cleared");
    } catch (error) {
      console.error("[Instagram Disconnect] Error clearing database:", error);
    }

    return NextResponse.json({
      success: true,
      message: "Instagram disconnected completely. You can now connect fresh."
    });

  } catch (error: any) {
    console.error("[Instagram Disconnect] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect" },
      { status: 500 }
    );
  }
}
