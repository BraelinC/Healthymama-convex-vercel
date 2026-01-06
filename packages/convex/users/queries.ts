/**
 * User Queries
 * Internal queries for user data
 */

import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get user by userId (public query for admin checks)
 */
export const getUserById = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return user;
  },
});

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
