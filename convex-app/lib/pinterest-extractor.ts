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
  // External link fields for recipe website extraction
  link?: string;           // External recipe website URL
  domain?: string;         // Domain name (e.g., "allrecipes.com")
  trackedLink?: string;    // Alternative tracked link field from API
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
 *
 * Valid Pinterest URL formats:
 * - https://www.pinterest.com/pin/123456789/
 * - https://pinterest.com/pin/123456789/
 * - https://pin.it/SHORTCODE
 */
export function isPinterestUrl(url: string): boolean {
  const pinterestPatterns = [
    /^https?:\/\/(www\.)?pinterest\.com\/pin\/\d+/i,
    /^https?:\/\/pin\.it\/[A-Za-z0-9]+/i,
  ];

  return pinterestPatterns.some(pattern => pattern.test(url));
}

/**
 * Extract video URL from various possible locations in the API response
 * Pinterest pins can have video URLs in many different places depending on the content type
 */
function extractVideoUrl(pin: any): string | undefined {
  // Log the full pin structure for debugging (JSON stringified, truncated)
  try {
    const pinJson = JSON.stringify(pin, null, 2);
    console.log('[Pinterest Extractor] Full pin data (first 3000 chars):', pinJson.substring(0, 3000));
    if (pinJson.length > 3000) {
      console.log('[Pinterest Extractor] ... (truncated, total length:', pinJson.length, ')');
    }
  } catch (e) {
    console.log('[Pinterest Extractor] Could not stringify pin data');
  }

  // Log the pin structure for debugging (only key fields)
  console.log('[Pinterest Extractor] Pin type:', pin.type);
  console.log('[Pinterest Extractor] Pin pinType:', pin.pinType);
  console.log('[Pinterest Extractor] Has video field:', !!pin.video);
  console.log('[Pinterest Extractor] Has videos field:', !!pin.videos);
  console.log('[Pinterest Extractor] Has data field:', !!pin.data);
  console.log('[Pinterest Extractor] Has story_pin_data:', !!pin.story_pin_data);
  console.log('[Pinterest Extractor] Has embed:', !!pin.embed);
  console.log('[Pinterest Extractor] Has rich_metadata:', !!pin.rich_metadata);
  console.log('[Pinterest Extractor] Has native_creator:', !!pin.native_creator);

  // Priority 0: Check data.url format (common Pinterest video response format)
  if (pin.data?.url) {
    console.log('[Pinterest Extractor] Found video in pin.data.url');
    return pin.data.url;
  }

  // Priority 1: Direct video field (most common for video pins)
  if (pin.video && typeof pin.video === 'string') {
    console.log('[Pinterest Extractor] Found video in pin.video');
    return pin.video;
  }

  // Check if video is an object with url
  if (pin.video?.url) {
    console.log('[Pinterest Extractor] Found video in pin.video.url');
    return pin.video.url;
  }

  // Priority 2: ScrapeCreators format - videos.url (direct URL)
  if (pin.videos?.url) {
    console.log('[Pinterest Extractor] Found video in pin.videos.url (ScrapeCreators format)');
    return pin.videos.url;
  }

  // Priority 2b: Video list with quality options (native Pinterest API format)
  if (pin.videos?.video_list) {
    const videoList = pin.videos.video_list;
    // Try different quality options in order of preference
    const qualityOptions = ['V_720P', 'V_EXP7', 'V_480P', 'V_360P', 'V_HLSV4', 'V_HLSV3_MOBILE'];
    for (const quality of qualityOptions) {
      if (videoList[quality]?.url) {
        console.log(`[Pinterest Extractor] Found video in videos.video_list.${quality}`);
        return videoList[quality].url;
      }
    }
    // Check for any video URL in the list
    for (const key of Object.keys(videoList)) {
      if (videoList[key]?.url) {
        console.log(`[Pinterest Extractor] Found video in videos.video_list.${key}`);
        return videoList[key].url;
      }
    }
  }

  // Priority 3: Story pin data (Pinterest story pins with video blocks)
  if (pin.story_pin_data?.pages) {
    for (const page of pin.story_pin_data.pages) {
      if (page.blocks) {
        for (const block of page.blocks) {
          // Check video block
          if (block.video?.video_list) {
            const videoList = block.video.video_list;
            for (const key of Object.keys(videoList)) {
              if (videoList[key]?.url) {
                console.log(`[Pinterest Extractor] Found video in story_pin_data.pages[].blocks[].video.video_list.${key}`);
                return videoList[key].url;
              }
            }
          }
          // Check block video URL directly
          if (block.video_url) {
            console.log('[Pinterest Extractor] Found video in story_pin_data block.video_url');
            return block.video_url;
          }
        }
      }
    }
  }

  // Priority 4: Embed data (for TikTok and other embedded videos)
  if (pin.embed?.src) {
    console.log('[Pinterest Extractor] Found video in embed.src');
    return pin.embed.src;
  }
  if (pin.embed?.url) {
    console.log('[Pinterest Extractor] Found video in embed.url');
    return pin.embed.url;
  }

  // Priority 5: Rich metadata (sometimes contains video URLs)
  if (pin.rich_metadata?.video_url) {
    console.log('[Pinterest Extractor] Found video in rich_metadata.video_url');
    return pin.rich_metadata.video_url;
  }
  if (pin.rich_metadata?.url && pin.rich_metadata.url.includes('video')) {
    console.log('[Pinterest Extractor] Found video in rich_metadata.url');
    return pin.rich_metadata.url;
  }

  // Priority 6: Native creator video (for creator content)
  if (pin.native_creator?.video_list) {
    const videoList = pin.native_creator.video_list;
    for (const key of Object.keys(videoList)) {
      if (videoList[key]?.url) {
        console.log(`[Pinterest Extractor] Found video in native_creator.video_list.${key}`);
        return videoList[key].url;
      }
    }
  }

  // Priority 7: Direct video_url field
  if (pin.video_url) {
    console.log('[Pinterest Extractor] Found video in pin.video_url');
    return pin.video_url;
  }

  // Priority 8: Check media object
  if (pin.media?.video?.video_list) {
    const videoList = pin.media.video.video_list;
    for (const key of Object.keys(videoList)) {
      if (videoList[key]?.url) {
        console.log(`[Pinterest Extractor] Found video in media.video.video_list.${key}`);
        return videoList[key].url;
      }
    }
  }

  // Priority 9: Check videoUrls array (some APIs return array of video URLs)
  if (pin.videoUrls && Array.isArray(pin.videoUrls) && pin.videoUrls.length > 0) {
    console.log('[Pinterest Extractor] Found video in pin.videoUrls array');
    return pin.videoUrls[0];
  }

  // Priority 10: Check video_versions (some Pinterest responses)
  if (pin.video_versions && Array.isArray(pin.video_versions)) {
    // Find highest quality
    const sorted = pin.video_versions.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
    if (sorted[0]?.url) {
      console.log('[Pinterest Extractor] Found video in pin.video_versions');
      return sorted[0].url;
    }
  }

  // Priority 11: Deep search - look for any field containing 'video' with a URL
  const deepVideoUrl = findVideoUrlDeep(pin);
  if (deepVideoUrl) {
    console.log('[Pinterest Extractor] Found video via deep search');
    return deepVideoUrl;
  }

  console.log('[Pinterest Extractor] No video URL found in pin data');
  return undefined;
}

