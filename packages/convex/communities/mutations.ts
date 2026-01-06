/**
 * Community Mutations
 * Internal mutations for community data
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update community with Stripe pricing IDs
 * Called after creating Stripe product and prices
 */
export const updateStripePricing = internalMutation({
  args: {
    communityId: v.id("communities"),
    stripeProductId: v.string(),
    monthlyStripePriceId: v.optional(v.string()),
    yearlyStripePriceId: v.optional(v.string()),
    lifetimeStripePaymentLinkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.communityId, {
      stripeProductId: args.stripeProductId,
      monthlyStripePriceId: args.monthlyStripePriceId,
      yearlyStripePriceId: args.yearlyStripePriceId,
      lifetimeStripePaymentLinkId: args.lifetimeStripePaymentLinkId,
      updatedAt: Date.now(),
    });

    console.log(
      `✅ [COMMUNITY] Updated community ${args.communityId} with Stripe pricing - Product: ${args.stripeProductId}`
    );
  },
});
