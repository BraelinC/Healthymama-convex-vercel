/**
 * Session Cache Manager (Node.js Actions)
 * Smart 2-minute TTL cache that:
 * - Warms up on page load with profile
 * - Updates incrementally with each message
 * - Extends TTL on activity (won't expire mid-conversation)
 * - Auto-expires after 2 minutes of inactivity
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (safety net for abandoned sessions)
const MAX_CACHED_MESSAGES = 15;

/**
 * Initialize cache when user opens chat page
 * Loads profile and creates empty cache (version 0)
 */
export const initializeSessionCache = action({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    console.log(`[Cache] Initializing for user ${args.userId}, session ${args.sessionId}`);

    // Check if cache already exists
    const existing = await ctx.runQuery(internal.memory.sessionCacheQueries.getCacheInternal, {
      userId: args.userId,
      sessionId: args.sessionId,
    });

    if (existing) {
      console.log(`[Cache] Already initialized (version ${existing.version})`);
      return { cached: true, source: "already_exists", version: existing.version };
    }

    // Load user profile (fast)
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: args.userId,
    });

    // Create empty cache entry with profile-only context
    const profileContext = profile ? formatProfileOnly(profile) : "";

    await ctx.runMutation(internal.memory.sessionCacheQueries.createCache, {
      userId: args.userId,
      sessionId: args.sessionId,
      cachedContext: profileContext,
      version: 0, // Version 0 = profile only, needs first message update
      messageCount: 0,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    console.log(`[Cache] Initialized with profile (expires in 2 min)`);
    return { cached: true, source: "profile_only", version: 0 };
  },
});


/**
 * Update cache with new message context
 * Called after each user message
 */
export const updateCache = action({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
    newMessageId: v.id("chatMessages"),
    newMessageContent: v.string(),
    mergedContext: v.string(), // Pre-built merged context from profileMerge
    intent: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    console.log(`[Cache] Updating for new message (intent: ${args.intent})`);

    // Get current cache
    const currentCache = await ctx.runQuery(api.memory.sessionCacheQueries.checkCache, {
      userId: args.userId,
      sessionId: args.sessionId,
    });

    // Rank new message (most recent = highest priority)
    const newRank = 100;

    // Get existing messages and decay their ranks
    let existingMessages = currentCache.stats?.recentMessages || [];
    if (Array.isArray(existingMessages)) {
      existingMessages = existingMessages.map((msg: any) => ({
        ...msg,
        rank: msg.rank * 0.9, // Decay older messages by 10%
      }));
    }

    // Add new message to ranked list
    const updatedMessages = [
      {
        messageId: args.newMessageId,
        content: args.newMessageContent.substring(0, 500), // Truncate long messages
        rank: newRank,
        timestamp: Date.now(),
      },
      ...existingMessages,
    ].slice(0, MAX_CACHED_MESSAGES); // Keep only last 15

    // Update cache in database
    await ctx.runMutation(internal.memory.sessionCacheQueries.updateCacheEntry, {
      userId: args.userId,
      sessionId: args.sessionId,
      cachedContext: args.mergedContext,
      version: (currentCache.stats?.version || 0) + 1,
      messageCount: updatedMessages.length,
      recentMessages: updatedMessages,
      expiresAt: Date.now() + CACHE_TTL_MS, // Extend TTL
    });

    const latency = Date.now() - startTime;
    const newVersion = (currentCache.stats?.version || 0) + 1;

    console.log(`[Cache] Updated to v${newVersion} (${latency}ms, ${updatedMessages.length} messages)`);

    return {
      cached: true,
      version: newVersion,
      messageCount: updatedMessages.length,
      latencyMs: latency,
    };
  },
});

/**
 * Extend cache TTL on user activity
 * Lightweight operation to prevent mid-conversation expiry
 */
export const extendCacheTTL = action({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.memory.sessionCacheQueries.extendTTL, {
      userId: args.userId,
      sessionId: args.sessionId,
    });
  },
});


// ========== HELPER FUNCTIONS ==========

/**
 * Format profile-only context (for initial cache)
 */
function formatProfileOnly(profile: any): string {
  if (!profile?.prefs) return "";

  let context = "## User Profile:\n";

  if (profile.prefs.profileName) {
    context += `Name: ${profile.prefs.profileName}\n`;
  }
  if (profile.prefs.primaryGoal) {
    context += `Goal: ${profile.prefs.primaryGoal}\n`;
  }
  if (profile.prefs.dietaryRestrictions?.length > 0) {
    context += `⚠️ Dietary Restrictions: ${profile.prefs.dietaryRestrictions.join(", ")}\n`;
  }
  if (profile.prefs.preferences?.length > 0) {
    context += `Preferences: ${profile.prefs.preferences.join(", ")}\n`;
  }
  if (profile.prefs.culturalBackground?.length > 0) {
    context += `Cuisines: ${profile.prefs.culturalBackground.join(", ")}\n`;
  }

  return context;
}

