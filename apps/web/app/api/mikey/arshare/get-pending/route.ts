import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Get pending Ayrshare profile for current user
 * GET /api/mikey/arshare/get-pending
 *
 * This endpoint retrieves the most recent pending profile connection
 * for the authenticated user. Used after OAuth window closes.
 */
export async function GET(request: Request) {
  try {
    console.log("[Get Pending] === STARTING GET PENDING PROFILE ===");

    const { userId } = await auth();
    console.log(`[Get Pending] User ID: ${userId}`);

    if (!userId) {
      console.error("[Get Pending] ERROR: Unauthorized - no userId");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Get Pending] Calling getLatestPendingProfile mutation...");
    const pending = await convex.mutation(api.mikey.mutations.getLatestPendingProfile, {
      userId,
    });

    console.log(`[Get Pending] Pending profile result:`, pending);

    if (!pending) {
      console.log("[Get Pending] WARNING: No pending profile found for user");
      return NextResponse.json({ error: "No pending profile found" }, { status: 404 });
    }

    console.log(`[Get Pending] SUCCESS: Returning profileKey: ${pending.profileKey}, refId: ${pending.refId}`);

    return NextResponse.json({
      success: true,
      profileKey: pending.profileKey,
      refId: pending.refId,
    });
  } catch (error: any) {
    console.error("[Get Pending] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
