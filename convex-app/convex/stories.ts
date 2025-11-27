import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// 24 hours in milliseconds
const STORY_DURATION_MS = 24 * 60 * 60 * 1000;

// Create a new story
export const createStory = mutation({
  args: {
    userId: v.string(),
    mediaStorageId: v.id("_storage"),
    mediaType: v.union(v.literal("image"), v.literal("video")),
    recipeId: v.optional(v.id("userRecipes")),
    caption: v.optional(v.string()),
    // New editor fields
    imageTransform: v.optional(v.object({
      scale: v.number(),
      x: v.number(),
      y: v.number(),
    })),
    textOverlays: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      x: v.number(),
      y: v.number(),
      font: v.string(),
      color: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // If recipe attached, get recipe details for denormalization
    let recipeTitle: string | undefined;
    let recipeImageUrl: string | undefined;

    if (args.recipeId) {
      const recipe = await ctx.db.get(args.recipeId);
      if (recipe) {
        recipeTitle = recipe.title || recipe.customRecipeData?.title;
        recipeImageUrl = recipe.imageUrl || recipe.customRecipeData?.imageUrl;
      }
    }

    const storyId = await ctx.db.insert("stories", {
      userId: args.userId,
      mediaStorageId: args.mediaStorageId,
      mediaType: args.mediaType,
      recipeId: args.recipeId,
      recipeTitle,
      recipeImageUrl,
      caption: args.caption,
      imageTransform: args.imageTransform,
      textOverlays: args.textOverlays,
      createdAt: now,
      expiresAt: now + STORY_DURATION_MS,
    });

    return storyId;
  },
});

// Get friends' stories (non-expired)
export const getFriendsStories = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get all friends
    const friendships1 = await ctx.db
      .query("friendships")
      .withIndex("by_user1_status", (q) =>
        q.eq("userId1", args.userId).eq("status", "accepted")
      )
      .collect();

    const friendships2 = await ctx.db
      .query("friendships")
      .withIndex("by_user2_status", (q) =>
        q.eq("userId2", args.userId).eq("status", "accepted")
      )
      .collect();

    // Extract friend IDs
    const friendIds = new Set<string>();
    friendships1.forEach((f) => friendIds.add(f.userId2));
    friendships2.forEach((f) => friendIds.add(f.userId1));

    // Get stories for each friend
    const storiesByUser: Map<string, any[]> = new Map();

    for (const friendId of friendIds) {
      const friendStories = await ctx.db
        .query("stories")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", friendId))
        .filter((q) => q.gt(q.field("expiresAt"), now))
        .order("desc")
        .collect();

      if (friendStories.length > 0) {
        // Get user info
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", friendId))
          .first();

        const userProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", friendId))
          .first();

        // Check which stories current user has viewed
        const viewedStoryIds = new Set<string>();
        for (const story of friendStories) {
          const view = await ctx.db
            .query("storyViews")
            .withIndex("by_viewer_story", (q) =>
              q.eq("viewerId", args.userId).eq("storyId", story._id)
            )
            .first();
          if (view) {
            viewedStoryIds.add(story._id);
          }
        }

        // Add media URLs to stories
        const storiesWithUrls = await Promise.all(
          friendStories.map(async (story) => {
            const mediaUrl = await ctx.storage.getUrl(story.mediaStorageId);
            return {
              ...story,
              mediaUrl,
              isViewed: viewedStoryIds.has(story._id),
            };
          })
        );

        storiesByUser.set(friendId, [
          {
            userId: friendId,
            userName: userProfile?.name || user?.prefs?.profileName || user?.email?.split("@")[0] || "User",
            userEmail: user?.email,
            stories: storiesWithUrls,
            hasUnviewed: storiesWithUrls.some((s) => !s.isViewed),
          },
        ]);
      }
    }

    // Convert to array and sort (users with unviewed stories first)
    const result = Array.from(storiesByUser.values())
      .flat()
      .sort((a, b) => {
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return 0;
      });

    return result;
  },
});

// Get my own active stories
export const getMyStories = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const stories = await ctx.db
      .query("stories")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .order("desc")
      .collect();

    // Add media URLs
    const storiesWithUrls = await Promise.all(
      stories.map(async (story) => {
        const mediaUrl = await ctx.storage.getUrl(story.mediaStorageId);

        // Get view count
        const views = await ctx.db
          .query("storyViews")
          .withIndex("by_story", (q) => q.eq("storyId", story._id))
          .collect();

        return {
          ...story,
          mediaUrl,
          viewCount: views.length,
        };
      })
    );

    return storiesWithUrls;
  },
});

