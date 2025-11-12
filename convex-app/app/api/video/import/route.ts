/**
 * Universal Video Recipe Import API Route
 *
 * Supports: YouTube, Instagram, TikTok, and other video platforms
 *
 * Workflow:
 * 1. Download video from source URL
 * 2. Upload to Mux for storage
 * 3. Analyze with Gemini AI to extract recipe
 * 4. Save metadata to Convex
 * 5. Return recipe data with Mux playback URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import {
  downloadVideo,
  cleanupVideo,
  detectPlatform,
  type VideoPlatform,
} from '@/lib/videoDownloader';
import {
  uploadVideoToMux,
  getMuxThumbnailUrl,
  getMuxVideoUrl,
} from '@/lib/muxUploader';
import { analyzeRecipeVideo } from '@/lib/geminiVideoAnalyzer';
import { extractFrameFromMux, timestampToSeconds } from '@/lib/frameExtractor';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface VideoImportRequest {
  url: string;
  userId: string;
}

export interface VideoImportResponse {
  success: boolean;
  jobId?: string;
  recipe?: any;
  muxPlaybackId?: string;
  muxPlaybackUrl?: string;
  muxThumbnailUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<VideoImportResponse>> {
  let tempVideoPath: string | null = null;

  try {
    const { url, userId }: VideoImportRequest = await request.json();

    // Validate inputs
    if (!url || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: url and userId' },
        { status: 400 }
      );
    }

    console.log(`[Video Import] Starting import for URL: ${url}`);

    const platform = detectPlatform(url);
    console.log(`[Video Import] Detected platform: ${platform}`);

    // Step 1: Create job record in Convex
    console.log('[Video Import] Creating job record...');
    const jobId = await convex.mutation(api.videoRecipes.createVideoRecipe, {
      userId,
      sourceUrl: url,
      sourcePlatform: platform,
    });

    console.log(`[Video Import] Job created: ${jobId}`);

    // Step 2: Download video
    console.log('[Video Import] Downloading video...');
    await convex.mutation(api.videoRecipes.updateStatus, {
      id: jobId,
      status: 'downloading',
    });

    const { filePath, buffer, metadata, videoId } = await downloadVideo(url);
    tempVideoPath = filePath;

    console.log(`[Video Import] Video downloaded: ${metadata.title || 'Untitled'}`);
    console.log(`[Video Import] Duration: ${metadata.duration}s`);

    // Step 3: Upload to Mux
    console.log('[Video Import] Uploading to Mux...');
    await convex.mutation(api.videoRecipes.updateStatus, {
      id: jobId,
      status: 'uploading_to_mux',
    });

    const muxData = await uploadVideoToMux(buffer, {
      title: metadata.title || 'Recipe Video',
      description: metadata.description,
      passthrough: JSON.stringify({
        sourceUrl: url,
        platform,
        username: metadata.uploader,
      }),
    });

    console.log(`[Video Import] Uploaded to Mux: ${muxData.assetId}`);

    // Update Convex with Mux data
    await convex.mutation(api.videoRecipes.updateMuxData, {
      id: jobId,
      muxAssetId: muxData.assetId,
      muxPlaybackId: muxData.playbackId,
      muxUploadId: muxData.uploadId,
      muxThumbnailUrl: muxData.thumbnailUrl,
      videoDuration: muxData.duration,
    });

    // Step 4: Analyze with Gemini
    console.log('[Video Import] Analyzing video with Gemini AI...');
    await convex.mutation(api.videoRecipes.updateStatus, {
      id: jobId,
      status: 'analyzing_with_ai',
    });

    const recipe = await analyzeRecipeVideo(filePath, {
      sourceUrl: url,
      videoTitle: metadata.title,
    });

    console.log(`[Video Import] Recipe extracted: "${recipe.title}"`);

    // Generate key frame thumbnails from Mux
    const keyFrames = recipe.keyFrames?.map(kf => ({
      ...kf,
      thumbnailUrl: extractFrameFromMux(
        muxData.playbackId,
        timestampToSeconds(kf.timestamp),
        { width: 640, height: 360 }
      ),
    }));

    // Step 5: Save recipe data to Convex
    await convex.mutation(api.videoRecipes.updateRecipeData, {
      id: jobId,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      servings: recipe.servings,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      keyFrames,
    });

    // Cleanup temp file
    if (tempVideoPath) {
      cleanupVideo(tempVideoPath);
      tempVideoPath = null;
    }

    console.log(`[Video Import] ✅ Import completed successfully!`);

    return NextResponse.json({
      success: true,
      jobId,
      recipe: {
        ...recipe,
        keyFrames,
      },
      muxPlaybackId: muxData.playbackId,
      muxPlaybackUrl: getMuxVideoUrl(muxData.playbackId),
      muxThumbnailUrl: muxData.thumbnailUrl,
    });

  } catch (error: any) {
    console.error('[Video Import] Error:', error);

    // Cleanup temp file on error
    if (tempVideoPath) {
      cleanupVideo(tempVideoPath);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import video',
      },
      { status: 500 }
    );
  }
}

// Enable CORS for development
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}
