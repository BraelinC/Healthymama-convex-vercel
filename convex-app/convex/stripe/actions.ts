/**
 * Stripe Actions
 * Server-side Stripe API calls (run in Node.js environment)
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getStripeClient, getPlatformFeePercent, calculatePlatformFee, isStripeTestMode } from "../lib/stripe";
import { api, internal } from "../_generated/api";

/**
 * Create Stripe Checkout Session
 * Handles monthly, yearly, and lifetime purchases
 */
export const createCheckoutSession = action({
  args: {
    userId: v.string(),
    communityId: v.id("communities"),
    tier: v.union(v.literal("monthly"), v.literal("yearly"), v.literal("lifetime")),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripeClient();

    // PRODUCTION SAFEGUARD: Prevent test mode in production
    if (process.env.VERCEL_ENV === 'production' && isStripeTestMode()) {
      throw new Error(
        'FATAL: Cannot use Stripe test keys in production environment. ' +
        'Please configure STRIPE_KEY with a live key (sk_live_...) in Vercel production settings.'
      );
    }

    // Get user
    const user = await ctx.runQuery(api.users.getUser, { userId: args.userId });
    if (!user) {
      throw new Error("User not found");
    }

    // Get community
    const community = await ctx.runQuery(api.communities.get, { id: args.communityId });
    if (!community) {
      throw new Error("Community not found");
    }

    // Get creator's Stripe Connect account
    let creatorAccount = await ctx.runQuery(api.stripe.queries.getCreatorAccount, {
      creatorId: community.creatorId,
    });

    // Check if we're in test mode
    const testMode = isStripeTestMode();

    // Auto-create creator account in test mode if missing
    if (!creatorAccount && testMode) {
      console.warn(
        `⚠️ [STRIPE TEST MODE] No creator account found - auto-creating test account for creator ${community.creatorId}`
      );

      // Create a test Stripe Connect account in test mode
      const testAccount = await stripe.accounts.create({
        type: "express",
        email: user.email, // Use current user's email as fallback
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          creatorId: community.creatorId,
          testMode: "true",
        },
      });

      // Store in database
      await ctx.runMutation(internal.stripe.mutations.createCreatorAccount, {
        creatorId: community.creatorId,
        stripeAccountId: testAccount.id,
        email: user.email,
      });

      // Fetch the newly created account
      creatorAccount = await ctx.runQuery(api.stripe.queries.getCreatorAccount, {
        creatorId: community.creatorId,
      });

      console.log(
        `✅ [STRIPE TEST MODE] Created test account ${testAccount.id} for creator ${community.creatorId}`
      );
    }

    // Verify creator has set up Stripe Connect (production only)
    if (!creatorAccount && !testMode) {
      throw new Error(
        "This creator hasn't set up payments yet. Please contact the creator to enable subscriptions."
      );
    }

    // Shouldn't happen, but safety check
    if (!creatorAccount) {
      throw new Error("Failed to initialize creator account");
    }

    if (!testMode && creatorAccount.accountStatus !== "active") {
      // Production: require fully active account
      const message = creatorAccount.accountStatus === "pending"
        ? "This creator is still setting up their payment account. Please check back later."
        : "This creator's payment account is currently unavailable. Please contact support.";

      throw new Error(message);
    }

    // Test mode: log warning if account isn't active
    if (testMode && creatorAccount.accountStatus !== "active") {
      console.warn(
        `⚠️ [STRIPE TEST MODE] Using non-active account (${creatorAccount.accountStatus}) for testing. ` +
        `Account: ${creatorAccount.stripeAccountId}`
      );
    }

    // Get effective platform fee for this creator
    const platformFeePercent = await ctx.runQuery(api.stripe.queries.getEffectivePlatformFee, {
      creatorId: community.creatorId,
    });

    // Ensure user has Stripe customer ID
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          clerkUserId: user.userId,
        },
      });
      stripeCustomerId = customer.id;

      // Update user with Stripe customer ID
      await ctx.runMutation(internal.users.mutations.updateStripeCustomerId, {
        userId: user.userId,
        stripeCustomerId,
      });
    }

    // Determine pricing and mode based on tier
    let sessionParams: any = {
      customer: stripeCustomerId,
      mode: args.tier === "lifetime" ? "payment" : "subscription",
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: {
        communityId: args.communityId,
        userId: args.userId,
        tier: args.tier,
      },
    };

    if (args.tier === "monthly") {
      // In test mode, create price on-the-fly if missing
      if (!community.monthlyStripePriceId && !testMode) {
        throw new Error("Monthly pricing not available for this community");
      }

      if (!community.monthlyPrice && testMode) {
        throw new Error("Monthly price amount not set for this community");
      }

      // Use existing price ID or create on-the-fly in test mode
      if (community.monthlyStripePriceId) {
        sessionParams.line_items = [
          {
            price: community.monthlyStripePriceId,
            quantity: 1,
          },
        ];
      } else {
        // Test mode: create price on-the-fly
        sessionParams.line_items = [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${community.name} - Monthly Subscription`,
                description: `Monthly subscription to ${community.name}`,
              },
              unit_amount: community.monthlyPrice,
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ];
      }

      // Skip platform fees and transfers in test mode (account doesn't have capabilities)
      sessionParams.subscription_data = {
        ...(testMode ? {} : {
          application_fee_percent: platformFeePercent,
          transfer_data: {
            destination: creatorAccount.stripeAccountId,
          },
        }),
        metadata: {
          communityId: args.communityId,
        },
      };
    } else if (args.tier === "yearly") {
      // In test mode, create price on-the-fly if missing
      if (!community.yearlyStripePriceId && !testMode) {
        throw new Error("Yearly pricing not available for this community");
      }

      if (!community.yearlyPrice && testMode) {
        throw new Error("Yearly price amount not set for this community");
      }

      // Use existing price ID or create on-the-fly in test mode
      if (community.yearlyStripePriceId) {
        sessionParams.line_items = [
          {
            price: community.yearlyStripePriceId,
            quantity: 1,
          },
        ];
      } else {
        // Test mode: create price on-the-fly
        sessionParams.line_items = [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${community.name} - Yearly Subscription`,
                description: `Yearly subscription to ${community.name}`,
              },
              unit_amount: community.yearlyPrice,
              recurring: {
                interval: "year",
              },
            },
            quantity: 1,
          },
        ];
      }

      // Skip platform fees and transfers in test mode (account doesn't have capabilities)
      sessionParams.subscription_data = {
        ...(testMode ? {} : {
          application_fee_percent: platformFeePercent,
          transfer_data: {
            destination: creatorAccount.stripeAccountId,
          },
        }),
        metadata: {
          communityId: args.communityId,
        },
      };
    } else if (args.tier === "lifetime") {
      if (!community.lifetimePrice) {
        throw new Error("Lifetime pricing not available for this community");
      }

      const applicationFeeAmount = calculatePlatformFee(community.lifetimePrice);

      sessionParams.line_items = [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${community.name} - Lifetime Access`,
              description: `One-time payment for lifetime access to ${community.name}`,
            },
            unit_amount: community.lifetimePrice,
          },
          quantity: 1,
        },
      ];

      // Skip platform fees and transfers in test mode (account doesn't have capabilities)
      sessionParams.payment_intent_data = {
        ...(testMode ? {} : {
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: creatorAccount.stripeAccountId,
          },
        }),
        metadata: {
          communityId: args.communityId,
        },
      };
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(
      `✅ [STRIPE] Created checkout session for ${args.tier} tier - Session: ${session.id}`
    );

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

/**
 * Create Stripe Customer
 * Called when user signs up (via Clerk webhook)
 */
export const createStripeCustomer = action({
  args: {
    userId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripeClient();

    // Check if user already has Stripe customer ID
    const user = await ctx.runQuery(api.users.getUser, { userId: args.userId });
    if (user?.stripeCustomerId) {
      console.log(`⚠️ [STRIPE] User ${args.userId} already has Stripe customer ID`);
      return user.stripeCustomerId;
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: args.email,
      metadata: {
        clerkUserId: args.userId,
      },
    });

    // Update user with Stripe customer ID
    await ctx.runMutation(internal.users.updateStripeCustomerId, {
      userId: args.userId,
      stripeCustomerId: customer.id,
    });

    console.log(`✅ [STRIPE] Created customer ${customer.id} for user ${args.userId}`);

    return customer.id;
  },
});

/**
 * Create Stripe Connect Account for Creator
 * Generates onboarding link for creator to complete setup
 */
export const createConnectAccount = action({
  args: {
    creatorId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripeClient();

    // Check if creator already has Connect account
    const existing = await ctx.runQuery(api.stripe.queries.getCreatorAccount, {
      creatorId: args.creatorId,
    });

    if (existing) {
      // Generate new onboarding link for existing account
      const accountLink = await stripe.accountLinks.create({
        account: existing.stripeAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/creator/onboarding`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/creator/dashboard`,
        type: "account_onboarding",
      });

      return {
        accountId: existing.stripeAccountId,
        onboardingUrl: accountLink.url,
      };
    }

    // Create new Connect Express account
    const account = await stripe.accounts.create({
      type: "express",
      email: args.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        creatorId: args.creatorId,
      },
    });

    // Store account in database
    await ctx.runMutation(internal.stripe.mutations.createCreatorAccount, {
      creatorId: args.creatorId,
      stripeAccountId: account.id,
      email: args.email,
    });

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/creator/onboarding`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/creator/dashboard`,
      type: "account_onboarding",
    });

    console.log(`✅ [STRIPE] Created Connect account ${account.id} for creator ${args.creatorId}`);

    return {
      accountId: account.id,
      onboardingUrl: accountLink.url,
    };
  },
});

/**
 * Create Stripe Product and Prices for Community
 * Called during community creation if pricing is enabled
 */
export const createCommunityPricing = action({
  args: {
    communityId: v.id("communities"),
    communityName: v.string(),
    monthlyPrice: v.optional(v.number()),
    yearlyPrice: v.optional(v.number()),
    lifetimePrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stripe = getStripeClient();

    // Create Stripe Product (one per community)
    const product = await stripe.products.create({
      name: args.communityName,
      description: `Access to ${args.communityName} community`,
      metadata: {
        communityId: args.communityId,
      },
    });

    let monthlyPriceId: string | undefined;
    let yearlyPriceId: string | undefined;
    let lifetimePaymentLinkId: string | undefined;

    // Create monthly price if enabled
    if (args.monthlyPrice) {
      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: args.monthlyPrice,
        recurring: {
          interval: "month",
        },
        metadata: {
          communityId: args.communityId,
          tier: "monthly",
        },
      });
      monthlyPriceId = monthlyPrice.id;
    }

    // Create yearly price if enabled
    if (args.yearlyPrice) {
      const yearlyPrice = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: args.yearlyPrice,
        recurring: {
          interval: "year",
        },
        metadata: {
          communityId: args.communityId,
          tier: "yearly",
        },
      });
      yearlyPriceId = yearlyPrice.id;
    }

    // Create payment link for lifetime if enabled
    if (args.lifetimePrice) {
      // We'll handle lifetime via checkout session directly, not payment link
      // Just store the price, no separate Payment Link needed
      lifetimePaymentLinkId = undefined;
    }

    // Update community with Stripe IDs
    await ctx.runMutation(internal.communities.updateStripePricing, {
      communityId: args.communityId,
      stripeProductId: product.id,
      monthlyStripePriceId: monthlyPriceId,
      yearlyStripePriceId: yearlyPriceId,
      lifetimeStripePaymentLinkId: lifetimePaymentLinkId,
    });

    console.log(
      `✅ [STRIPE] Created pricing for community ${args.communityId} - Product: ${product.id}`
    );

    return {
      productId: product.id,
      monthlyPriceId,
      yearlyPriceId,
    };
  },
});
