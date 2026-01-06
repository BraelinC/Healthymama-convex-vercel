/**
 * Internal Instagram Recipe Import API Route
 *
 * This endpoint is for internal use by the modal-scraper to:
 * 1. Extract recipe from video URL
 * 2. Save to Convex database
 * 3. Return the recipe URL for inclusion in DMs
 *
 * Authentication: API key based (not Clerk)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@healthymama/convex';

// Reuse extraction functions from main import route
import { uploadVideoFromUrl } from '@/lib/mux';
import { analyzeVideoSegments, extractRecipeFromVideo } from '@/lib/gemini-video-analysis';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://healthymama.app';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Parse Instagram caption for title, ingredients, and instructions
 * This is a cheap text-based Gemini call (vs expensive video analysis)
 */
async function parseCaption(caption: string): Promise<{
  title: string | null;
  ingredients: string[];
  instructions: string[];
}> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    console.log('[Caption Parser] OPEN_ROUTER_API_KEY not set, skipping');
    return { title: null, ingredients: [], instructions: [] };
  }

  const prompt = `Extract recipe information from this Instagram caption.

Caption:
"""
${caption}
"""

Extract:
1. TITLE: The recipe name (usually at the start, may have emojis)
2. INGREDIENTS: List with amounts (e.g., "2 lbs chicken thighs", "1/4 cup honey")
3. INSTRUCTIONS: Step-by-step cooking steps (if present)

RULES:
- Clean up formatting (remove excessive emojis, fix capitalization)
- If no title found, return null
- If no ingredients/instructions found, return empty arrays
- Ingredients MUST include amounts when available

Return ONLY valid JSON, no markdown:
{
  "title": "Recipe Name" or null,
  "ingredients": ["2 lbs chicken thighs", "4 cloves garlic minced"],
  "instructions": ["Season chicken with salt", "Heat pan over medium"]
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
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      console.error(`[Caption Parser] API error (${response.status})`);
      return { title: null, ingredients: [], instructions: [] };
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      console.error('[Caption Parser] Invalid response format');
      return { title: null, ingredients: [], instructions: [] };
    }

    let text = data.choices[0].message.content.trim();

    // Remove markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (text.startsWith('```')) {
      text = text.replace(/```\n?/g, '').trim();
    }

    const parsed = JSON.parse(text);

    const result = {
      title: parsed.title || null,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: Array.isArray(parsed.instructions) ? parsed.instructions : [],
    };

    console.log(`[Caption Parser] Extracted: title="${result.title}", ${result.ingredients.length} ingredients, ${result.instructions.length} instructions`);

    return result;

  } catch (error: any) {
    console.error('[Caption Parser] Error:', error.message);
    return { title: null, ingredients: [], instructions: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('X-API-Key');

    if (!INTERNAL_API_KEY || apiKey !== INTERNAL_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid API key' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { videoUrl, userId, creatorUsername, caption } = body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid videoUrl' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid userId' },
        { status: 400 }
      );
    }

    console.log(`[Internal Import] Processing video for creator @${creatorUsername || 'unknown'}`);
    console.log(`[Internal Import] Video URL: ${videoUrl.substring(0, 100)}...`);
    if (caption) {
      console.log(`[Internal Import] Caption provided: ${caption.substring(0, 100)}...`);
    }

    // STEP 1: Parse CAPTION first for title, ingredients, instructions (cheap text call)
    let captionData = { title: null as string | null, ingredients: [] as string[], instructions: [] as string[] };
    if (caption && caption.trim().length > 0) {
      console.log('[Internal Import] Step 1: Parsing caption (cheap)...');
      captionData = await parseCaption(caption);
    } else {
      console.log('[Internal Import] Step 1: No caption provided, skipping caption parse');
    }

    // STEP 2: Parse VIDEO for thumbnail timestamp + fallback data (expensive video call)
    console.log('[Internal Import] Step 2: Extracting from video (for thumbnail timestamp)...');
    let recipe;
    try {
      recipe = await extractRecipeFromVideo(videoUrl, creatorUsername ? `Recipe from @${creatorUsername}` : undefined);
      console.log(`[Internal Import] Video extracted: "${recipe.title}"`);
    } catch (error: any) {
      console.error('[Internal Import] Video extraction failed:', error.message);
      return NextResponse.json(
        { error: `Recipe extraction failed: ${error.message}` },
        { status: 500 }
      );
    }

    // STEP 3: Merge - caption wins, video is fallback
    const finalTitle = captionData.title || recipe.title;
    const finalIngredients = captionData.ingredients.length > 0 ? captionData.ingredients : (recipe.ingredients || []);
    const finalInstructions = captionData.instructions.length > 0 ? captionData.instructions : (recipe.instructions || []);

    console.log(`[Internal Import] Final: "${finalTitle}"`);
    console.log(`[Internal Import] Final ingredients: ${finalIngredients.length} (from ${captionData.ingredients.length > 0 ? 'caption' : 'video'})`);
    console.log(`[Internal Import] Final instructions: ${finalInstructions.length} (from ${captionData.instructions.length > 0 ? 'caption' : 'video'})`)

    // Step 2: Upload video to Mux
    let muxData = null;
    try {
      console.log('[Internal Import] Uploading video to Mux...');
      muxData = await uploadVideoFromUrl(videoUrl, {
        passthrough: `scraper:${creatorUsername || Date.now()}`,
      });
      console.log(`[Internal Import] Mux upload complete: ${muxData.playbackId}`);
    } catch (error: any) {
      console.warn('[Internal Import] Mux upload failed (continuing without video hosting):', error.message);
    }

    // Step 3: Analyze video segments for step-by-step mode (uses final instructions)
    let videoSegments;
    if (finalInstructions.length > 0) {
      try {
        console.log('[Internal Import] Analyzing video segments...');
        const analysis = await analyzeVideoSegments(videoUrl, finalInstructions);
        videoSegments = analysis.segments;
        console.log(`[Internal Import] Found ${videoSegments?.length || 0} video segments`);
      } catch (error: any) {
        console.warn('[Internal Import] Video segmentation failed:', error.message);
      }
    }

    // Generate thumbnail URL
    let thumbnailUrl;
    if (muxData?.playbackId) {
      const thumbnailTime = recipe.thumbnailTime ? Math.round(recipe.thumbnailTime) : 0;
      thumbnailUrl = `https://image.mux.com/${muxData.playbackId}/thumbnail.jpg?time=${thumbnailTime}`;
    }

    // Step 4: Save recipe to Convex using importInstagramRecipe action
    console.log('[Internal Import] Saving recipe to Convex...');

    const importResult = await convex.action(api.instagram.importInstagramRecipe, {
      userId,
      title: finalTitle,
      description: recipe.description || `Recipe from @${creatorUsername || 'Instagram'}`,
      ingredients: finalIngredients,
      instructions: finalInstructions,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      cuisine: recipe.cuisine,
      source: 'instagram',
      instagramVideoUrl: videoUrl,
      instagramThumbnailUrl: thumbnailUrl,
      instagramUsername: creatorUsername,
      muxPlaybackId: muxData?.playbackId,
      muxAssetId: muxData?.assetId,
      videoSegments: videoSegments,
      cookbookCategory: 'instagram', // Auto-organize in Instagram cookbook
    });

    if (!importResult.success || !importResult.recipeId) {
      console.error('[Internal Import] Recipe save failed:', importResult);
      return NextResponse.json(
        { error: importResult.error || 'Failed to save recipe' },
        { status: 500 }
      );
    }

    const recipeId = importResult.recipeId;
    const recipeUrl = `${APP_URL}/recipe/${recipeId}`;

    console.log(`[Internal Import] Recipe saved: ${recipeId}`);
    console.log(`[Internal Import] Recipe URL: ${recipeUrl}`);

    // Return success with recipe URL
    return NextResponse.json({
      success: true,
      recipeId,
      recipeUrl,
      recipeTitle: finalTitle,
    });

  } catch (error: any) {
    console.error('[Internal Import] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
