import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ==================== MUTATIONS ====================

/**
 * Save a recipe to user's cookbook
 */
export const saveRecipeToUserCookbook = mutation({
  args: {
    userId: v.string(),
    recipeType: v.union(v.literal("extracted"), v.literal("community"), v.literal("custom")),
    cookbookCategory: v.string(),

    // Recipe data
    title: v.string(),
    description: v.optional(v.string()),
    image_url: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),

    // Optional metadata
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    time_minutes: v.optional(v.number()),
    cuisine: v.optional(v.string()),
    diet: v.optional(v.string()),
    category: v.optional(v.string()),

    // Source references
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
    communityRecipeId: v.optional(v.id("recipes")),

    // User preferences
    isFavorited: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if recipe already exists in user's cookbook
    const existing = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();

    if (existing) {
      // Update existing recipe's cookbook category
      await ctx.db.patch(existing._id, {
        cookbookCategory: args.cookbookCategory,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new user recipe
    const userRecipeId = await ctx.db.insert("userRecipes", {
      userId: args.userId,
      recipeType: args.recipeType,
      cookbookCategory: args.cookbookCategory,

      title: args.title,
      description: args.description,
      image_url: args.image_url,
      ingredients: args.ingredients,
      instructions: args.instructions,

      servings: args.servings,
      prep_time: args.prep_time,
      cook_time: args.cook_time,
      time_minutes: args.time_minutes,
      cuisine: args.cuisine,
      diet: args.diet,
      category: args.category,

      extractedRecipeId: args.extractedRecipeId,
      communityRecipeId: args.communityRecipeId,

      isFavorited: args.isFavorited || false,
      createdAt: now,
      updatedAt: now,
    });

    return userRecipeId;
  },
});

/**
 * Remove a recipe from user's cookbook
 */
export const removeRecipeFromCookbook = mutation({
  args: {
    userId: v.string(),
    userRecipeId: v.id("userRecipes"),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const recipe = await ctx.db.get(args.userRecipeId);
    if (!recipe || recipe.userId !== args.userId) {
      throw new Error("Recipe not found or access denied");
    }

    await ctx.db.delete(args.userRecipeId);
    return { success: true };
  },
});

/**
 * Move a recipe to a different cookbook category
 */
export const updateRecipeCookbook = mutation({
  args: {
    userId: v.string(),
    userRecipeId: v.id("userRecipes"),
    newCookbookCategory: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const recipe = await ctx.db.get(args.userRecipeId);
    if (!recipe || recipe.userId !== args.userId) {
      throw new Error("Recipe not found or access denied");
    }

    await ctx.db.patch(args.userRecipeId, {
      cookbookCategory: args.newCookbookCategory,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Toggle favorite status of a recipe
 */
export const toggleRecipeFavorite = mutation({
  args: {
    userId: v.string(),
    userRecipeId: v.id("userRecipes"),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const recipe = await ctx.db.get(args.userRecipeId);
    if (!recipe || recipe.userId !== args.userId) {
      throw new Error("Recipe not found or access denied");
    }

    const newFavoriteStatus = !recipe.isFavorited;

    await ctx.db.patch(args.userRecipeId, {
      isFavorited: newFavoriteStatus,
      updatedAt: Date.now(),
    });

    return { isFavorited: newFavoriteStatus };
  },
});

/**
 * Update recipe access time (for tracking recently accessed recipes)
 */
export const updateRecipeAccessTime = mutation({
  args: {
    userId: v.string(),
    userRecipeId: v.id("userRecipes"),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.db.get(args.userRecipeId);
    if (!recipe || recipe.userId !== args.userId) {
      return { success: false };
    }

    await ctx.db.patch(args.userRecipeId, {
      lastAccessedAt: Date.now(),
    });

    return { success: true };
  },
});

// ==================== QUERIES ====================

/**
 * Get all recipes for a specific cookbook category
 */
export const getUserRecipesByCookbook = query({
  args: {
    userId: v.string(),
    cookbookCategory: v.string(),
  },
  handler: async (ctx, args) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", args.userId).eq("cookbookCategory", args.cookbookCategory)
      )
      .order("desc")
      .collect();

    return recipes;
  },
});

/**
 * Get all user's saved recipes
 */
export const getAllUserRecipes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return recipes;
  },
});

/**
 * Get user's favorited recipes
 */
export const getFavoritedRecipes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_favorited", (q) =>
        q.eq("userId", args.userId).eq("isFavorited", true)
      )
      .order("desc")
      .collect();

    return recipes;
  },
});

/**
 * Get cookbook statistics (recipe counts per category)
 */
export const getCookbookStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const allRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Group by cookbook category
    const stats: Record<string, { count: number; recipes: any[] }> = {};

    for (const recipe of allRecipes) {
      if (!stats[recipe.cookbookCategory]) {
        stats[recipe.cookbookCategory] = { count: 0, recipes: [] };
      }
      stats[recipe.cookbookCategory].count++;
      stats[recipe.cookbookCategory].recipes.push(recipe);
    }

    // Get first 4 recipe images for each cookbook
    const cookbookCategories = [
      "uncategorized",
      "breakfast",
      "lunch",
      "dinner",
      "dessert",
      "snacks",
    ];

    const result = cookbookCategories.map((category) => {
      const data = stats[category] || { count: 0, recipes: [] };
      const recipeImages = data.recipes
        .filter((r) => r.image_url)
        .slice(0, 4)
        .map((r) => r.image_url);

      return {
        id: category,
        name: category.charAt(0).toUpperCase() + category.slice(1),
        recipeCount: data.count,
        recipeImages,
      };
    });

    return result;
  },
});

/**
 * Search user's recipes by title or ingredients
 */
export const searchUserRecipes = query({
  args: {
    userId: v.string(),
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    const allRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const searchLower = args.searchTerm.toLowerCase();

    const filtered = allRecipes.filter((recipe) => {
      const titleMatch = recipe.title.toLowerCase().includes(searchLower);
      const ingredientMatch = recipe.ingredients.some((ing) =>
        ing.toLowerCase().includes(searchLower)
      );

      return titleMatch || ingredientMatch;
    });

    return filtered;
  },
});
