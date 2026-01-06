/**
 * Session Cache Queries & Mutations (V8 Isolate)
 * Split from sessionCache.ts to comply with Convex runtime rules
 */

import { internalMutation, query } from "../_generated/server";
import { v } from "convex/values";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (safety net for abandoned sessions)

/**
 * Check if cache exists and is valid
 * Returns: { hit: true/false, context: string, reason: string, stats?: object }
 */
export const checkCache = query({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const cache = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (!cache) {
      return { hit: false, context: "", reason: "cache_not_found" };
    }

    // Check if expired
    const now = Date.now();
    if (cache.expiresAt < now) {
      return {
        hit: false,
        context: "",
        reason: "cache_expired",
        expiredAgo: now - cache.expiresAt,
      };
    }

    // CACHE HIT! 🎉
    // Version 0 (profile only) is valid for new sessions - treat as hit!
    return {
      hit: true,
      context: cache.cachedContext,
      reason: cache.version === 0 ? "cache_hit_profile_only" : "cache_hit",
      stats: {
        version: cache.version,
        messageCount: cache.messageCount,
        hitCount: cache.hitCount,
        age: Date.now() - cache.updatedAt,
        expiresIn: cache.expiresAt - Date.now(),
      },
    };
  },
});

/**
 * Internal query to get cache (used by other functions)
 */
export const getCacheInternal = query({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessionCache")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .first();
  },
});

/**
 * Create new cache entry
 */
export const createCache = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
    cachedContext: v.string(),
    version: v.number(),
    messageCount: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("sessionCache", {
      userId: args.userId,
      sessionId: args.sessionId,
      cachedContext: args.cachedContext,
      version: args.version,
      messageCount: args.messageCount,
      lastMessageAt: now,
      expiresAt: args.expiresAt,
      hitCount: 0,
      missCount: 1, // First creation counts as a miss
      recentMessages: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update existing cache entry
 */
export const updateCacheEntry = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
    cachedContext: v.string(),
    version: v.number(),
    messageCount: v.number(),
    recentMessages: v.array(v.any()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const cache = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (cache) {
      await ctx.db.patch(cache._id, {
        cachedContext: args.cachedContext,
        version: args.version,
        messageCount: args.messageCount,
        recentMessages: args.recentMessages,
        lastMessageAt: Date.now(),
        expiresAt: args.expiresAt,
        missCount: cache.missCount + 1, // Rebuild counts as a miss
        updatedAt: Date.now(),
      });
    } else {
      // Cache doesn't exist, create it
      await ctx.db.insert("sessionCache", {
        userId: args.userId,
        sessionId: args.sessionId,
        cachedContext: args.cachedContext,
        version: args.version,
        messageCount: args.messageCount,
        recentMessages: args.recentMessages,
        lastMessageAt: Date.now(),
        expiresAt: args.expiresAt,
        hitCount: 0,
        missCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Extend TTL without rebuilding context
 */
export const extendTTL = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const cache = await ctx.db
      .query("sessionCache")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", args.userId).eq("sessionId", args.sessionId)
      )
      .first();

    if (cache) {
      await ctx.db.patch(cache._id, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        lastMessageAt: Date.now(),
        hitCount: cache.hitCount + 1,
      });
    }
  },
});

/**
 * Expire old caches (called by cron job every 5 minutes)
 */
export const expireOldCaches = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const expiredCaches = await ctx.db
      .query("sessionCache")
      .withIndex("by_expiry")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(50);

    for (const cache of expiredCaches) {
      console.log(`[Cache] Expiring cache for session ${cache.sessionId} (idle for ${Math.floor((now - cache.lastMessageAt) / 1000)}s)`);
      await ctx.db.delete(cache._id);
    }

    if (expiredCaches.length > 0) {
      console.log(`[Cache] Expired ${expiredCaches.length} old caches`);
    }

    return { expired: expiredCaches.length };
  },
});
