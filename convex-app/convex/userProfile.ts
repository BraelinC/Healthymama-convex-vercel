import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create or update user profile (Tier 1 - Static Data)
 */
export const upsertUserProfile = mutation({
  args: {
    userId: v.string(),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    familySize: v.optional(v.number()),
    cookingSkillLevel: v.optional(
      v.union(
        v.literal("beginner"),
        v.literal("intermediate"),
        v.literal("advanced")
      )
    ),
    allergens: v.array(v.string()),
    dietaryPreferences: v.array(v.string()),
    preferredCuisines: v.optional(v.array(v.string())),
    goal: v.optional(v.string()),
    kitchenEquipment: v.optional(v.array(v.string())),
    defaultServings: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, ...profileData } = args;
    const now = Date.now();

    // Check if profile exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing profile
      await ctx.db.patch(existing._id, {
        ...profileData,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        ...profileData,
        createdAt: now,
        updatedAt: now,
      });
      return profileId;
    }
  },
});

/**
 * Get user profile by userId
 */
export const getUserProfile = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return profile;
  },
});

/**
 * Check if user has completed onboarding (has a profile)
 */
export const hasCompletedOnboarding = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("🔍 [hasCompletedOnboarding] Checking userId:", args.userId);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const hasCompleted = profile !== null;
    console.log("📋 [hasCompletedOnboarding] Result:", hasCompleted, "Profile:", profile ? "exists" : "not found");

    return hasCompleted;
  },
});

/**
 * Delete user profile
 */
export const deleteUserProfile = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (profile) {
      await ctx.db.delete(profile._id);
      return true;
    }
    return false;
  },
});

// ========== PROFILE IMAGE FUNCTIONS ==========

/**
 * Generate upload URL for profile image
 */
export const generateProfileImageUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

/**
 * Update profile with uploaded image storage ID
 */
export const updateProfileImage = mutation({
  args: {
    userId: v.string(),
    profileImageStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      // Create profile if it doesn't exist
      await ctx.db.insert("userProfiles", {
        userId: args.userId,
        profileImageStorageId: args.profileImageStorageId,
        allergens: [],
        dietaryPreferences: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { success: true };
    }

    // Delete old image if exists
    if (profile.profileImageStorageId) {
      await ctx.storage.delete(profile.profileImageStorageId);
    }

    await ctx.db.patch(profile._id, {
      profileImageStorageId: args.profileImageStorageId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete profile image
 */
export const deleteProfileImage = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile || !profile.profileImageStorageId) {
      return { success: false };
    }

    // Delete from storage
    await ctx.storage.delete(profile.profileImageStorageId);

    // Update profile
    await ctx.db.patch(profile._id, {
      profileImageStorageId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get user profile with resolved image URL
 */
export const getUserProfileWithImage = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      return null;
    }

    // Get image URL from storage
    let profileImageUrl: string | null = null;
    if (profile.profileImageStorageId) {
      profileImageUrl = await ctx.storage.getUrl(profile.profileImageStorageId);
    }

    return {
      ...profile,
      profileImageUrl,
    };
  },
});

// ========== UNIQUE PROFILE NAME FUNCTIONS ==========

/**
 * Update unique profile name
 */
export const updateUniqueProfileName = mutation({
  args: {
    userId: v.string(),
    uniqueProfileName: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate the profile name format (alphanumeric, underscores, 3-20 chars)
    const nameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!nameRegex.test(args.uniqueProfileName)) {
      throw new Error("Profile name must be 3-20 characters and contain only letters, numbers, and underscores");
    }

    // Check if name is already taken by another user
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_unique_profile_name", (q) => q.eq("uniqueProfileName", args.uniqueProfileName.toLowerCase()))
      .first();

    if (existing && existing.userId !== args.userId) {
      throw new Error("This profile name is already taken");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      // Create profile if it doesn't exist
      await ctx.db.insert("userProfiles", {
        userId: args.userId,
        uniqueProfileName: args.uniqueProfileName.toLowerCase(),
        allergens: [],
        dietaryPreferences: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { success: true };
    }

    await ctx.db.patch(profile._id, {
      uniqueProfileName: args.uniqueProfileName.toLowerCase(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Check if a unique profile name is available
 */
export const checkProfileNameAvailable = query({
  args: {
    uniqueProfileName: v.string(),
    currentUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_unique_profile_name", (q) => q.eq("uniqueProfileName", args.uniqueProfileName.toLowerCase()))
      .first();

    // Available if no one has it, or if the current user has it
    return !existing || existing.userId === args.currentUserId;
  },
});

// ========== AYRSHARE / INSTAGRAM FUNCTIONS ==========

/**
 * Save Ayrshare profile key for user
 */
export const saveAyrshareProfileKey = mutation({
  args: {
    userId: v.string(),
    ayrshareProfileKey: v.string(),
    ayrshareRefId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      // Create profile if it doesn't exist
      await ctx.db.insert("userProfiles", {
        userId: args.userId,
        ayrshareProfileKey: args.ayrshareProfileKey,
        ayrshareRefId: args.ayrshareRefId,
        allergens: [],
        dietaryPreferences: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { success: true };
    }

    await ctx.db.patch(profile._id, {
      ayrshareProfileKey: args.ayrshareProfileKey,
      ayrshareRefId: args.ayrshareRefId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update Instagram connection status
 */
export const updateInstagramConnection = mutation({
  args: {
    userId: v.string(),
    instagramConnected: v.boolean(),
    instagramUsername: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!profile) {
      return { success: false, error: "Profile not found" };
    }

    await ctx.db.patch(profile._id, {
      instagramConnected: args.instagramConnected,
      instagramUsername: args.instagramUsername,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get user profile by Instagram username
 * Used by Mikey bot to find recipe recipients when they send DMs
 */
export const getUserByInstagramUsername = query({
  args: {
    instagramUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("instagramUsername"), args.instagramUsername))
      .first();

    return profile;
  },
});
