/**
 * Smart Memory Retrieval System
 * Searches across all 3 tiers and intelligently combines results
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { extractKeywords } from "./keywordSearch";

/**
 * Generate embedding via OpenAI
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
      "Authorization": `Bearer ${apiKey}`,
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
 * Smart memory retrieval across all tiers
 * Returns context optimized for AI prompts
 */
export const retrieveMemoryContext = action({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    query: v.string(),
    includeRecent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const includeRecent = args.includeRecent ?? true;

    console.log(`[Memory] Retrieving context for: "${args.query.substring(0, 50)}..."`);

    try {
      // Generate query embedding
      const embedding = await generateEmbedding(args.query);

      // Tier 1: Recent conversation messages (if requested)
      let recentMessages: any[] = [];
      if (includeRecent && args.sessionId) {
        recentMessages = await ctx.runQuery(api.chat.communitychat.getSessionMessages, {
          sessionId: args.sessionId,
          limit: 10,
        });
      }

      // Tier 2: Search important memories (vector search)
      const memories = await ctx.runQuery(api.memory.mutations.searchMemories, {
        userId: args.userId,
        embedding,
        topK: 5,
      });

      // COMMENTED OUT: Tier 3 thread summaries not needed for simplified approach
      // Tier 3: Search thread contexts (vector search)
      // const threadContexts = await ctx.runQuery(
      //   api.memory.mutations.searchThreadContexts,
      //   {
      //     userId: args.userId,
      //     embedding,
      //     topK: 2,
      //   }
      // );

      // Format for AI consumption (without thread contexts)
      const formattedContext = formatContextForAI(
        recentMessages,
        memories
      );

      console.log(
        `[Memory] Retrieved: ${recentMessages.length} recent, ${memories.length} memories`
      );

      return {
        recentMessages,
        memories: memories.slice(0, 5),
        formattedContext,
        stats: {
          recentCount: recentMessages.length,
          memoryCount: memories.length,
        },
      };
    } catch (error) {
      console.error("[Memory] Retrieval error:", error);
      return {
        recentMessages: [],
        memories: [],
        formattedContext: "",
        stats: { recentCount: 0, memoryCount: 0 },
        error: String(error),
      };
    }
  },
});

// Note: searchThreadContexts moved to memory/mutations.ts (must be in V8 isolate, not Node.js)

/**
 * Format retrieved context for AI prompt injection
 * SIMPLIFIED: Removed thread contexts (Tier 3)
 */
function formatContextForAI(
  recentMessages: any[],
  memories: any[]
): string {
  let context = "";

  // COMMENTED OUT: Thread summaries removed for simplified approach
  // Thread Summaries (highest level context)
  // if (threadContexts.length > 0) {
  //   context += "## Previous Conversation Context:\n";
  //   threadContexts.forEach((thread, idx) => {
  //     context += `${idx + 1}. ${thread.summary}\n`;
  //   });
  //   context += "\n";
  // }

  // Important Memories (mid-level context)
  if (memories.length > 0) {
    context += "## User Preferences & Important Facts:\n";
    memories.forEach((mem, idx) => {
      context += `${idx + 1}. ${mem.text} (relevance: ${(mem.similarity * 100).toFixed(0)}%)\n`;
    });
    context += "\n";
  }

  // Recent Messages (immediate context)
  if (recentMessages.length > 0) {
    context += "## Recent Conversation:\n";
    const last5 = recentMessages.slice(-5);
    last5.forEach((msg) => {
      context += `${msg.role}: ${msg.content}\n`;
    });
    context += "\n";
  }

  return context.trim();
}

/**
 * Quick retrieval for lightweight queries (skip embeddings)
 */
export const retrieveRecentMemories = action({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const memories = await ctx.runQuery(api.memory.mutations.listMemories, {
      userId: args.userId,
      limit,
    });

    return memories;
  },
});

/**
 * SIMPLIFIED MEMORY RETRIEVAL with Time Filters
 * Single-path retrieval using embeddings + optional time filtering
 * Perfect for queries like "I liked the pasta from last week"
 */
