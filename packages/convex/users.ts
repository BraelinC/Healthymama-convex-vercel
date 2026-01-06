import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createOrUpdateUser = mutation({
  args: {
    userId: v.string(),
    email: v.string(),
    prefs: v.object({
      diet: v.optional(v.string()),
      favorites: v.array(v.string()),
      profileName: v.optional(v.string()),
      primaryGoal: v.optional(v.string()),
      dietaryRestrictions: v.optional(v.array(v.string())),
      goals: v.optional(v.array(v.string())),
      preferences: v.optional(v.array(v.string())),
      culturalBackground: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    const payload = {
      userId: args.userId,
      email: args.email.toLowerCase(),
      prefs: {
        diet: args.prefs.diet,
        favorites: args.prefs.favorites,
        profileName: args.prefs.profileName,
        primaryGoal: args.prefs.primaryGoal,
        dietaryRestrictions: args.prefs.dietaryRestrictions,
        goals: args.prefs.goals,
        preferences: args.prefs.preferences,
        culturalBackground: args.prefs.culturalBackground,
      },
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert("users", payload);
  },
});

export const getUserProfile = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("🔍 [getUserProfile] Searching for userId:", args.userId);

    const profile = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      console.warn("⚠️ [getUserProfile] No profile found for userId:", args.userId);
      return null;
    }

    console.log("✅ [getUserProfile] Profile found:", {
      _id: profile._id,
      userId: profile.userId,
      email: profile.email,
      isCreator: profile.isCreator,
    });

    return {
      _id: profile._id,
      userId: profile.userId,
      email: profile.email,
      isCreator: profile.isCreator || false,
      prefs: profile.prefs,
      updatedAt: profile.updatedAt,
    };
  },
});

// Alias for Stripe actions
export const getUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    return user;
  },
});
