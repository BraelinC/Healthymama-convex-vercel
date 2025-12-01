/**
 * Mikey: Instagram DM Automation - Queries
 * Read-only queries for admin dashboard
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Get all Instagram accounts
 */
export const getAllInstagramAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("instagramAccounts").order("desc").collect();
    return accounts;
  },
});

/**
 * Get single Instagram account by ID
 */
export const getInstagramAccount = query({
  args: {
    accountId: v.id("instagramAccounts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});

/**
 * Get Instagram account by Ayrshare profileKey
 */
export const getInstagramAccountByProfileKey = query({
  args: {
    profileKey: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("instagramAccounts")
      .filter((q) => q.eq(q.field("ayrshareProfileKey"), args.profileKey))
      .first();

    return account;
  },
});

/**
 * Get conversation by ID
 */
export const getConversation = query({
  args: {
    conversationId: v.id("dmConversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

/**
 * Get all conversations for an Instagram account
 */
export const getConversationsByAccount = query({
  args: {
    accountId: v.id("instagramAccounts"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const conversations = await ctx.db
      .query("dmConversations")
      .withIndex("by_instagram_account", (q) => q.eq("instagramAccountId", args.accountId))
      .order("desc")
      .take(limit);

    return conversations;
  },
});

/**
 * Get messages for a conversation
 */
export const getMessagesByConversation = query({
  args: {
    conversationId: v.id("dmConversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    const messages = await ctx.db
      .query("dmMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit);

    return messages.reverse(); // Return in chronological order
  },
});

/**
 * Get recent activity across all accounts
 */
export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const messages = await ctx.db
      .query("dmMessages")
      .withIndex("by_status")
      .order("desc")
      .take(limit);

    // Enrich with conversation and account data
    const enriched = await Promise.all(
      messages.map(async (message) => {
        const conversation = await ctx.db.get(message.conversationId);
        if (!conversation) return null;

        const account = await ctx.db.get(conversation.instagramAccountId);
        if (!account) return null;

        return {
          ...message,
          instagramUsername: conversation.instagramUsername,
          accountUsername: account.username,
        };
      })
    );

    return enriched.filter((m) => m !== null);
  },
});

/**
 * Get dashboard statistics
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - 86400000; // 24 hours
    const oneWeekAgo = now - 604800000; // 7 days
    const oneMonthAgo = now - 2592000000; // 30 days

    // Get all accounts
    const allAccounts = await ctx.db.query("instagramAccounts").collect();
    const activeAccounts = allAccounts.filter((a) => a.status === "active");
    const fullAccounts = allAccounts.filter((a) => a.status === "full");

    // Get message counts
    const allMessages = await ctx.db.query("dmMessages").collect();
    const todayMessages = allMessages.filter((m) => m.createdAt > oneDayAgo);
    const weekMessages = allMessages.filter((m) => m.createdAt > oneWeekAgo);
    const monthMessages = allMessages.filter((m) => m.createdAt > oneMonthAgo);

    // Get success/failure rates
    const completedMessages = allMessages.filter((m) => m.status === "completed");
    const failedMessages = allMessages.filter((m) => m.status === "failed");

    // Get total conversations
    const totalConversations = await ctx.db.query("dmConversations").collect();

    return {
      accounts: {
        total: allAccounts.length,
        active: activeAccounts.length,
        full: fullAccounts.length,
        inactive: allAccounts.length - activeAccounts.length - fullAccounts.length,
      },
      messages: {
        today: todayMessages.length,
        week: weekMessages.length,
        month: monthMessages.length,
        total: allMessages.length,
      },
      successRate: {
        completed: completedMessages.length,
        failed: failedMessages.length,
        percentage:
          allMessages.length > 0
            ? Math.round((completedMessages.length / allMessages.length) * 100)
            : 0,
      },
      conversations: {
        total: totalConversations.length,
      },
    };
  },
});

/**
 * Get messages by status (for processing queue)
 */
export const getMessagesByStatus = query({
  args: {
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const messages = await ctx.db
      .query("dmMessages")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(limit);

    return messages;
  },
});

/**
 * Get anonymous recipe for shared viewing (no auth required)
 */
export const getAnonymousRecipe = query({
  args: {
    recipeId: v.id("userRecipes"),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.recipeId);

    if (!recipe) {
      return null;
    }

    // Get image URL
    const imageUrl = recipe.customRecipeData?.imageUrl || recipe.cachedImageUrl;

    // Debug logging
    console.log("[getAnonymousRecipe] Recipe:", recipe._id);
    console.log("[getAnonymousRecipe] customRecipeData imageUrl:", recipe.customRecipeData?.imageUrl);
    console.log("[getAnonymousRecipe] cachedImageUrl:", recipe.cachedImageUrl);
    console.log("[getAnonymousRecipe] Final imageUrl:", imageUrl);

    // Return recipe data (enrich if needed)
    return {
      _id: recipe._id,
      title: recipe.customRecipeData?.title || recipe.cachedTitle || "Recipe",
      description: recipe.customRecipeData?.description,
      imageUrl,
      ingredients: recipe.customRecipeData?.ingredients || [],
      instructions: recipe.customRecipeData?.instructions || [],
      servings: recipe.customRecipeData?.servings,
      prep_time: recipe.customRecipeData?.prep_time,
      cook_time: recipe.customRecipeData?.cook_time,
      cuisine: recipe.customRecipeData?.cuisine,
    };
  },
});

/**
 * Search conversations by Instagram username
 */
export const searchConversations = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const allConversations = await ctx.db.query("dmConversations").collect();

    // Filter by username (case-insensitive)
    const filtered = allConversations.filter((c) =>
      c.instagramUsername.toLowerCase().includes(args.searchTerm.toLowerCase())
    );

    return filtered.slice(0, limit);
  },
});
