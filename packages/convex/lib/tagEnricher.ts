// @ts-nocheck
/**
 * Recipe Tag Enrichment Module
 * Uses OpenRouter (gpt-oss-20b) to generate rich metadata for recipes
 *
 * Features:
 * - AI-powered tag generation (15+ fields)
 * - Structured JSON output
 * - Cost: ~$0.06 per 1,000 recipes
 * - Better accuracy than keyword matching
 */

"use node";

// Enriched tag schema returned by AI
export interface EnrichedTags {
  // Dietary information
  dietTags: string[];           // ["vegan", "gluten-free", "high-protein"]
  allergens: string[];          // ["nuts", "dairy", "eggs", "shellfish"]

  // Cuisine & context
  cuisine?: string;             // "Italian", "Mexican", "Asian Fusion" (optional)
  mealTypes: string[];          // ["dinner", "main course", "comfort food"]

  // Cooking details
  cookingMethods: string[];     // ["baking", "sautéing", "grilling"]
  difficulty?: string;          // "easy", "medium", "hard" (optional)
  timeCommitment?: string;      // "quick" (<30min), "moderate" (30-60min), "lengthy" (>60min) (optional)

  // Flavor & characteristics
  flavorProfile: string[];      // ["savory", "spicy", "umami", "tangy"]

  // Practical details
  mainIngredients: string[];    // ["chicken", "broccoli", "garlic"] (top 5)
  makeAhead: boolean;           // Can be prepared in advance
  mealPrepFriendly: boolean;    // Good for batch cooking

  // Metadata
  model: string;                // "openai/gpt-oss-20b"
  enrichedAt: number;           // timestamp
}

const ENRICHMENT_MODEL = "openai/gpt-oss-20b";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Generate enriched tags for a single recipe using OpenRouter
 */
export async function enrichRecipeTags(recipe: {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  category?: string;
}): Promise<EnrichedTags> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not configured");
  }

  // Build prompt for structured output
  const prompt = buildEnrichmentPrompt(recipe);

  console.log(`🤖 [TAG ENRICHER] Enriching "${recipe.title}" with ${ENRICHMENT_MODEL}`);

  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://healthymama.app",
        "X-Title": "HealthyMama Recipe Enrichment",
      },
      body: JSON.stringify({
        model: ENRICHMENT_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a recipe analysis expert. Return ONLY valid JSON matching the exact schema provided. No markdown, no explanations, just JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent structured output
        max_tokens: 1000,
        response_format: { type: "json_object" }, // Request JSON mode
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    // Parse and validate JSON response
    const enrichedTags = parseEnrichedTags(content);

    console.log(`✅ [TAG ENRICHER] Successfully enriched "${recipe.title}"`);
    console.log(`   Diet: ${enrichedTags.dietTags.join(", ")}`);
    console.log(`   Cuisine: ${enrichedTags.cuisine || "unknown"}`);

    return enrichedTags;
  } catch (error: any) {
    console.error(`🚨 [TAG ENRICHER] Failed to enrich "${recipe.title}":`, error.message);
    throw error;
  }
}

/**
 * Build enrichment prompt with structured output instructions
 */
function buildEnrichmentPrompt(recipe: {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  category?: string;
}): string {
  return `Analyze this recipe and return enriched metadata as JSON.

Recipe Title: ${recipe.title}
${recipe.description ? `Description: ${recipe.description}` : ""}
${recipe.category ? `Category: ${recipe.category}` : ""}

Ingredients:
${recipe.ingredients.map((ing, i) => `${i + 1}. ${ing}`).join("\n")}

Instructions:
${recipe.instructions.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Return JSON matching this EXACT schema:
{
  "dietTags": string[],          // Valid: "vegan", "vegetarian", "pescatarian", "gluten-free", "dairy-free", "omnivore", "keto", "paleo", "low-carb", "high-protein"
  "allergens": string[],         // Valid: "dairy", "eggs", "fish", "shellfish", "tree nuts", "peanuts", "wheat", "soy", "sesame"
  "cuisine": string | null,      // e.g., "Italian", "Mexican", "Chinese", "Indian", "American", "French", "Thai", "Japanese", "Mediterranean"
  "mealTypes": string[],         // Valid: "breakfast", "lunch", "dinner", "snack", "dessert", "appetizer", "main course", "side dish", "beverage"
  "cookingMethods": string[],    // e.g., "baking", "grilling", "frying", "sautéing", "boiling", "roasting", "steaming", "slow cooking"
  "difficulty": string | null,   // Valid: "easy", "medium", "hard"
  "timeCommitment": string | null, // Valid: "quick" (<30min), "moderate" (30-60min), "lengthy" (>60min)
  "flavorProfile": string[],     // e.g., "savory", "sweet", "spicy", "sour", "bitter", "umami", "tangy", "rich", "creamy"
  "mainIngredients": string[],   // Top 5 most important ingredients
  "makeAhead": boolean,          // true if can be prepared in advance
  "mealPrepFriendly": boolean    // true if good for batch cooking
}

Rules:
- If recipe contains meat/poultry/seafood → NOT vegan/vegetarian
- "Oat milk", "almond milk" → dairy-free
- "Vegan butter", "plant-based cheese" → vegan, dairy-free
- "Ghee", "paneer" → contains dairy
- Identify ALL allergens present
- Main ingredients should be the 5 most prominent/important
- Be specific with cuisine (e.g., "Northern Italian" better than "Italian")

Return ONLY the JSON object, no other text.`;
}

