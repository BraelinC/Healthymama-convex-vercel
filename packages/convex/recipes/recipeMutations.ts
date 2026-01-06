/**
 * Recipe Mutations Module
 * Database mutations for storing recipes (runs in V8 isolate, not Node.js)
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Internal mutation to store recipe with embedding
 */
export const storeRecipeWithEmbedding = internalMutation({
  args: {
    name: v.string(),
    description: v.string(),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    community: v.string(),
    dietTags: v.array(v.string()),
    embedding: v.array(v.float64()),
    imageUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if recipe already exists
    const existing = await ctx.db
      .query("recipes")
      .withIndex("by_community", (q) => q.eq("community", args.community))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      // Update existing recipe with new embedding and data
      await ctx.db.patch(existing._id, {
        description: args.description,
        ingredients: args.ingredients,
        steps: args.steps,
        dietTags: args.dietTags,
        embedding: args.embedding,
        embeddingModel: EMBEDDING_MODEL,
        imageUrl: args.imageUrl,
        sourceUrl: args.sourceUrl,
        createdBy: args.createdBy,
      });

      console.log(`🔄 [RECIPE EMBEDDING] Updated recipe "${args.name}" with new embedding (${args.embedding.length} dims)`);
      return existing._id;
    }

    // Insert new recipe
    const recipeId = await ctx.db.insert("recipes", {
      name: args.name,
      description: args.description,
      ingredients: args.ingredients,
      steps: args.steps,
      community: args.community,
      dietTags: args.dietTags,
      embedding: args.embedding,
      embeddingModel: EMBEDDING_MODEL,
      imageUrl: args.imageUrl,
      sourceUrl: args.sourceUrl,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });

    console.log(`✅ [RECIPE EMBEDDING] Stored recipe "${args.name}" with embedding (${args.embedding.length} dims)`);

    return recipeId;
  },
});

/**
 * Internal mutation to store ingredient embeddings for a recipe
 */
export const storeIngredientEmbeddings = internalMutation({
  args: {
    recipeId: v.id("recipes"),
    ingredientEmbeddings: v.array(v.object({
      ingredient: v.string(),
      type: v.union(v.literal("main"), v.literal("other")),
      embedding: v.array(v.float64()),
    })),
  },
  handler: async (ctx, args) => {
    // First, remove any existing ingredient embeddings for this recipe
    const existingEmbeddings = await ctx.db
      .query("ingredientEmbeddings")
      .withIndex("by_recipe", (q) => q.eq("recipeId", args.recipeId))
      .collect();

    for (const existing of existingEmbeddings) {
      await ctx.db.delete(existing._id);
    }

    // Insert new ingredient embeddings
    const insertedIds = [];
    for (const ingredientData of args.ingredientEmbeddings) {
      const id = await ctx.db.insert("ingredientEmbeddings", {
        recipeId: args.recipeId,
        ingredient: ingredientData.ingredient,
        ingredientType: ingredientData.type,
        embedding: ingredientData.embedding,
        embeddingModel: EMBEDDING_MODEL,
        createdAt: Date.now(),
      });
      insertedIds.push(id);
    }

    console.log(`✅ [INGREDIENT EMBEDDINGS] Stored ${args.ingredientEmbeddings.length} ingredient embeddings for recipe ${args.recipeId}`);

    return insertedIds;
  },
});

/**
 * Internal Mutation: Update enrichment status for extracted recipes
 */
export const updateEnrichmentStatus = internalMutation({
  args: {
    recipeId: v.id("extractedRecipes"),
    status: v.union(
      v.literal("pending"),
      v.literal("enriching"),
      v.literal("completed"),
      v.literal("failed")
    ),
    enrichedMetadata: v.optional(v.object({
      dietTags: v.array(v.string()),
      allergens: v.array(v.string()),
      cuisine: v.optional(v.string()),
      mealTypes: v.array(v.string()),
      cookingMethods: v.array(v.string()),
      difficulty: v.optional(v.string()),
      timeCommitment: v.optional(v.string()),
      flavorProfile: v.array(v.string()),
      mainIngredients: v.array(v.string()),
      makeAhead: v.boolean(),
      mealPrepFriendly: v.boolean(),
      model: v.string(),
      enrichedAt: v.number(),
    })),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recipeId, {
      enrichmentStatus: args.status,
      enrichedMetadata: args.enrichedMetadata,
      enrichmentError: args.error,
    });
  },
});

/**
 * Helper: Infer diet tags from recipe content
 * Detects: vegan, vegetarian, gluten-free, dairy-free, etc.
 */
export function inferDietTags(recipe: {
  ingredients: string[];
  description: string;
  title: string;
}): string[] {
  const allText = [
    recipe.title.toLowerCase(),
    recipe.description.toLowerCase(),
    ...recipe.ingredients.map((i) => i.toLowerCase()),
  ].join(" ");

  const tags: string[] = [];

  // Meat indicators
  const meatKeywords = [
    "chicken",
    "beef",
    "pork",
    "lamb",
    "turkey",
    "bacon",
    "sausage",
    "ham",
    "steak",
    "meat",
  ];
  const hasMeat = meatKeywords.some((keyword) => allText.includes(keyword));

  // Seafood indicators
  const seafoodKeywords = ["fish", "salmon", "tuna", "shrimp", "crab", "lobster", "seafood"];
  const hasSeafood = seafoodKeywords.some((keyword) => allText.includes(keyword));

  // Dairy indicators
  const dairyKeywords = [
    "milk",
    "cheese",
    "butter",
    "cream",
    "yogurt",
    "dairy",
    "parmesan",
    "mozzarella",
  ];
  const hasDairy = dairyKeywords.some((keyword) => allText.includes(keyword));

  // Egg indicators
  const eggKeywords = ["egg", "eggs"];
  const hasEggs = eggKeywords.some((keyword) => allText.includes(keyword));

  // Gluten indicators
  const glutenKeywords = [
    "flour",
    "wheat",
    "bread",
    "pasta",
    "noodle",
    "gluten",
    "barley",
    "rye",
  ];
  const hasGluten = glutenKeywords.some((keyword) => allText.includes(keyword));

  // Determine diet tags
  if (!hasMeat && !hasSeafood && !hasDairy && !hasEggs) {
    tags.push("vegan");
  } else if (!hasMeat && !hasSeafood) {
    tags.push("vegetarian");
  } else if (hasSeafood && !hasMeat) {
    tags.push("pescatarian");
  }

  if (!hasGluten) {
    tags.push("gluten-free");
  }

  if (!hasDairy) {
    tags.push("dairy-free");
  }

  // If no specific tags, add general omnivore tag
  if (tags.length === 0) {
    tags.push("omnivore");
  }

  return tags;
}
