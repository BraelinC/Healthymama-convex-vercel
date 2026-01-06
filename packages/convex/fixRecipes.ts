/**
 * Temporary fix: Delete all extracted recipes with image_url field
 */

import { mutation } from "./_generated/server";

/**
 * Delete all extractedRecipes (temporary fix for schema migration)
 */
export const deleteAllExtractedRecipes = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🗑️ [FIX] Deleting all extractedRecipes...");

    const recipes = await ctx.db.query("extractedRecipes").collect();

    console.log(`📋 [FIX] Found ${recipes.length} extractedRecipes to delete`);

    let deleted = 0;
    for (const recipe of recipes) {
      await ctx.db.delete(recipe._id);
      deleted++;
    }

    console.log(`✅ [FIX] Deleted ${deleted} extractedRecipes`);

    return {
      success: true,
      deletedCount: deleted,
    };
  },
});
