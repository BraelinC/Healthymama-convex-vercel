import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Debug endpoint to show all Instagram bot accounts and their refIds
 * GET /api/mikey/debug-accounts
 */
export async function GET() {
  try {
    const accounts = await convex.query(api.mikey.queries.getAllInstagramAccounts);

    return NextResponse.json({
      success: true,
      accounts: accounts.map((acc) => ({
        username: acc.username,
        ayrshareProfileKey: acc.ayrshareProfileKey,
        ayrshareRefId: acc.ayrshareRefId,
        status: acc.status,
        createdAt: new Date(acc.createdAt).toISOString(),
      })),
      webhook_received_refIds: [
        "0b5df3c719e39103ae193e9113867332c52928c0", // From latest reel
        "262b4e3e51bea795e07daaf0bfcb5c2efb2ef437",
        "661f320c94aca55279e87b60623fe0cf9041fe16",
        "34b05f1f55cbdd59bc09c3916ba23876314eb4fe",
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
