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
import { api } from '@/convex/_generated/api';

// Reuse extraction functions from main import route
import { uploadVideoFromUrl } from '@/lib/mux';
import { analyzeVideoSegments, extractRecipeFromVideo } from '@/lib/gemini-video-analysis';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://healthymama.app';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
    const { videoUrl, userId, creatorUsername } = body;

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

    // Step 1: Extract recipe from video using Gemini
    console.log('[Internal Import] Extracting recipe from video with Gemini...');
    let recipe;
    try {
      recipe = await extractRecipeFromVideo(videoUrl, creatorUsername ? `Recipe from @${creatorUsername}` : undefined);
      console.log(`[Internal Import] Extracted: "${recipe.title}"`);
      console.log(`[Internal Import] Ingredients: ${recipe.ingredients?.length || 0}`);
      console.log(`[Internal Import] Instructions: ${recipe.instructions?.length || 0}`);
    } catch (error: any) {
      console.error('[Internal Import] Recipe extraction failed:', error.message);
      return NextResponse.json(
        { error: `Recipe extraction failed: ${error.message}` },
        { status: 500 }
      );
    }

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

    // Step 3: Analyze video segments for step-by-step mode
    let videoSegments;
    if (recipe.instructions && recipe.instructions.length > 0) {
      try {
        console.log('[Internal Import] Analyzing video segments...');
        const analysis = await analyzeVideoSegments(videoUrl, recipe.instructions);
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
      title: recipe.title,
      description: recipe.description || `Recipe from @${creatorUsername || 'Instagram'}`,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
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
      recipeTitle: recipe.title,
    });

  } catch (error: any) {
    console.error('[Internal Import] Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
