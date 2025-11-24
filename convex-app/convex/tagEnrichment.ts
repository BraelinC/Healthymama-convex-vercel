/**
 * Tag Enrichment Actions
 * Orchestrates AI-powered tag enrichment for recipes
 */

"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { enrichRecipeTags, batchEnrichRecipes as batchEnrichHelper, EnrichedTags } from "./lib/tagEnricher";

/**
 * Action: Enrich a single recipe with AI-generated tags
 */
export const enrichRecipe = action({
  args: {
    recipeId: v.id("extractedRecipes"),
  },
  handler: async (ctx, args) => {
    console.log(`🔄 [ENRICHMENT] Starting enrichment for recipe: ${args.recipeId}`);

    // Get recipe from database
    const recipe = await ctx.runQuery(internal.recipes.recipeQueries.getExtractedRecipeById, {
      recipeId: args.recipeId,
    });

    if (!recipe) {
      throw new Error(`Recipe ${args.recipeId} not found`);
    }

    // Mark as enriching
    await ctx.runMutation(internal.recipes.recipeMutations.updateEnrichmentStatus, {
      recipeId: args.recipeId,
      status: "enriching",
    });

    try {
      // Call AI enrichment
      const enrichedTags = await enrichRecipeTags({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        category: recipe.category,
      });

      // Update recipe with enriched metadata
      await ctx.runMutation(internal.recipes.recipeMutations.updateEnrichmentStatus, {
        recipeId: args.recipeId,
        status: "completed",
        enrichedMetadata: enrichedTags,
      });

      console.log(`✅ [ENRICHMENT] Successfully enriched recipe: ${recipe.title}`);

      return {
        success: true,
        recipeId: args.recipeId,
        enrichedTags,
      };
    } catch (error: any) {
      console.error(`🚨 [ENRICHMENT] Failed to enrich recipe ${recipe.title}:`, error.message);

      // Mark as failed
      await ctx.runMutation(internal.recipes.recipeMutations.updateEnrichmentStatus, {
        recipeId: args.recipeId,
        status: "failed",
        error: error.message,
      });

      return {
        success: false,
        recipeId: args.recipeId,
        error: error.message,
      };
    }
  },
});

/**
 * Action: Batch enrich multiple recipes
 */
export const batchEnrichRecipes = action({
  args: {
    recipeIds: v.array(v.id("extractedRecipes")),
    concurrency: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const concurrency = args.concurrency || 50; // ULTRA mode: 50 concurrent enrichments
    console.log(`🚀 [BATCH ENRICHMENT] Starting batch enrichment for ${args.recipeIds.length} recipes with concurrency ${concurrency}`);

    // Get all recipes from database
    const recipes = await Promise.all(
      args.recipeIds.map(async (recipeId) => {
        const recipe = await ctx.runQuery(internal.recipes.recipeQueries.getExtractedRecipeById, {
          recipeId,
        });
        return recipe ? { ...recipe, id: recipeId } : null;
      })
    );

    const validRecipes = recipes.filter((r) => r !== null) as Array<{
      id: Id<"extractedRecipes">;
      title: string;
      description?: string;
      ingredients: string[];
      instructions: string[];
      category?: string;
    }>;

    if (validRecipes.length === 0) {
      console.log(`⚠️ [BATCH ENRICHMENT] No valid recipes found`);
      return {
        total: args.recipeIds.length,
        successCount: 0,
        failureCount: 0,
        results: [],
      };
    }

    // Mark all as enriching
    await Promise.all(
      validRecipes.map((recipe) =>
        ctx.runMutation(internal.recipes.recipeMutations.updateEnrichmentStatus, {
          recipeId: recipe.id,
          status: "enriching",
        })
      )
    );

    // Batch enrich with AI (using helper function from lib/tagEnricher)
    const enrichmentResults = await batchEnrichHelper(
      validRecipes.map((r) => ({
        id: r.id.toString(),
        title: r.title,
        description: r.description,
        ingredients: r.ingredients,
        instructions: r.instructions,
        category: r.category,
      })),
      concurrency
    );

    // Update database with results
    const results = await Promise.all(
      enrichmentResults.map(async (result) => {
        const recipeId = result.id as Id<"extractedRecipes">;

        if (result.success && result.tags) {
          await ctx.runMutation(internal.recipes.recipeMutations.updateEnrichmentStatus, {
            recipeId,
            status: "completed",
            enrichedMetadata: result.tags,
          });
          return { recipeId, success: true };
        } else {
          await ctx.runMutation(internal.recipes.recipeMutations.updateEnrichmentStatus, {
            recipeId,
            status: "failed",
            error: result.error || "Unknown error",
          });
          return { recipeId, success: false, error: result.error };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`✅ [BATCH ENRICHMENT] Complete: ${successCount} succeeded, ${failureCount} failed`);

    return {
      total: validRecipes.length,
      successCount,
      failureCount,
      results,
    };
  },
});

/**
 * Action: Enrich all recipes from an extraction job
 */
export const enrichJobRecipes = action({
  args: {
    jobId: v.id("extractionJobs"),
    concurrency: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log(`🔄 [JOB ENRICHMENT] Starting enrichment for job: ${args.jobId}`);

    // Get all recipes from the job
    const recipes = await ctx.runQuery(internal.recipes.recipeQueries.listExtractedRecipesByJob, {
      jobId: args.jobId,
    });

    if (recipes.length === 0) {
      console.log(`⚠️ [JOB ENRICHMENT] No recipes found for job ${args.jobId}`);
      return {
        total: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
      };
    }

    console.log(`📋 [JOB ENRICHMENT] Found ${recipes.length} recipes to enrich`);

    // Filter for recipes that haven't been enriched or failed
    // IMPORTANT: Also check if enrichedMetadata actually exists, not just the status
    const recipesToEnrich = recipes.filter(
      (r) => !r.enrichmentStatus ||
             r.enrichmentStatus === "pending" ||
             r.enrichmentStatus === "failed" ||
             !r.enrichedMetadata  // Re-enrich if metadata is missing even if status is "completed"
    );

    if (recipesToEnrich.length === 0) {
      console.log(`✅ [JOB ENRICHMENT] All recipes already enriched with metadata`);
      return {
        total: recipes.length,
        successCount: recipes.length,
        failureCount: 0,
        results: [],
      };
    }

    console.log(`🔄 [JOB ENRICHMENT] Enriching ${recipesToEnrich.length} recipes (including ${
      recipes.filter(r => r.enrichmentStatus === "completed" && !r.enrichedMetadata).length
    } with incomplete enrichment)`);

    // Batch enrich
    const result = await ctx.runAction(internal.tagEnrichment.batchEnrichRecipes, {
      recipeIds: recipesToEnrich.map((r) => r._id),
      concurrency: args.concurrency,
    });

    return result;
  },
});
