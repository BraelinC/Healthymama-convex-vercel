import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Create a new shared cookbook and invite a friend
 */
export const createSharedCookbook = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    creatorId: v.string(),
    inviteFriendId: v.string(), // Friend to invite as collaborator
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Create the shared cookbook
    const cookbookId = await ctx.db.insert("sharedCookbooks", {
      name: args.name,
      description: args.description,
      imageStorageId: args.imageStorageId,
      creatorId: args.creatorId,
      recipeCount: 0,
      memberCount: 2, // Creator + invited friend
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as owner
    await ctx.db.insert("sharedCookbookMembers", {
      cookbookId,
      userId: args.creatorId,
      role: "owner",
      createdAt: now,
    });

    // Add friend as collaborator
    await ctx.db.insert("sharedCookbookMembers", {
      cookbookId,
      userId: args.inviteFriendId,
      role: "collaborator",
      invitedBy: args.creatorId,
      createdAt: now,
    });

    return cookbookId;
  },
});

/**
 * Get all shared cookbooks for a user
 */
export const getSharedCookbooks = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all memberships for this user
    const memberships = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get cookbook details for each membership
    const cookbooks = await Promise.all(
      memberships.map(async (membership) => {
        const cookbook = await ctx.db.get(membership.cookbookId);
        if (!cookbook) return null;

        // Get image URL if exists
        let imageUrl: string | undefined;
        if (cookbook.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(cookbook.imageStorageId) ?? undefined;
        }

        // Get all members of this cookbook
        const members = await ctx.db
          .query("sharedCookbookMembers")
          .withIndex("by_cookbook", (q) => q.eq("cookbookId", membership.cookbookId))
          .collect();

        // Get member details
        const memberDetails = await Promise.all(
          members.map(async (member) => {
            const user = await ctx.db
              .query("users")
              .withIndex("by_userId", (q) => q.eq("userId", member.userId))
              .first();
            return {
              userId: member.userId,
              role: member.role,
              name: user?.prefs?.profileName || user?.email || "Unknown",
              email: user?.email,
            };
          })
        );

        return {
          ...cookbook,
          imageUrl,
          role: membership.role,
          members: memberDetails,
        };
      })
    );

    return cookbooks.filter(Boolean);
  },
});

/**
 * Get a single shared cookbook with details
 */
export const getSharedCookbook = query({
  args: {
    cookbookId: v.id("sharedCookbooks"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is a member
    const membership = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook_user", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this cookbook");
    }

    const cookbook = await ctx.db.get(args.cookbookId);
    if (!cookbook) {
      throw new Error("Cookbook not found");
    }

    // Get image URL
    let imageUrl: string | undefined;
    if (cookbook.imageStorageId) {
      imageUrl = await ctx.storage.getUrl(cookbook.imageStorageId) ?? undefined;
    }

    // Get members
    const members = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook", (q) => q.eq("cookbookId", args.cookbookId))
      .collect();

    const memberDetails = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", member.userId))
          .first();
        return {
          userId: member.userId,
          role: member.role,
          name: user?.prefs?.profileName || user?.email || "Unknown",
          email: user?.email,
        };
      })
    );

    return {
      ...cookbook,
      imageUrl,
      role: membership.role,
      members: memberDetails,
    };
  },
});

/**
 * Get recipes in a shared cookbook with contributor info
 */
export const getSharedCookbookRecipes = query({
  args: {
    cookbookId: v.id("sharedCookbooks"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is a member
    const membership = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook_user", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this cookbook");
    }

    // Get all recipes in this cookbook
    const cookbookRecipes = await ctx.db
      .query("sharedCookbookRecipes")
      .withIndex("by_cookbook", (q) => q.eq("cookbookId", args.cookbookId))
      .collect();

    // Enrich with contributor info and full recipe data
    const recipes = await Promise.all(
      cookbookRecipes.map(async (cbRecipe) => {
        // Get contributor info
        const contributor = await ctx.db
          .query("users")
          .withIndex("by_userId", (q) => q.eq("userId", cbRecipe.addedByUserId))
          .first();

        // Get full recipe data
        const recipe = await ctx.db.get(cbRecipe.recipeId);

        return {
          ...cbRecipe,
          recipe,
          contributor: {
            userId: cbRecipe.addedByUserId,
            name: contributor?.prefs?.profileName || contributor?.email || "Unknown",
            email: contributor?.email,
          },
        };
      })
    );

    return recipes;
  },
});

