// @ts-nocheck
/**
 * Database Migrations
 *
 * This file contains one-time migration scripts for updating the database schema.
 */

import { internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Migration: Rename image_url → imageUrl in extractedRecipes table
 *
 * This migration handles the transition from snake_case to camelCase for image URLs.
 * Since Convex doesn't support field deletion, we need to delete and re-insert documents.
 */
export const migrateExtractedRecipesImageUrl = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    console.log("🔄 [MIGRATION] Starting extractedRecipes image_url → imageUrl migration");

    // Get all extractedRecipes
    const allRecipes = await ctx.db.query("extractedRecipes").collect();

    console.log(`📊 [MIGRATION] Found ${allRecipes.length} extractedRecipes to process`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const recipe of allRecipes) {
      try {
        // Check if this recipe has the old image_url field
        const oldRecipe = recipe as any;

        if (oldRecipe.image_url !== undefined && oldRecipe.imageUrl === undefined) {
          // This recipe needs migration
          console.log(`🔧 [MIGRATION] Migrating recipe: ${recipe.title} (${recipe._id})`);

          // Delete the old document
          await ctx.db.delete(recipe._id);

          // Create new document with corrected field name
          const newRecipe = {
            jobId: recipe.jobId,
            userId: recipe.userId,
            communityId: recipe.communityId,
            url: recipe.url,
            title: recipe.title,
            description: recipe.description,
            imageUrl: oldRecipe.image_url, // Rename here
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            servings: recipe.servings,
            prep_time: recipe.prep_time,
            cook_time: recipe.cook_time,
            category: recipe.category,
            method: recipe.method,
            createdAt: recipe.createdAt,
            enrichmentStatus: recipe.enrichmentStatus,
            enrichedMetadata: recipe.enrichedMetadata,
            enrichmentError: recipe.enrichmentError,
          };

          // Insert new document
          await ctx.db.insert("extractedRecipes", newRecipe);

          migrated++;
          console.log(`✅ [MIGRATION] Migrated recipe: ${recipe.title}`);
        } else if (oldRecipe.imageUrl !== undefined) {
          // Already has imageUrl, skip
          skipped++;
        } else {
          // Has neither field, skip
          skipped++;
        }
      } catch (error: any) {
        console.error(`❌ [MIGRATION] Error migrating recipe ${recipe._id}:`, error.message);
        errors++;
      }
    }

    console.log(`🎉 [MIGRATION] Complete! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);

    return {
      total: allRecipes.length,
      migrated,
      skipped,
      errors,
    };
  },
});

/**
 * Migration: Rename image_url → imageUrl in userRecipes table
 */
export const migrateUserRecipesImageUrl = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 100;

    console.log("🔄 [MIGRATION] Starting userRecipes image_url → imageUrl migration");

    // Get all userRecipes
    const allRecipes = await ctx.db.query("userRecipes").collect();

    console.log(`📊 [MIGRATION] Found ${allRecipes.length} userRecipes to process`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const recipe of allRecipes) {
      try {
        // Check if this recipe has the old image_url field
        const oldRecipe = recipe as any;

        if (oldRecipe.image_url !== undefined && oldRecipe.imageUrl === undefined) {
          // This recipe needs migration
          console.log(`🔧 [MIGRATION] Migrating user recipe: ${recipe.title} (${recipe._id})`);

          // Delete the old document
          await ctx.db.delete(recipe._id);

          // Create new document with corrected field name
          const newRecipe = {
            userId: recipe.userId,
            recipeType: recipe.recipeType,
            cookbookCategory: recipe.cookbookCategory,
            title: recipe.title,
            description: recipe.description,
            imageUrl: oldRecipe.image_url, // Rename here
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            servings: recipe.servings,
            prep_time: recipe.prep_time,
            cook_time: recipe.cook_time,
            time_minutes: recipe.time_minutes,
            cuisine: recipe.cuisine,
            diet: recipe.diet,
            category: recipe.category,
            extractedRecipeId: recipe.extractedRecipeId,
            communityRecipeId: recipe.communityRecipeId,
            isFavorited: recipe.isFavorited,
            createdAt: recipe.createdAt,
            updatedAt: recipe.updatedAt,
          };

          // Insert new document
          await ctx.db.insert("userRecipes", newRecipe);

          migrated++;
          console.log(`✅ [MIGRATION] Migrated user recipe: ${recipe.title}`);
        } else if (oldRecipe.imageUrl !== undefined) {
          // Already has imageUrl, skip
          skipped++;
        } else {
          // Has neither field, skip
          skipped++;
        }
      } catch (error: any) {
        console.error(`❌ [MIGRATION] Error migrating user recipe ${recipe._id}:`, error.message);
        errors++;
      }
    }

    console.log(`🎉 [MIGRATION] Complete! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);

    return {
      total: allRecipes.length,
      migrated,
      skipped,
      errors,
    };
  },
});

/**
 * TEMPORARY: Public action to run extractedRecipes migration
 * This allows running the migration from the CLI without deploying internal mutations
 */
export const runExtractedRecipesMigration = action({
  args: {},
  handler: async (ctx) => {
    console.log("🚀 [MIGRATION RUNNER] Starting extractedRecipes migration...");

    const result = await ctx.runMutation(internal.migrations.migrateExtractedRecipesImageUrl, {
      batchSize: 100,
    });

    console.log("✅ [MIGRATION RUNNER] Migration complete:", result);
    return result;
  },
});

/**
 * TEMPORARY: Public action to run userRecipes migration
 */
export const runUserRecipesMigration = action({
  args: {},
  handler: async (ctx) => {
    console.log("🚀 [MIGRATION RUNNER] Starting userRecipes migration...");

    const result = await ctx.runMutation(internal.migrations.migrateUserRecipesImageUrl, {
      batchSize: 100,
    });

    console.log("✅ [MIGRATION RUNNER] Migration complete:", result);
    return result;
  },
});
