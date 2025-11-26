import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { parseIngredientsWithAI } from "../groceries";

// ==================== HELPER FUNCTIONS ====================

/**
 * Helper: Fetch and merge source recipe data with user recipe metadata
 * Handles both old and new schema formats
 */
async function enrichUserRecipeWithSource(ctx: any, userRecipe: any) {
  // Custom or AI-generated recipes: use embedded data
  if (userRecipe.recipeType === "custom" || userRecipe.recipeType === "ai_generated") {
    if (userRecipe.customRecipeData) {
      // New format: use customRecipeData
      return {
        ...userRecipe,
        title: userRecipe.customRecipeData.title,
        description: userRecipe.customRecipeData.description,
        imageUrl: userRecipe.customRecipeData.imageUrl,
        ingredients: userRecipe.customRecipeData.ingredients,
        instructions: userRecipe.customRecipeData.instructions,
        servings: userRecipe.customRecipeData.servings,
        prep_time: userRecipe.customRecipeData.prep_time,
        cook_time: userRecipe.customRecipeData.cook_time,
        time_minutes: userRecipe.customRecipeData.time_minutes,
        cuisine: userRecipe.customRecipeData.cuisine,
        diet: userRecipe.customRecipeData.diet,
        category: userRecipe.customRecipeData.category,
      };
    } else {
      // Old format: use top-level fields (migration compatibility)
      return userRecipe;
    }
  }

  // Referenced recipes: JOIN with source table
  let sourceRecipe = null;

  // Try new format first (sourceRecipeId + sourceRecipeType)
  if (userRecipe.sourceRecipeId && userRecipe.sourceRecipeType) {
    if (userRecipe.sourceRecipeType === "community") {
      sourceRecipe = await ctx.db.get(userRecipe.sourceRecipeId as Id<"recipes">);
    } else if (userRecipe.sourceRecipeType === "extracted") {
      sourceRecipe = await ctx.db.get(userRecipe.sourceRecipeId as Id<"extractedRecipes">);
    }
  }
  // Fall back to old format (communityRecipeId / extractedRecipeId)
  else if (userRecipe.communityRecipeId) {
    sourceRecipe = await ctx.db.get(userRecipe.communityRecipeId);
  } else if (userRecipe.extractedRecipeId) {
    sourceRecipe = await ctx.db.get(userRecipe.extractedRecipeId);
  }

  // Source recipe not found - use cached data or old fields
  if (!sourceRecipe) {
    return {
      ...userRecipe,
      title: userRecipe.cachedTitle || userRecipe.title || "Recipe Unavailable",
      description: userRecipe.description || "This recipe is no longer available",
      imageUrl: userRecipe.cachedImageUrl || userRecipe.imageUrl,
      ingredients: userRecipe.ingredients || [],
      instructions: userRecipe.instructions || [],
    };
  }

  // Merge source recipe data with user metadata
  return {
    ...userRecipe,
    title: sourceRecipe.name || sourceRecipe.title,
    description: sourceRecipe.description,
    imageUrl: sourceRecipe.imageUrl,
    ingredients: sourceRecipe.ingredients,
    instructions: sourceRecipe.steps || sourceRecipe.instructions,
    servings: sourceRecipe.servings,
    prep_time: sourceRecipe.prep_time,
    cook_time: sourceRecipe.cook_time,
    time_minutes: sourceRecipe.time_minutes,
    cuisine: sourceRecipe.cuisine,
    diet: sourceRecipe.diet,
    category: sourceRecipe.category,
  };
}

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
    imageUrl: v.optional(v.string()),
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

    // Mux video hosting (for Instagram imports)
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    instagramVideoUrl: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),

    // AI-analyzed video segments for step-by-step cooking mode
    videoSegments: v.optional(v.array(v.object({
      stepNumber: v.number(),
      instruction: v.string(),
      startTime: v.number(),
      endTime: v.number(),
    }))),
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

      // NEW: Reference architecture for community/extracted recipes
      sourceRecipeId: args.communityRecipeId || args.extractedRecipeId,
      sourceRecipeType: args.communityRecipeId ? "community" : (args.extractedRecipeId ? "extracted" : undefined),

      // OLD: Keep legacy fields for migration compatibility
      extractedRecipeId: args.extractedRecipeId,
      communityRecipeId: args.communityRecipeId,

      // NEW: Cache title/image for fallback
      cachedTitle: args.title,
      cachedImageUrl: args.imageUrl,

      // Referenced recipes (community/extracted): Don't store full data
      // Custom recipes: Store in customRecipeData
      ...(args.recipeType === "custom" ? {
        customRecipeData: {
          title: args.title,
          description: args.description,
          imageUrl: args.imageUrl,
          ingredients: args.ingredients,
          instructions: args.instructions,
          servings: args.servings,
          prep_time: args.prep_time,
          cook_time: args.cook_time,
          time_minutes: args.time_minutes,
          cuisine: args.cuisine,
          diet: args.diet,
          category: args.category,
        },
      } : {
        // OLD FORMAT: For backward compatibility, keep top-level fields
        // TODO: Remove these fields in future migration
        title: args.title,
        description: args.description,
        imageUrl: args.imageUrl,
        ingredients: args.ingredients,
        instructions: args.instructions,
        servings: args.servings,
        prep_time: args.prep_time,
        cook_time: args.cook_time,
        time_minutes: args.time_minutes,
        cuisine: args.cuisine,
        diet: args.diet,
        category: args.category,
      }),

      isFavorited: args.isFavorited || false,

      // Mux video hosting (for Instagram imports)
      muxPlaybackId: args.muxPlaybackId,
      muxAssetId: args.muxAssetId,
      instagramVideoUrl: args.instagramVideoUrl,
      instagramUsername: args.instagramUsername,

      // AI-analyzed video segments for step-by-step cooking mode
      videoSegments: args.videoSegments,

      createdAt: now,
      updatedAt: now,
    });

    return userRecipeId;
  },
});

