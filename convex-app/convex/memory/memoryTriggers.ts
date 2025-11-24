/**
 * Memory System Triggers
 * Background jobs that extract and process memories after conversations
 */

import { internalMutation, internalAction, action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Trigger preference extraction from recent conversation
 * Called after every N messages (e.g., every 5 messages)
 */
export const triggerPreferenceExtraction = internalAction({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    communityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`[MEMORY TRIGGER] Starting preference extraction for session ${args.sessionId}`);

    // Get recent messages from this session (last 10)
    const messages = await ctx.runQuery(internal.memory.memoryTriggers.getRecentSessionMessages, {
      sessionId: args.sessionId,
      limit: 10,
    });

    if (messages.length < 3) {
      console.log(`[MEMORY TRIGGER] Not enough messages (${messages.length}) to extract preferences`);
      return;
    }

    // Extract preferences (runs in background)
    await ctx.runAction(internal.memory.learnedPreferences.extractPreferencesFromMessages, {
      userId: args.userId,
      agentId: args.communityId,
      sessionId: args.sessionId,
      messages,
    });

    console.log(`[MEMORY TRIGGER] Preference extraction completed for session ${args.sessionId}`);
  },
});

/**
 * Trigger conversation summary generation
 * Called when session ends or reaches significant length (e.g., 20+ messages)
 */
export const triggerConversationSummary = internalAction({
  args: {
    sessionId: v.string(),
    userId: v.string(),
    communityId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`[MEMORY TRIGGER] Starting conversation summary for session ${args.sessionId}`);

    // Get all messages from this session
    const messages = await ctx.runQuery(internal.memory.memoryTriggers.getAllSessionMessages, {
      sessionId: args.sessionId,
    });

    if (messages.length < 5) {
      console.log(`[MEMORY TRIGGER] Not enough messages (${messages.length}) to generate summary`);
      return;
    }

    // Generate summary (runs in background)
    await ctx.runAction(internal.memory.conversationSummaries.generateConversationSummary, {
      sessionId: args.sessionId,
      userId: args.userId,
      communityId: args.communityId,
      messages,
    });

    console.log(`[MEMORY TRIGGER] Conversation summary completed for session ${args.sessionId}`);
  },
});

/**
 * Internal query: Get recent messages from a session
 */
export const getRecentSessionMessages = internalMutation({
  args: {
    sessionId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit);

    return messages
      .reverse()
      .map((m) => ({
        _id: m._id,
        role: m.role,
        content: m.content,
      }));
  },
});

/**
 * Internal query: Get all messages from a session
 */
export const getAllSessionMessages = internalMutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return messages
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => ({
        _id: m._id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));
  },
});

/**
 * Auto-trigger memory processing after message is added
 * This should be called from the chat API after a user message is saved
 */
export const autoProcessMemories = action({
  args: {
    userId: v.string(),
    sessionId: v.string(),
    communityId: v.string(),
    messageCount: v.number(), // Current message count in session
  },
  handler: async (ctx, args) => {
    // Extract preferences every 5 messages
    if (args.messageCount % 5 === 0) {
      await ctx.runAction(internal.memory.memoryTriggers.triggerPreferenceExtraction, {
        userId: args.userId,
        sessionId: args.sessionId,
        communityId: args.communityId,
      });
    }

    // Generate conversation summary every 20 messages
    if (args.messageCount % 20 === 0) {
      await ctx.runAction(internal.memory.memoryTriggers.triggerConversationSummary, {
        sessionId: args.sessionId,
        userId: args.userId,
        communityId: args.communityId,
      });
    }
  },
});
