import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Share a recipe with another user
 */
export const shareRecipe = mutation({
  args: {
    fromUserId: v.string(),
    toUserId: v.string(),
    recipeId: v.id("userRecipes"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get recipe details for denormalization
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Check if already shared
    const existing = await ctx.db
      .query("sharedRecipes")
      .filter((q) =>
        q.and(
          q.eq(q.field("fromUserId"), args.fromUserId),
          q.eq(q.field("toUserId"), args.toUserId),
          q.eq(q.field("recipeId"), args.recipeId)
        )
      )
      .first();

    if (existing) {
      throw new Error("Recipe already shared with this user");
    }

    // Create share
    const shareId = await ctx.db.insert("sharedRecipes", {
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      recipeId: args.recipeId,
      recipeTitle: recipe.title,
      recipeImageUrl: recipe.imageUrl,
      message: args.message,
      status: "unread",
      createdAt: Date.now(),
    });

    return shareId;
  },
});

/**
 * Get recipes shared with me (received)
 */
export const getRecipesSharedWithMe = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const shares = await ctx.db
      .query("sharedRecipes")
      .withIndex("by_receiver", (q) => q.eq("toUserId", args.userId))
      .order("desc")
      .collect();

    // Enrich with sender info
    const enriched = await Promise.all(
      shares.map(async (share) => {
        const sender = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", share.fromUserId))
          .first();

        return {
          ...share,
          senderName: sender?.prefs?.profileName || sender?.email || "Unknown",
          senderEmail: sender?.email,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get recipes I've shared (sent)
 */
export const getRecipesSharedByMe = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const shares = await ctx.db
      .query("sharedRecipes")
      .withIndex("by_sender", (q) => q.eq("fromUserId", args.userId))
      .order("desc")
      .collect();

    // Enrich with recipient info
    const enriched = await Promise.all(
      shares.map(async (share) => {
        const recipient = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", share.toUserId))
          .first();

        return {
          ...share,
          recipientName: recipient?.prefs?.profileName || recipient?.email || "Unknown",
          recipientEmail: recipient?.email,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get users who I've shared a specific recipe with
 */
export const getSharesForRecipe = query({
  args: {
    userId: v.string(),
    recipeId: v.id("userRecipes"),
  },
  handler: async (ctx, args) => {
    const shares = await ctx.db
      .query("sharedRecipes")
      .withIndex("by_recipe", (q) => q.eq("recipeId", args.recipeId))
      .filter((q) => q.eq(q.field("fromUserId"), args.userId))
      .collect();

    // Enrich with recipient info
    const enriched = await Promise.all(
      shares.map(async (share) => {
        const recipient = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", share.toUserId))
          .first();

        return {
          ...share,
          recipientName: recipient?.prefs?.profileName || recipient?.email || "Unknown",
          recipientEmail: recipient?.email,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get count of unread shared recipes (for notification badge)
 */
export const getUnreadShareCount = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Use simple index and filter to avoid compound index issues during deployment
    const unreadShares = await ctx.db
      .query("sharedRecipes")
      .withIndex("by_receiver", (q) => q.eq("toUserId", args.userId))
      .filter((q) => q.eq(q.field("status"), "unread"))
      .collect();

    return unreadShares.length;
  },
});

/**
 * Mark a shared recipe as viewed
 */
export const markShareAsViewed = mutation({
  args: {
    shareId: v.id("sharedRecipes"),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Share not found");
    }

    if (share.status === "unread") {
      await ctx.db.patch(args.shareId, {
        status: "viewed",
        viewedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Mark a shared recipe as saved (when recipient saves it to their cookbook)
 */
export const markShareAsSaved = mutation({
  args: {
    shareId: v.id("sharedRecipes"),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db.get(args.shareId);
    if (!share) {
      throw new Error("Share not found");
    }

    await ctx.db.patch(args.shareId, {
      status: "saved",
      savedAt: Date.now(),
    });

    return { success: true };
  },
});
