/**
 * Mux Video Hosting Utilities
 *
 * Handles uploading Instagram videos to Mux for:
 * - Professional video hosting
 * - Auto-encoding and adaptive streaming
 * - Fast playback worldwide via CDN
 * - Video thumbnails
 */

import Mux from '@mux/mux-node';

// Debug: Log Mux credentials (partial, for security)
console.log('[Mux] Token ID:', process.env.MUX_TOKEN_ID?.substring(0, 12) + '...');
console.log('[Mux] Token Secret length:', process.env.MUX_TOKEN_SECRET?.length || 0, 'chars');

// Initialize Mux client
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export interface MuxUploadResult {
  assetId: string;
  playbackId: string;
  status: string;
}

/**
 * Upload a video to Mux from a URL
 *
 * This is perfect for Instagram videos - Mux will:
 * 1. Download the video from the URL
 * 2. Encode it in multiple qualities
 * 3. Generate a playback ID
 * 4. Make it available via CDN
 *
 * @param videoUrl - Direct URL to video file (from Instagram CDN)
 * @param options - Optional metadata
 * @returns Mux asset and playback IDs
 */
export async function uploadVideoFromUrl(
  videoUrl: string,
  options: {
    title?: string;
    passthrough?: string; // Custom metadata
  } = {}
): Promise<MuxUploadResult> {
  try {
    console.log('[Mux] Creating asset from URL:', videoUrl);

    // Create Mux asset from URL
    const asset = await mux.video.assets.create({
      inputs: [{
        url: videoUrl,
      }],
      playback_policies: ['public'], // Make video publicly accessible
      // mp4_support removed - not supported on basic Mux accounts
      test: false, // Set to true for testing (won't charge)
      ...(options.passthrough && { passthrough: options.passthrough }),
    });

    console.log('[Mux] Asset created:', asset.id);

    // Get playback ID (used to play the video)
    const playbackId = asset.playback_ids?.[0]?.id;

    if (!playbackId) {
      throw new Error('No playback ID returned from Mux');
    }

    return {
      assetId: asset.id,
      playbackId: playbackId,
      status: asset.status || 'preparing',
    };
  } catch (error: any) {
    console.error('[Mux] Upload failed:', error.status, JSON.stringify(error.error || error.message, null, 2));
    throw new Error(`Failed to upload video to Mux: ${error.status} ${JSON.stringify(error.error || error.message)}`);
  }
}

/**
 * Get asset status (for checking if video is ready)
 *
 * @param assetId - Mux asset ID
 * @returns Asset status ('preparing', 'ready', 'errored')
 */
export async function getAssetStatus(assetId: string): Promise<{
  status: string;
  duration?: number;
  aspectRatio?: string;
}> {
  try {
    const asset = await mux.video.assets.retrieve(assetId);

    return {
      status: asset.status || 'unknown',
      duration: asset.duration,
      aspectRatio: asset.aspect_ratio,
    };
  } catch (error: any) {
    console.error('[Mux] Failed to get asset status:', error.message);
    throw new Error(`Failed to get Mux asset status: ${error.message}`);
  }
}

/**
 * Get video thumbnail URL
 *
 * @param playbackId - Mux playback ID
 * @param options - Thumbnail options
 * @returns Thumbnail URL
 */
export function getThumbnailUrl(
  playbackId: string,
  options: {
    time?: number; // Time in seconds (default: 0)
    width?: number; // Width in pixels (default: 640)
  } = {}
): string {
  const time = options.time || 0;
  const width = options.width || 640;

  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}`;
}

/**
 * Delete a video from Mux
 *
 * @param assetId - Mux asset ID
 */
export async function deleteVideo(assetId: string): Promise<void> {
  try {
    await mux.video.assets.delete(assetId);
    console.log('[Mux] Asset deleted:', assetId);
  } catch (error: any) {
    console.error('[Mux] Failed to delete asset:', error.message);
    throw new Error(`Failed to delete Mux asset: ${error.message}`);
  }
}

/**
 * Get video playback URL (for direct downloads)
 *
 * @param playbackId - Mux playback ID
 * @returns MP4 download URL
 */
export function getDownloadUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}
