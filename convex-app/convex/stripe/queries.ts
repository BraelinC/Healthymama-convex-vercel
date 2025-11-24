/**
 * Stripe Queries
 * Public queries for Stripe data
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { getPlatformFeePercent } from "../lib/stripe";

/**
 * Get creator's Stripe Connect account
 */
export const getCreatorAccount = query({
  args: {
    creatorId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("creatorStripeAccounts")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .first();

    return account;
  },
});

/**
 * Get effective platform fee for creator
 * Returns custom fee if set, otherwise default from env
 */
export const getEffectivePlatformFee = query({
  args: {
    creatorId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("creatorStripeAccounts")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .first();

    if (account && account.feeType === "custom" && account.customPlatformFeePercent) {
      return account.customPlatformFeePercent;
    }

    // Return default platform fee
    return getPlatformFeePercent();
  },
});

/**
 * Check if user has access to community
 * Returns access status based on subscription or purchase
 */
export const hasAccessToCommunity = query({
  args: {
    userId: v.string(),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Check for active subscription
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_community", (q) =>
        q.eq("userId", args.userId).eq("communityId", args.communityId)
      )
      .filter((q) =>
        q.or(q.eq(q.field("status"), "active"), q.eq(q.field("status"), "trialing"))
      )
      .first();

    if (subscription) {
      // Determine tier from price ID
      const community = await ctx.db.get(args.communityId);
      let tier: "monthly" | "yearly" = "monthly";

      if (community?.yearlyStripePriceId === subscription.stripePriceId) {
        tier = "yearly";
      }

      return {
        hasAccess: true,
        accessType: tier as "monthly" | "yearly" | "lifetime" | null,
        subscription: {
          id: subscription._id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      };
    }

    // Check for lifetime purchase
    const purchase = await ctx.db
      .query("purchases")
      .withIndex("by_user_community", (q) =>
        q.eq("userId", args.userId).eq("communityId", args.communityId)
      )
      .filter((q) => q.eq(q.field("status"), "succeeded"))
      .first();

    if (purchase) {
      return {
        hasAccess: true,
        accessType: "lifetime" as "monthly" | "yearly" | "lifetime" | null,
        purchase: {
          id: purchase._id,
          purchasedAt: purchase.purchasedAt,
        },
      };
    }

    // No access
    return {
      hasAccess: false,
      accessType: null,
    };
  },
});

/**
 * Get user's active subscriptions
 */
export const getUserSubscriptions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "trialing"),
          q.eq(q.field("status"), "past_due")
        )
      )
      .collect();

    return subscriptions;
  },
});

/**
 * Get user's lifetime purchases
 */
export const getUserPurchases = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "succeeded"))
      .collect();

    return purchases;
  },
});
