/**
 * Recipe Maintenance Module
 * Administrative functions for managing embedded recipes
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Delete all embedded recipes for a specific community
 * This allows re-embedding with updated schema (e.g., imageUrl field)
 *
 * NOTE: This only deletes from the 'recipes' table (embedded recipes).
 * The 'extractedRecipes' table (source data) remains untouched.
 */
export const deleteRecipesForCommunity = mutation({
  args: {
    communityId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`🗑️ [RECIPE MAINTENANCE] Deleting all embedded recipes for community: ${args.communityId}`);

    // Find all recipes for this community
    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_community", (q) => q.eq("community", args.communityId))
      .collect();

    console.log(`📋 [RECIPE MAINTENANCE] Found ${recipes.length} recipes to delete`);

    // Delete each recipe
    let deletedCount = 0;
    for (const recipe of recipes) {
      await ctx.db.delete(recipe._id);
      deletedCount++;
    }

    console.log(`✅ [RECIPE MAINTENANCE] Deleted ${deletedCount} recipes from 'recipes' table`);
    console.log(`ℹ️ [RECIPE MAINTENANCE] Source data in 'extractedRecipes' table remains intact`);

    return {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} embedded recipes. Source data preserved.`,
    };
  },
});

/**
 * Delete ALL embedded recipes across all communities
 * Nuclear option - use with caution!
 *
 * NOTE: This only deletes from the 'recipes' table (embedded recipes).
 * The 'extractedRecipes' table (source data) remains untouched.
 */
export const deleteAllRecipes = mutation({
  args: {},
  handler: async (ctx) => {
    console.log(`🗑️ [RECIPE MAINTENANCE] Deleting ALL embedded recipes (nuclear option)`);

    // Get all recipes
    const recipes = await ctx.db.query("recipes").collect();

    console.log(`📋 [RECIPE MAINTENANCE] Found ${recipes.length} total recipes to delete`);

    // Delete each recipe
    let deletedCount = 0;
    for (const recipe of recipes) {
      await ctx.db.delete(recipe._id);
      deletedCount++;
    }

    console.log(`✅ [RECIPE MAINTENANCE] Deleted ${deletedCount} recipes from 'recipes' table`);
    console.log(`ℹ️ [RECIPE MAINTENANCE] Source data in 'extractedRecipes' table remains intact`);

    return {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} embedded recipes. Source data preserved.`,
    };
  },
});

/**
 * Get recipe counts by community (diagnostic)
 */
export const getRecipeCounts = mutation({
  args: {},
  handler: async (ctx) => {
    const recipes = await ctx.db.query("recipes").collect();
    const extractedRecipes = await ctx.db.query("extractedRecipes").collect();

    // Group by community
    const recipesByCommunity = recipes.reduce((acc, recipe) => {
      acc[recipe.community] = (acc[recipe.community] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const extractedByCommunity = extractedRecipes.reduce((acc, recipe) => {
      acc[recipe.communityId] = (acc[recipe.communityId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalEmbeddedRecipes: recipes.length,
      totalExtractedRecipes: extractedRecipes.length,
      embeddedByCommunity: recipesByCommunity,
      extractedByCommunity: extractedByCommunity,
    };
  },
});
