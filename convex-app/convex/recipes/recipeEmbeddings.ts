/**
 * Recipe Embeddings Module
 * Generates and manages embeddings for recipes using OpenAI's text-embedding-3-small
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { inferDietTags } from "./recipeMutations";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate embedding for text using OpenAI API
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
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
 * Create embedding text from recipe data
 * Combines title, description, ingredients, and instructions into searchable text
 * Uses rich semantic context to improve embedding quality and search accuracy
 */
function createRecipeEmbeddingText(recipe: {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  category?: string;
}): string {
  const parts: string[] = [];

  // 1. Semantic introduction - helps embedding understand this is a recipe
  parts.push(`This is a recipe for ${recipe.title}.`);

  // 2. Description with context
  if (recipe.description) {
    parts.push(recipe.description);
  }

  // 3. Category/Meal Type
  if (recipe.category) {
    parts.push(`\nMeal Type: ${recipe.category}`);
  }

  // 4. Highlight key ingredients (first 6-8 are usually the main ones)
  const keyIngredients = recipe.ingredients.slice(0, Math.min(8, recipe.ingredients.length));
  if (keyIngredients.length > 0) {
    parts.push(`\nKey Ingredients: ${keyIngredients.join(", ")}`);
  }

  // 5. Extract cooking methods from instructions for better semantic matching
  const cookingMethods = extractCookingMethods(recipe.instructions);
  if (cookingMethods.length > 0) {
    parts.push(`Cooking Methods: ${cookingMethods.join(", ")}`);
  }

  // 6. Full ingredient list with context
  parts.push(`\nFull Ingredient List: ${recipe.ingredients.join(", ")}`);

  // 7. Step-by-step instructions
  parts.push(`\nPreparation Instructions: ${recipe.instructions.join(" ")}`);

  return parts.join("\n");
}

/**
 * Helper: Extract cooking methods from instructions
 * Identifies common cooking techniques mentioned in the recipe
 */
function extractCookingMethods(instructions: string[]): string[] {
  const allText = instructions.join(" ").toLowerCase();

  const methodKeywords = [
    "bake", "baking",
    "grill", "grilling", "grilled",
    "fry", "frying", "fried",
    "sauté", "sautéing", "sauteed",
    "stir-fry", "stir fry",
    "roast", "roasting", "roasted",
    "boil", "boiling", "boiled",
    "steam", "steaming", "steamed",
    "broil", "broiling",
    "simmer", "simmering",
    "marinate", "marinating",
    "slow cook", "slow cooking",
    "pressure cook",
    "air fry", "air frying",
    "pan-fry", "pan fry",
    "deep fry", "deep-fry",
    "poach", "poaching",
    "braise", "braising",
    "blanch", "blanching",
  ];

  const foundMethods = new Set<string>();

  for (const method of methodKeywords) {
    if (allText.includes(method)) {
      // Normalize the method name (remove -ing, -ed endings for consistency)
      const normalizedMethod = method.replace(/ing$|ed$/, "").trim();
      foundMethods.add(normalizedMethod);
    }
  }

  return Array.from(foundMethods);
}

/**
 * Create embedding text with diet tags included
 * Enhanced version that includes dietary information for better semantic matching
 */
function createRecipeEmbeddingTextWithDietTags(recipe: {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  category?: string;
  dietTags: string[];
}): string {
  const parts: string[] = [];

  // 1. Semantic introduction with dietary context
  const dietaryInfo = recipe.dietTags.length > 0
    ? ` This is a ${recipe.dietTags.join(", ")} recipe.`
    : "";
  parts.push(`This is a recipe for ${recipe.title}.${dietaryInfo}`);

  // 2. Description with context
  if (recipe.description) {
    parts.push(recipe.description);
  }

  // 3. Dietary tags for filtering
  if (recipe.dietTags.length > 0) {
    parts.push(`\nDietary: ${recipe.dietTags.join(", ")}`);
  }

  // 4. Category/Meal Type
  if (recipe.category) {
    parts.push(`Meal Type: ${recipe.category}`);
  }

  // 5. Highlight key ingredients (first 6-8 are usually the main ones)
  const keyIngredients = recipe.ingredients.slice(0, Math.min(8, recipe.ingredients.length));
  if (keyIngredients.length > 0) {
    parts.push(`\nKey Ingredients: ${keyIngredients.join(", ")}`);
  }

  // 6. Extract cooking methods from instructions for better semantic matching
  const cookingMethods = extractCookingMethods(recipe.instructions);
  if (cookingMethods.length > 0) {
    parts.push(`Cooking Methods: ${cookingMethods.join(", ")}`);
  }

  // 7. Full ingredient list with context
  parts.push(`\nFull Ingredient List: ${recipe.ingredients.join(", ")}`);

  // 8. Step-by-step instructions
  parts.push(`\nPreparation Instructions: ${recipe.instructions.join(" ")}`);

  return parts.join("\n");
}

