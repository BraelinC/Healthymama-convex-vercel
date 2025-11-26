import YTDlpWrap from 'yt-dlp-wrap';
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { ensureYtDlpBinary } from './ensureYtDlp';

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
 * Detects the video platform from URL using strict regex patterns
 *
 * This prevents false positives (e.g., Instagram URL being detected as YouTube)
 */
export function detectPlatform(url: string): VideoPlatform {
  // YouTube patterns - must start with youtube.com or youtu.be
  const youtubePatterns = [
    /^https?:\/\/(www\.|m\.)?youtube\.com\/(watch|embed|v|shorts)/i,
    /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/i,
    /^https?:\/\/(www\.)?youtube-nocookie\.com\/embed/i,
  ];

  // Instagram patterns - must be instagram.com with /reel/, /p/, /tv/, or /stories/
  const instagramPatterns = [
    /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+/i,
    /^https?:\/\/(www\.)?instagram\.com\/stories\/[^/]+\/\d+/i,
  ];

  // TikTok patterns
  const tiktokPatterns = [
    /^https?:\/\/(www\.|vm\.)?tiktok\.com\/@[^/]+\/video\/\d+/i,
    /^https?:\/\/(www\.)?tiktok\.com\/t\/[A-Za-z0-9]+/i,
  ];

  // Check patterns in order (most specific first)
  if (instagramPatterns.some(pattern => pattern.test(url))) {
    return 'instagram';
  }

  if (youtubePatterns.some(pattern => pattern.test(url))) {
    return 'youtube';
  }

  if (tiktokPatterns.some(pattern => pattern.test(url))) {
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
 * Downloads YouTube video using ytdl-core (more reliable than yt-dlp for YouTube)
 */
async function downloadYouTubeVideoWithYtdl(url: string, videoId: string): Promise<DownloadedVideo> {
  console.log(`[VideoDownloader] Using ytdl-core for YouTube video: ${videoId}`);

  // Create temp directory
  const tempDir = path.join(tmpdir(), 'healthymama-videos');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const outputPath = path.join(tempDir, `${timestamp}.mp4`);

  try {
    // Get video info first
    console.log(`[VideoDownloader] Fetching YouTube video info...`);
    const info = await ytdl.getInfo(url);

    const title = info.videoDetails.title;
    const description = info.videoDetails.description || '';
    const duration = parseInt(info.videoDetails.lengthSeconds);
    const thumbnail = info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || '';
    const uploader = info.videoDetails.author?.name || '';

    console.log(`[VideoDownloader] Video: "${title}" (${duration}s)`);

    // Get best format with video+audio
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: 'videoandaudio',
    });

    if (!format) {
      throw new Error('No suitable video format found');
    }

    console.log(`[VideoDownloader] Selected format: ${format.qualityLabel} (${format.container})`);

    // Download to file
    console.log(`[VideoDownloader] Downloading to ${outputPath}...`);

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath);
      const videoStream = ytdl.downloadFromInfo(info, { format });

      videoStream.pipe(writeStream);

      videoStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });

    // Read file into buffer
    const buffer = fs.readFileSync(outputPath);
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

    console.log(`[VideoDownloader] Download completed: ${fileSizeMB}MB`);

    return {
      filePath: outputPath,
      buffer,
      platform: 'youtube',
      videoId,
      metadata: {
        title,
        description,
        duration,
        thumbnail,
        uploader,
      },
    };
  } catch (error: any) {
    console.error(`[VideoDownloader] ytdl-core error:`, error.message);

    // Cleanup on error
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Provide specific error messages
    if (error.message.includes('Video unavailable')) {
      throw new Error('YouTube video is unavailable or private');
    } else if (error.message.includes('copyright')) {
      throw new Error('YouTube video is blocked due to copyright');
    } else if (error.message.includes('age')) {
      throw new Error('YouTube video is age-restricted');
    } else if (error.message.includes('Sign in')) {
      throw new Error('YouTube requires sign-in for this video');
    }

    throw new Error(`Failed to download YouTube video: ${error.message}`);
  }
}

/**
 * Downloads video from any supported platform
 * - YouTube: Uses ytdl-core (more reliable)
 * - Other platforms: Uses yt-dlp
 */
export async function downloadVideo(url: string): Promise<DownloadedVideo> {
  const platform = detectPlatform(url);
  const videoId = extractVideoId(url, platform);

  console.log(`[VideoDownloader] Detected platform: ${platform}, Video ID: ${videoId}`);

  // Use ytdl-core for YouTube (more reliable)
  if (platform === 'youtube' && videoId) {
    return downloadYouTubeVideoWithYtdl(url, videoId);
  }

  // Use yt-dlp for other platforms (Instagram, TikTok, etc.)
  console.log(`[VideoDownloader] Using yt-dlp for ${platform}...`);

  // Ensure yt-dlp binary is available (downloads automatically if needed)
  const binaryPath = await ensureYtDlpBinary();
  const ytDlp = new YTDlpWrap(binaryPath);

  // Create temp directory
  const tempDir = path.join(tmpdir(), 'healthymama-videos');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const timestamp = Date.now();
  const outputTemplate = path.join(tempDir, `${timestamp}.%(ext)s`);
  let outputPath: string | undefined;

  try {
    console.log(`[VideoDownloader] Downloading video from ${url}...`);
    console.log(`[VideoDownloader] Temp directory: ${tempDir}`);

    // Download with optimized settings for recipe videos
    const downloadOutput = await ytDlp.execPromise([
      url,
      // Format selection: prefer MP4, max 720p for cost savings
      '-f', 'bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best',
      '--merge-output-format', 'mp4',
      '-o', outputTemplate,
      '--no-playlist', // Single video only
      '--max-filesize', '500M', // Limit to 500MB
      '--socket-timeout', '30', // 30 second timeout
      '--retries', '3', // Retry 3 times on failure
      '--print', 'after_move:filepath', // Print the actual output file path
    ]);

    // Get the actual output path from yt-dlp
    const actualOutputPath = downloadOutput.toString().trim().split('\n').pop()?.trim();

    console.log(`[VideoDownloader] yt-dlp output: ${downloadOutput.toString()}`);
    console.log(`[VideoDownloader] Actual file path: ${actualOutputPath}`);

    // Verify the file exists
    if (actualOutputPath && fs.existsSync(actualOutputPath)) {
      outputPath = actualOutputPath;
    } else {
      // Fallback: search for the file in temp directory
      console.log(`[VideoDownloader] File not found at reported path, searching temp directory...`);
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(timestamp.toString()));

      if (files.length === 0) {
        throw new Error(`Downloaded file not found in ${tempDir}`);
      }

      outputPath = path.join(tempDir, files[0]);
      console.log(`[VideoDownloader] Found file: ${outputPath}`);
    }

    console.log(`[VideoDownloader] Download completed: ${outputPath}`);

    // Ensure outputPath is defined
    if (!outputPath) {
      throw new Error('Failed to determine output file path after download');
    }

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
    if (outputPath && fs.existsSync(outputPath)) {
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
