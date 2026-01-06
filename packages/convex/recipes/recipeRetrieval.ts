// @ts-nocheck
/**
 * Recipe Retrieval Module
 * Vector search and retrieval for recipes in AI chat
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const GROK_MODEL = "openai/gpt-4o-mini"; // Fast & cheap query enhancement
const GEMINI_FLASH_LITE = "google/gemini-2.5-flash-lite";

type QueryIntent =
  | "specific_dish"       // chocolate chip cookies, tikka masala, pad thai
  | "specific_cuisine"    // Italian pasta, Mexican tacos, Thai curry
  | "simple_ingredient"   // egg, chicken, pasta recipes
  | "constrained_search"  // quick dinner, budget meals, keto lunch
  | "what_can_i_make";    // what can I make with X, using leftover Y

/**
 * Analyze query intent using Gemini 2.5 Flash Lite (ultra-fast, ~50-100ms)
 * AI-driven classification - NO regex, NO patterns, pure natural language understanding
 */
async function analyzeQueryIntent(query: string): Promise<QueryIntent> {
  console.log(`🔍 [QUERY ANALYSIS] Analyzing intent: "${query}"`);

  const openRouterKey = process.env.OPEN_ROUTER_API_KEY;
  if (!openRouterKey) {
    console.warn("OPEN_ROUTER_API_KEY not set, defaulting to constrained_search");
    return "constrained_search";
  }

  const prompt = `You are a recipe search intent classifier. Analyze the user's query and determine their search intent.

Query: "${query}"

Classification categories:

1. SPECIFIC_DISH
   - User wants a specific, well-known dish by name
   - Examples: "chocolate chip cookies", "chicken tikka masala", "beef wellington", "pad thai", "carbonara"

2. SPECIFIC_CUISINE
   - User explicitly mentions a cuisine, culture, or region
   - Examples: "Italian pasta", "Mexican tacos", "Thai curry", "Indian dinner recipes", "Peruvian chicken"

3. SIMPLE_INGREDIENT
   - User searches for just an ingredient or two, wants general ideas
   - Examples: "egg", "chicken", "pasta", "egg recipes", "chicken breast recipes"

4. CONSTRAINED_SEARCH
   - User has specific constraints: time, budget, cooking method, dietary preferences, servings
   - Examples: "quick dinner for 2", "budget meals", "one pot recipes", "keto lunch ideas", "gluten free desserts"

5. WHAT_CAN_I_MAKE
   - User asks what they can make with ingredients they have
   - Examples: "what can I make with chicken and rice", "I have eggs and cheese", "using leftover bananas"

Real-world examples to learn from:
- "quick dinner for 2 under 30 minutes" → constrained_search
- "gluten free chocolate chip cookies" → specific_dish
- "what can I make with chicken and rice" → what_can_i_make
- "low carb breakfast ideas" → constrained_search
- "vegetarian pasta recipes no tomato sauce" → constrained_search
- "easy weeknight meals with ground beef" → constrained_search
- "desserts that use leftover bananas" → what_can_i_make
- "keto lunch ideas high protein" → constrained_search
- "one pot curry recipes" → specific_cuisine
- "budget friendly meals for a family of 4" → constrained_search
- "egg" → simple_ingredient
- "chicken recipes" → simple_ingredient
- "chicken tikka masala" → specific_dish
- "Italian pasta" → specific_cuisine
- "dinner ideas" → constrained_search

Output ONLY one of these five words: specific_dish, specific_cuisine, simple_ingredient, constrained_search, or what_can_i_make`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
      },
      body: JSON.stringify({
        model: GEMINI_FLASH_LITE,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1, // Very low for consistent classification
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`Gemini analysis failed: ${JSON.stringify(error)}`);
      return "constrained_search"; // Safe default
    }

    const data = await response.json();
    const result = data.choices[0].message.content.trim().toLowerCase();

    // Parse AI classification (NO regex - just string matching)
    if (result.includes("specific_dish")) {
      console.log(`✅ [QUERY ANALYSIS] Intent: SPECIFIC_DISH (no cultural override)`);
      return "specific_dish";
    } else if (result.includes("specific_cuisine")) {
      console.log(`✅ [QUERY ANALYSIS] Intent: SPECIFIC_CUISINE (respect cuisine choice)`);
      return "specific_cuisine";
    } else if (result.includes("simple_ingredient")) {
      console.log(`✅ [QUERY ANALYSIS] Intent: SIMPLE_INGREDIENT (open to cultural variations)`);
      return "simple_ingredient";
    } else if (result.includes("what_can_i_make")) {
      console.log(`✅ [QUERY ANALYSIS] Intent: WHAT_CAN_I_MAKE (creative suggestions)`);
      return "what_can_i_make";
    } else {
      console.log(`✅ [QUERY ANALYSIS] Intent: CONSTRAINED_SEARCH (variety within constraints)`);
      return "constrained_search";
    }
  } catch (error) {
    console.error(`Error analyzing query: ${error}`);
    return "constrained_search"; // Safe default
  }
}

