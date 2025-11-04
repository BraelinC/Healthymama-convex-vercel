/**
 * One-time script to enrich existing extracted recipes
 * Run this to add AI tags to recipes that were extracted before enrichment system
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Enrich all extracted recipes for a specific community
 */
export const enrichAllExtractedRecipes = action({
  args: {
    communityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    console.log(`🔍 [ENRICH EXISTING] Finding extracted recipes for community: ${args.communityId}`);

    // Get all extraction jobs for this community
    const jobs = await ctx.runQuery(internal.recipeQueries.listExtractedRecipesByJob, {
      jobId: args.communityId as any, // We need a different query
    });

    console.log(`📋 [ENRICH EXISTING] This needs a proper query - let me get recipes directly`);

    return {
      message: "Need to implement proper query for community recipes",
    };
  },
});

/**
 * Enrich extracted recipes by job ID
 */
export const enrichRecipesByJobId = action({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    console.log(`🚀 [ENRICH EXISTING] Starting enrichment for job: ${args.jobId}`);

    try {
      // Step 1: Enrich all recipes
      const enrichResult = await ctx.runAction(internal.tagEnrichment.enrichJobRecipes, {
        jobId: args.jobId,
        concurrency: 10,
      });

      console.log(`✅ [ENRICH EXISTING] Enrichment complete!`);
      console.log(`   Total: ${enrichResult.total}`);
      console.log(`   Success: ${enrichResult.successCount}`);
      console.log(`   Failed: ${enrichResult.failureCount}`);

      // Step 2: Trigger embedding for enriched recipes
      if (enrichResult.successCount > 0) {
        console.log(`🔄 [ENRICH EXISTING] Triggering embedding for ${enrichResult.successCount} enriched recipes`);

        await ctx.runAction(internal.recipeEmbeddings.embedJobRecipes, {
          jobId: args.jobId,
        });

        console.log(`✅ [ENRICH EXISTING] Embedding complete!`);
      }

      return {
        success: true,
        enrichResult,
      };
    } catch (error: any) {
      console.error(`🚨 [ENRICH EXISTING] Failed:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Get user's most recent job ID
 */
export const getRecentJobId = action({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // This would need a proper query implementation
    console.log(`🔍 [GET JOB] Looking for recent jobs for user: ${args.userId}`);

    return {
      message: "Please provide your jobId directly",
      instructions: "Look in your UI for the extraction job ID, or check the database",
    };
  },
});
