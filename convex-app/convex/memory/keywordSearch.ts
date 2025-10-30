/**
 * Fast Keyword-Based Memory Search
 * No embeddings required - uses text matching for quick lookups
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Extract cooking-relevant keywords from query
 */
export function extractKeywords(query: string): string[] {
  const normalized = query.toLowerCase();

  // Food categories and ingredients
  const foods = [
    "chicken", "beef", "pork", "fish", "salmon", "tuna", "shrimp",
    "vegetarian", "vegan", "pasta", "rice", "bread", "egg", "cheese",
    "tofu", "beans", "lentils", "quinoa", "potato", "vegetable",
    "fruit", "salad", "soup", "stew", "curry", "stir fry"
  ];

  // Dietary restrictions and allergies
  const dietary = [
    "allergic", "allergy", "allergies", "dairy", "gluten", "nut", "nuts",
    "peanut", "lactose", "celiac", "intolerant", "intolerance",
    "shellfish", "soy", "wheat", "egg allergy", "vegan", "vegetarian",
    "keto", "paleo", "low carb", "sugar free", "diabetic"
  ];

  // Preferences and dislikes
  const preferences = [
    "love", "loves", "hate", "hates", "favorite", "favourite", "dislike",
    "prefer", "prefers", "avoid", "don't like", "doesn't like"
  ];

  // Cooking context and constraints
  const context = [
    "quick", "fast", "easy", "simple", "healthy", "budget", "cheap",
    "meal prep", "batch cook", "leftovers", "freezer", "microwave",
    "slow cooker", "instant pot", "air fryer", "grill", "bake"
  ];

  // Time-related
  const time = [
    "30 minutes", "15 minutes", "hour", "tonight", "tomorrow",
    "weekend", "weeknight", "lunch", "dinner", "breakfast"
  ];

  const allKeywords = [...foods, ...dietary, ...preferences, ...context, ...time];

  return allKeywords.filter(kw => normalized.includes(kw));
}

/**
 * Search memories by keyword matching (fast, no embeddings)
 * Searches both text field AND extractedTerms arrays
 */
export const searchMemoriesByKeywords = query({
  args: {
    userId: v.string(),
    keywords: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;

    if (args.keywords.length === 0) {
      return [];
    }

    console.log(`[Memory] Keyword search for: ${args.keywords.join(", ")}`);

    // Get all user memories
    const allMemories = await ctx.db
      .query("userMemories")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(100); // Search last 100 memories only (performance)

    // Filter by keyword matches (text + extractedTerms)
    const matched = allMemories
      .map((memory) => {
        const text = memory.text.toLowerCase();
        let textMatches = 0;
        let termMatches = 0;

        // Count text matches
        args.keywords.forEach(kw => {
          if (text.includes(kw)) textMatches++;
        });

        // Count structured term matches (higher priority)
        if (memory.extractedTerms) {
          const allTerms = [
            ...memory.extractedTerms.proteins,
            ...memory.extractedTerms.restrictions,
            ...memory.extractedTerms.preferences,
            ...memory.extractedTerms.timeConstraints,
            ...memory.extractedTerms.dietaryTags,
            ...memory.extractedTerms.equipment,
          ].map(t => t.toLowerCase());

          args.keywords.forEach(kw => {
            if (allTerms.some(term => term.includes(kw) || kw.includes(term))) {
              termMatches++;
            }
          });
        }

        const matchCount = textMatches + termMatches;

        return {
          ...memory,
          textMatches,
          termMatches,
          matchCount,
          matchRatio: matchCount / args.keywords.length,
          matchSource: termMatches > 0 ? "structured" : "text",
        };
      })
      .filter((m) => m.matchCount > 0)
      .sort((a, b) => {
        // Prioritize structured term matches
        if (a.termMatches !== b.termMatches) {
          return b.termMatches - a.termMatches;
        }
        // Then match ratio
        if (b.matchRatio !== a.matchRatio) {
          return b.matchRatio - a.matchRatio;
        }
        // Then recency
        return b._creationTime - a._creationTime;
      })
      .slice(0, limit);

    console.log(`[Memory] Keyword matches: ${matched.length} results (${matched.filter(m => m.termMatches > 0).length} from structured terms)`);

    return matched.map((m) => ({
      _id: m._id,
      text: m.text,
      category: m.category,
      extractedTerms: m.extractedTerms,
      createdAt: m._creationTime,
      matchCount: m.matchCount,
      matchSource: m.matchSource,
    }));
  },
});
