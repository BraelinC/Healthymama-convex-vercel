import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

export type VideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'other';

export interface VideoMetadata {
  title?: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  uploader?: string;
  uploadDate?: string;
}

export interface DownloadedVideo {
  filePath: string;
  buffer: Buffer;
  metadata: VideoMetadata;
  platform: VideoPlatform;
  videoId?: string;
}

/**
 * Detects the video platform from URL
 */
export function detectPlatform(url: string): VideoPlatform {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  } else if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  } else if (lowerUrl.includes('tiktok.com')) {
    return 'tiktok';
  }

  return 'other';
}

/**
 * Extracts video ID from URL (YouTube-specific)
 */
export function extractVideoId(url: string, platform: VideoPlatform): string | undefined {
  if (platform === 'youtube') {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
  } else if (platform === 'instagram') {
    const match = url.match(/\/reel\/([A-Za-z0-9_-]+)/);
    return match?.[1];
  } else if (platform === 'tiktok') {
    const match = url.match(/\/video\/(\d+)/);
    return match?.[1];
  }

  return undefined;
}

/**
 * Downloads video from any supported platform using yt-dlp
 */
export async function downloadVideo(url: string): Promise<DownloadedVideo> {
  const platform = detectPlatform(url);
  const videoId = extractVideoId(url, platform);

  console.log(`[VideoDownloader] Detected platform: ${platform}, Video ID: ${videoId}`);

  const ytDlp = new YTDlpWrap();

  // Create temp directory
  const tempDir = path.join(tmpdir(), 'healthymama-videos');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const outputPath = path.join(tempDir, `${Date.now()}.mp4`);

  try {
    console.log(`[VideoDownloader] Downloading video from ${url}...`);

    // Download with optimized settings for recipe videos
    await ytDlp.execPromise([
      url,
      // Format selection: prefer MP4, max 720p for cost savings
      '-f', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best',
      '--merge-output-format', 'mp4',
      '-o', outputPath,
      '--no-playlist', // Single video only
      '--max-filesize', '500M', // Limit to 500MB
      '--socket-timeout', '30', // 30 second timeout
      '--retries', '3', // Retry 3 times on failure
    ]);

    console.log(`[VideoDownloader] Download completed: ${outputPath}`);

    // Get metadata
    console.log(`[VideoDownloader] Fetching metadata...`);
    const metadataJson = await ytDlp.execPromise([
      url,
      '--dump-json',
      '--no-playlist',
    ]);

    const metadata = JSON.parse(metadataJson.toString());

    // Read file into buffer for Mux upload
    const buffer = fs.readFileSync(outputPath);
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

    console.log(`[VideoDownloader] Video size: ${fileSizeMB}MB`);

    return {
      filePath: outputPath,
      buffer,
      platform,
      videoId,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        uploader: metadata.uploader || metadata.channel,
        uploadDate: metadata.upload_date,
      },
    };
  } catch (error: any) {
    console.error(`[VideoDownloader] Error downloading video:`, error);

    // Cleanup on error
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    throw new Error(`Failed to download video: ${error.message}`);
  }
}

/**
 * Cleans up temporary video file
 */
export function cleanupVideo(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[VideoDownloader] Cleaned up temp file: ${filePath}`);
    }
  } catch (error) {
    console.error(`[VideoDownloader] Error cleaning up file:`, error);
  }
}

/**
 * Cleans up all temporary video files older than 1 hour
 */
export function cleanupOldVideos(): void {
  const tempDir = path.join(tmpdir(), 'healthymama-videos');

  if (!fs.existsSync(tempDir)) {
    return;
  }

  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const files = fs.readdirSync(tempDir);

  let cleanedCount = 0;
  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < oneHourAgo) {
      fs.unlinkSync(filePath);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[VideoDownloader] Cleaned up ${cleanedCount} old video files`);
  }
}
