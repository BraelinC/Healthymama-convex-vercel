import { v } from "convex/values";
import { action, internalMutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Generate conversation summary (Tier 3)
 * Called after a chat session ends or reaches significant length
 */
export const generateConversationSummary = action({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    communityId: v.string(),
    messages: v.array(
      v.object({
        _id: v.id("chatMessages"),
        role: v.string(),
        content: v.string(),
        createdAt: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.messages.length === 0) {
      console.log("[CONVERSATION SUMMARY] No messages to summarize");
      return null;
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const conversationText = args.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const summaryPrompt = `Summarize this cooking conversation. Extract:
1. Main topics discussed
2. Recipes mentioned or discussed
3. Decisions or plans made by the user

Conversation:
${conversationText}

Return ONLY a JSON object in this exact format:
{
  "summary": "concise 2-3 sentence summary of the conversation",
  "topics": ["topic1", "topic2", ...],
  "recipesDiscussed": ["recipe1", "recipe2", ...] (or empty array if none),
  "decisionsMade": ["decision1", "decision2", ...] (or empty array if none)
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

    try {
      const result = await model.generateContent(summaryPrompt);
      const responseText = result.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log("[CONVERSATION SUMMARY] Failed to extract JSON");
        return null;
      }

      const summaryData = JSON.parse(jsonMatch[0]);

      // Generate embedding for semantic search
      const embeddingResponse = await openai.embeddings.create({
        input: summaryData.summary,
        model: "text-embedding-3-small",
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Get time range
      const sortedMessages = [...args.messages].sort(
        (a, b) => a.createdAt - b.createdAt
      );
      const timeRange = {
        startTime: sortedMessages[0].createdAt,
        endTime: sortedMessages[sortedMessages.length - 1].createdAt,
      };

      // Save summary
      const summaryId = await ctx.runMutation(
        internal.memory.conversationSummaries.createSummary,
        {
          sessionId: args.sessionId,
          userId: args.userId,
          communityId: args.communityId,
          summary: summaryData.summary,
          topics: summaryData.topics || [],
          recipesDiscussed: summaryData.recipesDiscussed || [],
          decisionsMade: summaryData.decisionsMade || [],
          timeRange,
          messageCount: args.messages.length,
          embedding,
        }
      );

      console.log(`[CONVERSATION SUMMARY] Created summary for session ${args.sessionId}`);
      return summaryId;
    } catch (error) {
      console.error("[CONVERSATION SUMMARY] Error:", error);
      return null;
    }
  },
});

/**
 * Internal: Create conversation summary in database
 */
export const createSummary = internalMutation({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    communityId: v.string(),
    summary: v.string(),
    topics: v.array(v.string()),
    recipesDiscussed: v.array(v.string()),
    decisionsMade: v.array(v.string()),
    timeRange: v.object({
      startTime: v.number(),
      endTime: v.number(),
    }),
    messageCount: v.number(),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if summary already exists for this session
    const existing = await ctx.db
      .query("conversationSummaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      // Update existing summary
      await ctx.db.patch(existing._id, {
        summary: args.summary,
        topics: args.topics,
        recipesDiscussed: args.recipesDiscussed,
        decisionsMade: args.decisionsMade,
        timeRange: args.timeRange,
        messageCount: args.messageCount,
        embedding: args.embedding,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new summary
      const summaryId = await ctx.db.insert("conversationSummaries", {
        sessionId: args.sessionId,
        userId: args.userId,
        communityId: args.communityId,
        summary: args.summary,
        topics: args.topics,
        recipesDiscussed: args.recipesDiscussed,
        decisionsMade: args.decisionsMade,
        timeRange: args.timeRange,
        messageCount: args.messageCount,
        embedding: args.embedding,
        embeddingModel: "text-embedding-3-small",
        createdAt: now,
        updatedAt: now,
      });
      return summaryId;
    }
  },
});

/**
 * Stage 1: Search conversation summaries by semantic similarity and time range
 */
export const searchConversationSummaries = action({
  args: {
    userId: v.string(),
    communityId: v.optional(v.string()),
    query: v.string(),
    timeRangeDays: v.optional(v.number()), // e.g., 7 for "last week", 30 for "last month"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    // Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      input: args.query,
      model: "text-embedding-3-small",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Calculate time filter if provided
    let startTimeFilter: number | undefined;
    if (args.timeRangeDays) {
      const now = Date.now();
      startTimeFilter = now - args.timeRangeDays * 24 * 60 * 60 * 1000;
    }

    // Vector search (filter by userId only - Convex doesn't support q.and())
    const results = await ctx.vectorSearch("conversationSummaries", "by_embedding", {
      vector: queryEmbedding,
      limit: limit * 3, // Get extra results for post-filtering by communityId and time
      filter: (q) => q.eq("userId", args.userId),
    });

    // Post-filter by communityId if specified
    let filteredResults = results;
    if (args.communityId) {
      filteredResults = filteredResults.filter(
        (r) => r.communityId === args.communityId
      );
    }

    // Post-filter by time range if specified
    if (startTimeFilter) {
      filteredResults = filteredResults.filter(
        (r) => r.timeRange.startTime >= startTimeFilter!
      );
    }

    return filteredResults.slice(0, limit);
  },
});

/**
 * Stage 2: Get full conversation from a session (deep retrieval)
 */
export const getFullConversation = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all messages from the session
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Sort by creation time
    const sortedMessages = messages.sort((a, b) => a.createdAt - b.createdAt);

    return sortedMessages;
  },
});

/**
 * Get conversation summary for a specific session
 */
export const getSummaryBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const summary = await ctx.db
      .query("conversationSummaries")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    return summary;
  },
});

/**
 * Get all conversation summaries for a user (chronological)
 */
export const getUserConversationHistory = query({
  args: {
    userId: v.string(),
    communityId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    let summaries;
    if (args.communityId) {
      summaries = await ctx.db
        .query("conversationSummaries")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("communityId"), args.communityId))
        .order("desc")
        .take(limit);
    } else {
      summaries = await ctx.db
        .query("conversationSummaries")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(limit);
    }

    return summaries;
  },
});

/**
 * Delete conversation summary
 */
export const deleteSummary = internalMutation({
  args: {
    summaryId: v.id("conversationSummaries"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.summaryId);
  },
});
