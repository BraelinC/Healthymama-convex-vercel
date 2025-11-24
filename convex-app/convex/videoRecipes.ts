import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Creates a new video recipe import job
 */
export const createVideoRecipe = mutation({
  args: {
    userId: v.string(),
    sourceUrl: v.string(),
    sourcePlatform: v.union(
      v.literal("youtube"),
      v.literal("instagram"),
      v.literal("tiktok"),
      v.literal("other")
    ),
    videoId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipeId = await ctx.db.insert("videoRecipes", {
      userId: args.userId,
      sourceUrl: args.sourceUrl,
      sourcePlatform: args.sourcePlatform,
      videoId: args.videoId,
      // Placeholder values (will be updated later)
      muxAssetId: "",
      muxPlaybackId: "",
      muxUploadId: "",
      muxThumbnailUrl: "",
      title: "",
      ingredients: [],
      instructions: [],
      extractionStatus: "downloading",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return recipeId;
  },
});

/**
 * Updates the extraction status of a video recipe
 */
export const updateStatus = mutation({
  args: {
    id: v.id("videoRecipes"),
    status: v.union(
      v.literal("downloading"),
      v.literal("uploading_to_mux"),
      v.literal("analyzing_with_ai"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      extractionStatus: args.status,
      extractionError: args.error,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates Mux-related data after upload
 */
export const updateMuxData = mutation({
  args: {
    id: v.id("videoRecipes"),
    muxAssetId: v.string(),
    muxPlaybackId: v.string(),
    muxUploadId: v.string(),
    muxThumbnailUrl: v.string(),
    videoDuration: v.optional(v.number()),
    videoResolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      muxAssetId: args.muxAssetId,
      muxPlaybackId: args.muxPlaybackId,
      muxUploadId: args.muxUploadId,
      muxThumbnailUrl: args.muxThumbnailUrl,
      videoDuration: args.videoDuration,
      videoResolution: args.videoResolution,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Updates recipe data after Gemini analysis
 */
export const updateRecipeData = mutation({
  args: {
    id: v.id("videoRecipes"),
    title: v.string(),
    description: v.optional(v.string()),
    ingredients: v.array(v.object({
      name: v.string(),
      quantity: v.optional(v.string()),
      unit: v.optional(v.string()),
    })),
    instructions: v.array(v.object({
      step: v.number(),
      description: v.string(),
      timestamp: v.optional(v.string()),
      keyActions: v.optional(v.array(v.string())),
    })),
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    difficulty: v.optional(v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard")
    )),
    keyFrames: v.optional(v.array(v.object({
      timestamp: v.string(),
      description: v.string(),
      thumbnailUrl: v.string(),
      actionType: v.union(
        v.literal("ingredient_prep"),
        v.literal("cooking_technique"),
        v.literal("final_plating"),
        v.literal("other")
      ),
    }))),
  },
  handler: async (ctx, args) => {
    const { id, ...recipeData } = args;

    await ctx.db.patch(id, {
      ...recipeData,
      extractionStatus: "completed",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Gets a video recipe by ID
 */
export const getVideoRecipe = query({
  args: {
    id: v.id("videoRecipes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Gets all video recipes for a user
 */
export const getUserVideoRecipes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Gets video recipes by platform
 */
export const getVideoRecipesByPlatform = query({
  args: {
    userId: v.string(),
    platform: v.union(
      v.literal("youtube"),
      v.literal("instagram"),
      v.literal("tiktok"),
      v.literal("other")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoRecipes")
      .withIndex("by_platform", (q) => q.eq("sourcePlatform", args.platform))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Gets recently completed video recipes
 */
export const getRecentCompletedRecipes = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    return await ctx.db
      .query("videoRecipes")
      .withIndex("by_status", (q) => q.eq("extractionStatus", "completed"))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Saves a video recipe to user's cookbook
 */
export const saveVideoRecipeToCookbook = mutation({
  args: {
    videoRecipeId: v.id("videoRecipes"),
    cookbookCategory: v.string(),
  },
  handler: async (ctx, args) => {
    const videoRecipe = await ctx.db.get(args.videoRecipeId);

    if (!videoRecipe) {
      throw new Error("Video recipe not found");
    }

    if (videoRecipe.extractionStatus !== "completed") {
      throw new Error("Recipe extraction is not yet complete");
    }

    // Create a userRecipe from the videoRecipe
    const userRecipeId = await ctx.db.insert("userRecipes", {
      userId: videoRecipe.userId,
      recipeType: "extracted",
      extractedRecipeId: args.videoRecipeId as any, // Reference to videoRecipe
      title: videoRecipe.title,
      description: videoRecipe.description,
      imageUrl: videoRecipe.muxThumbnailUrl,
      // Convert structured ingredients to string array
      ingredients: videoRecipe.ingredients.map(i =>
        `${i.quantity || ''} ${i.unit || ''} ${i.name}`.trim()
      ),
      // Convert structured instructions to string array
      instructions: videoRecipe.instructions.map(i => i.description),
      servings: videoRecipe.servings,
      prep_time: videoRecipe.prep_time,
      cook_time: videoRecipe.cook_time,
      cuisine: videoRecipe.cuisine,
      cookbookCategory: args.cookbookCategory,
      isFavorited: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userRecipeId;
  },
});

/**
 * Deletes a video recipe (also deletes from Mux if needed)
 */
export const deleteVideoRecipe = mutation({
  args: {
    id: v.id("videoRecipes"),
  },
  handler: async (ctx, args) => {
    // TODO: Add Mux asset deletion via webhook or server action
    await ctx.db.delete(args.id);
  },
});
