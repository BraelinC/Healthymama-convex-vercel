/**
 * Recipe Queries Module
 * Database queries for vector search and recipe retrieval (runs in V8 isolate, not Node.js)
 * Implements hybrid search: Vector (semantic) + Lexical (exact) + Fuzzy (typos/variations)
 */

import { query, internalQuery, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  calculateAverageFuzzySimilarity,
  countExactMatches,
} from "../lib/fuzzyMatch";

/**
 * HYBRID SEARCH SCORING SYSTEM
 * Combines 3 layers of similarity for optimal accuracy:
 *
 * Layer 1: Vector Similarity (0-100%) - Semantic understanding via embeddings
 * Layer 2: Lexical Boost (0-15%) - Exact keyword matching in title
 * Layer 3: Fuzzy Boost (0-8%) - Close matches with typos/variations
 *
 * Max Score = 100% + 15% + 8% = 123% (capped at 100% for display)
 */

/**
 * Calculate lexical boost based on exact keyword matches
 * Returns 0-15% boost depending on how many query words appear in recipe title
 *
 * Formula: (matched_words / total_words) × 15%
 *
 * Example:
 * - Query: "healthy carrot muffins", Title: "Healthy Carrot Muffins"
 *   → 3/3 matches = +15%
 * - Query: "BBQ chicken", Title: "BBQ Chicken Pizza"
 *   → 2/2 matches = +15%
 * - Query: "comfort food", Title: "Mac and Cheese"
 *   → 0/2 matches = +0%
 */
function calculateLexicalBoost(query: string, recipeTitle: string): number {
  const { matches, total } = countExactMatches(query, recipeTitle);

  if (total === 0) return 0;

  const matchRatio = matches / total;
  return matchRatio * 0.15; // 15% max boost
}

/**
 * Calculate fuzzy boost based on approximate string matching
 * Handles typos, plurals, and word variations using Levenshtein distance
 * Returns 0-8% boost based on average fuzzy similarity
 *
 * Formula: average_fuzzy_similarity × 8%
 *
 * Example:
 * - Query: "helthy carrot mufins", Title: "Healthy Carrot Muffins"
 *   → 90% fuzzy match = +7.2%
 * - Query: "roasted potatoes", Title: "Roasting Potato Wedges"
 *   → 85% fuzzy match = +6.8%
 */
function calculateFuzzyBoost(query: string, recipeTitle: string): number {
  const fuzzySimilarity = calculateAverageFuzzySimilarity(query, recipeTitle);
  return fuzzySimilarity * 0.08; // 8% max boost
}

/**
 * Calculate hybrid score combining all three layers
 * Final score is capped at 1.0 (100%)
 *
 * Example breakdown:
 * Query: "healthy carrot muffins"
 * Recipe: "Healthy Carrot Muffins"
 *
 * Vector:  0.786 (78.6% semantic similarity)
 * Lexical: +0.15 (100% exact match, 3/3 words)
 * Fuzzy:   +0.0  (no typos, not needed)
 * ─────────────
 * Final:   0.936 (93.6%) ✅
 */
function calculateHybridScore(
  query: string,
  recipeTitle: string,
  vectorSimilarity: number
): number {
  const lexicalBoost = calculateLexicalBoost(query, recipeTitle);
  const fuzzyBoost = calculateFuzzyBoost(query, recipeTitle);

  const hybridScore = vectorSimilarity + lexicalBoost + fuzzyBoost;

  // Cap at 1.0 (100%)
  return Math.min(hybridScore, 1.0);
}

/**
 * Internal Query: Fetch recipe documents by IDs
 * Called from vectorSearchRecipes action to load full documents
 */
export const fetchRecipesByIds = internalQuery({
  args: {
    ids: v.array(v.id("recipes")),
  },
  handler: async (ctx, args) => {
    const recipes = await Promise.all(
      args.ids.map(async (id) => {
        const recipe = await ctx.db.get(id);
        return recipe;
      })
    );
    return recipes.filter((r) => r !== null);
  },
});

/**
 * Action: Vector search recipes by embedding with hybrid scoring
 * Supports community filtering and dietary tag filtering
 * NOTE: Vector search is only available in actions, not queries
 */
