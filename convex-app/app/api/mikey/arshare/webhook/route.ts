import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import crypto from "crypto";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Ayrshare webhook receiver
 * POST /api/mikey/arshare/webhook
 *
 * Receives two types of events:
 * 1. "social" action - when Instagram account is linked/unlinked
 * 2. "message.received" - when DM is received (if implemented)
 */
export async function POST(request: Request) {
  try {
    // 1. Get raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("x-ayrshare-signature");

    // 2. Verify webhook signature (if configured)
    if (signature && process.env.AYRSHARE_WEBHOOK_SECRET) {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.AYRSHARE_WEBHOOK_SECRET)
        .update(body)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("[Ayrshare Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // 3. Parse event
    const event = JSON.parse(body);
    console.log("[Ayrshare Webhook] Received event:", JSON.stringify(event, null, 2));

    // 4. Handle social account link/unlink
    if (event.action === "social") {
      const { type, platform, displayName, refId, title } = event;

      // Only process Instagram links
      if (platform !== "instagram") {
        console.log("[Ayrshare Webhook] Ignoring non-Instagram platform:", platform);
        return NextResponse.json({ success: true, processed: false });
      }

      if (type === "link") {
        console.log("[Ayrshare Webhook] Instagram account linked:", displayName);

        // Get profile info from Ayrshare API to retrieve profileKey
        const AYRSHARE_BASE_URL = "https://api.ayrshare.com";
        const AYRSHARE_API = process.env.AYRSHARE_API;

        if (!AYRSHARE_API) {
          console.error("[Ayrshare Webhook] AYRSHARE_API not configured");
          return NextResponse.json({ error: "API key missing" }, { status: 500 });
        }

        // List all profiles and find the one matching this refId
        const profilesResponse = await fetch(`${AYRSHARE_BASE_URL}/api/profiles`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${AYRSHARE_API}`,
            "Content-Type": "application/json",
          },
        });

        if (!profilesResponse.ok) {
          console.error("[Ayrshare Webhook] Failed to fetch profiles");
          return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
        }

        const profilesData = await profilesResponse.json();
        console.log("[Ayrshare Webhook] Profiles data:", profilesData);

        // Find the profile with matching refId
        const matchingProfile = profilesData.profiles?.find((p: any) => p.refId === refId);

        if (!matchingProfile || !matchingProfile.profileKey) {
          console.error("[Ayrshare Webhook] Could not find profileKey for refId:", refId);
          return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        const profileKey = matchingProfile.profileKey;

        // Save Instagram account with its unique profileKey
        console.log("[Ayrshare Webhook] Saving Instagram account:", displayName, "with profileKey:", profileKey);
        await convex.mutation(api.mikey.mutations.addInstagramAccountWithProfileKey, {
          username: displayName,
          ayrshareProfileKey: profileKey,
          ayrshareRefId: refId,
          maxUsers: 95,
          createdBy: "admin",
        });

        return NextResponse.json({ success: true, processed: true });
      } else if (type === "unlink") {
        console.log("[Ayrshare Webhook] Instagram account unlinked:", displayName);
        // For unlink events, we could mark the account as inactive in the future
        // For now, just acknowledge the webhook
        return NextResponse.json({ success: true, processed: true });
      }
    }

    // 5. Handle message.received event (Instagram DMs)
    if (event.type === "message.received" || event.action === "message") {
      const { profileKey, platform, sender, message, messageId } = event;

      if (platform !== "instagram") {
        console.log("[Ayrshare Webhook] Ignoring non-Instagram message");
        return NextResponse.json({ success: true, processed: false });
      }

      console.log("[Ayrshare Webhook] Instagram DM received from:", sender);

      // Find Instagram account by profileKey
      const instagramAccount = await convex.query(api.mikey.queries.getInstagramAccountByProfileKey, {
        profileKey,
      });

      if (!instagramAccount) {
        console.error("[Ayrshare Webhook] Instagram account not found for profileKey:", profileKey);
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      // Process DM via Convex
      const result = await convex.mutation(api.mikey.mutations.processIncomingDM, {
        profileKey, // Use profileKey instead of internal ID
        instagramUserId: sender.id || sender.username,
        instagramUsername: sender.username || sender.name,
        messageText: message.text || message,
        arshareMessageId: messageId || event.id || `${Date.now()}`,
      });

      console.log("[Ayrshare Webhook] Processed DM:", result);

      // Schedule Instagram reel import if found
      if (result.instagramReelUrl && result.conversationId) {
        console.log("[Ayrshare Webhook] Scheduling Instagram reel import");
        await convex.action(api.mikey.actions.importRecipeFromDM, {
          instagramReelUrl: result.instagramReelUrl,
          userId: result.userId,
          conversationId: result.conversationId,
          messageId: result.messageId,
          profileKey: result.profileKey,
        });
      }
      // Send error message for non-reel URLs
      else if (result.needsErrorMessage) {
        console.log("[Ayrshare Webhook] Sending error message:", result.errorType);
        await convex.action(api.mikey.actions.sendErrorMessage, {
          conversationId: result.conversationId,
          messageId: result.messageId,
          profileKey: result.profileKey,
          errorType: result.errorType,
        });
      }
      // Send help message if no URL
      else if (result.needsHelpMessage) {
        console.log("[Ayrshare Webhook] Sending help message");
        await convex.action(api.mikey.actions.sendHelpMessage, {
          conversationId: result.conversationId,
          messageId: result.messageId,
        });
      }

      return NextResponse.json({ success: true, processed: true });
    }

    // Unknown event type
    console.log("[Ayrshare Webhook] Unhandled event type:", event.action || event.type);
    return NextResponse.json({ success: true, processed: false });
  } catch (error: any) {
    console.error("[Ayrshare Webhook] Error:", error);

    // Return 200 to avoid Ayrshare retry spam
    return NextResponse.json({ error: error.message }, { status: 200 });
  }
}

/**
 * Verify webhook endpoint (some services ping GET first)
 */
export async function GET(request: Request) {
  return NextResponse.json({ status: "ok", service: "mikey-webhook" });
}
