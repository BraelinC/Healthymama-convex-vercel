/**
 * Stripe Internal Mutations
 * Called by webhooks to update database
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Upsert subscription record (create or update)
 */
export const upsertSubscription = internalMutation({
  args: {
    userId: v.string(),
    communityId: v.id("communities"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    stripePriceId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("unpaid")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if subscription already exists
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing subscription
      await ctx.db.patch(existing._id, {
        status: args.status,
        stripePriceId: args.stripePriceId,
        currentPeriodStart: args.currentPeriodStart,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        canceledAt: args.canceledAt,
        updatedAt: now,
      });

      console.log(
        `🔄 [STRIPE] Updated subscription ${args.stripeSubscriptionId} - Status: ${args.status}`
      );
      return existing._id;
    }

    // Create new subscription
    const subscriptionId = await ctx.db.insert("subscriptions", {
      userId: args.userId,
      communityId: args.communityId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      stripePriceId: args.stripePriceId,
      status: args.status,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      canceledAt: args.canceledAt,
      createdAt: now,
      updatedAt: now,
    });

    console.log(
      `✅ [STRIPE] Created subscription ${args.stripeSubscriptionId} for user ${args.userId}`
    );
    return subscriptionId;
  },
});

/**
 * Delete subscription record
 */
export const deleteSubscription = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (subscription) {
      await ctx.db.delete(subscription._id);
      console.log(`✅ [STRIPE] Deleted subscription ${args.stripeSubscriptionId}`);
    }
  },
});

/**
 * Update subscription status
 */
export const updateSubscriptionStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("unpaid")
    ),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId)
      )
      .first();

    if (subscription) {
      await ctx.db.patch(subscription._id, {
        status: args.status,
        updatedAt: Date.now(),
      });

      console.log(
        `✅ [STRIPE] Updated subscription ${args.stripeSubscriptionId} status to ${args.status}`
      );
    }
  },
});

/**
 * Create purchase record (lifetime purchase)
 */
export const createPurchase = internalMutation({
  args: {
    userId: v.string(),
    communityId: v.id("communities"),
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.string(),
    amount: v.number(),
    status: v.union(
      v.literal("succeeded"),
      v.literal("pending"),
      v.literal("failed"),
      v.literal("canceled")
    ),
  },
  handler: async (ctx, args) => {
    // Check if purchase already exists (idempotency)
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_payment_intent", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId)
      )
      .first();

    if (existing) {
      console.log(
        `⚠️ [STRIPE] Purchase ${args.stripePaymentIntentId} already exists, skipping`
      );
      return existing._id;
    }

    const now = Date.now();

    const purchaseId = await ctx.db.insert("purchases", {
      userId: args.userId,
      communityId: args.communityId,
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeCustomerId: args.stripeCustomerId,
      amount: args.amount,
      status: args.status,
      purchasedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    console.log(
      `✅ [STRIPE] Created lifetime purchase for user ${args.userId} - Amount: $${
        args.amount / 100
      }`
    );
    return purchaseId;
  },
});

/**
 * Update creator Stripe Connect account
 */
export const updateCreatorAccount = internalMutation({
  args: {
    stripeAccountId: v.string(),
    accountStatus: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("disabled")
    ),
    onboardingComplete: v.boolean(),
    detailsSubmitted: v.boolean(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("creatorStripeAccounts")
      .withIndex("by_stripe_account", (q) =>
        q.eq("stripeAccountId", args.stripeAccountId)
      )
      .first();

    if (account) {
      await ctx.db.patch(account._id, {
        accountStatus: args.accountStatus,
        onboardingComplete: args.onboardingComplete,
        detailsSubmitted: args.detailsSubmitted,
        chargesEnabled: args.chargesEnabled,
        payoutsEnabled: args.payoutsEnabled,
        updatedAt: Date.now(),
      });

      console.log(
        `✅ [STRIPE] Updated creator account ${args.stripeAccountId} - Status: ${args.accountStatus}`
      );
    } else {
      console.error(
        `❌ [STRIPE] Creator account ${args.stripeAccountId} not found`
      );
    }
  },
});

/**
 * Create creator Stripe Connect account record
 */
export const createCreatorAccount = internalMutation({
  args: {
    creatorId: v.string(),
    stripeAccountId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const accountId = await ctx.db.insert("creatorStripeAccounts", {
      creatorId: args.creatorId,
      stripeAccountId: args.stripeAccountId,
      accountStatus: "pending",
      onboardingComplete: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      email: args.email,
      feeType: "default", // Start with default platform fee
      createdAt: now,
      updatedAt: now,
    });

    console.log(
      `✅ [STRIPE] Created creator account record for ${args.creatorId} - Stripe Account: ${args.stripeAccountId}`
    );
    return accountId;
  },
});

/**
 * Set custom platform fee for creator
 */
export const setCreatorPlatformFee = internalMutation({
  args: {
    creatorId: v.string(),
    feePercent: v.number(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("creatorStripeAccounts")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .first();

    if (!account) {
      throw new Error(`Creator account not found for ${args.creatorId}`);
    }

    await ctx.db.patch(account._id, {
      customPlatformFeePercent: args.feePercent,
      feeType: "custom",
      updatedAt: Date.now(),
    });

    console.log(
      `✅ [STRIPE] Set custom platform fee ${args.feePercent}% for creator ${args.creatorId}`
    );
  },
});

/**
 * Reset creator platform fee to default
 */
export const resetCreatorPlatformFee = internalMutation({
  args: {
    creatorId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("creatorStripeAccounts")
      .withIndex("by_creator", (q) => q.eq("creatorId", args.creatorId))
      .first();

    if (!account) {
      throw new Error(`Creator account not found for ${args.creatorId}`);
    }

    await ctx.db.patch(account._id, {
      customPlatformFeePercent: undefined,
      feeType: "default",
      updatedAt: Date.now(),
    });

    console.log(`✅ [STRIPE] Reset platform fee to default for creator ${args.creatorId}`);
  },
});