/**
 * Create embedding text with AI-enriched tags
 * BEST version - uses full AI-generated metadata for maximum semantic richness
 */
function createRecipeEmbeddingTextWithEnrichedTags(recipe: {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  category?: string;
  enrichedMetadata: {
    dietTags: string[];
    allergens: string[];
    cuisine?: string;
    mealTypes: string[];
    cookingMethods: string[];
    difficulty?: string;
    timeCommitment?: string;
    flavorProfile: string[];
    mainIngredients: string[];
    makeAhead: boolean;
    mealPrepFriendly: boolean;
  };
}): string {
  const parts: string[] = [];
  const meta = recipe.enrichedMetadata;

  // 1. Natural intro (NO labels, NO filler - matches query format)
  if (meta.cuisine) {
    parts.push(`${meta.cuisine} ${recipe.title}`);
  } else {
    parts.push(recipe.title);
  }

  // 2. Description (natural language)
  if (recipe.description) {
    parts.push(recipe.description);
  }

  // 3. Diet tags (direct keywords, NO labels)
  if (meta.dietTags.length > 0) {
    parts.push(meta.dietTags.join(", "));
  }

  // 4. Allergens (direct keywords)
  if (meta.allergens.length > 0) {
    parts.push(`contains ${meta.allergens.join(", ")}`);
  }

  // 5. Meal types (direct keywords, NO labels)
  if (meta.mealTypes.length > 0) {
    parts.push(meta.mealTypes.join(", "));
  }

  // 6. Cooking methods (direct keywords, NO labels)
  if (meta.cookingMethods.length > 0) {
    parts.push(meta.cookingMethods.join(", "));
  }

  // 7. Difficulty (direct keyword)
  if (meta.difficulty) {
    parts.push(meta.difficulty);
  }

  // 8. Time commitment (direct keyword)
  if (meta.timeCommitment) {
    parts.push(meta.timeCommitment);
  }

  // 9. Flavor profile (direct keywords, NO labels)
  if (meta.flavorProfile.length > 0) {
    parts.push(meta.flavorProfile.join(", "));
  }

  // 10. Meal prep flags (direct keywords)
  const prepFlags: string[] = [];
  if (meta.makeAhead) prepFlags.push("make ahead");
  if (meta.mealPrepFriendly) prepFlags.push("meal prep friendly");
  if (prepFlags.length > 0) {
    parts.push(prepFlags.join(", "));
  }

  // 11. Main ingredients (direct keywords, NO labels)
  if (meta.mainIngredients.length > 0) {
    parts.push(meta.mainIngredients.join(", "));
  }

  // 12. Full ingredient list (direct keywords)
  parts.push(recipe.ingredients.join(", "));

  // 13. Instructions (natural language)
  parts.push(recipe.instructions.join(" "));

  // Join with periods for natural flow (matches query style)
  return parts.join(". ");
}

/**
 * Generate individual embeddings for ingredients
 * Creates separate embeddings for main ingredients and combined embedding for others
 */