// ==================== ACTIONS ====================

/**
 * Save recipe WITH pre-parsed ingredients for instant grocery lists
 * This action parses ingredients once with AI, then saves to database
 */
export const saveRecipeWithParsedIngredients = action({
  args: {
    userId: v.string(),
    recipeType: v.union(v.literal("extracted"), v.literal("community"), v.literal("custom")),
    cookbookCategory: v.string(),

    // Recipe data
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
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

    // Mux video hosting (for Instagram imports)
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    instagramVideoUrl: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),

    // AI-analyzed video segments for step-by-step cooking mode
    videoSegments: v.optional(v.array(v.object({
      stepNumber: v.number(),
      instruction: v.string(),
      startTime: v.number(),
      endTime: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const openRouterKey = process.env.OPEN_ROUTER_API_KEY;

    let parsedIngredients = undefined;

    // Parse ingredients with AI if OpenRouter key is available
    if (openRouterKey) {
      try {
        console.log(`[SAVE RECIPE] Parsing ${args.ingredients.length} ingredients with AI`);
        const parsed = await parseIngredientsWithAI(args.ingredients, openRouterKey);

        // Keep measurements array format to match schema
        // AI returns: {name, display_text, measurements: [{quantity, unit}]}
        // Schema expects: {name, display_text, measurements: [{quantity, unit}]}
        parsedIngredients = parsed.map((ing: any) => ({
          name: ing.name,
          display_text: ing.display_text,
          measurements: ing.measurements || [{ quantity: 1, unit: "each" }],
        }));

        console.log(`[SAVE RECIPE] ✅ Successfully parsed ${parsedIngredients.length} ingredients`);
      } catch (error: any) {
        console.error(`[SAVE RECIPE] ❌ Failed to parse ingredients:`, error.message);
        // Continue without parsed ingredients - they'll be parsed later if needed
      }
    }

    // Check if recipe already exists
    const existing = await ctx.runQuery(api.recipes.userRecipes.getUserRecipeByTitle, {
      userId: args.userId,
      title: args.title,
    });

    if (existing) {
      // Update existing recipe
      await ctx.runMutation(api.recipes.userRecipes.updateUserRecipe, {
        userRecipeId: existing._id,
        cookbookCategory: args.cookbookCategory,
        parsedIngredients,
      });
      return existing._id;
    }

    // Create new recipe with parsed ingredients
    const userRecipeId = await ctx.runMutation(api.recipes.userRecipes.saveRecipeToUserCookbookWithParsed, {
      userId: args.userId,
      recipeType: args.recipeType,
      cookbookCategory: args.cookbookCategory,

      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      ingredients: args.ingredients,
      instructions: args.instructions,
      parsedIngredients,

      servings: args.servings,
      prep_time: args.prep_time,
      cook_time: args.cook_time,
      time_minutes: args.time_minutes,
      cuisine: args.cuisine,
      diet: args.diet,
      category: args.category,

      extractedRecipeId: args.extractedRecipeId,
      communityRecipeId: args.communityRecipeId,

      isFavorited: args.isFavorited,

      // Mux video hosting
      muxPlaybackId: args.muxPlaybackId,
      muxAssetId: args.muxAssetId,
      instagramVideoUrl: args.instagramVideoUrl,
      instagramUsername: args.instagramUsername,

      // AI-analyzed video segments
      videoSegments: args.videoSegments,
    });

    return userRecipeId;
  },
});

// ==================== MUTATIONS ====================

/**
 * Internal mutation to save recipe with parsed ingredients
 */
export const saveRecipeToUserCookbookWithParsed = mutation({
  args: {
    userId: v.string(),
    recipeType: v.union(v.literal("extracted"), v.literal("community"), v.literal("custom")),
    cookbookCategory: v.string(),

    // Recipe data
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    parsedIngredients: v.optional(v.array(v.object({
      name: v.string(),
      display_text: v.string(),
      measurements: v.array(v.object({
        quantity: v.number(),
        unit: v.string(),
      })),
    }))),

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

    // Mux video hosting (for Instagram imports)
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),
    instagramVideoUrl: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),

    // AI-analyzed video segments for step-by-step cooking mode
    videoSegments: v.optional(v.array(v.object({
      stepNumber: v.number(),
      instruction: v.string(),
      startTime: v.number(),
      endTime: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const userRecipeId = await ctx.db.insert("userRecipes", {
      userId: args.userId,
      recipeType: args.recipeType,
      cookbookCategory: args.cookbookCategory,

      // NEW: Reference architecture for community/extracted recipes
      sourceRecipeId: args.communityRecipeId || args.extractedRecipeId,
      sourceRecipeType: args.communityRecipeId ? "community" : (args.extractedRecipeId ? "extracted" : undefined),

      // OLD: Keep legacy fields for migration compatibility
      extractedRecipeId: args.extractedRecipeId,
      communityRecipeId: args.communityRecipeId,

      // NEW: Cache title/image for fallback
      cachedTitle: args.title,
      cachedImageUrl: args.imageUrl,

      // User-specific optimization (always keep parsedIngredients)
      parsedIngredients: args.parsedIngredients,

      // Referenced recipes (community/extracted): Don't store full data
      // Custom recipes: Store in customRecipeData
      ...(args.recipeType === "custom" ? {
        customRecipeData: {
          title: args.title,
          description: args.description,
          imageUrl: args.imageUrl,
          ingredients: args.ingredients,
          instructions: args.instructions,
          servings: args.servings,
          prep_time: args.prep_time,
          cook_time: args.cook_time,
          time_minutes: args.time_minutes,
          cuisine: args.cuisine,
          diet: args.diet,
          category: args.category,
        },
      } : {
        // OLD FORMAT: For backward compatibility, keep top-level fields
        // TODO: Remove these fields in future migration
        title: args.title,
        description: args.description,
        imageUrl: args.imageUrl,
        ingredients: args.ingredients,
        instructions: args.instructions,
        servings: args.servings,
        prep_time: args.prep_time,
        cook_time: args.cook_time,
        time_minutes: args.time_minutes,
        cuisine: args.cuisine,
        diet: args.diet,
        category: args.category,
      }),

      isFavorited: args.isFavorited || false,

      // Mux video hosting (for Instagram imports)
      muxPlaybackId: args.muxPlaybackId,
      muxAssetId: args.muxAssetId,
      instagramVideoUrl: args.instagramVideoUrl,
      instagramUsername: args.instagramUsername,

      // AI-analyzed video segments for step-by-step cooking mode
      videoSegments: args.videoSegments,

      createdAt: now,
      updatedAt: now,
    });

    return userRecipeId;
  },
});

/**
 * Update existing user recipe
 */
export const updateUserRecipe = mutation({
  args: {
    userRecipeId: v.id("userRecipes"),
    cookbookCategory: v.optional(v.string()),
    parsedIngredients: v.optional(v.array(v.object({
      name: v.string(),
      display_text: v.string(),
      measurements: v.array(v.object({
        quantity: v.number(),
        unit: v.string(),
      })),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.userRecipeId, {
      cookbookCategory: args.cookbookCategory,
      parsedIngredients: args.parsedIngredients,
      updatedAt: now,
    });
  },
});

/**
 * Get user recipe by title (for deduplication)
 */
export const getUserRecipeByTitle = query({
  args: {
    userId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();
  },
});

/**
 * Get a single user recipe by ID (with JOIN to source recipe)
 */
export const getUserRecipeById = query({
  args: {
    recipeId: v.id("userRecipes"),
  },
  handler: async (ctx, args) => {
    const userRecipe = await ctx.db.get(args.recipeId);
    if (!userRecipe) return null;

    return await enrichUserRecipeWithSource(ctx, userRecipe);
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
    const userRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", args.userId).eq("cookbookCategory", args.cookbookCategory)
      )
      .order("desc")
      .collect();

    // Enrich each recipe with source data
    const enrichedRecipes = await Promise.all(
      userRecipes.map((recipe) => enrichUserRecipeWithSource(ctx, recipe))
    );

    return enrichedRecipes;
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
    const userRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Enrich each recipe with source data
    const enrichedRecipes = await Promise.all(
      userRecipes.map((recipe) => enrichUserRecipeWithSource(ctx, recipe))
    );

    return enrichedRecipes;
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
    const userRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_favorited", (q) =>
        q.eq("userId", args.userId).eq("isFavorited", true)
      )
      .order("desc")
      .collect();

    // Enrich each recipe with source data
    const enrichedRecipes = await Promise.all(
      userRecipes.map((recipe) => enrichUserRecipeWithSource(ctx, recipe))
    );

    return enrichedRecipes;
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
        .filter((r) => r.imageUrl)
        .slice(0, 4)
        .map((r) => r.imageUrl);

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
    const userRecipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Enrich each recipe with source data first
    const enrichedRecipes = await Promise.all(
      userRecipes.map((recipe) => enrichUserRecipeWithSource(ctx, recipe))
    );

    const searchLower = args.searchTerm.toLowerCase();

    // Filter enriched recipes by title or ingredients
    const filtered = enrichedRecipes.filter((recipe) => {
      const titleMatch = recipe.title?.toLowerCase().includes(searchLower);
      const ingredientMatch = recipe.ingredients?.some((ing) =>
        ing.toLowerCase().includes(searchLower)
      );

      return titleMatch || ingredientMatch;
    });

    return filtered;
  },
});

// ==================== BACKFILL ====================

/**
 * Backfill parsed ingredients for existing recipes
 * This action will parse ingredients for all recipes that don't have parsedIngredients
 */
export const backfillParsedIngredients = action({
  args: {
    userId: v.string(), // Required: backfill recipes for this user
    batchSize: v.optional(v.number()), // Number of recipes to process per run (default: 10)
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 10;
    const openRouterKey = process.env.OPEN_ROUTER_API_KEY;

    if (!openRouterKey) {
      throw new Error("OPEN_ROUTER_API_KEY not configured");
    }

    console.log(`[BACKFILL] Starting backfill for user ${args.userId} (batch size: ${batchSize})`);

    // Get all recipes for this user
    const allRecipes = await ctx.runQuery(api.recipes.userRecipes.getAllUserRecipes, {
      userId: args.userId,
    });

    // Filter to recipes without parsed ingredients
    const unparsedRecipes = allRecipes.filter((recipe: any) => !recipe.parsedIngredients);

    console.log(`[BACKFILL] Found ${unparsedRecipes.length} recipes without parsed ingredients`);

    if (unparsedRecipes.length === 0) {
      return {
        success: true,
        message: "All recipes already have parsed ingredients",
        processed: 0,
        remaining: 0,
      };
    }

    // Process batch
    const recipesToProcess = unparsedRecipes.slice(0, batchSize);
    let successCount = 0;
    let errorCount = 0;

    for (const recipe of recipesToProcess) {
      try {
        console.log(`[BACKFILL] Parsing recipe: "${recipe.title}" (${recipe.ingredients.length} ingredients)`);

        // Parse ingredients with AI
        const parsed = await parseIngredientsWithAI(recipe.ingredients, openRouterKey);

        // Update recipe with parsed ingredients
        await ctx.runMutation(api.recipes.userRecipes.updateUserRecipe, {
          userRecipeId: recipe._id,
          parsedIngredients: parsed,
        });

        console.log(`[BACKFILL] ✅ Parsed ${parsed.length} ingredients for "${recipe.title}"`);
        successCount++;
      } catch (error: any) {
        console.error(`[BACKFILL] ❌ Failed to parse "${recipe.title}":`, error.message);
        errorCount++;
      }
    }

    const remaining = unparsedRecipes.length - recipesToProcess.length;

    console.log(`[BACKFILL] Batch complete: ${successCount} success, ${errorCount} errors, ${remaining} remaining`);

    return {
      success: true,
      processed: successCount,
      errors: errorCount,
      remaining,
      message: remaining > 0
        ? `Processed ${successCount} recipes. ${remaining} recipes remaining. Run again to continue.`
        : `All recipes processed! ${successCount} recipes updated.`,
    };
  },
});
