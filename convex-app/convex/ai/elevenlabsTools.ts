/**
 * ElevenLabs Conversational AI Tools
 * Webhook handlers for voice assistant tools
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";

/**
 * Search recipes by natural language query
 * Called by ElevenLabs agent when user asks for recipes
 */
export const searchRecipes = action({
  args: {
    query: v.string(),
    userId: v.string(),
    communityId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log(`[ELEVENLABS TOOL] search_recipes called: "${args.query}" for user ${args.userId}`);

    try {
      // Use default community if not provided
      const communityId = args.communityId || "default";
      const limit = args.limit || 5;

      // Call existing recipe search action
      const recipes = await ctx.runAction(internal["recipes/recipeRetrieval"].searchRecipesByQuery, {
        query: args.query,
        communityId,
        userId: args.userId,
        limit,
      });

      console.log(`[ELEVENLABS TOOL] Found ${recipes.length} recipes for "${args.query}"`);

      // Format response for voice assistant
      return {
        success: true,
        count: recipes.length,
        recipes: recipes.map((recipe) => ({
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          dietTags: recipe.dietTags,
          imageUrl: recipe.imageUrl,
          similarity: recipe.similarity,
        })),
      };
    } catch (error) {
      console.error("[ELEVENLABS TOOL] search_recipes error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search recipes",
        count: 0,
        recipes: [],
      };
    }
  },
});

/**
 * Get personalized meal suggestions
 * Called by ElevenLabs agent when user asks "what should I make?"
 */
export const getSuggestions = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[ELEVENLABS TOOL] get_suggestions called for user ${args.userId}`);

    try {
      // Call AI suggestion generator
      const result = await ctx.runAction(internal["ai/generateSuggestions"].generateSuggestions, {
        userId: args.userId,
      });

      console.log(`[ELEVENLABS TOOL] Generated ${result.suggestions.length} suggestions`);

      return {
        success: true,
        suggestions: result.suggestions,
        contextSnapshot: result.contextSnapshot,
      };
    } catch (error) {
      console.error("[ELEVENLABS TOOL] get_suggestions error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate suggestions",
        suggestions: [
          "Quick breakfast",
          "Healthy lunch",
          "Easy dinner",
          "Protein snack",
          "Light meal",
        ],
      };
    }
  },
});

/**
 * Search user's memory for preferences and history
 * Called by ElevenLabs agent when user asks about past preferences
 */
export const searchMemory = action({
  args: {
    query: v.string(),
    userId: v.string(),
    timeRange: v.optional(v.union(v.literal("last_week"), v.literal("last_month"), v.literal("all_time"))),
    memoryType: v.optional(v.union(v.literal("preference"), v.literal("conversation"), v.literal("all"))),
  },
  handler: async (ctx, args) => {
    console.log(`[ELEVENLABS TOOL] search_memory called: "${args.query}" for user ${args.userId}`);

    try {
      const results: any[] = [];

      // Search learned preferences
      if (!args.memoryType || args.memoryType === "preference" || args.memoryType === "all") {
        const preferences = await ctx.runQuery(api.memory.learnedPreferences.getTopPreferences, {
          userId: args.userId,
          agentId: undefined,
          limit: 5,
        });

        results.push(...preferences.map((p: any) => ({
          type: "preference",
          summary: p.summary,
          preferenceType: p.preferenceType,
          confidence: p.confidence,
          createdAt: p.createdAt,
        })));
      }

      // Search recent meals
      if (!args.memoryType || args.memoryType === "all") {
        const days = args.timeRange === "last_week" ? 7 : args.timeRange === "last_month" ? 30 : 90;
        const recentMeals = await ctx.runQuery(api.memory.recentMeals.getRecentMeals, {
          userId: args.userId,
          limit: 5,
          days,
        });

        results.push(...recentMeals.map((m: any) => ({
          type: "recent_meal",
          recipeName: m.recipeName,
          recipeId: m.recipeId,
          cookedAt: m.cookedAt,
        })));
      }

      // Get user profile
      const userProfile = await ctx.runQuery(api.userProfile.getUserProfile, {
        userId: args.userId,
      });

      if (userProfile) {
        results.push({
          type: "profile",
          name: userProfile.name,
          familySize: userProfile.familySize,
          allergens: userProfile.allergens,
          dietaryPreferences: userProfile.dietaryPreferences,
          preferredCuisines: userProfile.preferredCuisines,
        });
      }

      console.log(`[ELEVENLABS TOOL] Found ${results.length} memory items`);

      return {
        success: true,
        count: results.length,
        results,
      };
    } catch (error) {
      console.error("[ELEVENLABS TOOL] search_memory error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search memory",
        count: 0,
        results: [],
      };
    }
  },
});