async function generateIngredientEmbeddings(recipe: {
  ingredients: string[];
  enrichedMetadata: {
    mainIngredients: string[];
  };
}): Promise<Array<{ ingredient: string; type: "main" | "other"; embedding: number[] }>> {
  const embeddings: Array<{ ingredient: string; type: "main" | "other"; embedding: number[] }> = [];

  const mainIngredients = recipe.enrichedMetadata.mainIngredients;
  const allIngredients = recipe.ingredients;

  // Generate individual embeddings for each main ingredient
  for (const mainIngredient of mainIngredients) {
    const embeddingText = `Ingredient: ${mainIngredient}`;
    const embedding = await generateEmbedding(embeddingText);
    embeddings.push({
      ingredient: mainIngredient,
      type: "main",
      embedding,
    });
  }

  // Find remaining ingredients (all ingredients not in main ingredients)
  const mainIngredientSet = new Set(mainIngredients.map(ing => ing.toLowerCase().trim()));
  const otherIngredients = allIngredients.filter(ing => {
    // Check if this ingredient is one of the main ones
    const ingLower = ing.toLowerCase().trim();
    return !mainIngredientSet.has(ingLower);
  });

  // Generate one combined embedding for all other ingredients
  if (otherIngredients.length > 0) {
    const otherIngredientsText = `Other Ingredients: ${otherIngredients.join(", ")}`;
    const embedding = await generateEmbedding(otherIngredientsText);
    embeddings.push({
      ingredient: otherIngredients.join(", "),
      type: "other",
      embedding,
    });
  }

  return embeddings;
}

/**
 * Action: Embed a single extracted recipe
 * Takes recipe data from extractedRecipes and creates embedded version in recipes table
 * Uses AI-enriched metadata if available, otherwise falls back to keyword inference
 */
export const embedExtractedRecipe = action({
  args: {
    extractedRecipeId: v.id("extractedRecipes"),
  },
  handler: async (ctx, args) => {
    // Get the extracted recipe
    const extractedRecipe = await ctx.runQuery(internal.recipeQueries.getExtractedRecipeById, {
      recipeId: args.extractedRecipeId,
    });

    if (!extractedRecipe) {
      throw new Error(`Extracted recipe ${args.extractedRecipeId} not found`);
    }

    console.log(`🔄 [RECIPE EMBEDDING] Embedding recipe: ${extractedRecipe.title}`);

    let embeddingText: string;
    let dietTags: string[];

    // Check if recipe has AI-enriched metadata
    if (extractedRecipe.enrichedMetadata && extractedRecipe.enrichmentStatus === "completed") {
      console.log(`✨ [RECIPE EMBEDDING] Using AI-enriched metadata for "${extractedRecipe.title}"`);

      // Use enriched tags for embedding (BEST quality)
      embeddingText = createRecipeEmbeddingTextWithEnrichedTags({
        title: extractedRecipe.title,
        description: extractedRecipe.description,
        ingredients: extractedRecipe.ingredients,
        instructions: extractedRecipe.instructions,
        category: extractedRecipe.category,
        enrichedMetadata: extractedRecipe.enrichedMetadata,
      });

      dietTags = extractedRecipe.enrichedMetadata.dietTags;
    } else {
      console.log(`⚙️ [RECIPE EMBEDDING] Using keyword inference for "${extractedRecipe.title}"`);

      // Fallback to keyword inference (GOOD quality)
      dietTags = inferDietTags({
        ingredients: extractedRecipe.ingredients,
        description: extractedRecipe.description || "",
        title: extractedRecipe.title,
      });

      embeddingText = createRecipeEmbeddingTextWithDietTags({
        title: extractedRecipe.title,
        description: extractedRecipe.description,
        ingredients: extractedRecipe.ingredients,
        instructions: extractedRecipe.instructions,
        category: extractedRecipe.category,
        dietTags,
      });
    }

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    console.log(`✅ [RECIPE EMBEDDING] Generated embedding for "${extractedRecipe.title}" (${embedding.length} dims)`);

    // Store in recipes table
    const recipeId = await ctx.runMutation(internal.recipeMutations.storeRecipeWithEmbedding, {
      name: extractedRecipe.title,
      description: extractedRecipe.description || "",
      ingredients: extractedRecipe.ingredients,
      steps: extractedRecipe.instructions,
      community: extractedRecipe.communityId,
      dietTags,
      embedding,
      imageUrl: extractedRecipe.imageUrl,
      sourceUrl: extractedRecipe.url,
      createdBy: extractedRecipe.userId,
    });

    console.log(`💾 [RECIPE EMBEDDING] Stored recipe in vector database with ID: ${recipeId}`);

    // Generate and store ingredient embeddings if enriched metadata exists
    if (extractedRecipe.enrichedMetadata && extractedRecipe.enrichedMetadata.mainIngredients.length > 0) {
      console.log(`🔍 [INGREDIENT EMBEDDING] Generating individual ingredient embeddings for "${extractedRecipe.title}"`);

      try {
        const ingredientEmbeddings = await generateIngredientEmbeddings({
          ingredients: extractedRecipe.ingredients,
          enrichedMetadata: extractedRecipe.enrichedMetadata,
        });

        console.log(`✅ [INGREDIENT EMBEDDING] Generated ${ingredientEmbeddings.length} ingredient embeddings (${extractedRecipe.enrichedMetadata.mainIngredients.length} main + others)`);

        // Store ingredient embeddings
        await ctx.runMutation(internal.recipeMutations.storeIngredientEmbeddings, {
          recipeId,
          ingredientEmbeddings,
        });
      } catch (error: any) {
        console.error(`🚨 [INGREDIENT EMBEDDING] Failed to generate ingredient embeddings for "${extractedRecipe.title}":`, error.message);
        // Don't fail the whole operation if ingredient embeddings fail
      }
    }

    return {
      recipeId,
      embeddingLength: embedding.length,
      dietTags,
    };
  },
});

