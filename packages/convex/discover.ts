import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Discover module - Public recipe discovery and search
 * These queries return recipes from all users for discovery purposes
 */

/**
 * Get all extracted recipes from all users, sorted by most recent first
 * This powers the main discover feed showing the latest recipes
 */
export const getAllExtractedRecipes = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()), // Pagination cursor (createdAt timestamp)
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    
    // Query all extracted recipes, ordered by creation time (most recent first)
    let recipesQuery = ctx.db
      .query("extractedRecipes")
      .order("desc");

    // If cursor provided, filter to recipes older than cursor
    if (args.cursor) {
      recipesQuery = recipesQuery.filter((q) => 
        q.lt(q.field("createdAt"), args.cursor!)
      );
    }

    const recipes = await recipesQuery.take(limit + 1);

    // Check if there are more recipes
    const hasMore = recipes.length > limit;
    const returnedRecipes = hasMore ? recipes.slice(0, limit) : recipes;
    
    // Get next cursor from last recipe
    const nextCursor = hasMore 
      ? returnedRecipes[returnedRecipes.length - 1]?.createdAt 
      : undefined;

    return {
      recipes: returnedRecipes.map(recipe => ({
        _id: recipe._id,
        title: recipe.title,
        description: recipe.description,
        imageUrl: recipe.imageUrl,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        servings: recipe.servings,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        category: recipe.category,
        method: recipe.method,
        createdAt: recipe.createdAt,
        url: recipe.url,
        enrichedMetadata: recipe.enrichedMetadata,
      })),
      nextCursor,
      hasMore,
    };
  },
});

/**
 * Search extracted recipes by title or ingredients
 * Simple text-based search for the discover page
 */
export const searchExtractedRecipes = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const searchLower = args.searchTerm.toLowerCase();

    // Get all recipes and filter by search term
    // Note: For production, this should use a proper search index
    const allRecipes = await ctx.db
      .query("extractedRecipes")
      .order("desc")
      .take(500); // Limit initial fetch for performance

    const filteredRecipes = allRecipes.filter(recipe => {
      const titleMatch = recipe.title.toLowerCase().includes(searchLower);
      const ingredientMatch = recipe.ingredients.some(ing => 
        ing.toLowerCase().includes(searchLower)
      );
      const descMatch = recipe.description?.toLowerCase().includes(searchLower);
      const cuisineMatch = recipe.enrichedMetadata?.cuisine?.toLowerCase().includes(searchLower);
      
      return titleMatch || ingredientMatch || descMatch || cuisineMatch;
    }).slice(0, limit);

    return filteredRecipes.map(recipe => ({
      _id: recipe._id,
      title: recipe.title,
      description: recipe.description,
      imageUrl: recipe.imageUrl,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      category: recipe.category,
      method: recipe.method,
      createdAt: recipe.createdAt,
      url: recipe.url,
      enrichedMetadata: recipe.enrichedMetadata,
    }));
  },
});
