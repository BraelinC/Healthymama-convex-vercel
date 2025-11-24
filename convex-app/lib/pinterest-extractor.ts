/**
 * Pinterest Pin Data Extractor
 * Extracts recipe data from Pinterest pins using ScrapeCreators API
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
 * Fetch Pinterest pin data using ScrapeCreators API
 */
export async function fetchPinterestPin(pinUrl: string): Promise<PinterestPin> {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;

  if (!apiKey) {
    throw new Error('ScrapeCreators API key not configured. Set SCRAPECREATORS_API_KEY in environment.');
  }

  // ScrapeCreators Pinterest pin endpoint
  const apiUrl = `https://api.scrapecreators.com/v1/pinterest/pin?url=${encodeURIComponent(pinUrl)}`;

  const response = await fetch(apiUrl, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ScrapeCreators API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const pin = data.pin || data;

  // Determine pin type and extract media
  let type: 'image' | 'video' | 'carousel' = 'image';
  const imageUrls: string[] = [];
  let videoUrl: string | undefined;

  // Check for video
  if (pin.video || pin.videos?.video_list) {
    type = 'video';
    videoUrl = pin.video || pin.videos?.video_list?.V_720P?.url || pin.videos?.video_list?.V_EXP7?.url;
  }

  // Extract images - try multiple possible paths in API response
  if (pin.images?.orig?.url) {
    imageUrls.push(pin.images.orig.url);
  } else if (pin.image_url) {
    imageUrls.push(pin.image_url);
  } else if (pin.images?.['736x']?.url) {
    imageUrls.push(pin.images['736x'].url);
  }

  // Check for carousel
  if (pin.carousel_data?.carousel_slots?.length > 1) {
    type = 'carousel';
    // Clear and repopulate with carousel images
    imageUrls.length = 0;
    pin.carousel_data.carousel_slots.forEach((slot: any) => {
      if (slot.images?.orig?.url) {
        imageUrls.push(slot.images.orig.url);
      } else if (slot.images?.['736x']?.url) {
        imageUrls.push(slot.images['736x'].url);
      }
    });
  }

  return {
    pinId: pin.id || pin.node_id || '',
    type,
    title: pin.title || pin.grid_title || '',
    description: pin.description || '',
    imageUrls,
    videoUrl,
    username: pin.pinner?.username,
    boardName: pin.board?.name,
    createdAt: pin.created_at ? new Date(pin.created_at).getTime() : undefined,
  };
}

/**
 * Extract Pinterest pin from URL
 */
export async function extractPinterestPin(url: string): Promise<PinterestPin> {
  // ScrapeCreators API handles URL resolution internally (including pin.it)
  return await fetchPinterestPin(url);
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
