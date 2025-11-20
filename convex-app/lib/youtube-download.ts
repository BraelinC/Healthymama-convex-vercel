/**
 * YouTube Video Downloader
 *
 * Uses ytdl-core to download YouTube videos for:
 * - Uploading to Mux for CDN hosting
 * - Sending to Gemini for video analysis
 *
 * Note: YouTube videos are downloaded temporarily and then uploaded to Mux,
 * similar to the Instagram import flow. This ensures consistent video hosting
 * and enables instant clipping features.
 */

import ytdl from 'ytdl-core';
import { Readable } from 'stream';

export interface DownloadedVideo {
  videoUrl: string; // Temporary stream URL for Mux upload
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: number; // seconds
}

/**
 * Download YouTube video and get metadata
 *
 * This function:
 * 1. Fetches video metadata (title, description, thumbnail)
 * 2. Gets highest quality MP4 stream URL
 * 3. Returns video data ready for Mux upload
 *
 * Note: We don't actually download the full video to disk - we get a stream URL
 * that Mux can use to pull the video directly from YouTube's CDN.
 *
 * @param videoId - YouTube video ID
 * @returns Video metadata and stream URL
 */
export async function downloadYouTubeVideo(videoId: string): Promise<DownloadedVideo> {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  console.log('[YouTube Download] Fetching video metadata:', videoId);

  try {
    // Get video info
    const info = await ytdl.getInfo(url);

    // Extract metadata
    const title = info.videoDetails.title;
    const description = info.videoDetails.description || '';
    const thumbnailUrl =
      info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || '';
    const duration = parseInt(info.videoDetails.lengthSeconds);

    // Get highest quality video format (MP4)
    const formats = ytdl.filterFormats(info.formats, 'videoandaudio');

    if (formats.length === 0) {
      throw new Error('No suitable video format found');
    }

    // Sort by quality and select highest quality MP4
    const bestFormat = formats.sort((a, b) => {
      const qualityA = parseInt(a.qualityLabel?.replace('p', '') || '0');
      const qualityB = parseInt(b.qualityLabel?.replace('p', '') || '0');
      return qualityB - qualityA;
    })[0];

    console.log(`[YouTube Download] Selected format: ${bestFormat.qualityLabel} (${bestFormat.container})`);
    console.log(`[YouTube Download] Video duration: ${duration}s`);

    // Return stream URL for Mux upload
    // Mux can pull directly from this URL
    const videoUrl = bestFormat.url;

    return {
      videoUrl,
      title,
      description,
      thumbnailUrl,
      duration,
    };
  } catch (error: any) {
    console.error('[YouTube Download] Error:', error.message);

    // Provide more specific error messages
    if (error.message.includes('Video unavailable')) {
      throw new Error('YouTube video is unavailable or private');
    } else if (error.message.includes('copyright')) {
      throw new Error('YouTube video is blocked due to copyright');
    } else if (error.message.includes('age')) {
      throw new Error('YouTube video is age-restricted');
    }

    throw new Error(`Failed to download YouTube video: ${error.message}`);
  }
}

/**
 * Get YouTube video stream for Gemini analysis
 *
 * For video analysis, Gemini can accept YouTube URLs directly,
 * so we don't need to download the full video.
 *
 * @param videoId - YouTube video ID
 * @returns YouTube watch URL (Gemini supports this natively)
 */
export function getYouTubeStreamUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
