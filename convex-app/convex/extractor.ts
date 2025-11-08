import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internal as recipeEmbeddingsInternal } from "./_generated/api";

// ========== QUERIES ==========

/**
 * Get extraction job by ID
 */
export const getJob = query({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

/**
 * List user's extraction jobs
 */
export const listJobs = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("extractionJobs")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get extracted profiles for a job
 */
export const getJobProfiles = query({
  args: {
    jobId: v.id("extractionJobs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("extractedProfiles")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .take(limit);
  },
});

/**
 * Get stored URLs for a job
 */
export const getJobUrls = query({
  args: {
    jobId: v.id("extractionJobs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const urlBatches = await ctx.db
      .query("extractedUrls")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    // Flatten all URL arrays and limit results
    const allUrls = urlBatches.flatMap((batch) => batch.urls);
    return allUrls.slice(0, limit);
  },
});

/**
 * Get extracted recipes for a job
 */
export const getJobRecipes = query({
  args: {
    jobId: v.id("extractionJobs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("extractedRecipes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .take(limit);
  },
});

// ========== MUTATIONS ==========

/**
 * Create new extraction job
 */
export const createJob = mutation({
  args: {
    userId: v.string(),
    communityId: v.string(),
    sourceUrl: v.string(),
    jobType: v.union(v.literal("profile"), v.literal("recipe")),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("extractionJobs", {
      userId: args.userId,
      communityId: args.communityId,
      sourceUrl: args.sourceUrl,
      jobType: args.jobType,
      status: "extracting_urls",
      totalUrls: 0,
      processedUrls: 0,
      extractedCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return jobId;
  },
});

/**
 * Update job progress (internal)
 */
export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    status: v.optional(v.union(
      v.literal("extracting_urls"),
      v.literal("filtering"),
      v.literal("awaiting_confirmation"),
      v.literal("extracting_data"),
      v.literal("completed"),
      v.literal("failed")
    )),
    totalUrls: v.optional(v.number()),
    processedUrls: v.optional(v.number()),
    filteredUrls: v.optional(v.array(v.string())),
    extractedCount: v.optional(v.number()),
    extractionLimit: v.optional(v.number()),
    error: v.optional(v.string()),
    totalChunks: v.optional(v.number()),
    completedChunks: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Confirm extraction count and trigger extraction
 */
export const confirmExtractionCount = mutation({
  args: {
    jobId: v.id("extractionJobs"),
    extractionLimit: v.number(),
  },
  handler: async (ctx, args) => {
    // Update job with extraction limit
    await ctx.db.patch(args.jobId, {
      extractionLimit: args.extractionLimit,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Extract more recipes from a completed job
 */
export const extractMoreRecipes = mutation({
  args: {
    jobId: v.id("extractionJobs"),
    additionalCount: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== "completed") {
      throw new Error("Can only extract more from completed jobs");
    }

    console.log(`🔄 [EXTRACT MORE] Requesting ${args.additionalCount} more recipes from job ${args.jobId}`);

    // Update extraction limit and status
    await ctx.db.patch(args.jobId, {
      extractionLimit: args.additionalCount,
      status: "extracting_data",
      updatedAt: Date.now(),
    });

    // Schedule the extraction
    await ctx.scheduler.runAfter(0, api.extractor.continueExtraction, {
      jobId: args.jobId,
    });

    console.log(`✅ [EXTRACT MORE] Scheduled extraction of ${args.additionalCount} more recipes`);

    return { success: true };
  },
});

/**
 * Cancel/reset a stuck or running job
 */
export const cancelJob = mutation({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);

    if (!job) {
      throw new Error("Job not found");
    }

    // Mark job as failed with cancellation message
    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: "Cancelled by user",
      updatedAt: Date.now(),
    });

    console.log(`🛑 [CANCEL] Job ${args.jobId} cancelled by user`);

    return { success: true, message: "Job cancelled successfully" };
  },
});

/**
 * Delete all extraction data for a user in a community
 */
export const deleteAllExtractionData = mutation({
  args: {
    userId: v.string(),
    communityId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`🗑️ [DELETE ALL] Starting deletion for userId: ${args.userId}, communityId: ${args.communityId}`);

    let deletedCounts = {
      jobs: 0,
      urls: 0,
      profiles: 0,
      recipes: 0,
    };

    try {
      // 1. Get all jobs for this user
      const jobs = await ctx.db
        .query("extractionJobs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("communityId"), args.communityId))
        .collect();

      console.log(`🗑️ [DELETE ALL] Found ${jobs.length} jobs to delete`);

      // 2. Delete all related data for each job
      for (const job of jobs) {
        // Delete extracted URLs
        const urlBatches = await ctx.db
          .query("extractedUrls")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        for (const batch of urlBatches) {
          await ctx.db.delete(batch._id);
          deletedCounts.urls++;
        }

        // Delete extracted profiles
        const profiles = await ctx.db
          .query("extractedProfiles")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        for (const profile of profiles) {
          await ctx.db.delete(profile._id);
          deletedCounts.profiles++;
        }

        // Delete extracted recipes
        const recipes = await ctx.db
          .query("extractedRecipes")
          .withIndex("by_job", (q) => q.eq("jobId", job._id))
          .collect();

        for (const recipe of recipes) {
          await ctx.db.delete(recipe._id);
          deletedCounts.recipes++;
        }

        // Delete the job itself
        await ctx.db.delete(job._id);
        deletedCounts.jobs++;
      }

      console.log(`✅ [DELETE ALL] Deletion complete:`, deletedCounts);

      return {
        success: true,
        message: "All extraction data deleted successfully",
        deletedCounts,
      };
    } catch (error: any) {
      console.error(`🚨 [DELETE ALL] Error:`, error);
      throw new Error(`Failed to delete extraction data: ${error.message}`);
    }
  },
});

/**
 * Store extracted URL batch (internal)
 */
export const storeUrlBatch = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    urls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Store URLs in batches to avoid hitting size limits
    const batchSize = 100;
    for (let i = 0; i < args.urls.length; i += batchSize) {
      const batch = args.urls.slice(i, i + batchSize);
      await ctx.db.insert("extractedUrls", {
        jobId: args.jobId,
        urls: batch,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Replace all URLs for a job (used after Grok filtering)
 */
export const replaceJobUrls = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    urls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // First, delete all existing URLs for this job
    const existingBatches = await ctx.db
      .query("extractedUrls")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const batch of existingBatches) {
      await ctx.db.delete(batch._id);
    }

    // Now store the new filtered URLs in batches
    const batchSize = 100;
    for (let i = 0; i < args.urls.length; i += batchSize) {
      const batch = args.urls.slice(i, i + batchSize);
      await ctx.db.insert("extractedUrls", {
        jobId: args.jobId,
        urls: batch,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Append filtered URLs (used by parallel chunks)
 */
export const appendFilteredUrls = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    urls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Store URLs in batches
    const batchSize = 100;
    for (let i = 0; i < args.urls.length; i += batchSize) {
      const batch = args.urls.slice(i, i + batchSize);
      await ctx.db.insert("extractedUrls", {
        jobId: args.jobId,
        urls: batch,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Mark chunk as complete and check if all chunks are done
 */
export const markChunkComplete = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    chunkNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const completedChunks = (job.completedChunks || 0) + 1;
    const failedChunksCount = (job.failedChunks || []).length;
    const totalProcessed = completedChunks + failedChunksCount;
    console.log(`✅ [CHUNK TRACKING] Chunk ${args.chunkNumber} complete. Progress: ${completedChunks}/${job.totalChunks} (${failedChunksCount} failed)`);

    // Update completion count
    await ctx.db.patch(args.jobId, {
      completedChunks,
      updatedAt: Date.now(),
    });

    // If all chunks are done (completed OR failed), move to awaiting_confirmation
    if (totalProcessed >= (job.totalChunks || 0)) {
      console.log(`🎉 [CHUNK TRACKING] All chunks processed! ${completedChunks} succeeded, ${failedChunksCount} failed. Moving to awaiting_confirmation`);

      // Count total filtered URLs
      const urlBatches = await ctx.db
        .query("extractedUrls")
        .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
        .collect();

      const totalFilteredUrls = urlBatches.flatMap((batch) => batch.urls).length;

      await ctx.db.patch(args.jobId, {
        status: "awaiting_confirmation",
        totalUrls: totalFilteredUrls,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Record failed chunk for debugging
 */
export const recordFailedChunk = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    chunkNumber: v.number(),
    startIndex: v.number(),
    endIndex: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const failedChunks = job.failedChunks || [];
    failedChunks.push({
      chunkNumber: args.chunkNumber,
      startIndex: args.startIndex,
      endIndex: args.endIndex,
      error: args.error,
      timestamp: Date.now(),
    });

    console.error(`🚨 [CHUNK TRACKING] Chunk ${args.chunkNumber} failed: ${args.error}`);

    await ctx.db.patch(args.jobId, {
      failedChunks,
      updatedAt: Date.now(),
    });

    // Check if too many chunks have failed - mark job as failed
    const completedChunks = job.completedChunks || 0;
    const totalChunks = job.totalChunks || 1;
    const failureRate = failedChunks.length / totalChunks;
    const totalProcessed = completedChunks + failedChunks.length;

    console.log(`⚠️ [COMPLETION CHECK] After chunk ${args.chunkNumber} failure: ${totalProcessed}/${totalChunks} processed (${completedChunks} success, ${failedChunks.length} failed)`);

    // Check if all chunks are done (completed + failed)
    if (totalProcessed >= totalChunks) {
      if (failureRate > 0.5) {
        // Too many failures - mark as failed
        console.error(`🚨 [CHUNK TRACKING] All chunks processed but too many failures (${failedChunks.length}/${totalChunks}), marking job as failed`);
        await ctx.db.patch(args.jobId, {
          status: "failed",
          error: `Too many chunk failures: ${failedChunks.length} out of ${totalChunks} chunks failed`,
          updatedAt: Date.now(),
        });
      } else {
        // Some failures but acceptable - move to awaiting_confirmation
        console.log(`🎉 [CHUNK TRACKING] All chunks processed! ${completedChunks} succeeded, ${failedChunks.length} failed (${Math.round(failureRate * 100)}% failure rate). Moving to awaiting_confirmation`);

        // Count total filtered URLs from database
        const urlBatches = await ctx.db
          .query("extractedUrls")
          .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
          .collect();

        const totalFilteredUrls = urlBatches.flatMap((batch) => batch.urls).length;

        await ctx.db.patch(args.jobId, {
          status: "awaiting_confirmation",
          totalUrls: totalFilteredUrls,
          updatedAt: Date.now(),
        });
      }
    } else if (failureRate > 0.5) {
      // Not all chunks done yet, but already too many failures - mark as failed early
      console.error(`🚨 [CHUNK TRACKING] Too many failures (${failedChunks.length}/${totalChunks}), marking job as failed`);
      await ctx.db.patch(args.jobId, {
        status: "failed",
        error: `Too many chunk failures: ${failedChunks.length} out of ${totalChunks} chunks failed`,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Retry all failed chunks for a job
 */
export const retryFailedChunks = mutation({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const failedChunks = job.failedChunks || [];
    if (failedChunks.length === 0) {
      console.log(`⚠️ [RETRY] No failed chunks to retry for job ${args.jobId}`);
      return { retriedCount: 0 };
    }

    // Check retry limit
    const retryCount = (job.retryCount || 0) + 1;
    if (retryCount > 3) {
      console.error(`🚨 [RETRY] Max retry limit reached (3) for job ${args.jobId}`);
      throw new Error("Maximum retry limit (3) reached for this job");
    }

    console.log(`🔄 [RETRY] Retrying ${failedChunks.length} failed chunks for job ${args.jobId} (retry ${retryCount}/3)`);

    // Get the full URL list from the raw URLs table
    const rawUrlBatches = await ctx.db
      .query("rawExtractedUrls")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const allRawUrls = rawUrlBatches.flatMap((batch) => batch.urls);

    // Clear failed chunks array and increment retry count
    await ctx.db.patch(args.jobId, {
      failedChunks: [],
      retryCount,
      updatedAt: Date.now(),
    });

    // Schedule retry for each failed chunk
    for (const failedChunk of failedChunks) {
      const chunkUrls = allRawUrls.slice(failedChunk.startIndex, failedChunk.endIndex);

      console.log(`🔄 [RETRY] Rescheduling chunk ${failedChunk.chunkNumber}: URLs ${failedChunk.startIndex}-${failedChunk.endIndex}`);

      // Schedule the chunk for reprocessing
      await ctx.scheduler.runAfter(0, internal.extractor.filterUrlsWithGrok, {
        jobId: args.jobId,
        urls: chunkUrls,
        jobType: job.jobType as "profile" | "recipe",
        chunkNumber: failedChunk.chunkNumber,
        totalChunks: job.totalChunks || failedChunks.length,
        startIndex: failedChunk.startIndex,
        endIndex: failedChunk.endIndex,
      });
    }

    console.log(`✅ [RETRY] Scheduled ${failedChunks.length} chunks for retry`);

    return { retriedCount: failedChunks.length };
  },
});

/**
 * Retry a single failed chunk (for more granular control)
 */
export const retrySingleChunk = mutation({
  args: {
    jobId: v.id("extractionJobs"),
    chunkNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const failedChunks = job.failedChunks || [];
    const chunkToRetry = failedChunks.find((c: any) => c.chunkNumber === args.chunkNumber);

    if (!chunkToRetry) {
      throw new Error(`Failed chunk ${args.chunkNumber} not found`);
    }

    console.log(`🔄 [RETRY] Retrying single chunk ${args.chunkNumber}: URLs ${chunkToRetry.startIndex}-${chunkToRetry.endIndex}`);

    // Get the URL slice for this chunk
    const rawUrlBatches = await ctx.db
      .query("rawExtractedUrls")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    const allRawUrls = rawUrlBatches.flatMap((batch) => batch.urls);
    const chunkUrls = allRawUrls.slice(chunkToRetry.startIndex, chunkToRetry.endIndex);

    // Remove this chunk from failed chunks array
    const updatedFailedChunks = failedChunks.filter((c: any) => c.chunkNumber !== args.chunkNumber);
    await ctx.db.patch(args.jobId, {
      failedChunks: updatedFailedChunks,
      updatedAt: Date.now(),
    });

    // Schedule the chunk for reprocessing
    await ctx.scheduler.runAfter(0, internal.extractor.filterUrlsWithGrok, {
      jobId: args.jobId,
      urls: chunkUrls,
      jobType: job.jobType as "profile" | "recipe",
      chunkNumber: chunkToRetry.chunkNumber,
      totalChunks: job.totalChunks || failedChunks.length,
      startIndex: chunkToRetry.startIndex,
      endIndex: chunkToRetry.endIndex,
    });

    console.log(`✅ [RETRY] Scheduled chunk ${args.chunkNumber} for retry`);

    return { success: true };
  },
});

/**
 * Get job completion status for debugging
 */
export const getJobCompletionStatus = query({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    const completedChunks = job.completedChunks || 0;
    const failedChunks = job.failedChunks || [];
    const totalChunks = job.totalChunks || 0;
    const totalProcessed = completedChunks + failedChunks.length;
    const failureRate = totalChunks > 0 ? failedChunks.length / totalChunks : 0;

    return {
      jobId: args.jobId,
      status: job.status,
      completedChunks,
      failedChunksCount: failedChunks.length,
      failedChunks: failedChunks.map((chunk: any) => ({
        chunkNumber: chunk.chunkNumber,
        urlRange: `${chunk.startIndex}-${chunk.endIndex}`,
        error: chunk.error,
        timestamp: chunk.timestamp,
      })),
      totalChunks,
      totalProcessed,
      isComplete: totalProcessed >= totalChunks,
      shouldTransition: totalProcessed >= totalChunks && job.status === "filtering",
      failureRate: Math.round(failureRate * 100),
      progressPercent: totalChunks > 0 ? Math.round((totalProcessed / totalChunks) * 100) : 0,
    };
  },
});

/**
 * Save extracted profile (internal)
 */
export const saveProfile = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    userId: v.string(),
    communityId: v.string(),
    url: v.string(),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    links: v.optional(v.array(v.object({
      url: v.string(),
      text: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const profileId = await ctx.db.insert("extractedProfiles", {
      jobId: args.jobId,
      userId: args.userId,
      communityId: args.communityId,
      url: args.url,
      name: args.name,
      bio: args.bio,
      links: args.links,
      metadata: {
        scrapedAt: Date.now(),
      },
      createdAt: Date.now(),
    });

    return profileId;
  },
});

/**
 * Save extracted recipe (internal)
 */
export const saveRecipe = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    userId: v.string(),
    communityId: v.string(),
    url: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    category: v.optional(v.string()),
    method: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate recipes by title + jobId to avoid saving same recipe multiple times
    const existingRecipe = await ctx.db
      .query("extractedRecipes")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();

    if (existingRecipe) {
      console.log(`⚠️ [DUPLICATE] Recipe "${args.title}" already exists for this job, skipping save`);
      return existingRecipe._id; // Return existing recipe ID
    }

    const recipeId = await ctx.db.insert("extractedRecipes", {
      jobId: args.jobId,
      userId: args.userId,
      communityId: args.communityId,
      url: args.url,
      title: args.title,
      description: args.description,
      imageUrl: args.imageUrl,
      ingredients: args.ingredients,
      instructions: args.instructions,
      servings: args.servings,
      prep_time: args.prep_time,
      cook_time: args.cook_time,
      category: args.category,
      method: args.method,
      createdAt: Date.now(),
    });

    console.log(`✅ [SAVE RECIPE] Saved "${args.title}" to database`);

    // ULTRA PIPELINE: Immediately trigger enrich+embed pipeline for this recipe
    // This creates a streaming pipeline where each recipe flows through the full process
    console.log(`🚀 [SAVE RECIPE] Scheduling ULTRA pipeline (enrich→embed) for "${args.title}"`);
    ctx.scheduler.runAfter(0, internal.recipes.enrichmentWorkflow.pipelineEnrichAndEmbed, {
      extractedRecipeId: recipeId,
    });

    return recipeId;
  },
});

/**
 * Update extracted URLs list (internal)
 */
export const updateExtractedUrlsList = internalMutation({
  args: {
    jobId: v.id("extractionJobs"),
    extractedUrlsList: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      extractedUrlsList: args.extractedUrlsList,
      updatedAt: Date.now(),
    });
  },
});

// ========== HELPER FUNCTIONS ==========

/**
 * Two-tier URL filter:
 * 1. Excludes technical/system pages (fast)
 * 2. Excludes obvious blog posts via regex patterns (cost-saving)
 * 3. Sends remaining URLs to GPT-5 Mini for intelligent classification
 */
function isRecipeUrl(url: string): boolean {
  const lowercaseUrl = url.toLowerCase();

  // TIER 1: Exclude technical/system pages that are definitely not content
  const excludePatterns = [
    '/wp-admin',
    '/wp-content',
    '/wp-login',
    '.pdf',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.webp',
    '/sitemap',
    '/feed',
    '/rss',
    '/admin',
    '/login',
    '/signup',
    '/register',
    '/cart',
    '/checkout'
  ];

  // If URL contains technical exclusion patterns, skip it
  if (excludePatterns.some(pattern => lowercaseUrl.includes(pattern))) {
    return false;
  }

  // TIER 2: Exclude obvious blog posts via regex patterns
  // This saves ~30-50% on GPT-5 filtering API costs
  const blogPostPatterns = [
    // Numbered lists and roundups
    /\d+-favorite/,           // "10-favorite-recipes"
    /\d+-things/,             // "5-things-i-love"
    /\d+-ways-to/,            // "3-ways-to-cook"
    /\d+-best/,               // "7-best-meals"

    // Weekly/monthly content
    /-week-\d+-recap/,        // "week-3-recap"
    /-challenge-/,            // "30-day-challenge"
    /-month-in-/,             // "a-month-in-review"

    // Personal/lifestyle posts
    /thoughts-/,              // "thoughts-on-cooking"
    /announcement/,           // "big-announcement"
    /update-\d+/,             // "update-2024"
    /introducing-/,           // "introducing-my-new-book"
    /meet-/,                  // "meet-our-team"
    /what-is-/,               // "what-is-budget-bytes"
    /about-/,                 // "about-this-blog"

    // Travel/lifestyle
    /-korea/,                 // "south-korea-trip"
    /-japan/,                 // "japan-travel"
    /-vacation/,              // "summer-vacation"
    /-trip/,                  // "italy-trip"
    /-travel/,                // "travel-diary"

    // Blog meta content
    /favorite-things/,        // "nine-favorite-things"
    /life-/,                  // "life-update"
    /blogging-/,              // "on-blogging"
    /behind-the-scenes/,      // "behind-the-scenes"

    // Category/archive pages
    /\/category\//,           // "/category/desserts"
    /\/tag\//,                // "/tag/vegan"
    /\/author\//,             // "/author/lindsay"
    /\/page\/\d+/,            // "/page/2" (pagination)
  ];

  // If URL matches blog post patterns, skip it
  if (blogPostPatterns.some(pattern => lowercaseUrl.match(pattern))) {
    return false;
  }

  // Accept remaining URLs - let GPT-5 Mini do the intelligent filtering
  // This catches edge cases and ambiguous URLs that need AI classification
  return true;
}

// ========== ACTIONS ==========

/**
 * Step 1: Extract URL tree from sitemap
 * Adapted from old /api/extract-all-links endpoint
 */
export const extractUrlTree = action({
  args: {
    jobId: v.id("extractionJobs"),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`🔗 [URL TREE] Extracting URLs from: ${args.sourceUrl}`);

    try {
      // Update job status
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "extracting_urls",
      });

      // Extract domain from URL
      const domain = new URL(args.sourceUrl).origin;

      // List of sitemap URLs to try
      const sitemapUrls = [
        args.sourceUrl,
        `${domain}/sitemap.xml`,
        `${domain}/sitemap_index.xml`,
        `${domain}/sitemap-index.xml`,
        `${domain}/wp-sitemap.xml`,
        `${domain}/sitemap.php`,
      ];

      let allUrls: string[] = [];
      let foundSitemap = false;

      // Try each sitemap location
      for (const sitemapUrl of sitemapUrls) {
        try {
          console.log(`🔍 [URL TREE] Trying: ${sitemapUrl}`);

          const response = await fetch(sitemapUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; HealthyMama/1.0; +https://healthymama.app)",
            },
          });

          if (!response.ok) continue;

          const text = await response.text();

          console.log(`📄 [URL TREE] Fetched sitemap from ${sitemapUrl}, length: ${text.length}`);
          console.log(`📄 [URL TREE] Content preview:`, text.substring(0, 500));

          // Check if this is a sitemap index (contains other sitemaps)
          // NOTE: Only check for <sitemapindex tag, not </sitemap> which appears in ALL sitemaps
          const isSitemapIndex = text.includes('<sitemapindex');

          if (isSitemapIndex && !text.includes('<urlset')) {
            console.log(`📋 [URL TREE] Found sitemap index at: ${sitemapUrl}`);

            // Extract nested sitemap URLs
            const sitemapMatches = text.match(/<loc>(.*?)<\/loc>/g);
            if (sitemapMatches) {
              const nestedSitemaps = sitemapMatches.map((match) =>
                match.replace(/<\/?loc>/g, "").trim()
              );

              console.log(`🔗 [URL TREE] Found ${nestedSitemaps.length} nested sitemaps`);
              console.log(`🔗 [URL TREE] First few sitemaps:`, nestedSitemaps.slice(0, 5));

              // Fetch all nested sitemaps in parallel for maximum speed
              console.log(`⚡ [URL TREE] Fetching ${nestedSitemaps.length} nested sitemaps in parallel...`);
              const nestedResults = await Promise.allSettled(
                nestedSitemaps.map(async (nestedUrl) => {
                  const nestedResponse = await fetch(nestedUrl, {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (compatible; HealthyMama/1.0; +https://healthymama.app)",
                    },
                  });

                  if (!nestedResponse.ok) {
                    throw new Error(`HTTP ${nestedResponse.status}`);
                  }

                  const nestedText = await nestedResponse.text();
                  const nestedUrlMatches = nestedText.match(/<loc>(.*?)<\/loc>/g);

                  if (!nestedUrlMatches) {
                    return { url: nestedUrl, urls: [] };
                  }

                  const allExtracted = nestedUrlMatches.map((match) => match.replace(/<\/?loc>/g, "").trim());
                  const urls = allExtracted.filter((url) => isRecipeUrl(url)); // Filter for recipe URLs

                  console.log(`✅ [URL TREE] Extracted ${urls.length} recipe URLs from ${allExtracted.length} total URLs in: ${nestedUrl}`);
                  if (urls.length > 0) {
                    console.log(`🔍 [URL TREE] Sample recipe URLs:`, urls.slice(0, 3));
                  }

                  return { url: nestedUrl, urls };
                })
              );

              // Collect successful results
              let totalExtracted = 0;
              let totalFailed = 0;
              nestedResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                  allUrls.push(...result.value.urls);
                  totalExtracted += result.value.urls.length;
                } else {
                  totalFailed++;
                  console.log(`⚠️ [URL TREE] Failed to fetch nested sitemap ${index + 1}: ${result.reason?.message || 'Unknown error'}`);
                }
              });

              console.log(`🎉 [URL TREE] Parallel fetch complete: ${totalExtracted} URLs from ${nestedResults.length - totalFailed}/${nestedResults.length} sitemaps`);

              foundSitemap = true;
              break;
            }
          } else {
            // Regular sitemap with URLs
            const urlMatches = text.match(/<loc>(.*?)<\/loc>/g);
            if (urlMatches) {
              const allExtracted = urlMatches.map((match) => match.replace(/<\/?loc>/g, "").trim());
              console.log(`📋 [URL TREE] Extracted ${allExtracted.length} total URLs from regular sitemap`);
              console.log(`📋 [URL TREE] First 5 URLs:`, allExtracted.slice(0, 5));

              const urls = allExtracted.filter((url) => isRecipeUrl(url)); // Filter for recipe URLs

              allUrls = urls;
              console.log(`✅ [URL TREE] Found ${urls.length} recipe URLs from: ${sitemapUrl}`);
              if (urls.length > 0) {
                console.log(`🔍 [URL TREE] Sample recipe URLs:`, urls.slice(0, 3));
              }
              foundSitemap = true;
              break;
            }
          }
        } catch (e) {
          console.log(`⚠️ [URL TREE] Failed to parse ${sitemapUrl}`);
          continue;
        }
      }

      if (!foundSitemap || allUrls.length === 0) {
        throw new Error("No recipe URLs found in sitemaps");
      }

      console.log(`🎯 [URL TREE] Total recipe URLs extracted: ${allUrls.length}`);

      // Process all URLs - let GPT-5 do the filtering
      const urlsToProcess = allUrls;
      console.log(`🚀 [URL TREE] Processing all ${urlsToProcess.length} URLs through GPT-5 parallel filtering`);

      // Store URLs in database in batches (max 5000 per batch to avoid size limits)
      const storeBatchSize = 5000;
      for (let i = 0; i < urlsToProcess.length; i += storeBatchSize) {
        const batch = urlsToProcess.slice(i, i + storeBatchSize);
        await ctx.runMutation(internal.extractor.storeUrlBatch, {
          jobId: args.jobId,
          urls: batch,
        });
        console.log(`💾 [URL TREE] Stored batch ${Math.floor(i / storeBatchSize) + 1}/${Math.ceil(urlsToProcess.length / storeBatchSize)}`);
      }

      // Update job with total URLs
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "filtering",
        totalUrls: urlsToProcess.length,
      });

      return {
        count: urlsToProcess.length,
        sampleUrls: urlsToProcess.slice(0, 10),
        debug: {
          sitemapUrl: sitemapUrls.find(url => foundSitemap) || sitemapUrls[0],
          isSitemapIndex: foundSitemap,
          totalUrlsExtracted: allUrls.length,
        },
      };
    } catch (error: any) {
      console.error("🚨 [URL TREE] Error:", error);
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "failed",
        error: error.message,
      });
      throw error;
    }
  },
});

/**
 * Step 2a: Parallel Chunk Orchestrator
 * Fires all chunks at once for maximum speed
 */
export const filterUrlsParallel = action({
  args: {
    jobId: v.id("extractionJobs"),
    chunkSize: v.optional(v.number()), // URLs per chunk (default: 500)
  },
  handler: async (ctx, args) => {
    const chunkSize = args.chunkSize || 50; // ULTRA mode: Smaller chunks for maximum parallelization
    console.log(`🚀 [PARALLEL FILTER] Starting parallel chunked filtering with chunk size: ${chunkSize}`);

    try {
      // Get the job
      const job = await ctx.runQuery(api.extractor.getJob, {
        jobId: args.jobId,
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Get all URLs from database
      const allUrls = await ctx.runQuery(api.extractor.getJobUrls, {
        jobId: args.jobId,
        limit: 10000, // Get all URLs
      });

      console.log(`📋 [PARALLEL FILTER] Total URLs to filter: ${allUrls.length}`);

      // Calculate chunks
      const totalChunks = Math.ceil(allUrls.length / chunkSize);
      console.log(`📦 [PARALLEL FILTER] Splitting into ${totalChunks} chunks`);

      // Initialize chunk tracking in job
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        totalChunks,
        completedChunks: 0,
        status: "filtering",
      });

      // CRITICAL: Clear raw URLs before filtering starts
      // This ensures extraction only uses GPT-5 verified recipe URLs
      console.log(`🧹 [PARALLEL FILTER] Clearing raw URLs from database before filtering`);
      await ctx.runMutation(internal.extractor.replaceJobUrls, {
        jobId: args.jobId,
        urls: [], // Clear all URLs
      });
      console.log(`✅ [PARALLEL FILTER] Raw URLs cleared. Will store only filtered recipe URLs.`);

      // Fire all chunks in parallel
      for (let i = 0; i < totalChunks; i++) {
        const startIndex = i * chunkSize;
        const endIndex = Math.min(startIndex + chunkSize, allUrls.length);
        const chunk = allUrls.slice(startIndex, endIndex);

        console.log(`🔥 [PARALLEL FILTER] Scheduling chunk ${i + 1}/${totalChunks}: URLs ${startIndex}-${endIndex}`);

        // Schedule this chunk immediately
        await ctx.scheduler.runAfter(0, api.extractor.filterUrlsWithGrok, {
          jobId: args.jobId,
          urls: chunk,
          jobType: job.jobType,
          chunkNumber: i + 1,
          totalChunks,
          startIndex,
          endIndex,
        });
      }

      console.log(`✅ [PARALLEL FILTER] All ${totalChunks} chunks scheduled!`);

      return {
        totalChunks,
        chunkSize,
        totalUrls: allUrls.length,
      };
    } catch (error: any) {
      console.error("🚨 [PARALLEL FILTER] Error:", error);
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "failed",
        error: error.message,
      });
      throw error;
    }
  },
});

/**
 * Step 2b: Filter URLs with GPT-5 Mini (single chunk)
 * Now supports parallel processing with chunk tracking and detailed debugging
 */
export const filterUrlsWithGrok = action({
  args: {
    jobId: v.id("extractionJobs"),
    urls: v.array(v.string()),
    jobType: v.union(v.literal("profile"), v.literal("recipe")),
    chunkNumber: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
    startIndex: v.optional(v.number()),
    endIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const chunkInfo = args.chunkNumber ? `Chunk ${args.chunkNumber}/${args.totalChunks}` : 'Legacy';
    const startTime = Date.now();

    console.log(`🔍 [GPT-5 FILTER ${chunkInfo}] START - Filtering ${args.urls.length} URLs for ${args.jobType}s`);
    console.log(`📍 [GPT-5 FILTER ${chunkInfo}] URL range: ${args.startIndex}-${args.endIndex}`);

    // Retry configuration
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let lastError: any = null;

    // Retry loop with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(2, attempt - 2); // 1s, 2s, 4s
          console.log(`🔄 [GPT-5 FILTER ${chunkInfo}] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Main processing logic wrapped in try block
        const result = await processChunk(ctx, args, chunkInfo);

        // Success! Return the result
        return result;
      } catch (error: any) {
        lastError = error;
        console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] Attempt ${attempt}/${maxRetries} failed:`, error.message);

        // If this was the last attempt, break out to record the failure
        if (attempt === maxRetries) {
          break;
        }

        // Otherwise, continue to next retry attempt
      }
    }

    // All retries exhausted - record the failure
    const chunkDuration = Date.now() - startTime;
    console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] FAILED after ${maxRetries} attempts (${chunkDuration}ms) - Error:`, lastError);

    // Record failed chunk for debugging
    if (args.chunkNumber) {
      await ctx.runMutation(internal.extractor.recordFailedChunk, {
        jobId: args.jobId,
        chunkNumber: args.chunkNumber,
        startIndex: args.startIndex || 0,
        endIndex: args.endIndex || args.urls.length,
        error: lastError.message,
      });
    } else {
      // Legacy mode failure
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "failed",
        error: lastError.message,
      });
    }

    throw lastError;
  },
});

/**
 * Helper function to process a chunk (extracted for retry logic)
 */
async function processChunk(ctx: any, args: any, chunkInfo: string) {
      const startTime = Date.now();
      const apiKey = process.env.OPEN_ROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPEN_ROUTER_API_KEY not set");
      }

      // Process in batches of 100 URLs with high parallelization
      const batchSize = 100;
      const maxParallelBatches = 50; // Process 50 batches simultaneously for maximum speed
      const allFilteredUrls: string[] = [];
      const totalBatches = Math.ceil(args.urls.length / batchSize);

      console.log(`⚡ [gpt-oss-20b FILTER] Processing ${totalBatches} batches with ${maxParallelBatches} parallel requests`);

      // Helper function to process a single batch
      const processSingleBatch = async (batch: string[], batchNumber: number, batchStartIndex: number) => {
        const batchStartTime = Date.now();
        console.log(`📋 [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber}/${totalBatches} START - ${batch.length} URLs (indices ${batchStartIndex}-${batchStartIndex + batch.length})`);

        const filterType = args.jobType === "profile" ? "creator profile" : "recipe";
        const prompt = `Classify each URL as a ${filterType} page. Return TRUE only for standalone ${filterType} pages with actual content.

URLs to classify (${batch.length} total):
${batch.map((url, idx) => `${idx + 1}. ${url}`).join("\n")}

Rules:
- Classify all ${batch.length} URLs
- Return FALSE for: blog posts, numbered lists ("10-ways"), categories, tags, roundups, announcements, lifestyle/personal content
${args.jobType === "recipe" ? `- Recipe URLs must be single food/dish names only (e.g., "lentil-soup", "chocolate-cookies")
- Exclude: abstract concepts, temporal references ("in-october"), personal pronouns, lifestyle keywords` : ""}
- When uncertain, return FALSE

Output valid JSON only (no markdown):
{"results": [{"url": "exact_url_here", "is${args.jobType === "profile" ? "Profile" : "Recipe"}": true}]}

Must have exactly ${batch.length} entries.`;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://healthymama.app",
            "X-Title": "HealthyMama Extractor",
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [
              {
                role: "system",
                content: "You are a precise URL classifier. Carefully analyze each URL and determine if it's a recipe page or blog post. Return only valid JSON with no markdown formatting.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.1, // Low temperature for consistent classification
            max_tokens: 32000,
          }),
        });

        if (!response.ok) {
          const error = `gpt-oss-20b API error for batch ${batchNumber}: ${response.statusText}`;
          console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} FAILED - API returned ${response.status}`);
          throw new Error(error);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || "";

        const batchDuration = Date.now() - batchStartTime;
        console.log(`🔍 [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} - API response received (${content.length} chars, took ${batchDuration}ms)`);

        // Extract JSON from response
        let jsonContent = content.trim();
        if (jsonContent.startsWith("```json")) {
          jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        } else if (jsonContent.startsWith("```")) {
          jsonContent = jsonContent.replace(/```\n?/g, "").trim();
        }

        // Validate JSON before parsing
        if (!jsonContent || jsonContent.length === 0) {
          console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} FAILED - Empty response from gpt-oss-20b`);
          throw new Error(`Empty response from gpt-oss-20b for batch ${batchNumber}`);
        }

        let parsed;
        try {
          parsed = JSON.parse(jsonContent);
        } catch (parseError: any) {
          console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} FAILED - JSON parse error`);
          console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] Raw content preview:`, content.substring(0, 500));
          console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] Parse error:`, parseError.message);

          // Attempt fallback: Extract JSON object from potentially truncated response
          console.log(`🔄 [GPT-5 FILTER ${chunkInfo}] Attempting JSON recovery via regex extraction...`);
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              console.log(`✅ [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} - Successfully recovered partial JSON`);
            } catch (recoveryError: any) {
              console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] JSON recovery also failed:`, recoveryError.message);
              throw new Error(`Failed to parse gpt-oss-20b response for batch ${batchNumber}: ${parseError.message}. Recovery attempt also failed: ${recoveryError.message}`);
            }
          } else {
            console.error(`🚨 [GPT-5 FILTER ${chunkInfo}] No JSON object found in response`);
            throw new Error(`Failed to parse gpt-oss-20b response for batch ${batchNumber}: ${parseError.message}. No JSON object found.`);
          }
        }

        if (parsed.results && Array.isArray(parsed.results)) {
          const key = args.jobType === "profile" ? "isProfile" : "isRecipe";
          const filteredUrls = parsed.results
            .filter((item: any) => item[key] === true)
            .map((item: any) => item.url);

          const totalBatchDuration = Date.now() - batchStartTime;
          console.log(`✅ [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} SUCCESS - Found ${filteredUrls.length}/${batch.length} ${filterType} URLs (took ${totalBatchDuration}ms)`);

          return { filteredUrls, processedUrls: batchStartIndex + batchSize };
        }

        console.warn(`⚠️ [GPT-5 FILTER ${chunkInfo}] Batch ${batchNumber} - No results array in response`);
        return { filteredUrls: [], processedUrls: batchStartIndex + batchSize };
      };

      // Process batches in parallel groups
      for (let i = 0; i < args.urls.length; i += batchSize * maxParallelBatches) {
        const parallelPromises = [];

        // Create promises for parallel batch processing
        for (let j = 0; j < maxParallelBatches; j++) {
          const startIndex = i + (j * batchSize);
          if (startIndex >= args.urls.length) break;

          const batch = args.urls.slice(startIndex, Math.min(startIndex + batchSize, args.urls.length));
          const batchNumber = Math.floor(startIndex / batchSize) + 1;

          parallelPromises.push(processSingleBatch(batch, batchNumber, startIndex));
        }

        // Wait for all parallel batches to complete with error handling
        let results;
        try {
          results = await Promise.all(parallelPromises);
        } catch (batchError: any) {
          console.error(`🚨 [GPT-5 FILTER] Parallel batch processing failed:`, batchError);
          throw new Error(`Batch processing failed at URL ${i}: ${batchError.message}`);
        }

        // Collect filtered URLs from all parallel batches
        for (const result of results) {
          allFilteredUrls.push(...result.filteredUrls);
        }

        // Update progress after each parallel group
        const processedSoFar = Math.min(i + (batchSize * maxParallelBatches), args.urls.length);
        await ctx.runMutation(internal.extractor.updateJobProgress, {
          jobId: args.jobId,
          processedUrls: processedSoFar,
        });

        console.log(`⚡ [GPT-5 FILTER] Completed ${processedSoFar}/${args.urls.length} URLs (${allFilteredUrls.length} recipes found)`);
      }

      const chunkDuration = Date.now() - startTime;

      // For parallel chunks: append filtered URLs instead of replacing
      if (args.chunkNumber) {
        console.log(`💾 [GPT-5 FILTER ${chunkInfo}] Appending ${allFilteredUrls.length} filtered URLs to database`);
        await ctx.runMutation(internal.extractor.appendFilteredUrls, {
          jobId: args.jobId,
          urls: allFilteredUrls,
        });

        // Mark this chunk as complete
        await ctx.runMutation(internal.extractor.markChunkComplete, {
          jobId: args.jobId,
          chunkNumber: args.chunkNumber,
        });

        console.log(`✅ [GPT-5 FILTER ${chunkInfo}] COMPLETE - Processed ${args.urls.length} URLs, found ${allFilteredUrls.length} matches (took ${chunkDuration}ms)`);
      } else {
        // Legacy mode: replace all URLs
        console.log(`💾 [GPT-5 FILTER] Replacing database URLs with ${allFilteredUrls.length} filtered URLs`);
        await ctx.runMutation(internal.extractor.replaceJobUrls, {
          jobId: args.jobId,
          urls: allFilteredUrls,
        });

        await ctx.runMutation(internal.extractor.updateJobProgress, {
          jobId: args.jobId,
          status: "awaiting_confirmation",
          totalUrls: allFilteredUrls.length,
        });

        console.log(`✅ [GPT-5 FILTER] Database updated with filtered URLs`);
      }

      return {
        filteredUrls: allFilteredUrls,
        count: allFilteredUrls.length,
      };
}

