// @ts-nocheck
/**
 * Voice Memories - Gemini Live Cooking Assistant
 * Queries and Mutations (V8 isolate - no Node.js)
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ========== QUERIES ==========

/**
 * List recent memories for a user
 */
export const listRecent = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 10 }) => {
    const memories = await ctx.db
      .query("voiceMemories")
      .withIndex("by_user_recent", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return memories;
  },
});

/**
 * List favourite memories for a user
 */
export const listFavourites = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }) => {
    const memories = await ctx.db
      .query("voiceMemories")
      .withIndex("by_user_favourite", (q) => q.eq("userId", userId).eq("isFavourite", true))
      .order("desc")
      .take(limit);

    return memories;
  },
});

/**
 * Get a memory by ID
 */
export const getMemory = query({
  args: { memoryId: v.id("voiceMemories") },
  handler: async (ctx, { memoryId }) => {
    return await ctx.db.get(memoryId);
  },
});

/**
 * Internal: Get memories by IDs (for vector search)
 */
export const getMemoriesByIds = internalQuery({
  args: { ids: v.array(v.id("voiceMemories")) },
  handler: async (ctx, { ids }) => {
    const memories = await Promise.all(ids.map((id) => ctx.db.get(id)));
    return memories.filter((m) => m !== null);
  },
});

// ========== MUTATIONS ==========

/**
 * Add a new memory (from client - schedules embedding generation)
 */
export const addMemory = mutation({
  args: {
    userId: v.string(),
    text: v.string(),
    recipeId: v.optional(v.id("userRecipes")),
    sessionId: v.optional(v.id("voiceSessions")),
    isFavourite: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, text, recipeId, sessionId, isFavourite = false }) => {
    // Schedule embedding generation
    await ctx.scheduler.runAfter(0, internal.voiceMemoriesActions.addMemoryWithEmbedding, {
      userId,
      text,
      recipeId,
      sessionId,
      isFavourite,
    });

    console.log(`[VoiceMemory] Scheduled memory creation for user ${userId}`);
  },
});

/**
 * Internal: Add a fact directly with embedding (called from session processing)
 */
export const addFactInternal = internalMutation({
  args: {
    userId: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    sessionId: v.optional(v.id("voiceSessions")),
    recipeId: v.optional(v.id("userRecipes")),
    isFavourite: v.boolean(),
  },
  handler: async (ctx, { userId, text, embedding, sessionId, recipeId, isFavourite }) => {
    const memoryId = await ctx.db.insert("voiceMemories", {
      userId,
      text,
      type: "fact",
      embedding,
      recipeId,
      sessionId,
      isFavourite,
      createdAt: Date.now(),
    });

    return memoryId;
  },
});

/**
 * Toggle favourite status of a memory
 */
export const toggleFavourite = mutation({
  args: {
    userId: v.string(),
    memoryId: v.id("voiceMemories"),
  },
  handler: async (ctx, { userId, memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) {
      throw new Error("Memory not found");
    }

    if (memory.userId !== userId) {
      throw new Error("Not authorized");
    }

    const newFavourite = !memory.isFavourite;
    await ctx.db.patch(memoryId, { isFavourite: newFavourite });

    console.log(`[VoiceMemory] Toggled favourite for ${memoryId}: ${newFavourite}`);
    return { isFavourite: newFavourite };
  },
});

/**
 * Delete a memory
 */
export const deleteMemory = mutation({
  args: {
    userId: v.string(),
    memoryId: v.id("voiceMemories"),
  },
  handler: async (ctx, { userId, memoryId }) => {
    const memory = await ctx.db.get(memoryId);
    if (!memory) {
      throw new Error("Memory not found");
    }

    if (memory.userId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.delete(memoryId);
    console.log(`[VoiceMemory] Deleted memory ${memoryId}`);
  },
});