/**
 * Deep search for video URLs in the pin object
 * Looks for any field that might contain a video URL
 */
function findVideoUrlDeep(obj: any, depth = 0): string | undefined {
  if (depth > 5 || !obj) return undefined; // Prevent infinite recursion

  if (typeof obj === 'string') {
    // Check if string looks like a video URL
    if (obj.includes('.mp4') ||
        obj.includes('/videos/') ||
        obj.includes('video.') ||
        obj.includes('v1.pinimg.com/videos')) {
      return obj;
    }
    return undefined;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const result = findVideoUrlDeep(item, depth + 1);
      if (result) return result;
    }
    return undefined;
  }

  if (typeof obj === 'object') {
    // Check common video-related keys first
    const videoKeys = ['video_url', 'videoUrl', 'url', 'src', 'source'];
    for (const key of videoKeys) {
      if (obj[key] && typeof obj[key] === 'string') {
        const url = obj[key];
        if (url.includes('.mp4') || url.includes('/videos/') || url.includes('video')) {
          return url;
        }
      }
    }

    // Recurse into nested objects
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase().includes('video') || key.toLowerCase().includes('media')) {
        const result = findVideoUrlDeep(obj[key], depth + 1);
        if (result) return result;
      }
    }
  }

  return undefined;
}

/**
 * Determine if the pin contains video content
 */
function hasVideoContent(pin: any): boolean {
  return !!(
    pin.video ||
    pin.videos?.url || // ScrapeCreators format
    pin.videos?.video_list ||
    pin.story_pin_data?.pages?.some((page: any) =>
      page.blocks?.some((block: any) => block.video || block.video_url)
    ) ||
    pin.embed?.src ||
    pin.rich_metadata?.video_url ||
    pin.native_creator?.video_list ||
    pin.video_url ||
    pin.media?.video ||
    pin.type === 'video' ||
    pin.is_video ||
    pin.data?.url ||
    pin.videoUrls ||
    pin.video_versions ||
    // Check if any field name contains 'video'
    Object.keys(pin).some(key => key.toLowerCase().includes('video'))
  );
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

  // Log the full response for debugging (truncated for readability)
  console.log('[Pinterest Extractor] Raw API response keys:', Object.keys(pin));

  // Determine pin type and extract media
  let type: 'image' | 'video' | 'carousel' = 'image';
  const imageUrls: string[] = [];
  let videoUrl: string | undefined;

  // Check for video content using comprehensive detection
  if (hasVideoContent(pin)) {
    type = 'video';
    videoUrl = extractVideoUrl(pin);
    console.log('[Pinterest Extractor] Video extraction result:', videoUrl ? 'SUCCESS' : 'FAILED');
    if (videoUrl) {
      console.log('[Pinterest Extractor] Video URL (first 100 chars):', videoUrl.substring(0, 100));
    }
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

  // Extract external link (recipe source website)
  const externalLink = pin.link || pin.trackedLink || pin.tracked_link || undefined;
  let domain = pin.domain;
  if (!domain && externalLink) {
    try {
      domain = new URL(externalLink).hostname.replace('www.', '');
    } catch {
      // Invalid URL, skip domain extraction
    }
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
    // External link fields
    link: externalLink,
    domain,
    trackedLink: pin.trackedLink || pin.tracked_link || undefined,
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
