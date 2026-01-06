// @ts-nocheck
/**
 * Stripe Webhook Actions (Node.js)
 * Handles webhook signature verification and event processing in Node.js runtime
 */

"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { getStripeClient, getWebhookSecret, mapStripeStatus } from "../lib/stripe";
import { internal } from "../_generated/api";
import Stripe from "stripe";

/**
 * Fulfill Stripe Webhook
 * Verifies signature and processes webhook events in Node.js environment
 */
export const fulfillWebhook = internalAction({
  args: {
    signature: v.string(),
    payload: v.bytes()  // Use bytes to preserve exact raw body
  },
  handler: async (ctx, { signature, payload }) => {
    const stripe = getStripeClient();
    const webhookSecret = getWebhookSecret();

    // Convert ArrayBuffer to Buffer for Stripe SDK
    const buffer = Buffer.from(payload);

    let event: Stripe.Event;

    try {
      // Verify webhook signature using Buffer (preserves exact bytes)
      event = await stripe.webhooks.constructEventAsync(buffer, signature, webhookSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      throw new Error(`Webhook verification failed: ${err}`);
    }

    console.log(`✅ [WEBHOOK] Received event: ${event.type}`);

    // Route event to appropriate handler
    try {
      switch (event.type) {
        // ========== SUBSCRIPTION EVENTS ==========
        case "customer.subscription.created":
        case "customer.subscription.updated":
          await handleSubscriptionUpdate(ctx, event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription);
          break;

        case "customer.subscription.paused":
        case "customer.subscription.resumed":
        case "customer.subscription.pending_update_applied":
        case "customer.subscription.pending_update_expired":
        case "customer.subscription.trial_will_end":
          await handleSubscriptionUpdate(ctx, event.data.object as Stripe.Subscription);
          break;

        // ========== CHECKOUT EVENTS ==========
        case "checkout.session.completed":
          await handleCheckoutCompleted(ctx, event.data.object as Stripe.Checkout.Session);
          break;

        case "checkout.session.expired":
        case "checkout.session.async_payment_succeeded":
        case "checkout.session.async_payment_failed":
          console.log(`[WEBHOOK] Checkout event ${event.type} - logged`);
          break;

        // ========== INVOICE EVENTS ==========
        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(ctx, event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(ctx, event.data.object as Stripe.Invoice);
          break;

        case "invoice.payment_action_required":
        case "invoice.finalized":
          console.log(`[WEBHOOK] Invoice event ${event.type} - logged`);
          break;

        // ========== PAYMENT INTENT EVENTS (Lifetime Purchases) ==========
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(ctx, event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(ctx, event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_intent.canceled":
        case "payment_intent.requires_action":
          console.log(`[WEBHOOK] Payment Intent event ${event.type} - logged`);
          break;

        // ========== CUSTOMER EVENTS ==========
        case "customer.updated":
          await handleCustomerUpdated(ctx, event.data.object as Stripe.Customer);
          break;

        case "customer.deleted":
          console.log(`[WEBHOOK] Customer deleted - logged`);
          break;

        // ========== STRIPE CONNECT EVENTS ==========
        case "account.updated":
          await handleAccountUpdated(ctx, event.data.object as Stripe.Account);
          break;

        case "account.external_account.created":
        case "account.external_account.updated":
          console.log(`[WEBHOOK] Account external event ${event.type} - logged`);
          break;

        // ========== PAYOUT EVENTS ==========
        case "payout.paid":
        case "payout.failed":
        case "payout.canceled":
          console.log(`[WEBHOOK] Payout event ${event.type} - logged`);
          // TODO: Track payouts in database for creator dashboard
          break;

        // ========== DISPUTE/REFUND EVENTS ==========
        case "charge.dispute.created":
        case "charge.dispute.closed":
        case "charge.refunded":
        case "charge.refund.updated":
          console.log(`[WEBHOOK] Dispute/Refund event ${event.type} - logged`);
          // TODO: Handle disputes and refunds (revoke access, notify creator)
          break;

        default:
          console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ [WEBHOOK] Error processing ${event.type}:`, error);
      throw error;
    }
  },
});

// ========== WEBHOOK HANDLERS ==========

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdate(
  ctx: any,
  subscription: Stripe.Subscription
) {
  const stripeCustomerId = subscription.customer as string;
  const status = mapStripeStatus(subscription.status);

  // Get user from Stripe customer ID
  const user = await ctx.runQuery(internal.users.queries.getUserByStripeCustomerId, {
    stripeCustomerId,
  });

  if (!user) {
    console.error(`❌ [WEBHOOK] User not found for Stripe customer ${stripeCustomerId}`);
    return;
  }

  // Get community ID from subscription metadata
  const communityId = subscription.metadata.communityId;

  if (!communityId) {
    console.error(`❌ [WEBHOOK] No communityId in subscription metadata`);
    return;
  }

  // Upsert subscription record
  await ctx.runMutation(internal.stripe.mutations.upsertSubscription, {
    userId: user.userId,
    communityId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId,
    stripePriceId: subscription.items.data[0].price.id,
    status,
    currentPeriodStart: subscription.current_period_start * 1000,
    currentPeriodEnd: subscription.current_period_end * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: subscription.canceled_at ? subscription.canceled_at * 1000 : undefined,
  });

  console.log(
    `✅ [WEBHOOK] Subscription ${subscription.id} updated - Status: ${status}`
  );
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(
  ctx: any,
  subscription: Stripe.Subscription
) {
  await ctx.runMutation(internal.stripe.mutations.deleteSubscription, {
    stripeSubscriptionId: subscription.id,
  });

  console.log(`✅ [WEBHOOK] Subscription ${subscription.id} deleted`);
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(
  ctx: any,
  session: Stripe.Checkout.Session
) {
  const stripeCustomerId = session.customer as string;
  const mode = session.mode;

  console.log(
    `[WEBHOOK] Checkout completed - Mode: ${mode}, Customer: ${stripeCustomerId}`
  );

  // For subscription mode, subscription.created event will handle it
  // For payment mode (lifetime), payment_intent.succeeded will handle it
  // This event is mainly for logging/confirmation
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(
  ctx: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription invoice
  }

  // Update subscription status to active
  await ctx.runMutation(internal.stripe.mutations.updateSubscriptionStatus, {
    stripeSubscriptionId: subscriptionId,
    status: "active",
  });

  console.log(`✅ [WEBHOOK] Invoice paid for subscription ${subscriptionId}`);
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(ctx: any, invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return;
  }

  // Update subscription status to past_due
  await ctx.runMutation(internal.stripe.mutations.updateSubscriptionStatus, {
    stripeSubscriptionId: subscriptionId,
    status: "past_due",
  });

  console.log(
    `❌ [WEBHOOK] Invoice payment failed for subscription ${subscriptionId}`
  );
  // TODO: Send email notification to user to update payment method
}

/**
 * Handle payment intent succeeded (lifetime purchases)
 */
async function handlePaymentIntentSucceeded(
  ctx: any,
  paymentIntent: Stripe.PaymentIntent
) {
  const stripeCustomerId = paymentIntent.customer as string;
  const communityId = paymentIntent.metadata.communityId;

  if (!communityId) {
    console.error(`❌ [WEBHOOK] No communityId in payment intent metadata`);
    return;
  }

  // Get user from Stripe customer ID
  const user = await ctx.runQuery(internal.users.queries.getUserByStripeCustomerId, {
    stripeCustomerId,
  });

  if (!user) {
    console.error(
      `❌ [WEBHOOK] User not found for Stripe customer ${stripeCustomerId}`
    );
    return;
  }

  // Create purchase record
  await ctx.runMutation(internal.stripe.mutations.createPurchase, {
    userId: user.userId,
    communityId,
    stripePaymentIntentId: paymentIntent.id,
    stripeCustomerId,
    amount: paymentIntent.amount,
    status: "succeeded",
  });

  console.log(
    `✅ [WEBHOOK] Lifetime purchase completed - Payment Intent: ${paymentIntent.id}`
  );
}

/**
 * Handle payment intent failed (lifetime purchases)
 */
async function handlePaymentIntentFailed(
  ctx: any,
  paymentIntent: Stripe.PaymentIntent
) {
  console.log(
    `❌ [WEBHOOK] Payment intent failed: ${paymentIntent.id}`
  );
  // TODO: Create failed purchase record for tracking
}

/**
 * Handle customer updated
 */
async function handleCustomerUpdated(ctx: any, customer: Stripe.Customer) {
  // Sync customer data if needed (e.g., email, payment method changes)
  console.log(`[WEBHOOK] Customer ${customer.id} updated`);
}

/**
 * Handle Stripe Connect account updated
 */
async function handleAccountUpdated(ctx: any, account: Stripe.Account) {
  // Update creator Stripe account status
  await ctx.runMutation(internal.stripe.mutations.updateCreatorAccount, {
    stripeAccountId: account.id,
    accountStatus: account.charges_enabled && account.payouts_enabled
      ? "active"
      : "pending",
    onboardingComplete: account.details_submitted || false,
    detailsSubmitted: account.details_submitted || false,
    chargesEnabled: account.charges_enabled || false,
    payoutsEnabled: account.payouts_enabled || false,
  });

  console.log(`✅ [WEBHOOK] Creator account ${account.id} updated`);
}
