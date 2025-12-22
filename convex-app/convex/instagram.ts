/**
 * Instagram Recipe Import - Convex Backend
 *
 * This Convex file provides mutations and queries for managing Instagram-imported recipes.
 * All Instagram imports are automatically saved to a dedicated "instagram" cookbook category.
 *
 * Data Flow:
 * 1. Frontend calls Next.js API route (/api/instagram/import)
 * 2. API route extracts Instagram data + parses with AI
 * 3. Frontend calls `importInstagramRecipe` mutation (this file)
 * 4. Recipe is saved to Convex `userRecipes` table with cookbookCategory="instagram"
 *
 * Database Schema:
 * - Table: userRecipes
 * - Key Fields:
 *   - userId: Clerk user ID
 *   - recipeType: "community" (Instagram imports are external content)
 *   - cookbookCategory: "instagram" (dedicated cookbook for all Instagram imports)
 *   - title, ingredients[], instructions[] (standard recipe fields)
 *   - notes: Contains Instagram source URL for reference
 *
 * Features:
 * - Auto-creates "Instagram" cookbook (no manual setup needed)
 * - Duplicate detection (prevents re-importing same recipe)
 * - Full CRUD operations (import, query, delete)
 * - Cookbook stats for UI display
 */

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Parse Instagram caption to extract ingredients and instructions using Gemini
 *
 * @param caption - Raw Instagram caption text
 * @returns Parsed ingredients and instructions arrays
 */
