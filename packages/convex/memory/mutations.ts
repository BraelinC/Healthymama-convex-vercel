// @ts-nocheck
/**
 * Memory Mutations and Queries
 * Run in V8 isolate (no Node.js APIs)
 */

import { mutation, query, internalMutation, internalQuery, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

// Simple hash function that works in V8 isolate
function simpleHash(text: string): string {
  const normalized = text.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ========== QUERIES ==========

/**
 * Get all memories for a user
 */
export const listMemories = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    const memories = await ctx.db
      .query("userMemories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return memories;
  },
});

/**
 * Get memory history for a user
 */
export const getMemoryHistory = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const history = await ctx.db
      .query("memoryHistory")
      .withIndex("by_user_timestamp", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return history;
  },
});

/**
 * Search memories by vector similarity (optimized with native vector search)
 */
export const searchMemories = query({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const topK = args.topK ?? 10;

    // Use native vector search with userId filter
    const vectorResults = await ctx.db
      .vectorSearch("userMemories", "by_embedding", {
        vector: args.embedding,
        limit: topK,
        filter: (q) => q.eq("userId", args.userId),
      });

    // Load full memory documents with similarity scores
    const memoriesWithScores = await Promise.all(
      vectorResults.map(async (result) => {
        const memory = await ctx.db.get(result._id);
        if (!memory) return null;
        return {
          ...memory,
          similarity: result._score,
        };
      })
    );

    // Filter out any null results (deleted memories)
    const topResults = memoriesWithScores.filter((m) => m !== null);

    console.log(`[Memory] Found ${topResults.length} relevant memories for user ${args.userId}`);

    return topResults;
  },
});

/**
 * Internal Query: Fetch memory documents by IDs
 * Helper for vectorSearchMemories action (following recipe pattern)
 */
export const fetchMemoriesByIds = internalQuery({
  args: {
    ids: v.array(v.id("userMemories")),
  },
  handler: async (ctx, args) => {
    const memories = await Promise.all(
      args.ids.map(async (id) => {
        const memory = await ctx.db.get(id);
        return memory;
      })
    );
    return memories.filter((m) => m !== null);
  },
});

/**
 * Internal Action: Vector search memories with time filter
 * NOTE: Vector search only works in ACTIONS, not queries!
 * (Following the exact recipe pattern from recipeQueries.ts)
 */
export const vectorSearchMemories = internalAction({
  args: {
    userId: v.string(),
    embedding: v.array(v.float64()),
    topK: v.optional(v.number()),
    minCreatedAt: v.optional(v.number()), // Minimum timestamp (filter older memories)
  },
  handler: async (ctx, args) => {
    const topK = args.topK ?? 10;
    const hasTimeFilter = args.minCreatedAt && args.minCreatedAt > 0;
    const candidateLimit = hasTimeFilter ? topK * 3 : topK;

    console.log(`[Memory] Vector search: topK=${topK}, timeFilter=${hasTimeFilter}`);

    // STAGE 1: Native vector search using ctx.vectorSearch (action only!)
    const vectorResults = await ctx.vectorSearch("userMemories", "by_embedding", {
      vector: args.embedding,
      limit: candidateLimit,
      filter: (q) => q.eq("userId", args.userId),
    });

    // STAGE 2: Load full memory documents via internal query
    const memoryIds = vectorResults.map((result) => result._id);
    const memories = await ctx.runQuery(internal.memory.mutations.fetchMemoriesByIds, {
      ids: memoryIds,
    });

    // Map memories with their similarity scores
    const scoreMap = new Map(vectorResults.map((r) => [r._id, r._score]));
    const memoriesWithScores = memories.map((memory) => ({
      ...memory,
      similarity: scoreMap.get(memory!._id) || 0,
    }));

    // STAGE 3: Post-filter by time if needed (since createdAt can't be in filterFields)
    let results = memoriesWithScores;
    if (hasTimeFilter) {
      results = results.filter((m) => m!.createdAt >= args.minCreatedAt!);
      console.log(
        `[Memory] ✅ Vector + time filter: Found ${results.length} memories ` +
        `for user ${args.userId} since ${new Date(args.minCreatedAt!).toISOString()}`
      );
    } else {
      console.log(`[Memory] ✅ Vector search: Found ${results.length} memories for user ${args.userId} (all time)`);
    }

    // Return top K results
    return results.slice(0, topK);
  },
});

// ========== MUTATIONS ==========

/**
 * Add a new memory
 */