/**
 * Parse and validate enriched tags from AI response
 */
function parseEnrichedTags(content: string): EnrichedTags {
  try {
    // Remove markdown code blocks if present
    let jsonText = content.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText);

    // Validate and provide defaults
    // Filter all arrays to only include strings (removes numeric values like 0.0)
    const enrichedTags: EnrichedTags = {
      dietTags: Array.isArray(parsed.dietTags) ? parsed.dietTags.filter((t: any) => typeof t === "string") : [],
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens.filter((t: any) => typeof t === "string") : [],
      mealTypes: Array.isArray(parsed.mealTypes) ? parsed.mealTypes.filter((t: any) => typeof t === "string") : [],
      cookingMethods: Array.isArray(parsed.cookingMethods) ? parsed.cookingMethods.filter((t: any) => typeof t === "string") : [],
      flavorProfile: Array.isArray(parsed.flavorProfile) ? parsed.flavorProfile.filter((t: any) => typeof t === "string") : [],
      mainIngredients: Array.isArray(parsed.mainIngredients) ? parsed.mainIngredients.filter((t: any) => typeof t === "string") : [],
      makeAhead: typeof parsed.makeAhead === "boolean" ? parsed.makeAhead : false,
      mealPrepFriendly: typeof parsed.mealPrepFriendly === "boolean" ? parsed.mealPrepFriendly : false,
      model: ENRICHMENT_MODEL,
      enrichedAt: Date.now(),
    };

    // Only add optional string fields if they're actually strings (not null)
    if (typeof parsed.cuisine === "string") {
      enrichedTags.cuisine = parsed.cuisine;
    }
    if (typeof parsed.difficulty === "string") {
      enrichedTags.difficulty = parsed.difficulty;
    }
    if (typeof parsed.timeCommitment === "string") {
      enrichedTags.timeCommitment = parsed.timeCommitment;
    }

    return enrichedTags;
  } catch (error: any) {
    throw new Error(`Failed to parse enriched tags JSON: ${error.message}`);
  }
}

/**
 * Batch enrich multiple recipes with rate limiting
 */
export async function batchEnrichRecipes(
  recipes: Array<{
    id: string;
    title: string;
    description?: string;
    ingredients: string[];
    instructions: string[];
    category?: string;
  }>,
  concurrency: number = 10
): Promise<Array<{ id: string; success: boolean; tags?: EnrichedTags; error?: string }>> {
  console.log(`🚀 [BATCH ENRICHER] Starting batch enrichment for ${recipes.length} recipes (concurrency: ${concurrency})`);

  const results: Array<{ id: string; success: boolean; tags?: EnrichedTags; error?: string }> = [];

  // Process in batches with concurrency limit
  for (let i = 0; i < recipes.length; i += concurrency) {
    const batch = recipes.slice(i, i + concurrency);
    console.log(`📦 [BATCH ENRICHER] Processing batch ${Math.floor(i / concurrency) + 1} (${batch.length} recipes)`);

    const batchResults = await Promise.allSettled(
      batch.map(async (recipe) => {
        const tags = await enrichRecipeTags(recipe);
        return { id: recipe.id, success: true, tags };
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const recipe = batch[j];

      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          id: recipe.id,
          success: false,
          error: result.reason?.message || "Unknown error",
        });
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + concurrency < recipes.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`✅ [BATCH ENRICHER] Complete: ${successCount} succeeded, ${failureCount} failed`);

  return results;
}
