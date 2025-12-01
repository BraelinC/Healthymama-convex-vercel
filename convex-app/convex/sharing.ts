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

    // Extract full recipe data (ingredients, instructions, etc.)
    // Use customRecipeData for custom/AI recipes, or fetch from source for referenced recipes
    const recipeTitle = recipe.customRecipeData?.title || recipe.cachedTitle || recipe.title || "Recipe";
    const recipeImageUrl = recipe.customRecipeData?.imageUrl || recipe.cachedImageUrl || recipe.imageUrl;
    const recipeIngredients = recipe.customRecipeData?.ingredients || recipe.ingredients || [];
    const recipeInstructions = recipe.customRecipeData?.instructions || recipe.instructions || [];
    const recipeDescription = recipe.customRecipeData?.description || recipe.description;

    // Create share with FULL recipe data cached
    const shareId = await ctx.db.insert("sharedRecipes", {
      fromUserId: args.fromUserId,
      toUserId: args.toUserId,
      recipeId: args.recipeId,
      recipeTitle,
      recipeImageUrl,
      recipeIngredients,
      recipeInstructions,
      recipeDescription,
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

/**
 * Get friends sorted by most recently shared with
 */
export const getFriendsForSharing = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all friendships where user is userId1
    const friendships1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_status", (q) =>
        q.eq("userId1", args.userId).eq("status", "accepted")
      )
      .collect();

    // Get friendships where user is userId2
    const friendships2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_status", (q) =>
        q.eq("userId2", args.userId).eq("status", "accepted")
      )
      .collect();

    // Get friend IDs
    const friendIds: string[] = [
      ...friendships1.map((f) => f.userId2),
      ...friendships2.map((f) => f.userId1),
    ];

    // Get recent shares to these friends
    const recentShares = await ctx.db
      .query("sharedRecipes")
      .withIndex("by_sender", (q) => q.eq("fromUserId", args.userId))
      .order("desc")
      .collect();

    // Build a map of friendId -> most recent share timestamp
    const lastShareMap = new Map<string, number>();
    for (const share of recentShares) {
      if (friendIds.includes(share.toUserId) && !lastShareMap.has(share.toUserId)) {
        lastShareMap.set(share.toUserId, share.createdAt);
      }
    }

    // Get friend details with profile images
    const friends = await Promise.all(
      friendIds.map(async (friendId) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", friendId))
          .first();

        // Get profile image
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", friendId))
          .first();

        let profileImageUrl: string | null = null;
        if (profile?.profileImageStorageId) {
          profileImageUrl = await ctx.storage.getUrl(profile.profileImageStorageId);
        }

        return {
          userId: friendId,
          name: user?.prefs?.profileName || user?.email?.split("@")[0] || "Unknown",
          email: user?.email || "",
          profileImageUrl,
          lastSharedAt: lastShareMap.get(friendId) || 0,
        };
      })
    );

    // Sort by most recently shared first, then by name
    friends.sort((a, b) => {
      if (a.lastSharedAt && b.lastSharedAt) {
        return b.lastSharedAt - a.lastSharedAt;
      }
      if (a.lastSharedAt) return -1;
      if (b.lastSharedAt) return 1;
      return a.name.localeCompare(b.name);
    });

    return friends;
  },
});
