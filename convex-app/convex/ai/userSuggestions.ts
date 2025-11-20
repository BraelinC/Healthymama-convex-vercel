import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { api } from "../_generated/api";

const SUGGESTIONS_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get user suggestions (from cache or generate new ones)
 * Main function to call from frontend
 */
export const getOrGenerateSuggestions = action({
  args: {
    userId: v.string(),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check cache first (unless force refresh)
    if (!args.forceRefresh) {
      const cached = await ctx.runQuery(api.ai.userSuggestions.getCachedSuggestions, {
        userId: args.userId,
      });

      if (cached && cached.expiresAt > now) {
        console.log(`[USER SUGGESTIONS] Using cached suggestions (age: ${Math.floor((now - cached.generatedAt) / 1000)}s)`);
        return {
          suggestions: cached.suggestions,
          fromCache: true,
          generatedAt: cached.generatedAt,
        };
      }
    }

    // Generate new suggestions
    console.log("[USER SUGGESTIONS] Generating new suggestions...");
    const generated = await ctx.runAction(api.ai.generateSuggestions.generateSuggestions, {
      userId: args.userId,
    });

    // Save to cache
    await ctx.runMutation(api.ai.userSuggestions.saveSuggestions, {
      userId: args.userId,
      suggestions: generated.suggestions,
      contextSnapshot: generated.contextSnapshot,
    });

    return {
      suggestions: generated.suggestions,
      fromCache: false,
      generatedAt: generated.generatedAt,
    };
  },
});

/**
 * Get cached suggestions for a user
 */
export const getCachedSuggestions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const suggestion = await ctx.db
      .query("userSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    return suggestion;
  },
});

/**
 * Save suggestions to cache
 */
export const saveSuggestions = mutation({
  args: {
    userId: v.string(),
    suggestions: v.array(v.string()),
    contextSnapshot: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + SUGGESTIONS_TTL;

    // Check if user already has suggestions
    const existing = await ctx.db
      .query("userSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        suggestions: args.suggestions,
        generatedAt: now,
        expiresAt,
        contextSnapshot: args.contextSnapshot,
        updatedAt: now,
      });

      console.log(`[USER SUGGESTIONS] Updated suggestions for user ${args.userId}`);
      return existing._id;
    } else {
      // Create new
      const id = await ctx.db.insert("userSuggestions", {
        userId: args.userId,
        suggestions: args.suggestions,
        generatedAt: now,
        expiresAt,
        contextSnapshot: args.contextSnapshot,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`[USER SUGGESTIONS] Created new suggestions for user ${args.userId}`);
      return id;
    }
  },
});

/**
 * Delete user suggestions (for testing/cleanup)
 */
export const deleteSuggestions = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const suggestions = await ctx.db
      .query("userSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const suggestion of suggestions) {
      await ctx.db.delete(suggestion._id);
    }

    console.log(`[USER SUGGESTIONS] Deleted ${suggestions.length} suggestion records for user ${args.userId}`);
  },
});
