/**
 * Convex HTTP Routes
 * Handles Stripe webhooks, ElevenLabs tools, and other HTTP endpoints
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
