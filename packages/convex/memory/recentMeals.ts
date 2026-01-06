// @ts-nocheck
import { v } from "convex/values";
import { action, internalMutation, query } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Track a recipe discussion in recentMeals table
 * Called after recipes are shown to user
 */
export const trackRecipeDiscussion = internalMutation({
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
    discussedInSession: v.id("chatSessions"),
    discussedInMessage: v.id("chatMessages"),
    mealType: v.optional(v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack")
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if this exact recipe was already tracked in this session recently (within 5 minutes)
    const existingRecent = await ctx.db
      .query("recentMeals")
      .withIndex("by_user_recipe", (q) =>
        q.eq("userId", args.userId).eq("recipeId", args.recipeId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("discussedInSession"), args.discussedInSession),
          q.gt(q.field("discussedAt"), now - 5 * 60 * 1000) // Within 5 minutes
        )
      )
      .first();

    if (existingRecent) {
      console.log(`[RECENT MEALS] Skipping duplicate: ${args.recipeName} (already tracked)`);
      return existingRecent._id;
    }

    // Track new recipe discussion
    const id = await ctx.db.insert("recentMeals", {
      userId: args.userId,
      recipeId: args.recipeId,
      recipeName: args.recipeName,
      recipeType: args.recipeType,
      discussedInSession: args.discussedInSession,
      discussedInMessage: args.discussedInMessage,
      mealType: args.mealType,
      discussedAt: now,
      createdAt: now,
    });

    console.log(`[RECENT MEALS] Tracked: ${args.recipeName} (type: ${args.recipeType})`);
    return id;
  },
});

/**
 * Get recent meals for a user (for injection into context)
 */
export const getRecentMeals = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    days: v.optional(v.number()), // How many days back to look
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const days = args.days || 7;
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const recentMeals = await ctx.db
      .query("recentMeals")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", args.userId).gt("discussedAt", cutoffTime)
      )
      .order("desc")
      .take(limit);

    return recentMeals.map((meal) => ({
      _id: meal._id,
      recipeId: meal.recipeId,
      recipeName: meal.recipeName,
      recipeType: meal.recipeType,
      discussedAt: meal.discussedAt,
      mealType: meal.mealType,
    }));
  },
});

/**
 * Search recent meals by query (for memory router)
 * Used when user asks "the lasagna from last week"
 */
export const searchRecentMeals = action({
  args: {
    userId: v.string(),
    query: v.string(),
    timeRangeDays: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    const days = args.timeRangeDays || 30; // Default: last 30 days
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get recent meals within time range
    const recentMeals = await ctx.runQuery(api.memory.recentMeals.getRecentMeals, {
      userId: args.userId,
      limit: limit * 3, // Get more for filtering
      days,
    });

    // Simple text matching (fuzzy search by recipe name)
    const query = args.query.toLowerCase();
    const matches = recentMeals.filter((meal) =>
      meal.recipeName.toLowerCase().includes(query) ||
      query.includes(meal.recipeName.toLowerCase())
    );

    return matches.slice(0, limit);
  },
});

/**
 * Get last time user touched a specific recipe
 * Returns most recent discussion + total touch count
 */
export const getLastRecipeTouch = query({
  args: {
    userId: v.string(),
    recipeId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all touches for this recipe (sorted most recent first)
    const allTouches = await ctx.db
      .query("recentMeals")
      .withIndex("by_user_recipe", (q) =>
        q.eq("userId", args.userId).eq("recipeId", args.recipeId)
      )
      .order("desc")
      .collect();

    if (allTouches.length === 0) {
      return null;
    }

    const lastTouch = allTouches[0];

    return {
      lastTouchedAt: lastTouch.discussedAt,
      recipeName: lastTouch.recipeName,
      recipeType: lastTouch.recipeType,
      discussedInSession: lastTouch.discussedInSession,
      discussedInMessage: lastTouch.discussedInMessage,
      mealType: lastTouch.mealType,
      totalTouchCount: allTouches.length,
      // Include date helper
      daysAgo: Math.floor((Date.now() - lastTouch.discussedAt) / (1000 * 60 * 60 * 24)),
    };
  },
});
