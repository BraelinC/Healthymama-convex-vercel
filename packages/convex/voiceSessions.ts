/**
 * Voice Sessions - Gemini Live Cooking Assistant
 * Queries and Mutations (V8 isolate - no Node.js)
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ========== QUERIES ==========

/**
 * Get a session by ID
 */
export const getSession = query({
  args: { sessionId: v.id("voiceSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

/**
 * Get active session for a user (if any)
 */
export const getActiveSession = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("voiceSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();
  },
});

/**
 * Get recent sessions for a user
 */
export const getRecentSessions = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 10 }) => {
    return await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Internal: Get stale sessions for timeout processing
 */
export const getStale = internalQuery({
  args: { maxActivityAt: v.number() },
  handler: async (ctx, { maxActivityAt }) => {
    const staleSessions = await ctx.db
      .query("voiceSessions")
      .withIndex("by_status_activity", (q) => q.eq("status", "active"))
      .filter((q) => q.lt(q.field("lastActivityAt"), maxActivityAt))
      .collect();

    return staleSessions;
  },
});

/**
 * Internal: Get session for processing
 */
export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("voiceSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

// ========== MUTATIONS ==========

/**
 * Create a new voice session
 */
export const createSession = mutation({
  args: {
    userId: v.string(),
    recipeId: v.optional(v.id("userRecipes")),
  },
  handler: async (ctx, { userId, recipeId }) => {
    const now = Date.now();

    // End any existing active sessions for this user
    const activeSession = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .first();

    if (activeSession) {
      await ctx.db.patch(activeSession._id, {
        status: "ended",
        endedAt: now,
      });
    }

    // Create new session
    const sessionId = await ctx.db.insert("voiceSessions", {
      userId,
      recipeId,
      turns: [],
      status: "active",
      startedAt: now,
      lastActivityAt: now,
    });

    console.log(`[VoiceSession] Created session ${sessionId} for user ${userId}`);
    return sessionId;
  },
});

/**
 * Add a turn to the session transcript
 */
export const addTurn = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
    role: v.union(v.literal("user"), v.literal("model")),
    text: v.string(),
  },
  handler: async (ctx, { sessionId, role, text }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status !== "active") {
      console.log(`[VoiceSession] Warning: Adding turn to non-active session ${sessionId}`);
    }

    const now = Date.now();
    const newTurn = { role, text, timestamp: now };

    await ctx.db.patch(sessionId, {
      turns: [...session.turns, newTurn],
      lastActivityAt: now,
    });

    console.log(`[VoiceSession] Added ${role} turn to session ${sessionId}: "${text.substring(0, 50)}..."`);
  },
});

/**
 * End a session and trigger processing
 */
export const endSession = mutation({
  args: { sessionId: v.id("voiceSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    if (session.status !== "active") {
      console.log(`[VoiceSession] Session ${sessionId} already ended`);
      return;
    }

    await ctx.db.patch(sessionId, {
      status: "ended",
      endedAt: Date.now(),
    });

    // Schedule background processing
    await ctx.scheduler.runAfter(0, internal.voiceSessionsActions.processSession, {
      sessionId,
    });

    console.log(`[VoiceSession] Ended session ${sessionId}, scheduled processing`);
  },
});

/**
 * Internal: Mark session as processed
 */
export const markProcessed = internalMutation({
  args: {
    sessionId: v.id("voiceSessions"),
    extractedFactIds: v.array(v.id("voiceMemories")),
  },
  handler: async (ctx, { sessionId, extractedFactIds }) => {
    await ctx.db.patch(sessionId, {
      status: "processed",
      extractedFactIds,
    });

    console.log(`[VoiceSession] Session ${sessionId} processed, extracted ${extractedFactIds.length} facts`);
  },
});

/**
 * Internal: End stale session
 */
export const endStaleSession = internalMutation({
  args: { sessionId: v.id("voiceSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "active") return;

    await ctx.db.patch(sessionId, {
      status: "ended",
      endedAt: Date.now(),
    });

    console.log(`[VoiceSession] Ended stale session ${sessionId}`);
  },
});
