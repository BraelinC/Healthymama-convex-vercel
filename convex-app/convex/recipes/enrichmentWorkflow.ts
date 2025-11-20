/**
 * Enrichment Workflow Orchestration
 * Handles automatic and manual enrichment workflows
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Action: Automatically enrich recipes after extraction completes
 * This is the main entry point for post-extraction enrichment
 */
export const autoEnrichAfterExtraction = action({
  args: {
    jobId: v.id("extractionJobs"),
    concurrency: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const concurrency = args.concurrency || 10;

    console.log(`🚀 [WORKFLOW] Starting auto-enrichment for job: ${args.jobId}`);

    try {
      // Enrich all recipes from the job
      const result = await ctx.runAction(internal.tagEnrichment.enrichJobRecipes, {
        jobId: args.jobId,
        concurrency,
      });

      console.log(`✅ [WORKFLOW] Auto-enrichment complete for job ${args.jobId}`);
      console.log(`   Total: ${result.total}, Success: ${result.successCount}, Failed: ${result.failureCount}`);

      // After enrichment, trigger re-embedding for enriched recipes
      if (result.successCount > 0) {
        console.log(`🔄 [WORKFLOW] Triggering embedding for ${result.successCount} enriched recipes`);

        await ctx.runAction(internal["recipes/recipeEmbeddings"].embedJobRecipes, {
          jobId: args.jobId,
        });

        console.log(`✅ [WORKFLOW] Embedding complete for job ${args.jobId}`);
      }

      return {
        success: true,
        enrichmentResult: result,
      };
    } catch (error: any) {
      console.error(`🚨 [WORKFLOW] Auto-enrichment failed for job ${args.jobId}:`, error.message);

      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Action: Backfill enrichment for existing recipes without enriched metadata
 * Useful for adding AI tags to recipes that were extracted before the enrichment system existed
 */
export const backfillEnrichment = action({
  args: {
    communityId: v.string(),
    batchSize: v.optional(v.number()),
    concurrency: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;
    const concurrency = args.concurrency || 10;

    console.log(`🔄 [BACKFILL] Starting enrichment backfill for community: ${args.communityId}`);
    console.log(`   Batch size: ${batchSize}, Concurrency: ${concurrency}`);

    // Get all recipes in the community that need enrichment
    const allRecipes = await ctx.runQuery(internal["recipes/recipeQueries"].listExtractedRecipesByJob, {
      jobId: args.communityId as any, // This will need a proper query to get all community recipes
    });

    // Filter for recipes without enrichment or with failed enrichment
    // IMPORTANT: Also check if enrichedMetadata actually exists
    const recipesToEnrich = allRecipes.filter(
      (r) =>
        !r.enrichmentStatus ||
        r.enrichmentStatus === "pending" ||
        r.enrichmentStatus === "failed" ||
        !r.enrichedMetadata  // Re-enrich if metadata is missing
    );

    if (recipesToEnrich.length === 0) {
      console.log(`✅ [BACKFILL] No recipes need enrichment in community ${args.communityId}`);
      return {
        total: 0,
        processed: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    console.log(`📋 [BACKFILL] Found ${recipesToEnrich.length} recipes to enrich`);

    let totalSuccess = 0;
    let totalFailure = 0;

    // Process all batches in parallel (each batch has internal concurrency control)
    const batches = [];
    for (let i = 0; i < recipesToEnrich.length; i += batchSize) {
      const batch = recipesToEnrich.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(recipesToEnrich.length / batchSize);

      console.log(`🔄 [BACKFILL] Scheduling batch ${batchNum}/${totalBatches} (${batch.length} recipes)`);

      batches.push(
        ctx.runAction(internal.tagEnrichment.batchEnrichRecipes, {
          recipeIds: batch.map((r) => r._id),
          concurrency,
        })
      );
    }

    // Wait for all batches to complete in parallel
    console.log(`⚡ [BACKFILL] Processing ${batches.length} batches in parallel...`);
    const results = await Promise.all(batches);

    // Aggregate results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
      console.log(`   Batch ${i + 1} complete: ${result.successCount} succeeded, ${result.failureCount} failed`);
    }

    console.log(`✅ [BACKFILL] Backfill complete for community ${args.communityId}`);
    console.log(`   Total: ${recipesToEnrich.length}, Success: ${totalSuccess}, Failed: ${totalFailure}`);

    // Trigger re-embedding for enriched recipes
    if (totalSuccess > 0) {
      console.log(`🔄 [BACKFILL] Triggering re-embedding for ${totalSuccess} enriched recipes`);
      // Note: This would need to be implemented to re-embed specific recipes
    }

    return {
      total: recipesToEnrich.length,
      processed: recipesToEnrich.length,
      successCount: totalSuccess,
      failureCount: totalFailure,
    };
  },
});

/**
 * Action: Re-enrich recipes with a different model or updated prompt
 * Useful for testing different models or improving enrichment quality
 */
export const reEnrichWithModel = action({
  args: {
    jobId: v.id("extractionJobs"),
    newModel: v.optional(v.string()),
    concurrency: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const concurrency = args.concurrency || 10;

    console.log(`🔄 [RE-ENRICH] Re-enriching recipes from job: ${args.jobId}`);
    if (args.newModel) {
      console.log(`   Using model: ${args.newModel}`);
    }

    // Get all recipes from the job
    const recipes = await ctx.runQuery(internal["recipes/recipeQueries"].listExtractedRecipesByJob, {
      jobId: args.jobId,
    });

    if (recipes.length === 0) {
      console.log(`⚠️ [RE-ENRICH] No recipes found for job ${args.jobId}`);
      return {
        total: 0,
        successCount: 0,
        failureCount: 0,
      };
    }

    console.log(`📋 [RE-ENRICH] Re-enriching ${recipes.length} recipes`);

    // Re-enrich all recipes (regardless of current status)
    const result = await ctx.runAction(internal.tagEnrichment.batchEnrichRecipes, {
      recipeIds: recipes.map((r) => r._id),
      concurrency,
    });

    console.log(`✅ [RE-ENRICH] Re-enrichment complete for job ${args.jobId}`);
    console.log(`   Total: ${result.total}, Success: ${result.successCount}, Failed: ${result.failureCount}`);

    // Trigger re-embedding
    if (result.successCount > 0) {
      console.log(`🔄 [RE-ENRICH] Triggering re-embedding for ${result.successCount} recipes`);

      await ctx.runAction(internal["recipes/recipeEmbeddings"].embedJobRecipes, {
        jobId: args.jobId,
      });

      console.log(`✅ [RE-ENRICH] Re-embedding complete for job ${args.jobId}`);
    }

    return result;
  },
});

/**
 * Action: ULTRA Pipeline - Process single recipe through full pipeline
 * Immediately enriches and embeds a single extracted recipe
 * This is called right after each recipe extraction for maximum speed
 */
export const pipelineEnrichAndEmbed = action({
  args: {
    extractedRecipeId: v.id("extractedRecipes"),
  },
  handler: async (ctx, args) => {
    console.log(`🚀 [PIPELINE] Starting pipeline for recipe: ${args.extractedRecipeId}`);

    try {
      // Step 1: Enrich the recipe
      console.log(`🎨 [PIPELINE] Enriching recipe ${args.extractedRecipeId}...`);
      const enrichResult = await ctx.runAction(internal.tagEnrichment.enrichRecipe, {
        recipeId: args.extractedRecipeId,
      });

      if (!enrichResult.success) {
        console.error(`🚨 [PIPELINE] Enrichment failed for ${args.extractedRecipeId}: ${enrichResult.error}`);
        // Continue to embedding even if enrichment fails (will use basic tags)
      } else {
        console.log(`✅ [PIPELINE] Enrichment complete for recipe ${args.extractedRecipeId}`);
      }

      // Step 2: Immediately embed the recipe
      console.log(`🔢 [PIPELINE] Embedding recipe ${args.extractedRecipeId}...`);
      const embedResult = await ctx.runAction(internal["recipes/recipeEmbeddings"].embedExtractedRecipe, {
        extractedRecipeId: args.extractedRecipeId,
      });

      console.log(`✅ [PIPELINE] Embedding complete for recipe ${args.extractedRecipeId}`);
      console.log(`🎉 [PIPELINE] Full pipeline complete for recipe ${args.extractedRecipeId}`);

      return {
        success: true,
        recipeId: args.extractedRecipeId,
        enriched: enrichResult.success,
        embedded: true,
      };
    } catch (error: any) {
      console.error(`🚨 [PIPELINE] Pipeline failed for ${args.extractedRecipeId}:`, error.message);
      return {
        success: false,
        recipeId: args.extractedRecipeId,
        error: error.message,
      };
    }
  },
});
