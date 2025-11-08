/**
 * Instagram Recipe Import
 * Handles importing recipes from Instagram reels
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Import an Instagram recipe to user's cookbook
 *
 * Creates an "instagram" cookbook category if it doesn't exist yet
 */
export const importInstagramRecipe = mutation({
  args: {
    userId: v.string(),

    // Recipe data (parsed from Instagram caption/comments)
    title: v.string(),
    description: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),

    // Optional metadata
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    cuisine: v.optional(v.string()),

    // Instagram-specific data
    instagramUrl: v.string(),
    instagramVideoUrl: v.optional(v.string()),
    instagramThumbnailUrl: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const {
      userId,
      title,
      description,
      ingredients,
      instructions,
      servings,
      prep_time,
      cook_time,
      cuisine,
      instagramUrl,
      instagramVideoUrl,
      instagramThumbnailUrl,
      instagramUsername,
    } = args;

    // Check if recipe with same Instagram URL already exists
    const existingRecipe = await ctx.db
      .query("userRecipes")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("title"), title),
          q.eq(q.field("cookbookCategory"), "instagram")
        )
      )
      .first();

    if (existingRecipe) {
      console.log(`[Instagram] Recipe "${title}" already imported for user ${userId}`);
      return {
        success: false,
        error: "This recipe has already been imported",
        recipeId: existingRecipe._id,
      };
    }

    // Create recipe in userRecipes table
    const recipeId = await ctx.db.insert("userRecipes", {
      userId,

      // Recipe type: using "community" since Instagram imports are external
      recipeType: "community",

      // Recipe data
      title,
      description: description || `Recipe from @${instagramUsername || 'Instagram'}`,
      ingredients,
      instructions,

      // Use Instagram thumbnail as image
      imageUrl: instagramThumbnailUrl || instagramVideoUrl,

      // Optional metadata
      servings,
      prep_time,
      cook_time,
      cuisine,

      // Cookbook organization - use "instagram" category
      cookbookCategory: "instagram",

      // User metadata
      notes: `Imported from Instagram: ${instagramUrl}`,
      isFavorited: false,

      // Timestamps
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`[Instagram] ✅ Imported recipe "${title}" for user ${userId}`);

    return {
      success: true,
      recipeId,
      message: `Recipe "${title}" imported successfully!`,
    };
  },
});

/**
 * Get all Instagram-imported recipes for a user
 */
export const getInstagramRecipes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", userId).eq("cookbookCategory", "instagram")
      )
      .order("desc")
      .collect();

    return recipes;
  },
});

/**
 * Get Instagram cookbook stats (count of recipes)
 */
export const getInstagramCookbookStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", userId).eq("cookbookCategory", "instagram")
      )
      .collect();

    // Get recipe images for preview
    const recipeImages = recipes
      .slice(0, 4) // First 4 recipes
      .map((recipe) => recipe.imageUrl)
      .filter((url): url is string => url !== undefined);

    return {
      id: "instagram",
      name: "Instagram",
      recipeCount: recipes.length,
      recipeImages,
    };
  },
});

/**
 * Delete an Instagram recipe
 */
export const deleteInstagramRecipe = mutation({
  args: {
    userId: v.string(),
    recipeId: v.id("userRecipes"),
  },
  handler: async (ctx, { userId, recipeId }) => {
    // Verify the recipe belongs to the user and is an Instagram import
    const recipe = await ctx.db.get(recipeId);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    if (recipe.userId !== userId) {
      throw new Error("Unauthorized: This recipe does not belong to you");
    }

    if (recipe.cookbookCategory !== "instagram") {
      throw new Error("This recipe is not an Instagram import");
    }

    // Delete the recipe
    await ctx.db.delete(recipeId);

    console.log(`[Instagram] 🗑️ Deleted recipe ${recipeId} for user ${userId}`);

    return {
      success: true,
      message: "Recipe deleted successfully",
    };
  },
});
