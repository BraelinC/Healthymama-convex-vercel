/**
 * Utility functions for extracting frames from Mux videos
 */

export interface FrameExtractionOptions {
  width?: number;
  height?: number;
  format?: 'jpg' | 'png' | 'gif';
  fitMode?: 'preserve' | 'stretch' | 'crop' | 'smartcrop';
}

/**
 * Generates a Mux thumbnail URL for a specific timestamp
 */
export function extractFrameFromMux(
  playbackId: string,
  timestamp: number, // seconds
  options?: FrameExtractionOptions
): string {
  const width = options?.width || 1280;
  const height = options?.height || 720;
  const format = options?.format || 'jpg';
  const fitMode = options?.fitMode || 'smartcrop';

  const params = new URLSearchParams({
    time: timestamp.toString(),
    width: width.toString(),
    height: height.toString(),
    fit_mode: fitMode,
  });

  return `https://image.mux.com/${playbackId}/thumbnail.${format}?${params.toString()}`;
}

/**
 * Converts MM:SS timestamp string to seconds
 */
export function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);

  if (parts.length === 2) {
    // MM:SS format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
}

/**
 * Converts seconds to MM:SS timestamp string
 */
export function secondsToTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Extracts multiple frames from a video at specified timestamps
 */
export function extractKeyFrames(
  playbackId: string,
  timestamps: number[], // array of seconds
  options?: FrameExtractionOptions
): Array<{ timestamp: number; url: string; timestampFormatted: string }> {
  return timestamps.map(ts => ({
    timestamp: ts,
    timestampFormatted: secondsToTimestamp(ts),
    url: extractFrameFromMux(playbackId, ts, options),
  }));
}

/**
 * Generates a Mux animated GIF URL for a time range
 */
export function extractGifFromMux(
  playbackId: string,
  startTime: number, // seconds
  endTime?: number, // seconds (optional, defaults to startTime + 3)
  options?: {
    fps?: number; // frames per second (default: 10)
    width?: number; // width in pixels (default: 640)
  }
): string {
  const fps = options?.fps || 10;
  const width = options?.width || 640;
  const end = endTime || startTime + 3;

  const params = new URLSearchParams({
    start: startTime.toString(),
    end: end.toString(),
    fps: fps.toString(),
    width: width.toString(),
  });

  return `https://image.mux.com/${playbackId}/animated.gif?${params.toString()}`;
}

/**
 * Generates thumbnail URLs for video timeline scrubbing
 * Creates evenly spaced thumbnails across the video duration
 */
export function generateTimelineThumbnails(
  playbackId: string,
  videoDuration: number, // seconds
  numberOfThumbnails: number = 10,
  options?: FrameExtractionOptions
): Array<{ timestamp: number; url: string; percentage: number }> {
  const interval = videoDuration / (numberOfThumbnails + 1);
  const thumbnails: Array<{ timestamp: number; url: string; percentage: number }> = [];

  for (let i = 1; i <= numberOfThumbnails; i++) {
    const timestamp = interval * i;
    const percentage = (timestamp / videoDuration) * 100;

    thumbnails.push({
      timestamp,
      percentage,
      url: extractFrameFromMux(playbackId, timestamp, {
        width: 160,
        height: 90,
        ...options,
      }),
    });
  }

  return thumbnails;
}

/**
 * Gets a storyboard URL from Mux (multiple thumbnails in a single image grid)
 */
export function getMuxStoryboardUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/storyboard.vtt`;
}
