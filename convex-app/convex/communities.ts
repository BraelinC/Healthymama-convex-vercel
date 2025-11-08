import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get all communities
export const getAllCommunities = query({
  args: {},
  handler: async (ctx) => {
    const communities = await ctx.db
      .query("communities")
      .order("desc")
      .collect();

    // Add coverImage URL from storage if storageId exists
    return await Promise.all(
      communities.map(async (community) => {
        let coverImage = community.coverImage; // Legacy URL

        // If we have a storageId, get the URL from storage
        if (community.coverImageStorageId) {
          coverImage = await ctx.storage.getUrl(community.coverImageStorageId);
        }

        return {
          ...community,
          coverImage, // Override with storage URL if available
        };
      })
    );
  },
});

// Query: Get community by ID
export const getCommunityById = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, args) => {
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error(`Community with ID ${args.communityId} not found`);
    }

    // Get coverImage URL from storage if storageId exists
    let coverImage = community.coverImage; // Legacy URL
    if (community.coverImageStorageId) {
      coverImage = await ctx.storage.getUrl(community.coverImageStorageId);
    }

    return {
      ...community,
      coverImage, // Override with storage URL if available
    };
  },
});

// Query: Get community by ID (alias for Stripe actions)
export const get = query({
  args: { id: v.id("communities") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: Get user's last visited community
export const getUserLastVisitedCommunity = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) {
      return null;
    }

    // Check if user has a last visited community
    const lastVisitedCommunityId = user.prefs?.lastVisitedCommunityId;
    if (!lastVisitedCommunityId) {
      return null;
    }

    // Get the community
    const community = await ctx.db.get(lastVisitedCommunityId);
    return community || null;
  },
});

// Mutation: Update user's last visited community
export const updateLastVisitedCommunity = mutation({
  args: {
    userId: v.string(),
    communityId: v.id("communities"),
  },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) {
      throw new Error(`User with ID ${args.userId} not found`);
    }

    // Verify the community exists
    const community = await ctx.db.get(args.communityId);
    if (!community) {
      throw new Error(`Community with ID ${args.communityId} not found`);
    }

    // Update the user's preferences
    await ctx.db.patch(user._id, {
      prefs: {
        ...user.prefs,
        lastVisitedCommunityId: args.communityId,
        lastVisitedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Query: Get user's accessible communities (subscribed, purchased, free, or created)
export const getUserAccessibleCommunities = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all communities
    const allCommunities = await ctx.db.query("communities").collect();

    // Get user's active subscriptions
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "trialing")
        )
      )
      .collect();

    const subscribedCommunityIds = new Set(
      subscriptions.map((s) => s.communityId)
    );

    // Get user's lifetime purchases
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "succeeded"))
      .collect();

    const purchasedCommunityIds = new Set(
      purchases.map((p) => p.communityId)
    );

    // Filter accessible communities
    const accessibleCommunities = allCommunities.filter((community) => {
      // Free communities
      const isFree =
        !community.monthlyPrice &&
        !community.yearlyPrice &&
        !community.lifetimePrice;

      // User is creator
      const isCreator = community.creatorId === args.userId;

      // User has subscription or purchase
      const hasSubscription = subscribedCommunityIds.has(community._id);
      const hasPurchase = purchasedCommunityIds.has(community._id);

      return isFree || isCreator || hasSubscription || hasPurchase;
    });

    return accessibleCommunities;
  },
});

// Mutation: Create a new community (creators only)
export const createCommunity = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    coverImage: v.optional(v.string()), // Legacy: URL-based images
    coverImageStorageId: v.optional(v.id("_storage")), // New: UploadStuff storage ID
    nationalities: v.array(v.string()),
    // Multi-tier pricing (in cents)
    monthlyPrice: v.optional(v.number()),
    yearlyPrice: v.optional(v.number()),
    lifetimePrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is a creator
    if (!user.isCreator) {
      throw new Error("Only creators can create communities. Please contact support to become a creator.");
    }

    // Create the community
    const communityId = await ctx.db.insert("communities", {
      name: args.name,
      description: args.description,
      category: args.category,
      memberCount: 1, // Creator is the first member
      isPublic: true,
      coverImage: args.coverImage, // Legacy: URL-based images
      coverImageStorageId: args.coverImageStorageId, // New: UploadStuff storage ID
      rating: 0, // No ratings yet
      recipeCount: 0, // No recipes yet
      nationalities: args.nationalities,
      creator: {
        name: user.prefs?.profileName || user.email,
        avatar: undefined,
      },
      creatorId: user.userId,
      // Multi-tier pricing
      monthlyPrice: args.monthlyPrice,
      yearlyPrice: args.yearlyPrice,
      lifetimePrice: args.lifetimePrice,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      communityId,
    };
  },
});

// Mutation: Seed communities (for initial setup)
export const seedCommunities = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if communities already exist
    const existingCommunities = await ctx.db.query("communities").collect();
    if (existingCommunities.length > 0) {
      return {
        success: false,
        message: "Communities already seeded",
        count: existingCommunities.length
      };
    }

    // Mock communities from the frontend
    const mockCommunities = [
      {
        name: "Godsplan",
        description: "Divine recipes and meal planning for spiritual nourishment",
        category: "Religious",
        memberCount: 234,
        isPublic: true,
        rating: 4.8,
        recipeCount: 156,
        nationalities: ["American", "Mediterranean"],
        creator: { name: "Pastor John", avatar: undefined },
        price: 0,
        priceType: "free" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Italian Pasta Masters",
        description: "Authentic Italian pasta recipes from Nonna's kitchen",
        category: "Cuisine",
        memberCount: 1250,
        isPublic: true,
        rating: 4.9,
        recipeCount: 342,
        nationalities: ["Italian"],
        creator: { name: "Chef Marco", avatar: undefined },
        price: 9.99,
        priceType: "month" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Asian Fusion Kitchen",
        description: "Modern fusion of traditional Asian cuisines",
        category: "Cuisine",
        memberCount: 892,
        isPublic: true,
        rating: 4.7,
        recipeCount: 278,
        nationalities: ["Chinese", "Japanese", "Thai", "Korean"],
        creator: { name: "Chef Li", avatar: undefined },
        price: 12.99,
        priceType: "month" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Keto Warriors",
        description: "Low-carb, high-fat recipes for ketogenic lifestyle",
        category: "Diet",
        memberCount: 2100,
        isPublic: true,
        rating: 4.6,
        recipeCount: 445,
        nationalities: ["American", "European"],
        creator: { name: "Dr. Sarah", avatar: undefined },
        price: 14.99,
        priceType: "month" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Vegan Delights",
        description: "Delicious plant-based recipes for every meal",
        category: "Diet",
        memberCount: 1680,
        isPublic: true,
        rating: 4.8,
        recipeCount: 512,
        nationalities: ["Global"],
        creator: { name: "Chef Emma", avatar: undefined },
        price: 0,
        priceType: "free" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: "Quick Family Meals",
        description: "30-minute meals that the whole family will love",
        category: "Lifestyle",
        memberCount: 3200,
        isPublic: true,
        rating: 4.7,
        recipeCount: 389,
        nationalities: ["American"],
        creator: { name: "Mom's Kitchen", avatar: undefined },
        price: 7.99,
        priceType: "month" as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    // Insert all communities
    const insertedIds = [];
    for (const community of mockCommunities) {
      const id = await ctx.db.insert("communities", community);
      insertedIds.push(id);
    }

    return {
      success: true,
      message: "Successfully seeded communities",
      count: insertedIds.length,
      ids: insertedIds,
    };
  },
});
