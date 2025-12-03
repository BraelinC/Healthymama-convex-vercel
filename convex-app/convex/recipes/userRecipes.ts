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
    console.log(`[enrichUserRecipe] No source recipe found for ${userRecipe._id}, using cached/top-level data`);
    console.log(`[enrichUserRecipe] 🎥 MUX fields:`, {
      muxPlaybackId: userRecipe.muxPlaybackId,
      muxAssetId: userRecipe.muxAssetId,
      instagramVideoUrl: userRecipe.instagramVideoUrl,
    });
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
    title: sourceRecipe?.name || sourceRecipe?.title || userRecipe.title || "Recipe",
    description: sourceRecipe?.description || userRecipe.description,
    imageUrl: sourceRecipe?.imageUrl || userRecipe.imageUrl,
    ingredients: sourceRecipe?.ingredients || userRecipe.ingredients || [],
    instructions: sourceRecipe?.steps || sourceRecipe?.instructions || userRecipe.instructions || [],
    servings: sourceRecipe?.servings || userRecipe.servings,
    prep_time: sourceRecipe?.prep_time || userRecipe.prep_time,
    cook_time: sourceRecipe?.cook_time || userRecipe.cook_time,
    time_minutes: sourceRecipe?.time_minutes || userRecipe.time_minutes,
    cuisine: sourceRecipe?.cuisine || userRecipe.cuisine,
    diet: sourceRecipe?.diet || userRecipe.diet,
    category: sourceRecipe?.category || userRecipe.category,
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

    // Check if recipe already exists in the SAME cookbook
    // (Allows same-titled recipes in different cookbooks)
    const existing = await ctx.runQuery(api.recipes.userRecipes.getUserRecipeByTitle, {
      userId: args.userId,
      title: args.title,
    });

    if (existing && existing.cookbookCategory === args.cookbookCategory) {
      // Update existing recipe ONLY if it's in the same cookbook
      await ctx.runMutation(api.recipes.userRecipes.updateUserRecipe, {
        userRecipeId: existing._id,
        cookbookCategory: args.cookbookCategory,
        parsedIngredients,
      });
      return existing._id;
    }
    // Otherwise, create a new recipe (even if same title, different cookbook)

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

    console.log("[saveRecipeWithParsedIngredients] Received recipe ID from mutation:", userRecipeId);
    console.log("[saveRecipeWithParsedIngredients] Returning recipe ID:", userRecipeId);

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

    console.log("[saveRecipeToUserCookbookWithParsed] Inserting recipe:", args.title, "for user:", args.userId);
    console.log("[saveRecipeToUserCookbookWithParsed] 🎥 MUX fields being saved:", {
      muxPlaybackId: args.muxPlaybackId,
      muxAssetId: args.muxAssetId,
      instagramVideoUrl: args.instagramVideoUrl,
    });

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

    console.log("[saveRecipeToUserCookbookWithParsed] Recipe inserted with ID:", userRecipeId);
    console.log("[saveRecipeToUserCookbookWithParsed] ID type check - starts with correct prefix:", String(userRecipeId).substring(0, 3));

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

    console.log(`[getUserRecipeById] Raw recipe from DB - 🎥 MUX fields:`, {
      id: userRecipe._id,
      muxPlaybackId: userRecipe.muxPlaybackId,
      muxAssetId: userRecipe.muxAssetId,
    });

    const enriched = await enrichUserRecipeWithSource(ctx, userRecipe);

    console.log(`[getUserRecipeById] After enrichment - 🎥 MUX fields:`, {
      id: enriched._id,
      muxPlaybackId: enriched.muxPlaybackId,
      muxAssetId: enriched.muxAssetId,
    });

    return enriched;
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

    console.log("[updateRecipeCookbook] BEFORE update - Recipe:", args.userRecipeId);
    console.log("[updateRecipeCookbook] BEFORE update - 🎥 MUX fields:", {
      muxPlaybackId: recipe.muxPlaybackId,
      muxAssetId: recipe.muxAssetId,
      instagramVideoUrl: recipe.instagramVideoUrl,
    });

    await ctx.db.patch(args.userRecipeId, {
      cookbookCategory: args.newCookbookCategory,
      updatedAt: Date.now(),
    });

    // Verify muxPlaybackId is still there after update
    const updatedRecipe = await ctx.db.get(args.userRecipeId);
    console.log("[updateRecipeCookbook] AFTER update - 🎥 MUX fields:", {
      muxPlaybackId: updatedRecipe?.muxPlaybackId,
      muxAssetId: updatedRecipe?.muxAssetId,
      instagramVideoUrl: updatedRecipe?.instagramVideoUrl,
    });

    return { success: true };
  },
});