/**
 * Enhance query with user profile using Grok-4-Fast
 * Expands query with dietary needs, preferences, and goals in natural language
 * Research shows natural language expansion >> structured metadata for embeddings
 *
 * @param includeCuisine - If false, skip cultural/cuisine preferences (for specific_cuisine/specific_dish queries)
 */
async function enhanceQueryWithProfile(
  ctx: any,
  query: string,
  userId: string,
  includeCuisine: boolean = true
): Promise<string> {
  console.log(`🔍 [QUERY ENHANCEMENT] Original query: "${query}" (includeCuisine: ${includeCuisine})`);

  // Fetch user profile
  const userProfile = await ctx.runQuery(internal.users.getUserProfile, {
    userId,
  });

  // If no profile exists, return original query
  if (!userProfile || !userProfile.prefs) {
    console.log(`⚠️ [QUERY ENHANCEMENT] No profile found, using original query`);
    return query;
  }

  // Build profile context for Grok
  const profileParts: string[] = [];
  const prefs = userProfile.prefs;

  if (prefs.dietaryRestrictions && prefs.dietaryRestrictions.length > 0) {
    profileParts.push(`Dietary restrictions: ${prefs.dietaryRestrictions.join(", ")}`);
  }
  if (prefs.preferences && prefs.preferences.length > 0) {
    profileParts.push(`Taste preferences: ${prefs.preferences.join(", ")}`);
  }
  if (prefs.goals && prefs.goals.length > 0) {
    profileParts.push(`Goals: ${prefs.goals.join(", ")}`);
  }

  // Only include cultural cuisine if requested (skip for specific_cuisine/specific_dish)
  if (includeCuisine && prefs.culturalBackground && prefs.culturalBackground.length > 0) {
    profileParts.push(`Cultural cuisine interests: ${prefs.culturalBackground.join(", ")}`);
  }

  // If no meaningful profile data, return original query
  if (profileParts.length === 0) {
    console.log(`⚠️ [QUERY ENHANCEMENT] Empty profile, using original query`);
    return query;
  }

  const profileContext = profileParts.join("\n");

  // Call Grok-4-Fast to enhance query
  const openRouterKey = process.env.OPEN_ROUTER_API_KEY;
  if (!openRouterKey) {
    console.error("OPEN_ROUTER_API_KEY not set, skipping enhancement");
    return query;
  }

  const prompt = `You are a recipe search query optimizer. Your job is to expand user queries with their dietary profile to improve vector embedding search results.

User's original query: "${query}"

User's profile:
${profileContext}

Task: Rewrite this query as a KEYWORD-FOCUSED description that incorporates relevant profile information.

CRITICAL FORMATTING RULES:
- Use dense, keyword-rich language (NO first-person pronouns like "I'm", "I want")
- Start with the dish/ingredient, then add modifiers
- Include specific flavor descriptors (e.g., "soy, ginger, garlic" not "flavorful")
- Use noun phrases, NOT conversational sentences
- Keep it under 30 words for optimal embedding quality

Output ONLY the enhanced query, nothing else.

Good Examples:
Query: "dinner recipes"
Profile: Dietary restrictions: vegan, gluten-free. Taste preferences: Italian, garlic, spicy. Goals: high-protein, meal prep
Output: Vegan gluten-free dinner recipes featuring Italian flavors with garlic and spice, high-protein, meal-prep friendly

Query: "asian chicken"
Profile: Dietary restrictions: low-carb. Goals: muscle gain
Output: Low-carb Asian chicken recipes featuring soy, ginger, garlic, protein-packed for muscle gain

Bad Example (too conversational):
❌ "I'm looking for easy Asian chicken recipes that are low in carbohydrates and packed with protein"

Now enhance the user's query:`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Low temperature for consistent, focused expansion
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`Grok enhancement failed: ${JSON.stringify(error)}`);
      return query; // Fallback to original query
    }

    const data = await response.json();
    const enhancedQuery = data.choices[0].message.content.trim();

    console.log(`✅ [QUERY ENHANCEMENT] Enhanced query: "${enhancedQuery}"`);
    return enhancedQuery;
  } catch (error) {
    console.error(`Error enhancing query: ${error}`);
    return query; // Fallback to original query
  }
}

/**
 * Generate embedding for search query
 * Converts AI-enhanced query to vector for semantic search
 */
async function generateQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  // Pass through query (already optimized by AI enhancement)
  const expandedQuery = expandQueryForRecipeSearch(query);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: expandedQuery,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI Embeddings API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Pass through AI-enhanced query directly without expansion
 * AI enhancement already optimizes the query with keyword-rich, semantic language
 * Adding templated phrases would dilute semantic density and hurt embedding quality
 */