export const retrieveMemoriesSimplified = action({
  args: {
    userId: v.string(),
    query: v.string(),
    timeRangeDays: v.optional(v.number()), // e.g., 7 for last 7 days, 30 for last month
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const limit = args.limit ?? 10;

      // Generate embedding for semantic search
      const embedding = await generateEmbedding(args.query);

      // Calculate time cutoff if specified
      const now = Date.now();
      const timeRangeMs = args.timeRangeDays
        ? args.timeRangeDays * 24 * 60 * 60 * 1000
        : undefined;
      const cutoffTime = timeRangeMs ? now - timeRangeMs : 0;

      console.log(
        `[Memory] Simplified retrieval: query="${args.query}", ` +
        `timeRange=${args.timeRangeDays ? args.timeRangeDays + ' days' : 'all time'}, ` +
        `cutoff=${cutoffTime ? new Date(cutoffTime).toISOString() : 'none'}`
      );

      // Search memories with time filter (using action, not query!)
      const memories = await ctx.runAction(internal.memory.mutations.vectorSearchMemories, {
        userId: args.userId,
        embedding,
        topK: limit,
        minCreatedAt: cutoffTime,
      });

      // Format for AI consumption
      let formattedContext = "";
      if (memories.length > 0) {
        formattedContext += "## Relevant User Memories:\n";
        memories.forEach((mem, idx) => {
          const daysAgo = Math.floor((now - mem.createdAt) / (24 * 60 * 60 * 1000));
          const timeAgo = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
          formattedContext += `${idx + 1}. ${mem.text} (${timeAgo}, relevance: ${(mem.similarity * 100).toFixed(0)}%)\n`;
        });
      }

      console.log(`[Memory] Retrieved ${memories.length} memories`);

      return {
        memories,
        formattedContext: formattedContext.trim(),
        stats: {
          memoryCount: memories.length,
          timeRange: args.timeRangeDays ? `${args.timeRangeDays} days` : "all time",
          oldestMemory: memories.length > 0 ? new Date(Math.min(...memories.map(m => m.createdAt))).toISOString() : null,
        },
      };
    } catch (error) {
      console.error("[Memory] Simplified retrieval error:", error);
      return {
        memories: [],
        formattedContext: "",
        stats: { memoryCount: 0, timeRange: "error" },
        error: String(error),
      };
    }
  },
});

/**
 * Smart Memory Retrieval Based on Intent Level
 * Routes to appropriate search strategy based on query complexity
 */
export const retrieveMemoryByIntent = action({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    query: v.string(),
    intent: v.string(), // "simple" | "medium" | "complex"
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    console.log(`[Memory] Retrieving for intent: ${args.intent}, query: "${args.query.substring(0, 50)}..."`);

    const results: {
      keywordMatches: any[];
      recentMessages: any[];
      vectorMemories: any[];
      threadSummaries: any[];
      formattedContext: string;
      stats: {
        intent: string;
        keywordCount: number;
        recentCount: number;
        vectorCount: number;
        threadCount: number;
        latencyMs: number;
      };
    } = {
      keywordMatches: [],
      recentMessages: [],
      vectorMemories: [],
      threadSummaries: [],
      formattedContext: "",
      stats: {
        intent: args.intent,
        keywordCount: 0,
        recentCount: 0,
        vectorCount: 0,
        threadCount: 0,
        latencyMs: 0,
      },
    };

    try {
      // SIMPLE INTENT: Skip memory retrieval entirely
      if (args.intent === "simple") {
        console.log("[Memory] Simple intent - skipping retrieval");
        results.stats.latencyMs = Date.now() - startTime;
        return results;
      }

      // MEDIUM INTENT: Keyword + Recent + Light Vector (if needed)
      if (args.intent === "medium") {
        // 1. Extract keywords and search (fast, no embeddings)
        const keywords = extractKeywords(args.query);
        if (keywords.length > 0) {
          results.keywordMatches = await ctx.runQuery(
            api.memory.keywordSearch.searchMemoriesByKeywords,
            {
              userId: args.userId,
              keywords,
              limit: 3,
            }
          );
          results.stats.keywordCount = results.keywordMatches.length;
        }

        // 2. Get recent session messages
        if (args.sessionId) {
          results.recentMessages = await ctx.runQuery(
            api.chat.communitychat.getSessionMessages,
            {
              sessionId: args.sessionId,
              limit: 5,
            }
          );
          results.stats.recentCount = results.recentMessages.length;
        }

        // 3. If keyword results < 2, do light vector search as fallback
        if (results.keywordMatches.length < 2) {
          console.log("[Memory] Keyword results insufficient, using light vector search");
          const embedding = await generateEmbedding(args.query);
          results.vectorMemories = await ctx.runQuery(
            api.memory.mutations.searchMemories,
            {
              userId: args.userId,
              embedding,
              topK: 3,
            }
          );
          results.stats.vectorCount = results.vectorMemories.length;
        }

        // Format context
        results.formattedContext = formatContextWithWeights(results, "medium");
      }

      // COMPLEX INTENT: Full retrieval across all tiers
      if (args.intent === "complex") {
        const embedding = await generateEmbedding(args.query);

        // 1. Thread summaries (Tier 3) - highest level context
        results.threadSummaries = await ctx.runQuery(
          api.memory.mutations.searchThreadContexts,
          {
            userId: args.userId,
            embedding,
            topK: 2,
          }
        );
        results.stats.threadCount = results.threadSummaries.length;

        // 2. Vector search on memories (Tier 2) - semantic matches
        results.vectorMemories = await ctx.runQuery(
          api.memory.mutations.searchMemories,
          {
            userId: args.userId,
            embedding,
            topK: 10,
          }
        );
        results.stats.vectorCount = results.vectorMemories.length;

        // 3. Keyword matches (Tier 2) - exact hits
        const keywords = extractKeywords(args.query);
        if (keywords.length > 0) {
          results.keywordMatches = await ctx.runQuery(
            api.memory.keywordSearch.searchMemoriesByKeywords,
            {
              userId: args.userId,
              keywords,
              limit: 3,
            }
          );
          results.stats.keywordCount = results.keywordMatches.length;
        }

        // 4. Recent messages (Tier 1) - immediate context
        if (args.sessionId) {
          results.recentMessages = await ctx.runQuery(
            api.chat.communitychat.getSessionMessages,
            {
              sessionId: args.sessionId,
              limit: 5,
            }
          );
          results.stats.recentCount = results.recentMessages.length;
        }

        // Format context with all tiers
        results.formattedContext = formatContextWithWeights(results, "complex");
      }

      results.stats.latencyMs = Date.now() - startTime;

      console.log(
        `[Memory] Retrieved: ${results.stats.keywordCount} keywords, ${results.stats.recentCount} recent, ${results.stats.vectorCount} vector, ${results.stats.threadCount} threads (${results.stats.latencyMs}ms)`
      );

      return results;
    } catch (error) {
      console.error("[Memory] Retrieval error:", error);
      results.stats.latencyMs = Date.now() - startTime;
      return results;
    }
  },
});