/**
 * Action: Batch embed multiple extracted recipes
 */
export const batchEmbedExtractedRecipes = action({
  args: {
    extractedRecipeIds: v.array(v.id("extractedRecipes")),
  },
  handler: async (ctx, args) => {
    console.log(`🚀 [BATCH EMBEDDING] Starting batch embedding for ${args.extractedRecipeIds.length} recipes`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process embeddings in parallel batches for maximum speed
    const concurrency = 50; // ULTRA mode: Generate 50 embeddings simultaneously
    console.log(`⚡ [BATCH EMBEDDING] Processing ${args.extractedRecipeIds.length} recipes with concurrency ${concurrency}...`);

    for (let i = 0; i < args.extractedRecipeIds.length; i += concurrency) {
      const batch = args.extractedRecipeIds.slice(i, i + concurrency);
      const batchNumber = Math.floor(i / concurrency) + 1;
      const totalBatches = Math.ceil(args.extractedRecipeIds.length / concurrency);

      console.log(`📦 [BATCH EMBEDDING] Processing batch ${batchNumber}/${totalBatches} (${batch.length} recipes)...`);

      // Process all embeddings in this batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (recipeId) => {
          try {
            const result = await ctx.runAction(internal.recipeEmbeddings.embedExtractedRecipe, {
              extractedRecipeId: recipeId,
            });
            return { recipeId, success: true, result };
          } catch (error: any) {
            console.error(`🚨 [BATCH EMBEDDING] Failed to embed recipe ${recipeId}:`, error.message);
            return { recipeId, success: false, error: error.message };
          }
        })
      );

      // Collect results and count successes/failures
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          failureCount++;
          results.push({ recipeId: 'unknown', success: false, error: result.reason?.message || 'Unknown error' });
        }
      }

      const batchSuccessCount = batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      console.log(`✅ [BATCH EMBEDDING] Batch ${batchNumber} complete: ${batchSuccessCount}/${batch.length} succeeded`);
    }

    console.log(`✅ [BATCH EMBEDDING] Complete: ${successCount} succeeded, ${failureCount} failed`);

    return {
      total: args.extractedRecipeIds.length,
      successCount,
      failureCount,
      results,
    };
  },
});

/**
 * Action: Embed recipes from a specific extraction job
 */
export const embedJobRecipes = action({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    console.log(`🔄 [JOB EMBEDDING] Embedding all recipes from job: ${args.jobId}`);

    // Get all extracted recipes for this job
    const extractedRecipes = await ctx.runQuery(internal.recipeQueries.listExtractedRecipesByJob, {
      jobId: args.jobId,
    });

    if (extractedRecipes.length === 0) {
      console.log(`⚠️ [JOB EMBEDDING] No recipes found for job ${args.jobId}`);
      return {
        total: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    console.log(`📋 [JOB EMBEDDING] Found ${extractedRecipes.length} recipes to embed`);

    // Batch embed all recipes
    const recipeIds = extractedRecipes.map((r) => r._id);
    const result = await ctx.runAction(internal.recipeEmbeddings.batchEmbedExtractedRecipes, {
      extractedRecipeIds: recipeIds,
    });

    return result;
  },
});