function expandQueryForRecipeSearch(query: string): string {
  // Return query as-is - AI enhancement already optimized it
  return query;
}

/**
 * Action: Search recipes by natural language query
 * Generates embedding and performs vector search
 */
export const searchRecipesByQuery = action({
  args: {
    query: v.string(),
    communityId: v.string(),
    userId: v.string(), // Added for profile-based query enhancement
    limit: v.optional(v.number()),
    dietaryTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    console.log(`🔍 [RECIPE SEARCH ACTION] Original query: "${args.query}"`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: ANALYZE QUERY INTENT (Gemini 2.5 Flash Lite ~50-100ms)
    // AI-driven classification - NO regex, NO patterns
    // ═══════════════════════════════════════════════════════════════
    const intent = await analyzeQueryIntent(args.query);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: ADAPTIVE SEARCH STRATEGY BASED ON INTENT
    // ═══════════════════════════════════════════════════════════════

    if (intent === "specific_dish") {
      // ──────────────────────────────────────────────────────────
      // STRATEGY A: SPECIFIC_DISH - No enhancement
      // User wants exact dish → don't add cultural preferences
      // ──────────────────────────────────────────────────────────
      console.log(`🎯 [SEARCH STRATEGY] SPECIFIC_DISH → Dietary-only enhancement`);

      const enhancedQuery = await enhanceQueryWithProfile(ctx, args.query, args.userId, false); // includeCuisine=false
      const embedding = await generateQueryEmbedding(enhancedQuery);

      const results = await ctx.runAction(internal["recipes/recipeQueries"].vectorSearchRecipes, {
        embedding,
        communityId: args.communityId,
        limit: args.limit || 4,
        dietaryTags: args.dietaryTags,
        query: args.query,
      });

      return results.map((recipe) => ({
        id: recipe._id,
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        dietTags: recipe.dietTags,
        imageUrl: recipe.imageUrl,
        sourceUrl: recipe.sourceUrl,
        similarity: recipe.similarity,
      }));

    } else if (intent === "specific_cuisine") {
      // ──────────────────────────────────────────────────────────
      // STRATEGY B: SPECIFIC_CUISINE - Dietary-only enhancement
      // User chose a cuisine → respect it, don't override with profile cuisines
      // ──────────────────────────────────────────────────────────
      console.log(`🎯 [SEARCH STRATEGY] SPECIFIC_CUISINE → Dietary-only enhancement`);

      const enhancedQuery = await enhanceQueryWithProfile(ctx, args.query, args.userId, false); // includeCuisine=false
      console.log(`📝 [ENHANCED QUERY] "${enhancedQuery}"`);

      const embedding = await generateQueryEmbedding(enhancedQuery);
      const results = await ctx.runAction(internal["recipes/recipeQueries"].vectorSearchRecipes, {
        embedding,
        communityId: args.communityId,
        limit: args.limit || 4,
        dietaryTags: args.dietaryTags,
        query: args.query,
      });

      return results.map((recipe) => ({
        id: recipe._id,
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        dietTags: recipe.dietTags,
        imageUrl: recipe.imageUrl,
        sourceUrl: recipe.sourceUrl,
        similarity: recipe.similarity,
      }));

    } else {
      // ──────────────────────────────────────────────────────────
      // STRATEGY C: DUAL PARALLEL SEARCH for variety
      // For: simple_ingredient, constrained_search, what_can_i_make
      // User is open to suggestions → show personalized + diverse options
      // ──────────────────────────────────────────────────────────
      console.log(`🎯 [SEARCH STRATEGY] ${intent.toUpperCase()} → Dual parallel search (personalized + diverse)`);

      // Run TWO searches in parallel
      const [personalizedResults, diverseResults] = await Promise.all([
        // Search 1: Full profile with cuisine (personalized)
        (async () => {
          const enhancedQuery = await enhanceQueryWithProfile(ctx, args.query, args.userId, true); // includeCuisine=true
          const expandedQuery = expandQueryForRecipeSearch(enhancedQuery);
          console.log(`📝 [SEARCH 1 - PERSONALIZED] Enhanced: "${expandedQuery}"`);

          const embedding = await generateQueryEmbedding(expandedQuery);
          return ctx.runAction(internal["recipes/recipeQueries"].vectorSearchRecipes, {
            embedding,
            communityId: args.communityId,
            limit: 2, // Get 2 personalized results
            dietaryTags: args.dietaryTags,
            query: args.query,
          });
        })(),

        // Search 2: Dietary-only, no cuisine (diverse)
        (async () => {
          const enhancedQuery = await enhanceQueryWithProfile(ctx, args.query, args.userId, false); // includeCuisine=false
          const expandedQuery = expandQueryForRecipeSearch(enhancedQuery);
          console.log(`📝 [SEARCH 2 - DIVERSE] Enhanced: "${expandedQuery}"`);

          const embedding = await generateQueryEmbedding(expandedQuery);
          return ctx.runAction(internal["recipes/recipeQueries"].vectorSearchRecipes, {
            embedding,
            communityId: args.communityId,
            limit: 2, // Get 2 diverse results
            dietaryTags: args.dietaryTags,
            query: args.query,
          });
        })(),
      ]);

      // Combine and deduplicate results
      const seenIds = new Set<string>();
      const combinedResults = [];

      // Add personalized results first
      for (const recipe of personalizedResults) {
        if (!seenIds.has(recipe._id)) {
          seenIds.add(recipe._id);
          combinedResults.push(recipe);
        }
      }

      // Add diverse results (skip duplicates)
      for (const recipe of diverseResults) {
        if (!seenIds.has(recipe._id)) {
          seenIds.add(recipe._id);
          combinedResults.push(recipe);
        }
      }

      console.log(`✅ [DUAL SEARCH] Combined ${combinedResults.length} unique recipes (${personalizedResults.length} personalized + ${diverseResults.length - (personalizedResults.length + diverseResults.length - combinedResults.length)} diverse)`);

      return combinedResults.map((recipe) => ({
        id: recipe._id,
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        dietTags: recipe.dietTags,
        imageUrl: recipe.imageUrl,
        sourceUrl: recipe.sourceUrl,
        similarity: recipe.similarity,
      }));
    }
  },
});

/**
 * Action: Get full recipe details by ID (for tool response)
 */
export const getRecipeByIdAction = action({
  args: {
    recipeId: v.id("recipes"),
  },
  handler: async (ctx, args) => {
    const recipe = await ctx.runQuery(internal["recipes/recipeQueries"].getRecipeById, {
      recipeId: args.recipeId,
    });

    if (!recipe) {
      throw new Error(`Recipe ${args.recipeId} not found`);
    }

    return {
      id: recipe._id,
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      dietTags: recipe.dietTags,
      sourceUrl: recipe.sourceUrl,
      createdBy: recipe.createdBy,
      createdAt: recipe.createdAt,
    };
  },
});

/**
 * Action: Search recipes by ingredient using vector search on individual ingredient embeddings
 */
export const searchByIngredient = action({
  args: {
    query: v.string(),
    community: v.string(),
    ingredientType: v.optional(v.union(v.literal("main"), v.literal("other"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    console.log(`🔍 [INGREDIENT SEARCH] Searching for ingredient: "${args.query}" in community ${args.community}`);

    // Generate embedding for the ingredient query
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: `Ingredient: ${args.query}`,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const queryEmbedding = data.data[0].embedding;

    // Search ingredient embeddings using vector search
    const ingredientMatches = await ctx.vectorSearch(
      "ingredientEmbeddings",
      "by_embedding",
      {
        vector: queryEmbedding,
        limit: limit * 3, // Get more ingredient matches to ensure enough unique recipes
        filter: args.ingredientType
          ? (q: any) => q.eq("ingredientType", args.ingredientType)
          : undefined,
      }
    );

    console.log(`🔍 [INGREDIENT SEARCH] Found ${ingredientMatches.length} ingredient matches`);

    // Group by recipe and get unique recipes
    const recipeMatches = new Map<string, { recipeId: any; ingredient: string; score: number; type: string }>();

    for (const match of ingredientMatches) {
      const recipeIdStr = match.recipeId.toString();

      // Only keep the best match per recipe
      if (!recipeMatches.has(recipeIdStr) || recipeMatches.get(recipeIdStr)!.score < match._score) {
        recipeMatches.set(recipeIdStr, {
          recipeId: match.recipeId,
          ingredient: match.ingredient,
          score: match._score,
          type: match.ingredientType,
        });
      }
    }

    // Get recipe details and filter by community
    const recipes = [];
    for (const [_, match] of Array.from(recipeMatches.entries()).slice(0, limit)) {
      const recipe = await ctx.runQuery(internal["recipes/recipeQueries"].getRecipeById, {
        recipeId: match.recipeId,
      });

      if (recipe && recipe.community === args.community) {
        recipes.push({
          id: recipe._id,
          name: recipe.name,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          dietTags: recipe.dietTags,
          imageUrl: recipe.imageUrl,
          sourceUrl: recipe.sourceUrl,
          matchedIngredient: match.ingredient,
          ingredientType: match.type,
          similarity: match.score,
        });
      }
    }

    console.log(`✅ [INGREDIENT SEARCH] Returning ${recipes.length} recipes for "${args.query}"`);

    return recipes;
  },
});
