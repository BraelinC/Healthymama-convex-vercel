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