export const addMemory = mutation({
  args: {
    userId: v.string(),
    text: v.string(),
    embedding: v.array(v.float64()),
    extractedTerms: v.optional(v.object({
      proteins: v.array(v.string()),
      restrictions: v.array(v.string()),
      preferences: v.array(v.string()),
      timeConstraints: v.array(v.string()),
      dietaryTags: v.array(v.string()),
      equipment: v.array(v.string()),
    })),
    sessionId: v.id("chatSessions"),
    messageIds: v.array(v.id("chatMessages")),
    category: v.optional(v.string()),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const contentHash = simpleHash(args.text);

    // Check for duplicates
    const existing = await ctx.db
      .query("userMemories")
      .withIndex("by_hash", (q) => q.eq("contentHash", contentHash))
      .first();

    if (existing) {
      console.log("Memory already exists:", contentHash);
      return existing._id;
    }

    const memoryId = await ctx.db.insert("userMemories", {
      userId: args.userId,
      agentId: args.agentId,
      runId: args.sessionId,
      text: args.text,
      category: args.category,
      extractedTerms: args.extractedTerms,
      embedding: args.embedding,
      embeddingModel: "text-embedding-3-small",
      contentHash,
      extractedFrom: {
        sessionId: args.sessionId,
        messageIds: args.messageIds,
        extractedAt: Date.now(),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });

    // Log history
    await ctx.db.insert("memoryHistory", {
      memoryId,
      userId: args.userId,
      operation: "ADD",
      beforeState: undefined,
      afterState: JSON.stringify({
        text: args.text,
        extractedTerms: args.extractedTerms
      }),
      triggeredBy: {
        sessionId: args.sessionId,
        messageContent: "Memory extraction",
      },
      timestamp: Date.now(),
    });

    return memoryId;
  },
});

/**
 * Update an existing memory
 */
export const updateMemory = mutation({
  args: {
    memoryId: v.id("userMemories"),
    newText: v.string(),
    newEmbedding: v.array(v.float64()),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.memoryId);
    if (!existing) {
      throw new Error("Memory not found");
    }

    const newContentHash = simpleHash(args.newText);

    // Save before state
    const beforeState = JSON.stringify({
      text: existing.text,
      version: existing.version,
    });

    // Update memory
    await ctx.db.patch(args.memoryId, {
      text: args.newText,
      embedding: args.newEmbedding,
      contentHash: newContentHash,
      updatedAt: Date.now(),
      version: existing.version + 1,
    });

    // Log history
    await ctx.db.insert("memoryHistory", {
      memoryId: args.memoryId,
      userId: existing.userId,
      operation: "UPDATE",
      beforeState,
      afterState: JSON.stringify({
        text: args.newText,
        version: existing.version + 1,
      }),
      triggeredBy: {
        sessionId: args.sessionId,
        messageContent: "Memory update",
      },
      timestamp: Date.now(),
    });
  },
});

/**
 * Delete a memory
 */
export const deleteMemory = mutation({
  args: {
    memoryId: v.id("userMemories"),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.memoryId);
    if (!existing) {
      throw new Error("Memory not found");
    }

    // Log history before deletion
    await ctx.db.insert("memoryHistory", {
      memoryId: args.memoryId,
      userId: existing.userId,
      operation: "DELETE",
      beforeState: JSON.stringify({ text: existing.text }),
      afterState: JSON.stringify({ deleted: true }),
      triggeredBy: {
        sessionId: args.sessionId,
        messageContent: "Memory deletion",
      },
      timestamp: Date.now(),
    });

    // Delete memory
    await ctx.db.delete(args.memoryId);
  },
});

/**
 * Reset all memories for a user
 */
export const resetMemories = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("userMemories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const memory of memories) {
      await ctx.db.delete(memory._id);
    }

    return { deletedCount: memories.length };
  },
});

// COMMENTED OUT: Tier 3 thread summaries not needed for simplified approach
/**
 * Search thread contexts by vector similarity (optimized with native vector search)
 * (Moved from smartRetrieval.ts - queries must be in V8 isolate)
 */
// export const searchThreadContexts = query({
//   args: {
//     userId: v.string(),
//     embedding: v.array(v.float64()),
//     topK: v.optional(v.number()),
//   },
//   handler: async (ctx, args) => {
//     const topK = args.topK ?? 3;
//
//     // Use native vector search with userId filter
//     const vectorResults = await ctx.db
//       .vectorSearch("threadContexts", "by_embedding", {
//         vector: args.embedding,
//         limit: topK,
//         filter: (q) => q.eq("userId", args.userId),
//       });
//
//     // Load full thread context documents with similarity scores
//     const scored = await Promise.all(
//       vectorResults.map(async (result) => {
//         const context = await ctx.db.get(result._id);
//         if (!context) return null;
//         return {
//           ...context,
//           similarity: result._score,
//         };
//       })
//     );
//
//     // Filter out any null results (deleted contexts)
//     return scored.filter((c) => c !== null);
//   },
// });

// COMMENTED OUT: Tier 3 thread summaries not needed for simplified approach
/**
 * Upsert thread context (create or update)
 * (Moved from tieredProcessing.ts - mutations must be in V8 isolate)
 */
// export const upsertThreadContext = internalMutation({
//   args: {
//     userId: v.string(),
//     sessionId: v.id("chatSessions"),
//     summary: v.string(),
//     embedding: v.array(v.float64()),
//     messageCount: v.number(),
//   },
//   handler: async (ctx, args) => {
//     // Check if context exists
//     const existing = await ctx.db
//       .query("threadContexts")
//       .withIndex("by_user_session", (q) =>
//         q.eq("userId", args.userId).eq("sessionId", args.sessionId)
//       )
//       .first();
//
//     const now = Date.now();
//
//     if (existing) {
//       // Update existing
//       await ctx.db.patch(existing._id, {
//         summary: args.summary,
//         embedding: args.embedding,
//         messageCount: args.messageCount,
//         lastMessageAt: now,
//         updatedAt: now,
//       });
//       return existing._id;
//     } else {
//       // Create new
//       return await ctx.db.insert("threadContexts", {
//         userId: args.userId,
//         sessionId: args.sessionId,
//         summary: args.summary,
//         embedding: args.embedding,
//         messageCount: args.messageCount,
//         lastMessageAt: now,
//         createdAt: now,
//         updatedAt: now,
//       });
//     }
//   },
// });

/**
 * Get message count for session (internal query)
 * (Moved from tieredProcessing.ts - queries must be in V8 isolate)
 */
export const getSessionMessageCount = internalQuery({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    return { count: messages.length };
  },
});