/**
 * Format retrieved context with proper weighting and ordering
 * Includes structured extractedTerms inline
 */
function formatContextWithWeights(
  results: {
    keywordMatches: any[];
    recentMessages: any[];
    vectorMemories: any[];
    threadSummaries: any[];
  },
  intent: "medium" | "complex"
): string {
  let context = "";

  // Helper to format extracted terms
  const formatTerms = (terms: any) => {
    if (!terms) return "";
    const parts = [];
    if (terms.proteins?.length > 0) parts.push(`Proteins: ${terms.proteins.join(", ")}`);
    if (terms.restrictions?.length > 0) parts.push(`Restrictions: ${terms.restrictions.join(", ")}`);
    if (terms.preferences?.length > 0) parts.push(`Preferences: ${terms.preferences.join(", ")}`);
    if (terms.timeConstraints?.length > 0) parts.push(`Time: ${terms.timeConstraints.join(", ")}`);
    if (terms.dietaryTags?.length > 0) parts.push(`Diet Tags: ${terms.dietaryTags.join(", ")}`);
    if (terms.equipment?.length > 0) parts.push(`Equipment: ${terms.equipment.join(", ")}`);
    return parts.length > 0 ? ` [${parts.join(" | ")}]` : "";
  };

  // COMPLEX: Thread summaries first (highest priority)
  if (intent === "complex" && results.threadSummaries.length > 0) {
    context += "## Previous Conversation Themes [HIGH PRIORITY]:\n";
    results.threadSummaries.forEach((thread, idx) => {
      context += `${idx + 1}. ${thread.summary}\n`;
    });
    context += "\n";
  }

  // Vector memories (semantic matches)
  if (results.vectorMemories.length > 0) {
    const priority = intent === "complex" ? "MEDIUM-HIGH" : "MEDIUM";
    context += `## Important Memories [${priority} PRIORITY]:\n`;
    results.vectorMemories.forEach((mem, idx) => {
      const relevance = mem.similarity
        ? `(relevance: ${(mem.similarity * 100).toFixed(0)}%)`
        : "";
      const terms = formatTerms(mem.extractedTerms);
      context += `${idx + 1}. ${mem.text} ${relevance}${terms}\n`;
    });
    context += "\n";
  }

  // Keyword matches (exact hits)
  if (results.keywordMatches.length > 0) {
    context += "## Exact Facts [MEDIUM PRIORITY]:\n";
    results.keywordMatches.forEach((mem, idx) => {
      const terms = formatTerms(mem.extractedTerms);
      context += `${idx + 1}. ${mem.text}${terms}\n`;
    });
    context += "\n";
  }

  // Recent messages (immediate context)
  if (results.recentMessages.length > 0) {
    const priority = intent === "medium" ? "HIGH" : "LOW-MEDIUM";
    context += `## Recent Conversation [${priority} PRIORITY]:\n`;
    const last5 = results.recentMessages.slice(-5);
    last5.forEach((msg) => {
      context += `${msg.role}: ${msg.content}\n`;
    });
    context += "\n";
  }

  return context.trim();
}
