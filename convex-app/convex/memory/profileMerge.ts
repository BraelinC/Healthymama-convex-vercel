/**
 * Profile-Memory Merge System
 * Combines user-set profile data (source of truth) with AI-learned memories
 * Profile allergies/restrictions ALWAYS take precedence for safety
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Build merged user context combining profile + AI memories
 * Priority: Profile data (user-set) > AI memories (learned)
 */
export const buildMergedUserContext = action({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("chatSessions")),
    query: v.string(),
    intent: v.string(), // "simple" | "medium" | "complex"
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    console.log(`[ProfileMerge] Building merged context for user ${args.userId}, intent: ${args.intent}`);

    try {
      // STEP 1: Load persistent user profile (source of truth)
      const profile = await ctx.runQuery(api.users.getUserProfile, {
        userId: args.userId,
      });

      console.log(`[ProfileMerge] Profile loaded:`, profile ? "✓" : "✗");

      // STEP 2: Retrieve AI memories based on intent (skip for simple queries)
      let memoryContext: any = {
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

      if (args.intent !== "simple") {
        memoryContext = await ctx.runAction(
          api.memory.smartRetrieval.retrieveMemoryByIntent,
          {
            userId: args.userId,
            sessionId: args.sessionId,
            query: args.query,
            intent: args.intent,
          }
        );

        console.log(
          `[ProfileMerge] AI memories retrieved: ${memoryContext.stats.keywordCount} keywords, ${memoryContext.stats.vectorCount} vectors`
        );
      }

      // STEP 3: Merge profile + AI memories with priority rules
      const mergedContext = mergeProfileAndMemories(profile, memoryContext);

      const totalLatency = Date.now() - startTime;

      console.log(`[ProfileMerge] Merge complete (${totalLatency}ms)`);

      return {
        profileData: profile,
        aiMemories: memoryContext,
        mergedContext,
        stats: {
          ...memoryContext.stats,
          totalLatencyMs: totalLatency,
          hasProfile: !!profile,
        },
      };
    } catch (error) {
      console.error("[ProfileMerge] Error:", error);
      return {
        profileData: null,
        aiMemories: null,
        mergedContext: "",
        stats: {
          intent: args.intent,
          totalLatencyMs: Date.now() - startTime,
          hasProfile: false,
          error: String(error),
        },
      };
    }
  },
});

/**
 * Merge profile data with AI memories
 * Rules:
 * 1. Profile allergies/restrictions = ALWAYS priority (100% compliance)
 * 2. Profile preferences enriched by AI-learned patterns
 * 3. AI memories add equipment, time constraints, cooking patterns
 */
function mergeProfileAndMemories(
  profile: any,
  memoryContext: any
): string {
  let context = "";

  // ========== TIER 1: CRITICAL PROFILE DATA (HIGHEST PRIORITY) ==========
  if (profile?.prefs) {
    context += "## USER PROFILE [SOURCE OF TRUTH - 100% COMPLIANCE REQUIRED]:\n\n";

    // Profile Name & Goal
    if (profile.prefs.profileName) {
      context += `**Name:** ${profile.prefs.profileName}\n`;
    }
    if (profile.prefs.primaryGoal) {
      context += `**Primary Goal:** ${profile.prefs.primaryGoal}\n`;
    }

    // Dietary Restrictions (CRITICAL - never override)
    if (profile.prefs.dietaryRestrictions?.length > 0) {
      context += `\n**⚠️ DIETARY RESTRICTIONS (MANDATORY COMPLIANCE):**\n`;
      profile.prefs.dietaryRestrictions.forEach((restriction: string) => {
        context += `  - ${restriction}\n`;
      });
      context += `\n**IMPORTANT:** These restrictions are user-set and MUST be respected in ALL recipe suggestions. Never recommend recipes containing these ingredients.\n`;
    }

    // Food Preferences (user-set)
    if (profile.prefs.preferences?.length > 0) {
      context += `\n**Food Preferences [USER-SET]:**\n`;
      profile.prefs.preferences.forEach((pref: string) => {
        context += `  - ${pref}\n`;
      });
    }

    // Cultural Background
    if (profile.prefs.culturalBackground?.length > 0) {
      context += `\n**Preferred Cuisines:**\n`;
      profile.prefs.culturalBackground.forEach((cuisine: string) => {
        context += `  - ${cuisine}\n`;
      });
    }

    context += "\n---\n\n";
  }

  // ========== TIER 2: AI-LEARNED CONTEXT (ENRICHMENT) ==========
  if (memoryContext?.formattedContext && memoryContext.formattedContext.trim().length > 0) {
    context += "## AI-LEARNED PATTERNS & MEMORIES [ENRICHMENT]:\n\n";
    context += memoryContext.formattedContext;
    context += "\n---\n\n";
  }

  // ========== TIER 3: CONFLICT DETECTION ==========
  const conflicts = detectConflicts(profile, memoryContext);
  if (conflicts.length > 0) {
    context += "## ⚠️ DETECTED CONFLICTS (Profile Takes Precedence):\n";
    conflicts.forEach((conflict) => {
      context += `  - ${conflict}\n`;
    });
    context += "\n---\n\n";
  }

  // ========== GUIDANCE FOR AI ==========
  context += "## INSTRUCTIONS FOR AI:\n";
  context += "1. **ALWAYS comply with dietary restrictions from USER PROFILE** (allergies, diet types)\n";
  context += "2. **Prioritize user-set preferences** from profile over AI-learned patterns\n";
  context += "3. **Use AI memories to enrich** recommendations (equipment, time constraints, cooking patterns)\n";
  context += "4. **If conflict exists**, choose the safer/more restrictive option from profile\n";
  context += "5. **Never suggest** recipes that violate profile restrictions, even if AI memories suggest interest\n";

  return context.trim();
}

