/**
 * User Mutations
 * Internal mutations for user data
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update user's Stripe customer ID
 * Called when creating Stripe customer for the first time
 */
export const updateStripeCustomerId = internalMutation({
  args: {
    userId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error(`User ${args.userId} not found`);
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });

    console.log(
      `✅ [USER] Updated user ${args.userId} with Stripe customer ID ${args.stripeCustomerId}`
    );
  },
});
