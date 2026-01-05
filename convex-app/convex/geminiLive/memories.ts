/**
 * Gemini Live Cooking Assistant - Actions
 *
 * These are Node.js actions that call external APIs (embeddings).
 * They use internal queries/mutations from queries.ts for database access.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// ========== HELPER FUNCTIONS ==========

/**
 * Generate embedding using OpenAI
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

/**
 * Simple hash function for deduplication
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

// ========== TOOL ACTIONS (called by Gemini via client) ==========

/**
 * Search user memories using vector similarity
 * Tool: search_memories
 */
export const search = action({
  args: {
    userId: v.string(),
    query: v.string(),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const topK = args.topK ?? 5;

    console.log(`[GeminiLive] Searching memories for user ${args.userId}: "${args.query}"`);

    // Generate embedding for the search query
    const embedding = await generateEmbedding(args.query);

    // Use vector search to find similar memories
    const vectorResults = await ctx.vectorSearch("userMemories", "by_embedding", {
      vector: embedding,
      limit: topK,
      filter: (q) => q.eq("userId", args.userId),
    });

    // Fetch full memory documents
    const memories = await Promise.all(
      vectorResults.map(async (result) => {
        const memory = await ctx.runQuery(internal.geminiLive.queries.getMemoryById, {
          memoryId: result._id,
        });
        return memory ? {
          id: result._id,
          text: memory.text,
          category: memory.category,
          isFavourite: memory.isFavourite ?? false,
          similarity: result._score,
          createdAt: memory.createdAt,
        } : null;
      })
    );

    const results = memories.filter((m) => m !== null);

    console.log(`[GeminiLive] Found ${results.length} memories`);

    return {
      memories: results,
      count: results.length,
    };
  },
});

/**
 * List user's favourite/starred memories
 * Tool: list_favourites
 */
export const listFavourites = action({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    console.log(`[GeminiLive] Listing favourites for user ${args.userId}`);

    const favourites = await ctx.runQuery(internal.geminiLive.queries.getFavourites, {
      userId: args.userId,
      limit,
    });

    console.log(`[GeminiLive] Found ${favourites.length} favourites`);

    return {
      favourites: favourites.map((f) => ({
        id: f._id,
        text: f.text,
        category: f.category,
        createdAt: f.createdAt,
      })),
      count: favourites.length,
    };
  },
});

/**
 * Add a new memory from the cooking conversation
 * Called when user says something worth remembering
 */
export const addMemory = action({
  args: {
    userId: v.string(),
    text: v.string(),
    category: v.optional(v.string()),
    isFavourite: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    console.log(`[GeminiLive] Adding memory for user ${args.userId}: "${args.text}"`);

    // Check for duplicate via hash
    const contentHash = simpleHash(args.text);
    const existing = await ctx.runQuery(internal.geminiLive.queries.checkDuplicate, {
      contentHash,
    });

    if (existing) {
      console.log(`[GeminiLive] Memory already exists, skipping`);
      return { success: true, memoryId: existing._id, duplicate: true };
    }

    // Generate embedding
    const embedding = await generateEmbedding(args.text);

    // Insert memory
    const memoryId = await ctx.runMutation(internal.geminiLive.queries.insertMemory, {
      userId: args.userId,
      text: args.text,
      embedding,
      contentHash,
      category: args.category ?? "cooking_preference",
      isFavourite: args.isFavourite ?? false,
      agentId: "gemini_live_cooking",
    });

    console.log(`[GeminiLive] Memory added: ${memoryId}`);

    return { success: true, memoryId, duplicate: false };
  },
});
