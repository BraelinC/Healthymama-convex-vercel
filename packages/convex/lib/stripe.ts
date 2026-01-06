// @ts-nocheck
/**
 * Stripe Configuration
 * Stripe SDK initialization for Convex Actions ("use node")
 */

import Stripe from "stripe";

/**
 * Initialize Stripe SDK with API key from environment
 * IMPORTANT: Only call this from Convex Actions, not Mutations or Queries
 */
export function getStripeClient(): Stripe {
  const apiKey = process.env.STRIPE_KEY;

  if (!apiKey) {
    throw new Error("STRIPE_KEY environment variable is not set");
  }

  return new Stripe(apiKey, {
    apiVersion: "2024-12-18.acacia", // Latest stable version
    typescript: true,
  });
}

/**
 * Check if we're using Stripe test mode
 * Test mode keys start with "sk_test_"
 */
export function isStripeTestMode(): boolean {
  const apiKey = process.env.STRIPE_KEY;
  return apiKey?.startsWith("sk_test_") || false;
}

/**
 * Get platform fee percentage from environment (default: 25%)
 */
export function getPlatformFeePercent(): number {
  const feePercent = process.env.PLATFORM_FEE_PERCENT;
  return feePercent ? parseFloat(feePercent) : 25;
}

/**
 * Calculate platform fee in cents
 * @param totalAmountCents - Total subscription amount in cents
 * @returns Platform fee amount in cents (rounded)
 */
export function calculatePlatformFee(totalAmountCents: number): number {
  const feePercent = getPlatformFeePercent();
  return Math.round((totalAmountCents * feePercent) / 100);
}

/**
 * Get Stripe webhook secret from environment
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOKS_SECRET;

  if (!secret) {
    throw new Error("STRIPE_WEBHOOKS_SECRET environment variable is not set");
  }

  return secret;
}

/**
 * Stripe subscription status type
 */
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "unpaid";

/**
 * Map Stripe subscription status to our database enum
 */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "trialing":
      return "trialing";
    case "unpaid":
      return "unpaid";
    default:
      console.warn(`Unknown Stripe status: ${stripeStatus}, defaulting to "incomplete"`);
      return "incomplete";
  }
}
