import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * Track a recipe interaction anywhere in the app
 * Call this whenever user interacts with a recipe (view, save, cook, share, etc.)
 */
export const trackRecipeInteraction = mutation({
  args: {
    userId: v.string(),
    recipeId: v.string(),
    recipeName: v.string(),
    recipeType: v.union(
      v.literal("community"),
      v.literal("extracted"),
      v.literal("user"),
      v.literal("ai_generated")
    ),
    interactionType: v.union(
      v.literal("viewed"),
      v.literal("discussed"),
      v.literal("saved_to_cookbook"),
      v.literal("cooked"),
      v.literal("shared"),
      v.literal("imported")
    ),
    contextId: v.optional(v.string()),
    contextType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for duplicate interaction within 1 minute (prevent spam)
    const recentDuplicate = await ctx.db
      .query("recipeInteractions")
      .withIndex("by_user_recipe_time", (q) =>
        q.eq("userId", args.userId).eq("recipeId", args.recipeId)
      )
      .order("desc")
      .first();

    if (
      recentDuplicate &&
      recentDuplicate.interactionType === args.interactionType &&
      now - recentDuplicate.timestamp < 60 * 1000 // Within 1 minute
    ) {
      console.log(
        `[RECIPE INTERACTIONS] Skipping duplicate: ${args.recipeName} (${args.interactionType})`
      );
      return recentDuplicate._id;
    }

    // Track new interaction
    const id = await ctx.db.insert("recipeInteractions", {
      userId: args.userId,
      recipeId: args.recipeId,
      recipeName: args.recipeName,
      recipeType: args.recipeType,
      interactionType: args.interactionType,
      contextId: args.contextId,
      contextType: args.contextType,
      timestamp: now,
      createdAt: now,
    });

    console.log(
      `[RECIPE INTERACTIONS] Tracked: ${args.recipeName} - ${args.interactionType}` +
      (args.contextType ? ` (${args.contextType})` : "")
    );

    return id;
  },
});

/**
 * Get last time user interacted with a specific recipe (any interaction type)
 * Returns most recent interaction + total interaction count
 */
export const getLastRecipeInteraction = query({
  args: {
    userId: v.string(),
    recipeId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all interactions for this recipe (sorted most recent first)
    const allInteractions = await ctx.db
      .query("recipeInteractions")
      .withIndex("by_user_recipe_time", (q) =>
        q.eq("userId", args.userId).eq("recipeId", args.recipeId)
      )
      .order("desc")
      .collect();

    if (allInteractions.length === 0) {
      return null;
    }

    const lastInteraction = allInteractions[0];

    // Count interactions by type
    const interactionCounts: Record<string, number> = {};
    allInteractions.forEach((interaction) => {
      interactionCounts[interaction.interactionType] =
        (interactionCounts[interaction.interactionType] || 0) + 1;
    });

    return {
      lastInteractedAt: lastInteraction.timestamp,
      lastInteractionType: lastInteraction.interactionType,
      recipeName: lastInteraction.recipeName,
      recipeType: lastInteraction.recipeType,
      contextId: lastInteraction.contextId,
      contextType: lastInteraction.contextType,
      totalInteractions: allInteractions.length,
      interactionCounts,
      // Helper: how many days since last interaction
      daysAgo: Math.floor(
        (Date.now() - lastInteraction.timestamp) / (1000 * 60 * 60 * 24)
      ),
    };
  },
});

/**
 * Get full interaction history for a specific recipe
 */
export const getRecipeInteractionHistory = query({
  args: {
    userId: v.string(),
    recipeId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const interactions = await ctx.db
      .query("recipeInteractions")
      .withIndex("by_user_recipe_time", (q) =>
        q.eq("userId", args.userId).eq("recipeId", args.recipeId)
      )
      .order("desc")
      .take(limit);

    return interactions.map((interaction) => ({
      _id: interaction._id,
      interactionType: interaction.interactionType,
      timestamp: interaction.timestamp,
      contextId: interaction.contextId,
      contextType: interaction.contextType,
      daysAgo: Math.floor(
        (Date.now() - interaction.timestamp) / (1000 * 60 * 60 * 24)
      ),
    }));
  },
});

/**
 * Get all recipes user has interacted with (by interaction type)
 * Example: Get all recipes user marked as "cooked"
 */
export const getRecipesByInteractionType = query({
  args: {
    userId: v.string(),
    interactionType: v.union(
      v.literal("viewed"),
      v.literal("discussed"),
      v.literal("saved_to_cookbook"),
      v.literal("cooked"),
      v.literal("shared"),
      v.literal("imported")
    ),
    limit: v.optional(v.number()),
    days: v.optional(v.number()), // How many days back to look
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const cutoffTime = args.days
      ? Date.now() - args.days * 24 * 60 * 60 * 1000
      : 0;

    const interactions = await ctx.db
      .query("recipeInteractions")
      .withIndex("by_interaction_type", (q) =>
        q.eq("userId", args.userId).eq("interactionType", args.interactionType)
      )
      .order("desc")
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .take(limit);

    // Group by recipe (show most recent interaction per recipe)
    const recipeMap = new Map();
    interactions.forEach((interaction) => {
      if (!recipeMap.has(interaction.recipeId)) {
        recipeMap.set(interaction.recipeId, {
          recipeId: interaction.recipeId,
          recipeName: interaction.recipeName,
          recipeType: interaction.recipeType,
          lastInteractedAt: interaction.timestamp,
          contextId: interaction.contextId,
          contextType: interaction.contextType,
        });
      }
    });

    return Array.from(recipeMap.values());
  },
});

/**
 * Get recent recipe interactions across ALL types (activity feed)
 */
export const getRecentInteractions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const cutoffTime = args.days
      ? Date.now() - args.days * 24 * 60 * 60 * 1000
      : 0;

    const interactions = await ctx.db
      .query("recipeInteractions")
      .withIndex("by_user_time", (q) => q.eq("userId", args.userId))
      .order("desc")
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .take(limit);

    return interactions.map((interaction) => ({
      _id: interaction._id,
      recipeId: interaction.recipeId,
      recipeName: interaction.recipeName,
      recipeType: interaction.recipeType,
      interactionType: interaction.interactionType,
      timestamp: interaction.timestamp,
      contextId: interaction.contextId,
      contextType: interaction.contextType,
      daysAgo: Math.floor(
        (Date.now() - interaction.timestamp) / (1000 * 60 * 60 * 24)
      ),
    }));
  },
});