/**
 * Step 3: Extract recipe data with 3-pronged approach
 * 1. JSON-LD (fast) -> 2. Gemini AI -> 3. Puppeteer (fallback)
 */
export const extractRecipeFromUrl = action({
  args: {
    jobId: v.id("extractionJobs"),
    userId: v.string(),
    communityId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(`🍳 [EXTRACT] Starting 3-pronged extraction for: ${args.url}`);

    // Import extraction functions
    const {
      extractJsonLdFromHtml,
      validateRecipeCompleteness,
      transformJsonLdRecipe,
      extractImageUrls,
      extractTextFromHtml
    } = await import("./lib/recipeExtractor");

    const {
      extractRecipeWithOpenRouter,
      identifyMainRecipeImageWithOpenRouter
    } = await import("./lib/openRouterExtractor");

    try {
      // METHOD 1: Fast JSON-LD extraction (no browser)
      console.log(`⚡ [METHOD 1] Trying JSON-LD extraction...`);
      const response = await fetch(args.url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const html = await response.text();

      const jsonLdRecipe = extractJsonLdFromHtml(html);

      if (jsonLdRecipe) {
        const validation = validateRecipeCompleteness(jsonLdRecipe);
        if (validation.isComplete) {
          console.log(`✅ [METHOD 1] JSON-LD complete! Recipe: ${jsonLdRecipe.name}`);

          const imageUrls = extractImageUrls(html);
          let mainImageUrl = null;
          if (imageUrls.length > 0) {
            mainImageUrl = await identifyMainRecipeImageWithOpenRouter(imageUrls);
          }

          const recipe = transformJsonLdRecipe(jsonLdRecipe, mainImageUrl);
          await ctx.runMutation(internal.extractor.saveRecipe, {
            ...args,
            ...recipe,
            method: 'json-ld',
          });
          console.log(`💾 [METHOD 1] Saved recipe to database`);
          return recipe;
        }
        console.log(`⚠️ [METHOD 1] JSON-LD incomplete: ${validation.reason}`);
      } else {
        console.log(`⚠️ [METHOD 1] No JSON-LD found`);
      }

      // DETECT WEB STORIES: Skip to Puppeteer (Method 3) if web story detected
      const isWebStory = args.url.includes('/web-stories/') ||
                         args.url.includes('/amp/') ||
                         html.toLowerCase().includes('<amp-story');

      if (isWebStory) {
        console.log(`🎬 [WEB STORY] Detected! Web stories need JavaScript execution.`);
        console.log(`🎬 [WEB STORY] Skipping Gemini (Method 2) → Going directly to Puppeteer (Method 3)...`);
        // Skip to METHOD 3 below
      } else {
        // METHOD 2: OpenRouter (Gemini) AI extraction (no browser) - only for regular pages
        console.log(`🧠 [METHOD 2] Trying OpenRouter (Gemini) AI extraction...`);
        const imageUrls = extractImageUrls(html);
        const mainImageUrl = imageUrls.length > 0 ? await identifyMainRecipeImageWithOpenRouter(imageUrls) : null;

        const geminiRecipe = await extractRecipeWithOpenRouter(html, mainImageUrl);

        if (geminiRecipe.title && geminiRecipe.ingredients?.length > 0) {
          console.log(`✅ [METHOD 2] Gemini success! Recipe: ${geminiRecipe.title}`);
          await ctx.runMutation(internal.extractor.saveRecipe, {
            ...args,
            ...geminiRecipe,
            method: 'gemini',
          });
          console.log(`💾 [METHOD 2] Saved recipe to database`);
          return geminiRecipe;
        }

        console.log(`⚠️ [METHOD 2] Gemini incomplete, trying Method 3...`);
      }

      // METHOD 3: Puppeteer fallback via Vercel endpoint
      console.log(`🌐 [METHOD 3] Calling Vercel Puppeteer endpoint...`);
      const vercelUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const puppeteerUrl = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;

      console.log(`🌐 [METHOD 3] Puppeteer URL: ${puppeteerUrl}/api/scrape-recipe`);

      const scrapeResponse = await fetch(`${puppeteerUrl}/api/scrape-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: args.url }),
      });

      const scrapeData = await scrapeResponse.json();

      if (!scrapeData.success) {
        throw new Error(`All extraction methods failed. Last error: ${scrapeData.error}`);
      }

      console.log(`🌐 [METHOD 3] Puppeteer scraping complete`);
      console.log(`📋 [DEBUG] JSON-LD from Puppeteer: ${scrapeData.jsonLdData ? 'Found' : 'Not found'}`);
      console.log(`📄 [DEBUG] HTML length: ${scrapeData.html.length}`);

      // Try JSON-LD from Puppeteer result
      if (scrapeData.jsonLdData && scrapeData.jsonLdData.name) {
        const mainImg = scrapeData.imageUrls.length > 0
          ? await identifyMainRecipeImageWithOpenRouter(scrapeData.imageUrls)
          : null;
        const recipe = transformJsonLdRecipe(scrapeData.jsonLdData, mainImg);
        await ctx.runMutation(internal.extractor.saveRecipe, {
          ...args,
          ...recipe,
          method: 'puppeteer-jsonld',
        });
        console.log(`💾 [METHOD 3] Saved recipe (Puppeteer JSON-LD) to database`);
        return recipe;
      }

      // Last resort: OpenRouter (Gemini) on Puppeteer HTML
      const geminiRecipe2 = await extractRecipeWithOpenRouter(scrapeData.html, scrapeData.imageUrls[0]);
      console.log(`✅ [METHOD 3] Gemini + Puppeteer success! Recipe: ${geminiRecipe2.title}`);
      await ctx.runMutation(internal.extractor.saveRecipe, {
        ...args,
        ...geminiRecipe2,
        method: 'puppeteer-gemini',
      });
      console.log(`💾 [METHOD 3] Saved recipe (Puppeteer + Gemini) to database`);
      return geminiRecipe2;

    } catch (error: any) {
      console.error(`🚨 [EXTRACT] All methods failed for ${args.url}:`, error);
      throw error;
    }
  },
});

/**
 * Continue extraction after user confirms count
 */
export const continueExtraction = action({
  args: {
    jobId: v.id("extractionJobs"),
  },
  handler: async (ctx, args) => {
    // Get the job
    const job = await ctx.runQuery(api.extractor.getJob, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new Error("Job not found");
    }

    console.log(`🚀 [CONTINUE EXTRACTION] Continuing job ${args.jobId} with limit ${job.extractionLimit || 10}`);

    try {
      // Query ALL stored URLs from database
      const allUrls = await ctx.runQuery(api.extractor.getJobUrls, {
        jobId: args.jobId,
        limit: 10000, // Get all URLs
      });

      // Filter out already-extracted URLs
      const extractedUrlsList = job.extractedUrlsList || [];
      const remainingUrls = allUrls.filter((url: any) => !extractedUrlsList.includes(url));

      console.log(`📋 [CONTINUE EXTRACTION] Total URLs: ${allUrls.length}, Already extracted: ${extractedUrlsList.length}, Remaining: ${remainingUrls.length}`);

      // Take only the requested limit from remaining URLs
      const urlsToExtract = remainingUrls.slice(0, job.extractionLimit || 10);

      console.log(`📋 [CONTINUE EXTRACTION] Extracting ${urlsToExtract.length} URLs from remaining pool`);

      let extractedCount = 0;

      // Update status to extracting_data
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "extracting_data",
      });

      // Track newly extracted URLs
      const newlyExtractedUrls: string[] = [];

      // ULTRA PIPELINE: Process recipes with maximum concurrency
      const concurrency = 50; // Extract 50 recipes simultaneously (ULTRA mode!)
      console.log(`⚡ [ULTRA PIPELINE] Processing ${urlsToExtract.length} recipes with concurrency ${concurrency}...`);

      for (let i = 0; i < urlsToExtract.length; i += concurrency) {
        const batch = urlsToExtract.slice(i, i + concurrency);
        const batchNumber = Math.floor(i / concurrency) + 1;
        const totalBatches = Math.ceil(urlsToExtract.length / concurrency);

        console.log(`📦 [CONTINUE EXTRACTION] Processing batch ${batchNumber}/${totalBatches} (${batch.length} recipes)...`);

        // Process all recipes in this batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (url: any) => {
            try {
              await ctx.runAction(api.extractor.extractRecipeFromUrl, {
                jobId: args.jobId,
                userId: job.userId,
                communityId: job.communityId,
                url,
              });
              return { url, success: true };
            } catch (error: any) {
              console.error(`Failed to extract ${url}:`, error.message);
              return { url, success: false, error: error.message };
            }
          })
        );

        // Count successes and collect extracted URLs
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            extractedCount++;
            newlyExtractedUrls.push(result.value.url);
          }
        }

        // Update progress after each batch
        await ctx.runMutation(internal.extractor.updateJobProgress, {
          jobId: args.jobId,
          extractedCount: (job.extractedCount || 0) + extractedCount,
        });

        const successCount = batchResults.filter((r: any) => r.status === 'fulfilled' && r.value.success).length;
        console.log(`✅ [CONTINUE EXTRACTION] Batch ${batchNumber} complete: ${successCount}/${batch.length} succeeded`);
      }

      // Update the extractedUrlsList with newly extracted URLs
      const updatedExtractedUrlsList = [...extractedUrlsList, ...newlyExtractedUrls];

      // Mark as completed and save extracted URLs list
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "completed",
        extractedCount: (job.extractedCount || 0) + extractedCount,
      });

      // Update extracted URLs list via internal mutation
      await ctx.runMutation(internal.extractor.updateExtractedUrlsList, {
        jobId: args.jobId,
        extractedUrlsList: updatedExtractedUrlsList,
      });

      console.log(`🎉 [CONTINUE EXTRACTION] Job ${args.jobId} completed! Extracted ${extractedCount} recipes. Total extracted: ${updatedExtractedUrlsList.length}`);

      // ULTRA PIPELINE: No batch enrichment needed!
      // Each recipe triggers enrich→embed pipeline immediately after save via ctx.scheduler
      // See saveRecipe mutation (lines 580-585) for the per-recipe pipeline trigger
      console.log(`🔥 [ULTRA PIPELINE] All recipes are processing through individual enrich→embed pipelines`);

      return {
        jobId: args.jobId,
        extractedCount,
      };
    } catch (error: any) {
      console.error("🚨 [CONTINUE EXTRACTION] Job failed:", error);
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId: args.jobId,
        status: "failed",
        error: error.message,
      });
      throw error;
    }
  },
});

/**
 * Master action: Run full extraction workflow
 */
export const runExtraction = action({
  args: {
    userId: v.string(),
    communityId: v.string(),
    sourceUrl: v.string(),
    jobType: v.union(v.literal("profile"), v.literal("recipe")),
  },
  handler: async (ctx, args) => {
    // Step 1: Create job
    const jobId = await ctx.runMutation(api.extractor.createJob, {
      userId: args.userId,
      communityId: args.communityId,
      sourceUrl: args.sourceUrl,
      jobType: args.jobType,
    });

    console.log(`🚀 [EXTRACTION] Started job ${jobId} for ${args.sourceUrl}`);

    try {
      // Step 2: Extract URL tree (now stores URLs in database)
      const { count, sampleUrls, debug } = await ctx.runAction(api.extractor.extractUrlTree, {
        jobId,
        sourceUrl: args.sourceUrl,
      });

      console.log(`📋 [EXTRACTION] Found ${count} URLs`);
      console.log(`🔍 [DEBUG] Sitemap URL: ${debug.sitemapUrl}`);
      console.log(`🔍 [DEBUG] Is Sitemap Index: ${debug.isSitemapIndex}`);
      console.log(`🔍 [DEBUG] Sample URLs:`, sampleUrls);

      // Step 3: Filter URLs with GPT-5 Mini using parallel chunks
      console.log(`🤖 [EXTRACTION] Starting parallel filtering for ${count} URLs...`);

      await ctx.runAction(api.extractor.filterUrlsParallel, {
        jobId,
        chunkSize: 50, // ULTRA mode: Process 50 URLs per chunk for maximum parallelization (2-3x faster)
      });

      console.log(`✅ [EXTRACTION] Parallel filtering initiated. Chunks will process independently.`);
      console.log(`⏸️ [EXTRACTION] Job ${jobId} will move to awaiting_confirmation when all chunks complete`);

      return {
        jobId,
        totalUrls: count, // Initial URL count; will be updated when chunks complete
        status: "filtering",
      };
    } catch (error: any) {
      console.error("🚨 [EXTRACTION] Job failed:", error);
      await ctx.runMutation(internal.extractor.updateJobProgress, {
        jobId,
        status: "failed",
        error: error.message,
      });
      throw error;
    }
  },
});
