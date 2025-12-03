/**
 * Convex HTTP Routes
 * Handles Stripe webhooks, ElevenLabs tools, and Ayrshare webhooks
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Stripe Webhook Endpoint
 * Receives webhooks and delegates to Node.js action for verification and processing
 */
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Get signature from headers
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return new Response("No signature provided", { status: 400 });
    }

    // Get raw body as ArrayBuffer (preserves exact bytes for signature verification)
    const payloadBuffer = await request.arrayBuffer();

    try {
      // Delegate to Node.js action for verification and processing
      await ctx.runAction(internal.stripe.webhookActions.fulfillWebhook, {
        signature,
        payload: payloadBuffer,
      });

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(`❌ [WEBHOOK] Error:`, error);
      return new Response(`Webhook Error: ${error}`, { status: 400 });
    }
  }),
});

/**
 * Ayrshare Webhook Endpoint
 * Receives Instagram DM webhooks and account link/unlink events
 * Processes both bot accounts (instagramAccounts table) and regular users (userProfiles table)
 */
http.route({
  path: "/mikey/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      console.log("[Ayrshare Webhook] Received:", JSON.stringify(body, null, 2));

      // Handle social account link/unlink events
      if (body.action === "social") {
        const { type, platform, displayName, refId } = body;

        // Only process Instagram links
        if (platform !== "instagram") {
          return new Response(JSON.stringify({ success: true, processed: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (type === "link") {
          console.log("[Ayrshare Webhook] Instagram account linked:", displayName);

          // Process the linked account
          // Note: You'll need to handle profile key retrieval and saving here

          return new Response(JSON.stringify({ success: true, processed: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Handle Instagram DM received events
      // Ayrshare sends action="messages" (plural) with subAction="messageCreated"
      if (
        body.type === "message.received" ||
        body.action === "message" ||
        (body.action === "messages" && body.subAction === "messageCreated")
      ) {
        const { profileKey, refId, platform, senderDetails, message, messageId, conversationId, recipientId } = body;

        if (platform !== "instagram") {
          return new Response(JSON.stringify({ success: true, processed: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Skip outgoing "sent" messages FIRST - we only process incoming "received" messages
        // This must happen before any processing to avoid bot responding to its own messages
        if (body.type === "sent" || body.direction === "outgoing" || body.subAction === "messageSent") {
          console.log("[Ayrshare Webhook] Skipping outgoing message (type:", body.type, "direction:", body.direction, "subAction:", body.subAction, ")");
          return new Response(JSON.stringify({ success: true, processed: false, skipped: "outgoing" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // CRITICAL: Deduplicate webhook events using webhook ID
        // Ayrshare sends SAME message with DIFFERENT refIds - we must deduplicate by webhook ID
        const webhookId = body.id || `${conversationId}_${body.created}`;

        // Check if we processed this exact webhook in the last 60 seconds
        const recentWebhooks = await ctx.runQuery(internal.mikey.queries.checkRecentWebhookId, {
          webhookId,
          windowSeconds: 60,
        });

        if (recentWebhooks && recentWebhooks.length > 0) {
          console.log("[Ayrshare Webhook] ⚠️ Duplicate webhook detected (same ID):", webhookId);
          console.log("[Ayrshare Webhook] Already processed at:", new Date(recentWebhooks[0].createdAt).toISOString());
          return new Response(
            JSON.stringify({ success: true, processed: false, skipped: "duplicate_webhook_id" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }

        // Log this webhook ID for future deduplication
        await ctx.runMutation(internal.mikey.mutations.logWebhookId, {
          webhookId,
          refId: refId || "",
          conversationId: conversationId || "",
        });

        console.log("[Ayrshare Webhook] 🎉 Instagram DM received from:", senderDetails?.username || "unknown");
        console.log("[Ayrshare Webhook] Message:", message);
        console.log("[Ayrshare Webhook] Attachments:", body.attachments);
        console.log("[Ayrshare Webhook] RefId:", refId);
        console.log("[Ayrshare Webhook] Webhook ID:", webhookId);

        // Extract message text or Instagram reel URL from attachments
        let messageText = typeof message === "string" ? message : message?.text || "";

        // Check for Instagram reel in attachments
        if (body.attachments && Array.isArray(body.attachments)) {
          const reelAttachment = body.attachments.find((att: any) => att.type === "ig_reel");
          if (reelAttachment?.url) {
            // Extract asset_id from CDN URL
            const assetIdMatch = reelAttachment.url.match(/asset_id=(\d+)/);
            if (assetIdMatch) {
              const mediaId = assetIdMatch[1];
              console.log("[Ayrshare Webhook] Extracted media ID from attachment:", mediaId);

              try {
                // Get Instagram permalink via Graph API
                const graphResponse = await fetch(
                  `https://graph.facebook.com/v18.0/${mediaId}?fields=permalink&access_token=${process.env.INSTAGRAM_ACCESS_TOKEN || process.env.AYRSHARE_API_KEY}`
                );

                if (graphResponse.ok) {
                  const graphData = await graphResponse.json();
                  if (graphData.permalink) {
                    messageText = messageText ? `${messageText}\n${graphData.permalink}` : graphData.permalink;
                    console.log("[Ayrshare Webhook] Instagram reel permalink:", graphData.permalink);
                  } else {
                    console.log("[Ayrshare Webhook] No permalink in Graph API response, using CDN URL");
                    messageText = messageText ? `${messageText}\n${reelAttachment.url}` : reelAttachment.url;
                  }
                } else {
                  console.log("[Ayrshare Webhook] Graph API call failed, using CDN URL");
                  messageText = messageText ? `${messageText}\n${reelAttachment.url}` : reelAttachment.url;
                }
              } catch (error) {
                console.error("[Ayrshare Webhook] Error fetching permalink:", error);
                messageText = messageText ? `${messageText}\n${reelAttachment.url}` : reelAttachment.url;
              }
            } else {
              // No asset_id found, use URL as-is
              messageText = messageText ? `${messageText}\n${reelAttachment.url}` : reelAttachment.url;
              console.log("[Ayrshare Webhook] Instagram reel found in attachments (no asset_id):", reelAttachment.url);
            }
          }
        }

        // Try to process as Mikey bot DM first (check instagramAccounts table)
        try {
          await ctx.runAction(internal.mikey.actions.processWebhookDM, {
            profileKey: refId || "",
            botInstagramUserId: recipientId || "",  // The bot's Instagram user ID (who received the message)
            instagramUserId: senderDetails?.id || body.senderId || "",
            instagramUsername: senderDetails?.username || body.senderUsername || "unknown",
            messageText,
            arshareMessageId: body.id || messageId || `${conversationId}_${Date.now()}`,
          });

          console.log("[Ayrshare Webhook] ✅ DM processed as Mikey bot message");

          return new Response(JSON.stringify({ success: true, processed: true, type: "bot" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (botError: any) {
          console.error("[Ayrshare Webhook] ⚠️ Bot account processing failed:", botError.message);

          // Only fallback to user path if account not found
          // Don't fallback for recipe import errors, duplicates, or other processing errors
          if (botError.message?.includes("Instagram account not found")) {
            console.log("[Ayrshare Webhook] Not a bot account, trying regular user...");

            try {
              await ctx.runMutation(internal.userInstagram.processUserIncomingDM, {
                ayrshareRefId: refId || "",
                instagramUserId: senderDetails?.id || body.senderId || "",
                instagramUsername: senderDetails?.username || body.senderUsername || "unknown",
                messageText: typeof message === "string" ? message : message?.text || "",
                instagramMessageId: messageId || conversationId || body.id || `${Date.now()}`,
              });

              console.log("[Ayrshare Webhook] ✅ DM processed as regular user message");

              return new Response(JSON.stringify({ success: true, processed: true, type: "user" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            } catch (userError: any) {
              console.error("[Ayrshare Webhook] ❌ Could not process DM:", userError.message);
              throw userError;
            }
          }

          // For other errors (duplicates, import failures), return success without fallback
          // This prevents duplicate processing - the error message was already sent to user
          console.log("[Ayrshare Webhook] Skipping fallback for error:", botError.message);
          return new Response(
            JSON.stringify({ success: true, processed: false, skipped: true, reason: botError.message }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      // Unknown event type
      console.log("[Ayrshare Webhook] Unhandled event:", body.action || body.type);
      return new Response(JSON.stringify({ success: true, processed: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Ayrshare Webhook] Error:", error);

      // Return 200 to avoid Ayrshare retry spam
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * ElevenLabs Conversational AI Tools Endpoint
 * Webhook handler for voice assistant tool calls
 */
http.route({
  path: "/elevenlabs/tools",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { tool_name, parameters } = body;

      console.log(`[ELEVENLABS WEBHOOK] Tool called: ${tool_name}`, parameters);

      // Route to appropriate tool handler
      switch (tool_name) {
        case "search_recipes": {
          const result = await ctx.runAction(internal["ai/elevenlabsTools"].searchRecipes, {
            query: parameters.query,
            userId: parameters.userId || "anonymous",
            communityId: parameters.communityId,
            limit: parameters.limit || 5,
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        case "get_suggestions": {
          const result = await ctx.runAction(internal["ai/elevenlabsTools"].getSuggestions, {
            userId: parameters.userId || "anonymous",
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        case "search_memory": {
          const result = await ctx.runAction(internal["ai/elevenlabsTools"].searchMemory, {
            query: parameters.query,
            userId: parameters.userId || "anonymous",
            timeRange: parameters.timeRange,
            memoryType: parameters.memoryType || "all",
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        default:
          return new Response(
            JSON.stringify({
              success: false,
              error: `Unknown tool: ${tool_name}`,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
      }
    } catch (error) {
      console.error("[ELEVENLABS WEBHOOK] Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