async function parseRecipeCaption(caption: string): Promise<{
  ingredients: string[];
  instructions: string[];
}> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    console.log("[Caption Parser] OPEN_ROUTER_API_KEY not set, skipping caption parsing");
    return { ingredients: [], instructions: [] };
  }

  const prompt = `Extract ingredients (with amounts) and instructions from this Instagram recipe caption.

Caption:
"""
${caption}
"""

RULES:
1. Extract ALL ingredients with their quantities/amounts (e.g., "2 lbs chicken thighs", "1/4 cup honey")
2. Extract step-by-step instructions in order
3. If no ingredients or instructions are found, return empty arrays
4. Clean up formatting (remove emojis, fix capitalization)
5. Each ingredient should be a single string with amount and item
6. Each instruction should be a single clear step

Return ONLY valid JSON, no markdown code blocks:
{
  "ingredients": ["2 lbs chicken thighs", "4 cloves garlic minced", "1/4 cup honey"],
  "instructions": ["Season chicken with salt and pepper", "Heat oil in pan over medium heat", "Cook chicken 5 minutes per side"]
}`;

  try {
    console.log(`[Caption Parser] Parsing caption (${caption.length} chars)...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Caption Parser',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Caption Parser] API error (${response.status}):`, errorText);
      return { ingredients: [], instructions: [] };
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('[Caption Parser] Invalid response format');
      return { ingredients: [], instructions: [] };
    }

    let text = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/```\n?/g, '').trim();
    }

    const parsed = JSON.parse(text);

    const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const instructions = Array.isArray(parsed.instructions) ? parsed.instructions : [];

    console.log(`[Caption Parser] Extracted ${ingredients.length} ingredients, ${instructions.length} instructions`);

    return { ingredients, instructions };

  } catch (error: any) {
    console.error('[Caption Parser] Error parsing caption:', error.message);
    return { ingredients: [], instructions: [] };
  }
}

/**
 * Import an Instagram Recipe to User's Cookbook
 *
 * Main mutation for saving Instagram-extracted recipes to the database.
 * Automatically organizes all Instagram imports into a dedicated "instagram" cookbook category.
 *
 * Process:
 * 1. Check for duplicate recipes (same title + instagram cookbook)
 * 2. Save recipe to userRecipes table
 * 3. Set cookbookCategory="instagram" (auto-creates cookbook in UI)
 * 4. Store Instagram URL in notes field for attribution
 *
 * Duplicate Detection:
 * - Checks if recipe with same title exists in Instagram cookbook
 * - Returns error if duplicate found (prevents re-importing same recipe)
 * - User can manually save to different cookbook if desired
 *
 * Cookbook Auto-Creation:
 * - No manual cookbook creation needed
 * - UI automatically displays "Instagram" cookbook when first recipe is saved
 * - getCookbookStats query handles cookbook display logic
 *
 * @param userId - Clerk user ID (required for all user-specific data)
 * @param title - Recipe name (e.g., "Chocolate Chip Cookies")
 * @param ingredients - Array of ingredient strings (e.g., ["1 cup flour", "2 eggs"])
 * @param instructions - Array of step strings (e.g., ["Preheat oven", "Mix ingredients"])
 * @param instagramUrl - Original Instagram reel URL (for reference)
 * @param instagramVideoUrl - Direct video URL (optional, for playback)
 * @param instagramThumbnailUrl - Preview image URL (used as recipe image)
 * @param instagramUsername - Post author (optional, for attribution)
 * @param description, servings, prep_time, cook_time, cuisine - Optional metadata
 *
 * @returns {success: boolean, recipeId?: string, error?: string, message?: string}
 *
 * Error Cases:
 * - Duplicate recipe: Returns {success: false, error: "already imported", recipeId}
 * - Database error: Throws exception (handled by Convex)
 */
export const importInstagramRecipe = action({
  args: {
    // Optional userId for internal calls (Mikey bot) - otherwise retrieved from auth context
    userId: v.optional(v.string()),

    // Recipe data (parsed from video or description)
    title: v.string(),
    description: v.optional(v.string()),
    ingredients: v.optional(v.array(v.string())), // Optional - defaults to empty array
    instructions: v.optional(v.array(v.string())), // Optional - defaults to empty array

    // Optional metadata
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    cuisine: v.optional(v.string()),

    // User-selected cookbook category (overrides auto-detection if provided)
    cookbookCategory: v.optional(v.string()),

    // Source platform
    source: v.optional(v.union(
      v.literal("instagram"),
      v.literal("youtube"),
      v.literal("pinterest")
    )),

    // Instagram-specific data
    instagramUrl: v.optional(v.string()),
    instagramVideoUrl: v.optional(v.string()),
    instagramThumbnailUrl: v.optional(v.string()),
    instagramUsername: v.optional(v.string()),

    // YouTube-specific data
    youtubeUrl: v.optional(v.string()),
    youtubeVideoId: v.optional(v.string()),
    youtubeThumbnailUrl: v.optional(v.string()),

    // Pinterest-specific data
    pinterestUrl: v.optional(v.string()),
    pinterestPinId: v.optional(v.string()),
    pinterestUsername: v.optional(v.string()),
    pinterestBoardName: v.optional(v.string()),
    pinterestImageUrls: v.optional(v.array(v.string())),
    pinterestThumbnailUrl: v.optional(v.string()),

    // Mux video hosting (all platforms)
    muxPlaybackId: v.optional(v.string()),
    muxAssetId: v.optional(v.string()),

    // AI-analyzed video segments for step-by-step cooking mode
    videoSegments: v.optional(v.array(v.object({
      stepNumber: v.number(),
      instruction: v.string(),
      startTime: v.number(),
      endTime: v.number(),
    }))),

    // Instagram caption text for parsing ingredients/instructions
    captionText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get userId - either from args (Mikey bot) or auth context (regular users)
    let userId: string;

    if (args.userId) {
      // Internal call from Mikey bot or other system
      console.log("[Instagram Import] Using provided userId:", args.userId);
      userId = args.userId;
    } else {
      // SECURITY: Get authenticated userId from Convex auth context
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Unauthorized - must be logged in to import recipes");
      }
      userId = identity.subject;
    }

    const {
      title,
      description,
      ingredients: videoIngredients,
      instructions: videoInstructions,
      servings,
      prep_time,
      cook_time,
      cuisine,
      source,
      instagramUrl,
      instagramVideoUrl,
      instagramThumbnailUrl,
      instagramUsername,
      youtubeUrl,
      youtubeVideoId,
      youtubeThumbnailUrl,
      pinterestUrl,
      pinterestPinId,
      pinterestUsername,
      pinterestBoardName,
      pinterestImageUrls,
      pinterestThumbnailUrl,
      muxPlaybackId,
      muxAssetId,
      videoSegments,
      captionText,
    } = args;

    // Determine cookbook category - use user selection if provided, otherwise auto-detect from source
    const isYouTube = source === "youtube";
    const isPinterest = source === "pinterest";
    const autoCategory = isPinterest ? "pinterest" : (isYouTube ? "youtube" : "instagram");
    const cookbookCategory = args.cookbookCategory || autoCategory;
    const imageUrl = isPinterest ? pinterestThumbnailUrl :
                     (isYouTube ? youtubeThumbnailUrl : (instagramThumbnailUrl || instagramVideoUrl));

    // Parse caption for ingredients/instructions if provided
    // Caption data is used as fallback if video extraction is missing data
    let ingredients = videoIngredients || [];
    let instructions = videoInstructions || [];

    if (captionText && captionText.trim().length > 0) {
      console.log(`[${source || 'Video Import'}] Caption provided, parsing for ingredients/instructions...`);

      const parsed = await parseRecipeCaption(captionText);

      // Use caption data if video extraction is missing data
      if (parsed.ingredients.length > 0 && ingredients.length === 0) {
        console.log(`[${source || 'Video Import'}] Using ${parsed.ingredients.length} ingredients from caption`);
        ingredients = parsed.ingredients;
      }
      if (parsed.instructions.length > 0 && instructions.length === 0) {
        console.log(`[${source || 'Video Import'}] Using ${parsed.instructions.length} instructions from caption`);
        instructions = parsed.instructions;
      }
    }

    // Save Recipe with PRE-PARSED INGREDIENTS for instant grocery lists
    // This parses ingredients ONCE with AI during import
    console.log(`[${source || 'Video Import'}] Calling saveRecipeWithParsedIngredients for "${title}"`);
    console.log(`[${source || 'Video Import'}] 🎥 MUX Playback ID to save:`, muxPlaybackId);
    console.log(`[${source || 'Video Import'}] 🎥 MUX Asset ID to save:`, muxAssetId);
    const recipeId = await ctx.runAction(api.recipes.userRecipes.saveRecipeWithParsedIngredients, {
      userId,
      recipeType: "community", // Video imports are external recipes
      cookbookCategory,

      // Recipe data
      title,
      description: description || (
        isPinterest ? `Recipe from @${pinterestUsername || 'Pinterest'}` :
        (isYouTube ? `Recipe from YouTube` : `Recipe from @${instagramUsername || 'Instagram'}`)
      ),
      imageUrl,
      ingredients, // From video extraction or caption parsing
      instructions, // From video extraction or caption parsing

      // Optional metadata
      servings,
      prep_time,
      cook_time,
      cuisine,

      // User preferences
      isFavorited: false,

      // Mux video hosting
      muxPlaybackId,
      muxAssetId,

      // Instagram fields
      instagramVideoUrl,
      instagramUsername,

      // AI-analyzed video segments
      videoSegments,
    });

    console.log(`[${source || 'Video Import'}] ✅ Received recipe ID: ${recipeId}`);
    console.log(`[${source || 'Video Import'}] ✅ Imported recipe "${title}" with pre-parsed ingredients for user ${userId}`);

    return {
      success: true,
      recipeId,
      message: `Recipe "${title}" imported successfully!`,
    };
  },
});

/**
 * Get all Instagram-imported recipes for a user
 */
export const getInstagramRecipes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", userId).eq("cookbookCategory", "instagram")
      )
      .order("desc")
      .collect();

    return recipes;
  },
});

/**
 * Get Instagram cookbook stats (count of recipes)
 */
export const getInstagramCookbookStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const recipes = await ctx.db
      .query("userRecipes")
      .withIndex("by_user_cookbook", (q) =>
        q.eq("userId", userId).eq("cookbookCategory", "instagram")
      )
      .collect();

    // Get recipe images for preview
    const recipeImages = recipes
      .slice(0, 4) // First 4 recipes
      .map((recipe) => recipe.imageUrl)
      .filter((url): url is string => url !== undefined);

    return {
      id: "instagram",
      name: "Instagram",
      recipeCount: recipes.length,
      recipeImages,
    };
  },
});

/**
 * Delete an Instagram recipe
 */
export const deleteInstagramRecipe = mutation({
  args: {
    userId: v.string(),
    recipeId: v.id("userRecipes"),
  },
  handler: async (ctx, { userId, recipeId }) => {
    // Verify the recipe belongs to the user and is an Instagram import
    const recipe = await ctx.db.get(recipeId);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    if (recipe.userId !== userId) {
      throw new Error("Unauthorized: This recipe does not belong to you");
    }

    if (recipe.cookbookCategory !== "instagram") {
      throw new Error("This recipe is not an Instagram import");
    }

    // Delete the recipe
    await ctx.db.delete(recipeId);

    console.log(`[Instagram] 🗑️ Deleted recipe ${recipeId} for user ${userId}`);

    return {
      success: true,
      message: "Recipe deleted successfully",
    };
  },
});