// Mark a story as viewed
export const markStoryViewed = mutation({
  args: {
    storyId: v.id("stories"),
    viewerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already viewed
    const existingView = await ctx.db
      .query("storyViews")
      .withIndex("by_viewer_story", (q) =>
        q.eq("viewerId", args.viewerId).eq("storyId", args.storyId)
      )
      .first();

    if (existingView) {
      return existingView._id;
    }

    // Create new view record
    const viewId = await ctx.db.insert("storyViews", {
      storyId: args.storyId,
      viewerId: args.viewerId,
      viewedAt: Date.now(),
    });

    return viewId;
  },
});

// Delete own story
export const deleteStory = mutation({
  args: {
    storyId: v.id("stories"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const story = await ctx.db.get(args.storyId);

    if (!story || story.userId !== args.userId) {
      throw new Error("Story not found or unauthorized");
    }

    // Delete all views for this story
    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();

    for (const view of views) {
      await ctx.db.delete(view._id);
    }

    // Delete the story
    await ctx.db.delete(args.storyId);

    // Delete media from storage
    await ctx.storage.delete(story.mediaStorageId);

    return { success: true };
  },
});

// Get story viewers (for story owner)
export const getStoryViewers = query({
  args: {
    storyId: v.id("stories"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const story = await ctx.db.get(args.storyId);
    if (!story || story.userId !== args.userId) {
      return [];
    }

    const views = await ctx.db
      .query("storyViews")
      .withIndex("by_story", (q) => q.eq("storyId", args.storyId))
      .collect();

    // Get viewer details
    const viewersWithDetails = await Promise.all(
      views.map(async (view) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", view.viewerId))
          .first();

        const userProfile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", view.viewerId))
          .first();

        return {
          viewerId: view.viewerId,
          viewedAt: view.viewedAt,
          viewerName: userProfile?.name || user?.prefs?.profileName || user?.email?.split("@")[0] || "User",
          viewerEmail: user?.email,
        };
      })
    );

    return viewersWithDetails.sort((a, b) => b.viewedAt - a.viewedAt);
  },
});

// Generate upload URL for story media
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Save a recipe from a story to user's cookbook (creates a reference, not a copy)
export const saveStoryRecipeToMyCookbook = mutation({
  args: {
    userId: v.string(),
    recipeId: v.id("userRecipes"),
    cookbookCategory: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the original recipe
    const originalRecipe = await ctx.db.get(args.recipeId);
    if (!originalRecipe) {
      throw new Error("Recipe not found");
    }

    // Check if user already has this recipe saved (by reference)
    const existingSave = await ctx.db
      .query("userRecipes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("sourceRecipeId"), args.recipeId))
      .first();

    if (existingSave) {
      // Update the cookbook category of existing save
      await ctx.db.patch(existingSave._id, {
        cookbookCategory: args.cookbookCategory,
        updatedAt: Date.now(),
      });
      return existingSave._id;
    }

    // Create a new reference to the recipe in user's cookbook
    const now = Date.now();
    const userRecipeId = await ctx.db.insert("userRecipes", {
      userId: args.userId,
      recipeType: "community", // Treating as community since it's from another user
      cookbookCategory: args.cookbookCategory,

      // Reference to original recipe
      sourceRecipeId: args.recipeId,
      sourceRecipeType: "userRecipe",

      // Cache basic info for display
      cachedTitle: originalRecipe.title || originalRecipe.cachedTitle,
      cachedImageUrl: originalRecipe.imageUrl || originalRecipe.cachedImageUrl,

      // Copy essential fields
      title: originalRecipe.title || originalRecipe.cachedTitle,
      imageUrl: originalRecipe.imageUrl || originalRecipe.cachedImageUrl,
      ingredients: originalRecipe.ingredients || [],
      instructions: originalRecipe.instructions || [],
      description: originalRecipe.description,
      servings: originalRecipe.servings,
      prep_time: originalRecipe.prep_time,
      cook_time: originalRecipe.cook_time,

      createdAt: now,
      updatedAt: now,
      isFavorited: false,
    });

    return userRecipeId;
  },
});

// Cleanup expired stories (can be called by a cron job)
export const cleanupExpiredStories = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expiredStories = await ctx.db
      .query("stories")
      .withIndex("by_expiresAt")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    let deletedCount = 0;

    for (const story of expiredStories) {
      // Delete views
      const views = await ctx.db
        .query("storyViews")
        .withIndex("by_story", (q) => q.eq("storyId", story._id))
        .collect();

      for (const view of views) {
        await ctx.db.delete(view._id);
      }

      // Delete media
      try {
        await ctx.storage.delete(story.mediaStorageId);
      } catch (e) {
        console.error("Failed to delete story media:", e);
      }

      // Delete story
      await ctx.db.delete(story._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});
