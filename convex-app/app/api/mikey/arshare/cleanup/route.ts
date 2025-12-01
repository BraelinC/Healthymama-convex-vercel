import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Cleanup endpoint - delete all Instagram accounts and pending profiles
 * POST /api/mikey/arshare/cleanup
 *
 * This endpoint deletes all Instagram accounts and pending Ayrshare profiles
 * for a fresh start. Admin only.
 */
export async function POST(request: Request) {
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

    console.log("[Cleanup] Starting cleanup...");

    // Delete all Instagram accounts
    const deletedAccounts = await convex.mutation(api.mikey.mutations.deleteAllInstagramAccounts);

    // Delete all pending profiles
    const deletedPending = await convex.mutation(api.mikey.mutations.deleteAllPendingProfiles);

    console.log(`[Cleanup] Deleted ${deletedAccounts} Instagram accounts`);
    console.log(`[Cleanup] Deleted ${deletedPending} pending profiles`);

    return NextResponse.json({
      success: true,
      deletedAccounts,
      deletedPending,
      message: `Deleted ${deletedAccounts} Instagram accounts and ${deletedPending} pending profiles`,
    });
  } catch (error: any) {
    console.error("[Cleanup] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
