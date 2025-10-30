/**
 * Cache Intelligence Router
 * Smart decision system that:
 * - Checks cache first (30-50ms if hit)
 * - Falls back to full search on miss (700-2000ms)
 * - Auto-updates cache for next request
 * - Extends TTL to prevent mid-conversation expiry
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Smart cache-aware context retrieval
 * Decision tree:
 *   1. Check cache → HIT → extend TTL → return (fast!)
 *   2. Check cache → MISS → full search → update cache → return
 */
export const getContextWithCache = action({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
    query: v.string(),
    intent: v.string(),
    newMessageId: v.optional(v.id("chatMessages")),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // STEP 1: Check cache
    const cacheCheck = await ctx.runQuery(api.memory.sessionCacheQueries.checkCache, {
      userId: args.userId,
      sessionId: args.sessionId,
    });

    console.log(
      `[CacheRouter] ${cacheCheck.hit ? '🎯 HIT' : '❌ MISS'} - ${cacheCheck.reason}` +
      (cacheCheck.stats ? ` (v${cacheCheck.stats.version}, age=${Math.floor(cacheCheck.stats.age / 1000)}s)` : '')
    );

    // ========== CACHE HIT: Use cached context (fast path!) ==========
    if (cacheCheck.hit) {
      // No TTL extension - cache persists while user is on app
      // This makes cache hits lightning fast (30-50ms instead of 473ms!)
      const latency = Date.now() - startTime;

      console.log(
        `[CacheRouter] ⚡ Served from cache (${latency}ms, ` +
        `hits=${cacheCheck.stats?.hitCount}, age=${Math.floor((cacheCheck.stats?.age || 0) / 1000)}s)`
      );

      return {
        mergedContext: cacheCheck.context,
        source: "cache_hit",
        stats: {
          totalLatencyMs: latency,
          cacheVersion: cacheCheck.stats?.version,
          cacheAge: cacheCheck.stats?.age,
          hitCount: cacheCheck.stats?.hitCount,
          cached: true,
          // Pass through profileMerge-compatible stats
          hasProfile: true,
          keywordCount: 0,
          recentCount: cacheCheck.stats?.messageCount || 0,
          vectorCount: 0,
          threadCount: 0,
        },
      };
    }

    // ========== CACHE MISS: Build profile-only context (fast!) ==========
    console.log(`[CacheRouter] 🔄 Cache miss (${cacheCheck.reason}), rebuilding profile-only cache...`);

    // Load ONLY user profile (no AI memories - those come via tool calls)
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: args.userId,
    });

    // Format profile-only context
    const profileContext = profile ? formatProfileOnly(profile) : "";

    // Update cache for next request (async, non-blocking - don't wait!)
    // Skip cache update if no message was saved (e.g., recipe selections)
    if (args.newMessageId) {
      ctx.runAction(api.memory.sessionCache.updateCache, {
        userId: args.userId,
        sessionId: args.sessionId,
        newMessageId: args.newMessageId,
        newMessageContent: args.query,
        mergedContext: profileContext,
        intent: args.intent,
      }).catch((error) => {
        console.error(`[CacheRouter] Failed to update cache:`, error);
      });
    }

    const latency = Date.now() - startTime;

    console.log(`[CacheRouter] ✅ Rebuilt profile cache (${latency}ms) - AI memories available via tool`);

    return {
      mergedContext: profileContext,
      source: "cache_miss_rebuilt_profile_only",
      stats: {
        totalLatencyMs: latency,
        reason: cacheCheck.reason,
        cached: false,
        hasProfile: !!profile,
        keywordCount: 0, // AI memories now retrieved via tool
        recentCount: 0,
        vectorCount: 0,
        threadCount: 0,
      },
    };
  },
});

/**
 * Lightweight cache check (for debugging/monitoring)
 * Returns cache status without performing any operations
 */
export const getCacheStatus = action({
  args: {
    userId: v.string(),
    sessionId: v.id("chatSessions"),
  },
  handler: async (ctx, args) => {
    const cacheCheck = await ctx.runQuery(api.memory.sessionCacheQueries.checkCache, {
      userId: args.userId,
      sessionId: args.sessionId,
    });

    return {
      exists: cacheCheck.hit || cacheCheck.reason !== "cache_not_found",
      valid: cacheCheck.hit,
      reason: cacheCheck.reason,
      stats: cacheCheck.stats,
    };
  },
});

// ========== HELPER FUNCTIONS ==========

/**
 * Format profile-only context (dietary restrictions, goals, preferences)
 * AI memories are NO LONGER auto-injected - they come via tool calls
 * FORMATTED AS BACKGROUND KNOWLEDGE - NOT TO BE RECITED TO USER
 */
function formatProfileOnly(profile: any): string {
  if (!profile?.prefs) return "";

  // Build concise profile summary (data only - no instructions)
  const profileParts: string[] = [];

  if (profile.prefs.profileName) {
    profileParts.push(`Name: ${profile.prefs.profileName}`);
  }
  if (profile.prefs.primaryGoal) {
    profileParts.push(`Goal: ${profile.prefs.primaryGoal}`);
  }
  if (profile.prefs.culturalBackground?.length > 0) {
    profileParts.push(`Cuisines: ${profile.prefs.culturalBackground.join(", ")}`);
  }
  if (profile.prefs.preferences?.length > 0) {
    profileParts.push(`Preferences: ${profile.prefs.preferences.join(", ")}`);
  }

  let context = profileParts.join(" | ");

  // Dietary restrictions are CRITICAL - keep them prominent
  if (profile.prefs.dietaryRestrictions?.length > 0) {
    context += `\n⚠️ Dietary Restrictions: ${profile.prefs.dietaryRestrictions.join(", ")}`;
  }

  return context;
}