export const vectorSearchRecipes = internalAction({
  args: {
    embedding: v.array(v.float64()),
    communityId: v.string(),
    limit: v.optional(v.number()),
    dietaryTags: v.optional(v.array(v.string())),
    allergens: v.optional(v.array(v.string())), // User allergens to EXCLUDE
    query: v.optional(v.string()), // Original query for hybrid scoring
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const useHybridScoring = !!args.query; // Use hybrid if query provided

    console.log(`🔍 [RECIPE SEARCH] ${useHybridScoring ? 'Hybrid' : 'Vector'} search in community: ${args.communityId}, limit: ${limit}`);

    // ═══════════════════════════════════════════════════════════════
    // TWO-STAGE RETRIEVAL FOR OPTIMAL PERFORMANCE
    // ═══════════════════════════════════════════════════════════════

    // STAGE 1: Native Vector Search (FAST - uses Convex's optimized index)
    // Get top candidates using native vector search with community filter
    const candidateLimit = Math.max(limit * 4, 20);

    const vectorResults = await ctx.vectorSearch("recipes", "by_embedding", {
      vector: args.embedding,
      limit: candidateLimit,
      filter: (q) => q.eq("community", args.communityId),
    });

    console.log(`   📊 Stage 1: Native vector search found ${vectorResults.length} candidates`);

    // Load full recipe documents from vector search results
    const recipeIds = vectorResults.map((result) => result._id);
    const recipes = await ctx.runQuery(internal["recipes/recipeQueries"].fetchRecipesByIds, {
      ids: recipeIds,
    });

    // Map recipes with their vector similarity scores
    const scoreMap = new Map(vectorResults.map((r) => [r._id, r._score]));
    const topCandidates = recipes.map((recipe) => ({
      ...recipe,
      vectorSimilarity: scoreMap.get(recipe._id) || 0,
    }));

    // Filter out any null results (deleted recipes)
    const validCandidates = topCandidates.filter((r) => r !== null);

    // Apply ALLERGEN filter first (HARD CONSTRAINT - must exclude)
    let filteredCandidates = validCandidates;
    if (args.allergens && args.allergens.length > 0) {
      const userAllergens = args.allergens.map(a => a.toLowerCase());
      const beforeCount = filteredCandidates.length;

      // EXCLUDE recipes that contain any allergens the user is allergic to
      // Note: This checks recipe names/ingredients for allergen keywords
      filteredCandidates = filteredCandidates.filter(recipe => {
        const recipeName = recipe.name.toLowerCase();
        const ingredients = recipe.ingredients?.map(i => i.toLowerCase()).join(' ') || '';
        const recipeText = `${recipeName} ${ingredients}`;

        // Check if any allergen appears in recipe
        const hasAllergen = userAllergens.some(allergen =>
          recipeText.includes(allergen)
        );

        return !hasAllergen; // Keep recipe ONLY if it doesn't contain allergens
      });

      console.log(`   ⚠️ ALLERGEN FILTER: Excluded ${beforeCount - filteredCandidates.length} recipes containing: ${userAllergens.join(', ')}`);
    }

    // Apply dietary tag filter to candidates (soft preference)
    if (args.dietaryTags && args.dietaryTags.length > 0) {
      const requestedTags = args.dietaryTags.map(tag => tag.toLowerCase());
      const filtered = filteredCandidates.filter(recipe =>
        recipe.dietTags.some(tag => requestedTags.includes(tag.toLowerCase()))
      );

      // Only apply filter if it found matches, otherwise use all candidates
      if (filtered.length > 0) {
        filteredCandidates = filtered;
        console.log(`   🔍 Filtered from ${validCandidates.length} to ${filteredCandidates.length} candidates by dietary tags: ${requestedTags.join(', ')}`);
      } else {
        console.log(`   ⚠️ No candidates matched dietary tags [${requestedTags.join(', ')}], using all ${filteredCandidates.length} candidates`);
      }
    }

    // STAGE 2: Hybrid Reranking (ONLY filtered candidates - expensive but precise)
    // Apply fuzzy + lexical boosting only to filtered candidates for efficiency
    const rerankedCandidates = filteredCandidates.map((recipe) => {
      const similarity = useHybridScoring
        ? calculateHybridScore(args.query!, recipe.name, recipe.vectorSimilarity)
        : recipe.vectorSimilarity;

      return { ...recipe, similarity };
    });

    // Re-sort candidates with hybrid scores
    rerankedCandidates.sort((a, b) => b.similarity - a.similarity);

    // Take final top results
    const topResults = rerankedCandidates.slice(0, limit);

    if (useHybridScoring) {
      console.log(`   ⚡ Stage 2: Applied hybrid scoring to ${filteredCandidates.length} candidates`);
    }

    console.log(`✅ [RECIPE SEARCH] Found ${topResults.length} recipes`);
    if (topResults.length > 0) {
      const topRecipe = topResults[0];
      console.log(`📋 [RECIPE SEARCH] Top result: "${topRecipe.name}" (similarity: ${topRecipe.similarity.toFixed(3)})`);

      // Show hybrid scoring breakdown for top result if available
      if (useHybridScoring) {
        // Get the vector score from the recipe (before hybrid scoring)
        const vectorScore = topRecipe.vectorSimilarity || topRecipe.similarity;
        const lexicalBoost = calculateLexicalBoost(args.query!, topRecipe.name);
        const fuzzyBoost = calculateFuzzyBoost(args.query!, topRecipe.name);

        console.log(`   🔹 Vector: ${(vectorScore * 100).toFixed(1)}% | Lexical: +${(lexicalBoost * 100).toFixed(1)}% | Fuzzy: +${(fuzzyBoost * 100).toFixed(1)}%`);
      }
    }

    return topResults;
  },
});

/**
 * Query: List recent recipes in a community
 */
export const listCommunityRecipes = query({
  args: {
    communityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    const recipes = await ctx.db
      .query("recipes")
      .withIndex("by_community", (q) => q.eq("community", args.communityId))
      .order("desc")
      .take(limit);

    return recipes;
  },
});

/**
 * Query: Get an extracted recipe by ID
 */
export const getExtractedRecipeById = query({
  args: {
    recipeId: v.id("extractedRecipes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipeId);
  },
});

/**
 * Query: List all extracted recipes for a specific job
 */
export const listExtractedRecipesByJob = query({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractedRecipes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

/**
 * Query: Get a single recipe by ID
 */
export const getRecipeById = query({
  args: {
    recipeId: v.id("recipes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipeId);
  },
});

/**
 * Helper: Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Helper: Format recipe for AI tool response
 */
export function formatRecipeForAI(recipe: {
  name: string;
  description: string;
  ingredients: string[];
  steps: string[];
  dietTags: string[];
}): string {
  const parts: string[] = [
    `## ${recipe.name}`,
    "",
    recipe.description ? `**Description:** ${recipe.description}` : "",
    "",
    "**Dietary Tags:** " + recipe.dietTags.join(", "),
    "",
    "**Ingredients:**",
    ...recipe.ingredients.map((ing, i) => `${i + 1}. ${ing}`),
    "",
    "**Instructions:**",
    ...recipe.steps.map((step, i) => `${i + 1}. ${step}`),
  ];

  return parts.filter((p) => p !== "").join("\n");
}