/**
 * Add a recipe to a shared cookbook
 */
export const addRecipeToSharedCookbook = mutation({
  args: {
    cookbookId: v.id("sharedCookbooks"),
    recipeId: v.id("userRecipes"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is a member
    const membership = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook_user", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this cookbook");
    }

    // Check if recipe already in cookbook
    const existing = await ctx.db
      .query("sharedCookbookRecipes")
      .withIndex("by_cookbook_recipe", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("recipeId", args.recipeId)
      )
      .first();

    if (existing) {
      throw new Error("Recipe already in this cookbook");
    }

    // Get recipe details for denormalization
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Add recipe to cookbook
    await ctx.db.insert("sharedCookbookRecipes", {
      cookbookId: args.cookbookId,
      recipeId: args.recipeId,
      addedByUserId: args.userId,
      recipeTitle: recipe.title,
      recipeImageUrl: recipe.imageUrl,
      createdAt: Date.now(),
    });

    // Update recipe count
    const cookbook = await ctx.db.get(args.cookbookId);
    if (cookbook) {
      await ctx.db.patch(args.cookbookId, {
        recipeCount: cookbook.recipeCount + 1,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Remove a recipe from a shared cookbook
 */
export const removeRecipeFromSharedCookbook = mutation({
  args: {
    cookbookId: v.id("sharedCookbooks"),
    recipeId: v.id("userRecipes"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is a member
    const membership = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook_user", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this cookbook");
    }

    // Find the recipe entry
    const entry = await ctx.db
      .query("sharedCookbookRecipes")
      .withIndex("by_cookbook_recipe", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("recipeId", args.recipeId)
      )
      .first();

    if (!entry) {
      throw new Error("Recipe not in this cookbook");
    }

    // Delete the entry
    await ctx.db.delete(entry._id);

    // Update recipe count
    const cookbook = await ctx.db.get(args.cookbookId);
    if (cookbook) {
      await ctx.db.patch(args.cookbookId, {
        recipeCount: Math.max(0, cookbook.recipeCount - 1),
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Delete a shared cookbook (owner only)
 */
export const deleteSharedCookbook = mutation({
  args: {
    cookbookId: v.id("sharedCookbooks"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user is owner
    const membership = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook_user", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("userId", args.userId)
      )
      .first();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only the owner can delete this cookbook");
    }

    // Delete all recipes in cookbook
    const recipes = await ctx.db
      .query("sharedCookbookRecipes")
      .withIndex("by_cookbook", (q) => q.eq("cookbookId", args.cookbookId))
      .collect();

    for (const recipe of recipes) {
      await ctx.db.delete(recipe._id);
    }

    // Delete all memberships
    const members = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook", (q) => q.eq("cookbookId", args.cookbookId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete the cookbook
    await ctx.db.delete(args.cookbookId);

    return { success: true };
  },
});

/**
 * Generate upload URL for cookbook cover image
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Update shared cookbook details
 */
export const updateSharedCookbook = mutation({
  args: {
    cookbookId: v.id("sharedCookbooks"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    // Verify user is a member
    const membership = await ctx.db
      .query("sharedCookbookMembers")
      .withIndex("by_cookbook_user", (q) =>
        q.eq("cookbookId", args.cookbookId).eq("userId", args.userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this cookbook");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.imageStorageId !== undefined) updates.imageStorageId = args.imageStorageId;

    await ctx.db.patch(args.cookbookId, updates);

    return { success: true };
  },
});
