/**
 * User Queries
 * Internal queries for user data
 */

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get user by Stripe customer ID
 * Used by webhooks to find user from Stripe events
 */
export const getUserByStripeCustomerId = internalQuery({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();

    return user;
  },
});
