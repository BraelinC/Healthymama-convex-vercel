/**
 * Convex HTTP Routes
 * Handles Stripe webhooks and other HTTP endpoints
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

export default http;
