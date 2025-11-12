import Mux from '@mux/mux-node';
import axios from 'axios';

// Initialize Mux client
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export interface MuxUploadResult {
  assetId: string;
  playbackId: string;
  uploadId: string;
  thumbnailUrl: string;
  duration?: number;
}

export interface MuxUploadOptions {
  title: string;
  description?: string;
  passthrough?: string; // Custom metadata JSON string
}

/**
 * Uploads video buffer to Mux using direct upload API
 */
export async function uploadVideoToMux(
  videoBuffer: Buffer,
  options: MuxUploadOptions
): Promise<MuxUploadResult> {
  try {
    console.log(`[Mux] Creating direct upload URL for "${options.title}"...`);

    // Step 1: Create Direct Upload URL
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ['public'], // Public playback for recipe videos
        video_quality: 'basic', // Lower tier = cheaper (adequate for recipes)
        mp4_support: 'standard', // Enable MP4 downloads
        max_resolution_tier: '720p', // Limit resolution to save costs
        passthrough: options.passthrough || JSON.stringify({
          title: options.title,
          description: options.description,
        }),
      },
      cors_origin: '*', // Adjust for your domain in production
      timeout: 3600, // 1 hour timeout for large uploads
    });

    console.log(`[Mux] Upload URL created: ${upload.id}`);

    // Step 2: Upload video buffer to Mux via PUT request
    console.log(`[Mux] Uploading video buffer (${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB)...`);

    await axios.put(upload.url, videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 600000, // 10 minute upload timeout
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`[Mux] Upload progress: ${percentCompleted}%`);
        }
      },
    });

    console.log(`[Mux] Video uploaded successfully, waiting for processing...`);

    // Step 3: Wait for asset to be ready
    let asset = await mux.video.assets.retrieve(upload.asset_id!);
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max wait (5 sec intervals)

    while (asset.status !== 'ready' && asset.status !== 'errored' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      asset = await mux.video.assets.retrieve(upload.asset_id!);
      attempts++;

      if (attempts % 6 === 0) {
        console.log(`[Mux] Still processing... (${attempts * 5}s elapsed, status: ${asset.status})`);
      }
    }

    if (asset.status === 'errored') {
      throw new Error(`Mux asset processing failed: ${JSON.stringify(asset.errors)}`);
    }

    if (asset.status !== 'ready') {
      throw new Error('Mux asset processing timeout (10 minutes exceeded)');
    }

    console.log(`[Mux] Asset ready! Asset ID: ${asset.id}`);

    const playbackId = asset.playback_ids?.[0]?.id;
    if (!playbackId) {
      throw new Error('No playback ID available for asset');
    }

    return {
      assetId: asset.id,
      playbackId,
      uploadId: upload.id,
      thumbnailUrl: getMuxThumbnailUrl(playbackId),
      duration: asset.duration,
    };
  } catch (error: any) {
    console.error(`[Mux] Upload error:`, error);
    throw new Error(`Failed to upload video to Mux: ${error.message}`);
  }
}

/**
 * Gets Mux video playback URL (HLS stream)
 */
export function getMuxVideoUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Gets Mux thumbnail URL at specific timestamp
 */
export function getMuxThumbnailUrl(playbackId: string, timestamp: number = 0): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${timestamp}`;
}

/**
 * Gets Mux animated GIF URL
 */
export function getMuxGifUrl(playbackId: string, startTime: number = 0, endTime?: number): string {
  const params = new URLSearchParams({
    start: startTime.toString(),
    ...(endTime && { end: endTime.toString() }),
    fps: '10',
    width: '640',
  });
  return `https://image.mux.com/${playbackId}/animated.gif?${params.toString()}`;
}

/**
 * Deletes video asset from Mux (for cleanup)
 */
export async function deleteMuxAsset(assetId: string): Promise<void> {
  try {
    console.log(`[Mux] Deleting asset: ${assetId}...`);
    await mux.video.assets.delete(assetId);
    console.log(`[Mux] Asset deleted successfully`);
  } catch (error: any) {
    console.error(`[Mux] Error deleting asset:`, error);
    throw new Error(`Failed to delete Mux asset: ${error.message}`);
  }
}

/**
 * Gets asset details from Mux
 */
export async function getMuxAsset(assetId: string) {
  try {
    return await mux.video.assets.retrieve(assetId);
  } catch (error: any) {
    console.error(`[Mux] Error fetching asset:`, error);
    throw new Error(`Failed to fetch Mux asset: ${error.message}`);
  }
}