/**
 * Save a shared recipe to user's cookbook
 * Creates a reference to another user's recipe
 */
export const saveSharedRecipeToUserCookbook = mutation({
  args: {
    userId: v.string(),
    sharedRecipeId: v.id("userRecipes"), // User A's recipe
    cookbookCategory: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the shared recipe (User A's recipe)
    const sharedRecipe = await ctx.db.get(args.sharedRecipeId);
    if (!sharedRecipe) {
      throw new Error("Shared recipe not found");
    }

    // Check if user already saved this recipe
    const existing = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("sharedFromRecipeId"), args.sharedRecipeId))
      .first();

    if (existing) {
      // Already saved - just update cookbook category
      await ctx.db.patch(existing._id, {
        cookbookCategory: args.cookbookCategory,
        updatedAt: Date.now(),
      });
      return { success: true, recipeId: existing._id };
    }

    // Find the share record to get cached recipe data (ingredients, instructions, etc.)
    const share = await ctx.db
      .query("sharedRecipes")
      .filter((q) =>
        q.and(
          q.eq(q.field("toUserId"), args.userId),
          q.eq(q.field("recipeId"), args.sharedRecipeId)
        )
      )
      .first();

    // For custom/AI recipes, copy the customRecipeData
    let customRecipeDataCopy = undefined;
    if (sharedRecipe.recipeType === "custom" || sharedRecipe.recipeType === "ai_generated") {
      customRecipeDataCopy = sharedRecipe.customRecipeData;
    }
    // For extracted/community recipes, use cached data from share if available
    else if (share && (share.recipeIngredients || share.recipeInstructions)) {
      // Convert share cached data to customRecipeData format
      customRecipeDataCopy = {
        title: share.recipeTitle,
        description: share.recipeDescription,
        imageUrl: share.recipeImageUrl,
        ingredients: share.recipeIngredients || [],
        instructions: share.recipeInstructions || [],
        // Note: servings, prep_time, cook_time, cuisine not in share cache yet
        servings: undefined,
        prep_time: undefined,
        cook_time: undefined,
        time_minutes: undefined,
        cuisine: undefined,
        diet: undefined,
        category: undefined,
      };
    }
    // For community recipes (Instagram/YouTube/Pinterest) without share cache,
    // copy data from top-level fields (community recipes don't use customRecipeData)
    else if (sharedRecipe.recipeType === "community") {
      // Get enriched data which includes ingredients/instructions from source
      const enrichedRecipe = await enrichUserRecipeWithSource(ctx, sharedRecipe);
      if (enrichedRecipe.ingredients && enrichedRecipe.instructions) {
        customRecipeDataCopy = {
          title: enrichedRecipe.title || sharedRecipe.cachedTitle,
          description: enrichedRecipe.description,
          imageUrl: enrichedRecipe.imageUrl || sharedRecipe.cachedImageUrl,
          ingredients: enrichedRecipe.ingredients,
          instructions: enrichedRecipe.instructions,
          servings: enrichedRecipe.servings,
          prep_time: enrichedRecipe.prep_time,
          cook_time: enrichedRecipe.cook_time,
          time_minutes: enrichedRecipe.time_minutes,
          cuisine: enrichedRecipe.cuisine,
          diet: enrichedRecipe.diet,
          category: enrichedRecipe.category,
        };
      }
    }

    // Create new userRecipe entry for User B
    const newRecipeId = await ctx.db.insert("userRecipes", {
      userId: args.userId,

      // If we have cached data, use "custom" type to embed the full recipe
      // Otherwise reference the same source as the shared recipe
      recipeType: customRecipeDataCopy ? "custom" : sharedRecipe.recipeType,
      ...(customRecipeDataCopy
        ? { customRecipeData: customRecipeDataCopy }
        : {
            sourceRecipeId: sharedRecipe.sourceRecipeId,
            sourceRecipeType: sharedRecipe.sourceRecipeType,
          }
      ),

      // Store reference to the recipe this was shared from
      sharedFromRecipeId: args.sharedRecipeId,
      sharedFromUserId: sharedRecipe.userId,

      // Cached data for quick display (fallback if source is deleted)
      cachedTitle: share?.recipeTitle || sharedRecipe.title || sharedRecipe.cachedTitle,
      cachedImageUrl: share?.recipeImageUrl || sharedRecipe.imageUrl || sharedRecipe.cachedImageUrl,

      // User B's organization
      cookbookCategory: args.cookbookCategory,

      // Copy Mux video data from shared recipe (for Instagram/video recipes)
      muxPlaybackId: sharedRecipe.muxPlaybackId,
      muxAssetId: sharedRecipe.muxAssetId,
      instagramVideoUrl: sharedRecipe.instagramVideoUrl,
      instagramUsername: sharedRecipe.instagramUsername,
      videoSegments: sharedRecipe.videoSegments,

      // Metadata
      isFavorited: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: Date.now(),
    });

    // Mark share as saved
    if (share) {
      await ctx.db.patch(share._id, {
        status: "saved",
        savedAt: Date.now(),
      });
    }

    return { success: true, recipeId: newRecipeId };
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

    console.log(`[getUserRecipesByCookbook] Found ${userRecipes.length} recipes in ${args.cookbookCategory}`);
    if (userRecipes.length > 0) {
      console.log(`[getUserRecipesByCookbook] First recipe 🎥 MUX fields:`, {
        id: userRecipes[0]._id,
        muxPlaybackId: userRecipes[0].muxPlaybackId,
        muxAssetId: userRecipes[0].muxAssetId,
      });
    }

    // Enrich each recipe with source data
    const enrichedRecipes = await Promise.all(
      userRecipes.map((recipe) => enrichUserRecipeWithSource(ctx, recipe))
    );

    if (enrichedRecipes.length > 0) {
      console.log(`[getUserRecipesByCookbook] After enrichment - First recipe 🎥 MUX fields:`, {
        id: enrichedRecipes[0]._id,
        muxPlaybackId: enrichedRecipes[0].muxPlaybackId,
        muxAssetId: enrichedRecipes[0].muxAssetId,
      });
    }

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
      "favorites",
      "breakfast",
      "lunch",
      "dinner",
      "dessert",
      "snacks",
    ];

    const result = cookbookCategories.map((category) => {
      const data = stats[category] || { count: 0, recipes: [] };
      const recipeImages = data.recipes
        .map((r) => {
          // Check customRecipeData first (for custom/AI recipes), then cachedImageUrl, then top-level imageUrl
          return r.customRecipeData?.imageUrl || r.cachedImageUrl || r.imageUrl;
        })
        .filter((url) => url) // Remove null/undefined URLs
        .slice(0, 4);

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

// ==================== PREFETCH QUERIES ====================

/**
 * Get top N recent recipes for cache prefetching
 * Used by GlobalCacheWarmer to pre-load recipes on app start
 */
export const getRecentRecipesForPrefetch = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    // Enrich each recipe with source data (with error handling)
    const enrichedRecipes = await Promise.all(
      recipes.map(async (recipe) => {
        try {
          return await enrichUserRecipeWithSource(ctx, recipe);
        } catch (error) {
          console.error(`[Prefetch] Error enriching recipe ${recipe._id}:`, error);
          // Return recipe as-is if enrichment fails
          return recipe;
        }
      })
    );

    return enrichedRecipes;
  },
});

/**
 * Batch prefetch cookbook recipes with full enrichment
 *
 * Fetches all recipes in a cookbook and enriches them server-side in parallel.
 * This is more efficient than N separate client queries and avoids React hooks issues.
 * The result is automatically cached by ConvexQueryCacheProvider on the client.
 */
export const prefetchCookbookRecipes = query({
  args: {
    userId: v.string(),
    cookbookCategory: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all recipes in cookbook
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", args.userId).eq("cookbookCategory", args.cookbookCategory)
      )
      .collect();

    // Enrich ALL recipes in parallel (batch operation)
    const enriched = await Promise.all(
      recipes.map(async (recipe) => {
        try {
          return await enrichUserRecipeWithSource(ctx, recipe);
        } catch (error) {
          console.error(`[Cookbook Prefetch] Error enriching recipe ${recipe._id}:`, error);
          return recipe;
        }
      })
    );

    return enriched;
  },
});
