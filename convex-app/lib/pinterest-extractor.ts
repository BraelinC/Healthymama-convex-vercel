/**
 * Pinterest Pin Data Extractor
 * Extracts recipe data from Pinterest pins using Pinterest API v5
 */

export interface PinterestPin {
  pinId: string;
  type: 'image' | 'video' | 'carousel';
  title: string;
  description: string;
  imageUrls: string[];
  videoUrl?: string;
  username?: string;
  boardName?: string;
  createdAt?: number;
}

/**
 * Extract pin ID from various Pinterest URL formats
 */
export function extractPinIdFromUrl(url: string): string | null {
  // Support formats:
  // https://www.pinterest.com/pin/123456789/
  // https://pinterest.com/pin/123456789
  // https://pin.it/abc123 (shortened)

  const patterns = [
    /pinterest\.com\/pin\/(\d+)/,
    /pin\.it\/([a-zA-Z0-9]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if URL is a Pinterest URL
 */
export function isPinterestUrl(url: string): boolean {
  return url.includes('pinterest.com') || url.includes('pin.it');
}

/**
 * Fetch Pinterest pin data using Pinterest API v5
 */
export async function fetchPinterestPin(pinId: string): Promise<PinterestPin> {
  const accessToken = process.env.PINTEREST_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Pinterest access token not configured');
  }

  // Pinterest API v5 endpoint
  const apiUrl = `https://api.pinterest.com/v5/pins/${pinId}`;

  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinterest API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Determine pin type
  let type: 'image' | 'video' | 'carousel' = 'image';
  const imageUrls: string[] = [];
  let videoUrl: string | undefined;

  // Check for video
  if (data.media?.video_url) {
    type = 'video';
    videoUrl = data.media.video_url;
    // Also get thumbnail
    if (data.media?.images?.['600x']) {
      imageUrls.push(data.media.images['600x'].url);
    }
  }
  // Check for carousel (multiple images)
  else if (data.media?.carousel_media && data.media.carousel_media.length > 1) {
    type = 'carousel';
    data.media.carousel_media.forEach((item: any) => {
      if (item.images?.['600x']) {
        imageUrls.push(item.images['600x'].url);
      } else if (item.images?.orig) {
        imageUrls.push(item.images.orig.url);
      }
    });
  }
  // Single image
  else if (data.media?.images) {
    type = 'image';
    // Prefer original, fall back to 600x
    if (data.media.images.orig) {
      imageUrls.push(data.media.images.orig.url);
    } else if (data.media.images['600x']) {
      imageUrls.push(data.media.images['600x'].url);
    }
  }

  return {
    pinId: data.id,
    type,
    title: data.title || '',
    description: data.description || '',
    imageUrls,
    videoUrl,
    username: data.creator_username || data.pinner?.username,
    boardName: data.board?.name,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
  };
}

/**
 * Extract Pinterest pin from URL
 */
export async function extractPinterestPin(url: string): Promise<PinterestPin> {
  // Handle pin.it shortened URLs by following redirect
  if (url.includes('pin.it')) {
    const response = await fetch(url, { redirect: 'follow' });
    url = response.url;
  }

  const pinId = extractPinIdFromUrl(url);

  if (!pinId) {
    throw new Error('Invalid Pinterest URL format');
  }

  return await fetchPinterestPin(pinId);
}

/**
 * Download image from URL and return as base64
 */
export async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}
