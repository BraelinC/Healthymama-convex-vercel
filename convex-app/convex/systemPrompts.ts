import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's saved prompt
export const getPrompt = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("systemPrompts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// Save prompt
export const savePrompt = mutation({
  args: {
    userId: v.string(),
    promptText: v.string(),
    contextInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("systemPrompts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        promptText: args.promptText,
        contextInstructions: args.contextInstructions,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new
      return await ctx.db.insert("systemPrompts", {
        userId: args.userId,
        promptText: args.promptText,
        contextInstructions: args.contextInstructions,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});