/**
 * Detect conflicts between profile and AI memories
 * E.g., profile says "dairy allergy" but AI learned "loves cheese"
 */
function detectConflicts(profile: any, memoryContext: any): string[] {
  const conflicts: string[] = [];

  if (!profile?.prefs?.dietaryRestrictions || !memoryContext?.vectorMemories) {
    return conflicts;
  }

  const restrictions = profile.prefs.dietaryRestrictions.map((r: string) =>
    r.toLowerCase()
  );

  // Check AI memories for conflicting terms
  memoryContext.vectorMemories.forEach((memory: any) => {
    if (!memory.extractedTerms) return;

    const memoryText = memory.text.toLowerCase();
    const allTerms = [
      ...memory.extractedTerms.proteins,
      ...memory.extractedTerms.preferences,
    ].map((t: string) => t.toLowerCase());

    // Conflict detection patterns
    const conflictPatterns: Record<string, string[]> = {
      dairy: ["milk", "cheese", "yogurt", "butter", "cream"],
      gluten: ["wheat", "bread", "pasta", "flour"],
      nut: ["almond", "walnut", "peanut", "cashew"],
      shellfish: ["shrimp", "crab", "lobster", "oyster"],
      soy: ["tofu", "soy sauce", "edamame"],
    };

    restrictions.forEach((restriction: string) => {
      // Find matching conflict pattern
      const restrictionKey = Object.keys(conflictPatterns).find((key) =>
        restriction.includes(key)
      );

      if (restrictionKey) {
        const conflictingTerms = conflictPatterns[restrictionKey];
        const found = allTerms.filter((term: string) =>
          conflictingTerms.some((ct) => term.includes(ct) || ct.includes(term))
        );

        if (found.length > 0) {
          conflicts.push(
            `Profile restricts "${restriction}" but AI learned interest in: ${found.join(", ")}. **Using profile restriction.**`
          );
        }
      }
    });
  });

  return conflicts;
}

/**
 * Quick profile-only retrieval (skip AI memories)
 * Use for very simple queries or when memory retrieval not needed
 */
export const getProfileOnly = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.runQuery(api.users.getUserProfile, {
      userId: args.userId,
    });

    if (!profile?.prefs) {
      return { profileContext: "", hasProfile: false };
    }

    let context = "## User Profile:\n";

    if (profile.prefs.profileName) {
      context += `Name: ${profile.prefs.profileName}\n`;
    }

    if (profile.prefs.dietaryRestrictions?.length > 0) {
      context += `Dietary Restrictions: ${profile.prefs.dietaryRestrictions.join(", ")}\n`;
    }

    if (profile.prefs.preferences?.length > 0) {
      context += `Preferences: ${profile.prefs.preferences.join(", ")}\n`;
    }

    return {
      profileContext: context,
      hasProfile: true,
      profile: profile.prefs,
    };
  },
});
