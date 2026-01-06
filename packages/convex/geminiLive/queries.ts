/**
 * Gemini Live - Queries and Mutations
 *
 * These run in V8 isolate (no Node.js APIs).
 * Used by actions for internal database operations.
 */

import { mutation, query, internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

// ========== HELPER FUNCTIONS ==========

/**
 * Simple hash function for deduplication (V8 compatible)
 */
function simpleHash(text: string): string {
  const normalized = text.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ========== PUBLIC MUTATIONS ==========

/**
 * Toggle favourite status of a memory
 */
export const toggleFavourite = mutation({
  args: {
    userId: v.string(),
    memoryId: v.id("userMemories"),
  },
  handler: async (ctx, args) => {
    const memory = await ctx.db.get(args.memoryId);

    if (!memory) {
      throw new Error("Memory not found");
    }

    if (memory.userId !== args.userId) {
      throw new Error("Unauthorized: Memory belongs to different user");
    }

    const newFavouriteState = !memory.isFavourite;

    await ctx.db.patch(args.memoryId, {
      isFavourite: newFavouriteState,
      updatedAt: Date.now(),
    });

    console.log(`[GeminiLive] Memory ${args.memoryId} favourite: ${newFavouriteState}`);

    return { isFavourite: newFavouriteState };
  },
});

// ========== PUBLIC QUERIES ==========

/**
 * Get recent memories for a user (for display in UI)
 */
export const getRecentMemories = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    return await ctx.db
      .query("userMemories")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

// ========== INTERNAL QUERIES ==========

/**
 * Internal: Get memory by ID
 */
export const getMemoryById = internalQuery({
  args: { memoryId: v.id("userMemories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.memoryId);
  },
});

/**
 * Internal: Get favourites for a user
 */
export const getFavourites = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMemories")
      .withIndex("by_user_favourite", (q) =>
        q.eq("userId", args.userId).eq("isFavourite", true)
      )
      .order("desc")
      .take(args.limit);
  },
});

/**
 * Internal: Check for duplicate memory
 */
export const checkDuplicate = internalQuery({
  args: { contentHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userMemories")
      .withIndex("by_hash", (q) => q.eq("contentHash", args.contentHash))
      .first();
  },
});

// ========== INTERNAL MUTATIONS ==========

/**
 * Internal: Insert a new memory
 */
export const insertMemory = internalMutation({
  args: {
    userId: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    contentHash: v.string(),
    category: v.string(),
    isFavourite: v.boolean(),
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const memoryId = await ctx.db.insert("userMemories", {
      userId: args.userId,
      agentId: args.agentId,
      text: args.text,
      category: args.category,
      embedding: args.embedding,
      embeddingModel: "text-embedding-3-small",
      contentHash: args.contentHash,
      isFavourite: args.isFavourite,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    return memoryId;
  },
});
