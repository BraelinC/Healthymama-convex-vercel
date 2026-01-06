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

    // ========== CACHE MISS: Build Tier 1 + Tier 2 context (fast!) ==========
    console.log(`[CacheRouter] 🔄 Cache miss (${cacheCheck.reason}), rebuilding Tier 1 + 2 cache...`);

    // Load Tier 1: User Profile (static onboarding data)
    const userProfile = await ctx.runQuery(api.userProfile.getUserProfile, {
      userId: args.userId,
    });

    // Load Tier 2: Top 10 Learned Preferences (dynamic AI-learned data)
    const learnedPrefs = await ctx.runQuery(api.memory.learnedPreferences.getTopPreferences, {
      userId: args.userId,
      agentId: undefined, // Global preferences across all communities
      limit: 10,
    });

    // Load Tier 2.5: Recent Meals (last 7 days, max 10 recipes)
    const recentMeals = await ctx.runQuery(api.memory.recentMeals.getRecentMeals, {
      userId: args.userId,
      limit: 10,
      days: 7,
    });

    // Format combined context (Tier 1 + Tier 2 + Tier 2.5)
    const profileContext = formatMultiTierContext(userProfile, learnedPrefs, recentMeals);

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

    console.log(`[CacheRouter] ✅ Rebuilt Tier 1+2 cache (${latency}ms) - Tier 3 available via tool`);

    return {
      mergedContext: profileContext,
      source: "cache_miss_rebuilt_tier1_tier2",
      stats: {
        totalLatencyMs: latency,
        reason: cacheCheck.reason,
        cached: false,
        hasProfile: !!userProfile,
        hasLearnedPrefs: learnedPrefs.length > 0,
        learnedPrefsCount: learnedPrefs.length,
        keywordCount: 0, // Tier 3 memories retrieved via tool
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

/**
 * Format multi-tier context (Tier 1 + Tier 2 + Tier 2.5) for AI
 * FORMATTED AS BACKGROUND KNOWLEDGE - NOT TO BE RECITED TO USER
 */
function formatMultiTierContext(userProfile: any, learnedPrefs: any[], recentMeals: any[]): string {
  const sections: string[] = [];

  // ============ TIER 1: USER PROFILE (Static Onboarding Data) ============
  if (userProfile) {
    const profileParts: string[] = [];

    if (userProfile.name) {
      profileParts.push(`Name: ${userProfile.name}`);
    }
    if (userProfile.familySize) {
      profileParts.push(`Family Size: ${userProfile.familySize} people`);
    }
    if (userProfile.cookingSkillLevel) {
      profileParts.push(`Skill Level: ${userProfile.cookingSkillLevel}`);
    }
    if (userProfile.defaultServings) {
      profileParts.push(`Default Servings: ${userProfile.defaultServings}`);
    }

    // Optional fields
    if (userProfile.preferredCuisines?.length > 0) {
      profileParts.push(`Preferred Cuisines: ${userProfile.preferredCuisines.join(", ")}`);
    }
    if (userProfile.kitchenEquipment?.length > 0) {
      profileParts.push(`Equipment: ${userProfile.kitchenEquipment.join(", ")}`);
    }

    if (profileParts.length > 0) {
      sections.push(`[USER PROFILE]\n${profileParts.join(" | ")}`);
    }

    // Allergens are CRITICAL - keep them prominent (life-threatening)
    if (userProfile.allergens?.length > 0) {
      sections.push(`⚠️ ALLERGENS (MUST AVOID - LIFE-THREATENING): ${userProfile.allergens.join(", ")}`);
    }

    // Dietary preferences are important but not life-threatening
    if (userProfile.dietaryPreferences?.length > 0) {
      sections.push(`🍽️ DIETARY PREFERENCES (Lifestyle Choices): ${userProfile.dietaryPreferences.join(", ")}`);
    }
  }

  // ============ TIER 2: LEARNED PREFERENCES (AI-Discovered Patterns) ============
  if (learnedPrefs && learnedPrefs.length > 0) {
    // Group by preference type
    const grouped: Record<string, string[]> = {
      food_love: [],
      food_dislike: [],
      cooking_habit: [],
      time_constraint: [],
      lifestyle_context: [],
    };

    learnedPrefs.forEach((pref) => {
      grouped[pref.preferenceType].push(
        `${pref.summary} (confidence: ${(pref.confidence * 100).toFixed(0)}%)`
      );
    });

    const prefLines: string[] = [];
    if (grouped.food_love.length > 0) {
      prefLines.push(`Loves: ${grouped.food_love.join(", ")}`);
    }
    if (grouped.food_dislike.length > 0) {
      prefLines.push(`Dislikes: ${grouped.food_dislike.join(", ")}`);
    }
    if (grouped.cooking_habit.length > 0) {
      prefLines.push(`Cooking Habits: ${grouped.cooking_habit.join("; ")}`);
    }
    if (grouped.time_constraint.length > 0) {
      prefLines.push(`Time Constraints: ${grouped.time_constraint.join("; ")}`);
    }
    if (grouped.lifestyle_context.length > 0) {
      prefLines.push(`Lifestyle: ${grouped.lifestyle_context.join("; ")}`);
    }

    if (prefLines.length > 0) {
      sections.push(`[LEARNED PREFERENCES]\n${prefLines.join("\n")}`);
    }
  }

  // ============ TIER 2.5: RECENT MEALS (Last 7 Days) ============
  if (recentMeals && recentMeals.length > 0) {
    const mealsList = recentMeals.map((meal) => {
      const daysAgo = Math.floor((Date.now() - meal.discussedAt) / (1000 * 60 * 60 * 24));
      const timeAgo = daysAgo === 0 ? "today" : daysAgo === 1 ? "yesterday" : `${daysAgo} days ago`;
      return `${meal.recipeName} (${timeAgo})`;
    }).join(", ");

    sections.push(`[RECENT MEALS]\n${mealsList}`);
  }

  return sections.join("\n\n");
}
