// @ts-nocheck
/**
 * Voice Memories Actions - Gemini Live Cooking Assistant
 * Actions only (Node.js environment)
 */

"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ========== HELPER FUNCTIONS ==========

/**
 * Generate embedding for text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI Embeddings API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ========== ACTIONS ==========

/**
 * Add memory with embedding generation
 */
export const addMemoryWithEmbedding = internalAction({
  args: {
    userId: v.string(),
    text: v.string(),
    recipeId: v.optional(v.id("userRecipes")),
    sessionId: v.optional(v.id("voiceSessions")),
    isFavourite: v.boolean(),
  },
  handler: async (ctx, { userId, text, recipeId, sessionId, isFavourite }) => {
    const embedding = await generateEmbedding(text);

    const memoryId = await ctx.runMutation(internal.voiceMemoriesQueries.addFactInternal, {
      userId,
      text,
      embedding,
      recipeId,
      sessionId,
      isFavourite,
    });

    console.log(`[VoiceMemory] Created memory ${memoryId} with embedding`);
    return memoryId;
  },
});

/**
 * Search memories using vector similarity
 */
export const searchMemories = action({
  args: {
    userId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, query, limit = 5 }) => {
    console.log(`[VoiceMemory] Searching for: "${query}" (user: ${userId})`);

    // Generate embedding for query
    const embedding = await generateEmbedding(query);

    // Vector search
    const vectorResults = await ctx.vectorSearch("voiceMemories", "by_embedding", {
      vector: embedding,
      limit: limit,
      filter: (q) => q.eq("userId", userId),
    });

    // Load full documents
    const memoryIds = vectorResults.map((r) => r._id);
    const memories = await ctx.runQuery(internal.voiceMemoriesQueries.getMemoriesByIds, {
      ids: memoryIds,
    });

    // Map with similarity scores
    const scoreMap = new Map(vectorResults.map((r) => [r._id, r._score]));
    const results = memories.map((m) => ({
      ...m,
      similarity: scoreMap.get(m!._id) || 0,
    }));

    console.log(`[VoiceMemory] Found ${results.length} memories`);
    return results;
  },
});

/**
 * Add a favourite fact (for Gemini tool calling)
 * Called when user says "remember that I love X" or "I'm allergic to Y"
 */
export const addFavourite = action({
  args: {
    userId: v.string(),
    text: v.string(),
    recipeId: v.optional(v.id("userRecipes")),
    sessionId: v.optional(v.id("voiceSessions")),
  },
  handler: async (ctx, { userId, text, recipeId, sessionId }) => {
    console.log(`[VoiceMemory] Adding favourite: "${text}" (user: ${userId})`);

    const embedding = await generateEmbedding(text);

    const memoryId = await ctx.runMutation(internal.voiceMemoriesQueries.addFactInternal, {
      userId,
      text,
      embedding,
      recipeId,
      sessionId,
      isFavourite: true,
    });

    console.log(`[VoiceMemory] Created favourite ${memoryId}`);
    return { memoryId, text };
  },
});
