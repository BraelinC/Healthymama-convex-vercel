/**
 * Instagram Recipe Import API Route (Next.js Backend)
 *
 * This API route orchestrates the Instagram recipe import process using HikerAPI
 * for Instagram extraction and Gemini 2.0 Flash for AI-powered recipe parsing.
 *
 * Architecture Flow:
 * 1. Frontend sends Instagram URL to this endpoint
 * 2. We call HikerAPI to extract Instagram data (caption, video URL, metadata)
 * 3. 🎥 PRIMARY PATH: Watch video with Gemini to extract recipe (ingredients, steps, timing)
 * 4. Upload video to Mux for hosting (instant clipping support)
 * 5. Analyze video to segment cooking steps with timestamps (step-by-step cooking mode)
 * 6. Return formatted recipe JSON to frontend for preview/save
 *
 * Why Video-First Extraction?:
 * - Instagram reels often say "Recipe in bio" or "Link in caption" instead of showing recipe text
 * - Gemini 2.0 Flash can watch the video and extract ingredients, steps, quantities visually
 * - More reliable than caption parsing (captions are often marketing copy, not recipes)
 * - Enables automatic recipe extraction from any cooking video
 * - Caption parsing is used as fallback if video extraction fails
 *
 * Environment Variables Used:
 * - HIKER_API_KEY: HikerAPI key for Instagram data extraction
 * - OPEN_ROUTER_API_KEY: OpenRouter API key for Gemini 2.0 Flash (video analysis + text parsing)
 * - MUX_TOKEN_ID, MUX_TOKEN_SECRET: Mux credentials for video hosting
 *
 * Error Handling:
 * - Network errors (HikerAPI unreachable)
 * - Instagram errors (private account, deleted post)
 * - Video download timeouts (30 second limit)
 * - AI extraction errors (invalid JSON, missing fields)
 * - Automatic fallback to caption parsing if video extraction fails
 * - All errors return 500 with descriptive message
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadVideoFromUrl } from '@/lib/mux';
import { extractRecipeWithSegments, VideoSegment, RecipeWithSegments } from '@/lib/gemini-video-analysis';
import {
  extractYouTubeVideoId,
  parseYouTubeDescription,
  isYouTubeUrl,
  isInstagramUrl
} from '@/lib/youtube-parser';
import { formatRecipeWithGPT } from '@/lib/openai-formatter';
import { extractPinterestPin, isPinterestUrl } from '@/lib/pinterest-extractor';
import { extractRecipeFromPinterestImage } from '@/lib/gemini-video-analysis';
import {
  extractJsonLdFromHtml,
  validateRecipeCompleteness,
  transformJsonLdRecipe,
} from '@/convex/lib/recipeExtractor';
import { extractRecipeWithOpenRouter } from '@/convex/lib/openRouterExtractor';

/**
 * Extract URLs from text (captions/descriptions)
 * Filters out social media URLs and returns only potential recipe website URLs
 */
function extractUrlsFromText(text: string): string[] {
  if (!text) return [];

  // URL regex pattern - matches http/https URLs
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlPattern) || [];

  // Filter out social media and non-recipe URLs
  const socialMediaDomains = [
    'instagram.com', 'facebook.com', 'twitter.com', 'x.com',
    'tiktok.com', 'youtube.com', 'youtu.be', 'pinterest.com',
    'pin.it', 'linktr.ee', 'linkin.bio', 'bio.link', 'beacons.ai',
    'stan.store', 'allmylinks.com', 'lnk.to', 'bit.ly', 't.co'
  ];

  return matches.filter(url => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      // Exclude social media and link-in-bio services
      return !socialMediaDomains.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  });
}

// Define return type for Railway service
interface InstagramExtractionResult {
  success: boolean;
  caption: string;
  comments: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  postUrl: string;
  username: string;
  mediaType: string;
  error?: string;
}

// Define parsed recipe structure
interface ParsedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  imageUrl?: string; // Recipe image from website extraction
  videoSegments?: VideoSegment[]; // AI-analyzed timestamps for each step
  thumbnailTime?: number; // Best timestamp (seconds) for thumbnail from Gemini
}

/**
 * Step 1: Extract Instagram data using HikerAPI
 *
 * Calls HikerAPI (instagrapi fork) to fetch Instagram media data.
 * HikerAPI provides direct video URLs, captions, and metadata via REST API.
 *
 * @param url - Instagram URL (e.g., https://www.instagram.com/reel/ABC123/ or /p/ABC123/)
 * @returns Promise<InstagramExtractionResult> - Caption, video URLs, thumbnails
 * @throws Error if HikerAPI is unreachable or Instagram fetch fails
 *
 * HikerAPI Response:
 * {
 *   success: true,
 *   data: {
 *     video_url: "https://...",
 *     caption_text: "Recipe text...",
 *     thumbnail_url: "https://...",
 *     user: { username: "creator_username" },
 *     media_type: 2  // 1=photo, 2=video
 *   }
 * }
 */
async function extractInstagramData(url: string): Promise<InstagramExtractionResult> {
  const apiKey = process.env.HIKER_API_KEY;

  if (!apiKey) {
    throw new Error('HikerAPI key not configured (HIKER_API_KEY). Get your key at https://hikerapi.com');
  }

  console.log(`[Instagram Import] Using HikerAPI for URL: ${url}`);

  // Use /v1/media/by/url endpoint which accepts full Instagram URLs
  const apiUrl = `https://api.hikerapi.com/v1/media/by/url?url=${encodeURIComponent(url)}`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-access-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[HikerAPI] Error:', {
      status: response.status,
      body: errorText,
    });

    if (response.status === 401) {
      throw new Error('HikerAPI: Invalid or expired API key. Please get a new key from https://hikerapi.com/login');
    }

    throw new Error(`HikerAPI error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  console.log('[HikerAPI] ✅ Success! Media type:', data.media_type);
  console.log('[HikerAPI] Username:', data.user?.username);
  console.log('[HikerAPI] Caption length:', data.caption_text?.length || 0);

  // Map HikerAPI response to our format
  return {
    success: true,
    caption: data.caption_text || '',
    comments: [],
    videoUrl: data.video_url || '',
    thumbnailUrl: data.thumbnail_url || data.thumbnail_url_hd || '',
    postUrl: url,
    username: data.user?.username || '',
    mediaType: data.media_type === 2 ? 'video' : 'photo',
  };
}

/**
 * Step 1b: Extract YouTube data using YouTube Data API v3
 *
 * Calls YouTube Data API to fetch video metadata including description, title, and thumbnail.
 * The description is where recipes are typically found on YouTube cooking channels.
 *
 * @param url - YouTube URL (any format)
 * @returns Promise<{description, title, thumbnailUrl, videoId}> - Video metadata
 * @throws Error if YouTube API is unreachable or video is unavailable
 *
 * YouTube API Response:
 * {
 *   items: [{
 *     id: "VIDEO_ID",
 *     snippet: {
 *       title: "Recipe Title",
 *       description: "Full recipe text...",
 *       thumbnails: { maxres: { url: "..." } }
 *     }
 *   }]
 * }
 */
async function extractYouTubeData(url: string): Promise<{
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
}> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YouTube API key not configured (YOUTUBE_API_KEY). Get your key at https://console.cloud.google.com/');
  }

  // Extract video ID from URL
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    throw new Error('Invalid YouTube URL - could not extract video ID');
  }

  console.log(`[YouTube Import] Fetching video data for: ${videoId}`);

  // Call YouTube Data API v3
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[YouTube API] Error:', {
      status: response.status,
      body: errorText,
    });

    if (response.status === 403) {
      throw new Error('YouTube API: Invalid or quota-exceeded API key. Check your quota at https://console.cloud.google.com/');
    }

    throw new Error(`YouTube API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('YouTube video not found - it may be private, deleted, or unavailable');
  }

  const snippet = data.items[0].snippet;

  console.log('[YouTube API] ✅ Success! Video:', snippet.title.substring(0, 50) + '...');
  console.log('[YouTube API] Description length:', snippet.description?.length || 0);

  return {
    videoId,
    title: snippet.title,
    description: snippet.description || '',
    thumbnailUrl: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || '',
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

/**
 * Step 2: Parse Instagram caption + comments into structured recipe using OpenRouter AI
 *
 * Takes the raw Instagram data (caption + comments) and uses OpenRouter's Gemini 2.0 Flash
 * model to extract a structured recipe with title, ingredients, instructions, etc.
 *
 * Why Gemini 2.0 Flash?:
 * - Fast response time (~1-3 seconds)
 * - Very cheap (~$0.001 per recipe)
 * - Good at understanding recipe text
 * - Consistent JSON output
 *
 * AI Prompt Strategy:
 * - Combines caption + first 20 comments for context
 * - Recipe might be split across caption and comments
 * - Asks for specific JSON structure (title, ingredients[], instructions[])
 * - Low temperature (0.2) for consistent, predictable output
 *
 * @param caption - Instagram post caption (usually contains recipe)
 * @param comments - Array of comment texts (may contain additional recipe details)
 * @param username - Post author username (for context/attribution)
 * @returns Promise<ParsedRecipe> - Structured recipe with ingredients, instructions, etc.
 * @throws Error if AI parsing fails or returns invalid JSON
 *
 * Response Format:
 * {
 *   title: "Recipe Name",
 *   description: "Brief description",
 *   ingredients: ["1 cup flour", "2 eggs", ...],
 *   instructions: ["Step 1...", "Step 2...", ...],
 *   servings: "4 servings",  // Optional
 *   prep_time: "15 minutes",  // Optional
 *   cook_time: "30 minutes",  // Optional
 *   cuisine: "Italian"  // Optional
 * }
 */
async function parseRecipeWithAI(
  caption: string,
  comments: string[],
  username: string
): Promise<ParsedRecipe> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  // Combine caption and comments for AI parsing
  const commentsText = comments.length > 0
    ? `\n\nComments:\n${comments.slice(0, 20).map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : '';

  const prompt = `You are a recipe extraction expert. Extract a recipe from this Instagram post.

INSTRUCTIONS:
1. Parse the caption and comments to extract the recipe
2. The recipe might be in the caption, or split across multiple comments
3. Extract: title, ingredients (as array), instructions (as step-by-step array)
4. Also extract: servings, prep_time, cook_time, cuisine (if mentioned)
5. If the title is not clear, create one from the main dish/food mentioned
6. Return ONLY a JSON object, no markdown or explanation

Caption:
${caption}${commentsText}

Return format:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": ["ingredient 1", "ingredient 2", ...],
  "instructions": ["Step 1", "Step 2", ...],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian"
}

Return ONLY the JSON object.`;

  console.log(`[Instagram Import] Parsing recipe with OpenRouter (Gemini 2.0 Flash)`);

  // Use the same model and pattern as openRouterExtractor.ts
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://healthymama.app',
      'X-Title': 'HealthyMama Instagram Import',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001', // Fast and cheap
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Low temperature for consistent extraction
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`🚨 [OpenRouter] API error (${response.status}):`, errorText);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from OpenRouter');
  }

  const text = data.choices[0].message.content.trim();

  // Remove markdown code blocks if present (same as openRouterExtractor)
  let jsonText = text;
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').trim();
  }

  const parsed: ParsedRecipe = JSON.parse(jsonText);

  // Validate required fields
  if (!parsed.title || !parsed.ingredients || !parsed.instructions) {
    throw new Error('AI parsing failed: missing required fields (title, ingredients, or instructions)');
  }

  console.log(`[Instagram Import] ✅ Parsed recipe: "${parsed.title}"`);
  console.log(`[Instagram Import] Ingredients count: ${parsed.ingredients?.length || 0}`);
  console.log(`[Instagram Import] Instructions count: ${parsed.instructions?.length || 0}`);
  if (parsed.instructions?.length > 0) {
    console.log(`[Instagram Import] First instruction: ${parsed.instructions[0].substring(0, 100)}...`);
  }

  return parsed;
}

/**
 * Extract recipe from external website URL using 3-method approach
 *
 * This function implements the same extraction flow used for direct website scraping:
 * 1. JSON-LD extraction (fastest, most reliable)
 * 2. Gemini AI extraction from HTML
 * 3. Puppeteer fallback for JavaScript-rendered pages
 *
 * @param url - External recipe website URL
 * @param fallbackImageUrl - Image URL to use if website doesn't have one
 * @returns Parsed recipe or null if extraction fails
 */
async function extractRecipeFromWebsite(url: string, fallbackImageUrl?: string): Promise<ParsedRecipe | null> {
  console.log(`[Website Extraction] Starting 3-method extraction for: ${url}`);

  try {
    // METHOD 1: Try direct fetch + JSON-LD extraction (fastest)
    console.log('[Website Extraction] METHOD 1: Trying JSON-LD extraction...');

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      console.warn(`[Website Extraction] Fetch failed: ${response.status}`);
      throw new Error(`Website returned ${response.status}`);
    }

    const html = await response.text();
    console.log(`[Website Extraction] Fetched ${html.length} chars of HTML`);

    // Try JSON-LD first
    const jsonLdRecipe = extractJsonLdFromHtml(html);
    if (jsonLdRecipe) {
      const validation = validateRecipeCompleteness(jsonLdRecipe);
      if (validation.isComplete) {
        console.log('[Website Extraction] ✅ JSON-LD extraction successful!');
        const transformed = transformJsonLdRecipe(jsonLdRecipe, fallbackImageUrl);
        return {
          title: transformed.title,
          description: transformed.description,
          ingredients: transformed.ingredients,
          instructions: transformed.instructions,
          servings: transformed.servings,
          prep_time: transformed.prep_time,
          cook_time: transformed.cook_time,
          cuisine: transformed.category,
          imageUrl: transformed.imageUrl || fallbackImageUrl,
        };
      }
      console.log(`[Website Extraction] JSON-LD incomplete: ${validation.reason}`);
    }

    // METHOD 2: Try Gemini extraction from HTML
    console.log('[Website Extraction] METHOD 2: Trying Gemini AI extraction...');

    try {
      const geminiRecipe = await extractRecipeWithOpenRouter(html, fallbackImageUrl);
      if (geminiRecipe?.title && geminiRecipe?.ingredients?.length > 0 && geminiRecipe?.instructions?.length > 0) {
        console.log('[Website Extraction] ✅ Gemini extraction successful!');
        return {
          title: geminiRecipe.title,
          description: geminiRecipe.description || '',
          ingredients: geminiRecipe.ingredients,
          instructions: geminiRecipe.instructions,
          servings: geminiRecipe.servings,
          prep_time: geminiRecipe.prep_time,
          cook_time: geminiRecipe.cook_time,
          cuisine: geminiRecipe.category,
          imageUrl: geminiRecipe.imageUrl || fallbackImageUrl,
        };
      }
      console.log('[Website Extraction] Gemini extraction incomplete');
    } catch (error: any) {
      console.warn('[Website Extraction] Gemini extraction failed:', error.message);
    }

    // METHOD 3: Puppeteer fallback for JavaScript-rendered pages
    console.log('[Website Extraction] METHOD 3: Trying Puppeteer fallback...');

    try {
      // Get the base URL for API call
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const puppeteerResponse = await fetch(`${baseUrl}/api/scrape-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(30000), // 30 second timeout for Puppeteer
      });

      if (puppeteerResponse.ok) {
        const puppeteerData = await puppeteerResponse.json();

        // Check if Puppeteer found JSON-LD data
        if (puppeteerData.jsonLdData) {
          const validation = validateRecipeCompleteness(puppeteerData.jsonLdData);
          if (validation.isComplete) {
            console.log('[Website Extraction] ✅ Puppeteer JSON-LD extraction successful!');
            const transformed = transformJsonLdRecipe(puppeteerData.jsonLdData, fallbackImageUrl);
            return {
              title: transformed.title,
              description: transformed.description,
              ingredients: transformed.ingredients,
              instructions: transformed.instructions,
              servings: transformed.servings,
              prep_time: transformed.prep_time,
              cook_time: transformed.cook_time,
              cuisine: transformed.category,
              imageUrl: transformed.imageUrl || fallbackImageUrl,
            };
          }
        }

        // Try Gemini on Puppeteer-rendered HTML
        if (puppeteerData.html) {
          const geminiRecipe = await extractRecipeWithOpenRouter(
            puppeteerData.html,
            puppeteerData.imageUrls?.[0] || fallbackImageUrl
          );
          if (geminiRecipe?.title && geminiRecipe?.ingredients?.length > 0) {
            console.log('[Website Extraction] ✅ Puppeteer + Gemini extraction successful!');
            return {
              title: geminiRecipe.title,
              description: geminiRecipe.description || '',
              ingredients: geminiRecipe.ingredients,
              instructions: geminiRecipe.instructions,
              servings: geminiRecipe.servings,
              prep_time: geminiRecipe.prep_time,
              cook_time: geminiRecipe.cook_time,
              cuisine: geminiRecipe.category,
              imageUrl: geminiRecipe.imageUrl || fallbackImageUrl,
            };
          }
        }

        // METHOD 4: Gemini 2.5 Flash Vision on multiple screenshots (for React/JS-heavy sites)
        if (puppeteerData.screenshots && puppeteerData.screenshots.length > 0) {
          console.log(`[Website Extraction] METHOD 4: Trying Gemini 2.5 Flash Vision on ${puppeteerData.screenshots.length} screenshots...`);
          try {
            const visionRecipe = await extractRecipeFromScreenshots(puppeteerData.screenshots);
            if (visionRecipe?.title && visionRecipe?.ingredients?.length > 0) {
              console.log('[Website Extraction] ✅ Gemini 2.5 Flash Vision OCR extraction successful!');
              return {
                title: visionRecipe.title,
                description: visionRecipe.description || '',
                ingredients: visionRecipe.ingredients,
                instructions: visionRecipe.instructions,
                servings: visionRecipe.servings,
                prep_time: visionRecipe.prep_time,
                cook_time: visionRecipe.cook_time,
                cuisine: visionRecipe.cuisine,
                imageUrl: fallbackImageUrl,
              };
            }
          } catch (visionError: any) {
            console.warn('[Website Extraction] Claude Haiku Vision failed:', visionError.message);
          }
        }

        // FALLBACK: Single screenshot with Gemini (legacy support)
        if (puppeteerData.screenshot) {
          console.log('[Website Extraction] METHOD 4b: Trying Gemini Vision on single screenshot...');
          try {
            const { extractRecipeFromPinterestImage } = await import('@/lib/gemini-video-analysis');
            const visionRecipe = await extractRecipeFromPinterestImage(
              [puppeteerData.screenshot],
              '',
              undefined
            );
            if (visionRecipe?.title && visionRecipe?.ingredients?.length > 0) {
              console.log('[Website Extraction] ✅ Gemini Vision OCR extraction successful!');
              return {
                title: visionRecipe.title,
                description: visionRecipe.description || '',
                ingredients: visionRecipe.ingredients,
                instructions: visionRecipe.instructions,
                servings: visionRecipe.servings,
                prep_time: visionRecipe.prep_time,
                cook_time: visionRecipe.cook_time,
                cuisine: visionRecipe.cuisine,
                imageUrl: fallbackImageUrl,
              };
            }
          } catch (visionError: any) {
            console.warn('[Website Extraction] Gemini Vision failed:', visionError.message);
          }
        }
      }
    } catch (error: any) {
      console.warn('[Website Extraction] Puppeteer fallback failed:', error.message);
    }

    console.log('[Website Extraction] ❌ All methods failed');
    return null;
  } catch (error: any) {
    console.error('[Website Extraction] Fatal error:', error.message);
    return null;
  }
}

/**
 * Extract recipe from multiple screenshots using Gemini 2.5 Flash Vision
 *
 * This function takes an array of base64 screenshots (captured while scrolling)
 * and sends them to Gemini 2.5 Flash for OCR extraction of the complete recipe.
 *
 * @param screenshots - Array of base64 data URLs (data:image/jpeg;base64,...)
 * @returns Parsed recipe or null if extraction fails
 */
async function extractRecipeFromScreenshots(screenshots: string[]): Promise<ParsedRecipe | null> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  console.log(`[Screenshot Extraction] Sending ${screenshots.length} screenshots to Gemini 2.5 Flash...`);

  // Build content array with text prompt + all screenshots
  const content: any[] = [
    {
      type: 'text',
      text: `You are viewing ${screenshots.length} screenshots of a recipe webpage (scrolled from top to bottom).

Extract the COMPLETE recipe including:
- title (the main recipe name)
- description (brief description if available)
- ingredients (COMPLETE list with exact quantities - e.g., "1 cup flour", "2 large eggs")
- instructions (step-by-step, numbered if possible)
- servings, prep_time, cook_time if visible

IMPORTANT:
- The recipe content may be spread across multiple screenshots
- Look carefully at ALL screenshots to find ALL ingredients and ALL instructions
- If you see tabs or sections, extract content from all visible sections
- Include ALL measurements and quantities exactly as shown

If this is NOT a recipe page (e.g., CAPTCHA, error page, blocked), return:
{"error": "Not a recipe page", "reason": "description of what you see"}

Otherwise, return ONLY valid JSON:
{
  "title": "Recipe Name",
  "description": "Brief description",
  "ingredients": ["1 cup flour", "2 large eggs", ...],
  "instructions": ["Step 1: Preheat oven...", "Step 2: Mix...", ...],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian"
}`
    }
  ];

  // Add all screenshots as images
  screenshots.forEach((screenshot, i) => {
    content.push({
      type: 'image_url',
      image_url: { url: screenshot }
    });
  });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://healthymama.app',
      'X-Title': 'HealthyMama Screenshot Recipe Extraction',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content }],
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 4000, // Ensure we get complete recipe
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Screenshot Extraction] API error (${response.status}):`, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from Gemini');
  }

  const text = data.choices[0].message.content.trim();

  // Remove markdown code blocks if present
  let jsonText = text;
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').trim();
  }

  const parsed = JSON.parse(jsonText);

  // Check if Claude detected a non-recipe page
  if (parsed.error) {
    console.warn(`[Screenshot Extraction] Not a recipe page: ${parsed.reason}`);
    return null;
  }

  // Validate required fields
  if (!parsed.title || !parsed.ingredients || !parsed.instructions) {
    console.warn('[Screenshot Extraction] Missing required fields');
    return null;
  }

  console.log(`[Screenshot Extraction] ✅ Extracted: "${parsed.title}"`);
  console.log(`[Screenshot Extraction] Ingredients: ${parsed.ingredients?.length || 0}`);
  console.log(`[Screenshot Extraction] Instructions: ${parsed.instructions?.length || 0}`);

  return {
    title: parsed.title,
    description: parsed.description || '',
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    servings: parsed.servings,
    prep_time: parsed.prep_time,
    cook_time: parsed.cook_time,
    cuisine: parsed.cuisine,
  };
}

/**
 * Main API route handler
 */
export async function POST(request: NextRequest) {
  try {
    // Check if this is an internal call from Mikey bot
    const isInternalCall = request.headers.get('X-Internal-Call') === 'mikey-bot';

    let userId: string | null = null;

    if (isInternalCall) {
      // For Mikey bot calls, use a system user ID
      console.log('[Instagram Import] Internal call from Mikey bot');
      userId = 'system_mikey_bot'; // Placeholder - actual userId passed separately
    } else {
      // SECURITY: Validate authentication for regular user requests
      const authResult = await auth();
      userId = authResult.userId;
      if (!userId) {
        return NextResponse.json(
          { error: 'Unauthorized - authentication required' },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid URL' },
        { status: 400 }
      );
    }

    // Detect URL type
    console.log(`[Video Import] === URL Validation Debug ===`);
    console.log(`[Video Import] Raw URL:`, url);
    console.log(`[Video Import] URL type:`, typeof url);
    console.log(`[Video Import] URL length:`, url?.length);
    console.log(`[Video Import] Is CDN URL (lookaside check):`, url?.includes('lookaside.fbsbx.com'));
    console.log(`[Video Import] Is CDN URL (full path check):`, url?.includes('lookaside.fbsbx.com/ig_messaging_cdn'));
    const isInstagram = isInstagramUrl(url);
    const isYouTube = isYouTubeUrl(url);
    const isPinterest = isPinterestUrl(url);
    console.log(`[Video Import] Validation results - isInstagram:`, isInstagram, 'isYouTube:', isYouTube, 'isPinterest:', isPinterest);

    // YouTube is temporarily disabled
    if (isYouTube) {
      return NextResponse.json(
        { error: 'YouTube import is temporarily disabled. Please use Instagram or Pinterest URLs.' },
        { status: 400 }
      );
    }

    // TEMPORARY: Force-accept Facebook CDN URLs for debugging
    const isCdnUrl = url.includes('lookaside.fbsbx.com/ig_messaging_cdn');
    console.log(`[Video Import] Is CDN URL:`, isCdnUrl);

    if (!isInstagram && !isPinterest && !isCdnUrl) {
      console.log(`[Video Import] ❌ URL validation failed - rejecting URL`);
      return NextResponse.json(
        { error: 'Invalid URL - must be Instagram or Pinterest URL' },
        { status: 400 }
      );
    }

    console.log(`[Video Import] ✅ URL validation passed`);

    // Determine platform (CDN URLs are Instagram)
    const platform = isPinterest ? 'Pinterest' : ((isInstagram || isCdnUrl) ? 'Instagram' : 'YouTube');
    console.log(`\n[${platform} Import] Starting import for: ${url}`);

    // Step 1: Extract data based on platform
    let videoUrl: string | undefined;
    let videoId: string | undefined;
    let thumbnailUrl: string | undefined;
    let title: string | undefined;
    let description: string = '';
    let pinterestData: Awaited<ReturnType<typeof extractPinterestPin>> | undefined;

    if (isPinterest) {
      // Extract Pinterest pin data using Pinterest API
      pinterestData = await extractPinterestPin(url);

      videoUrl = pinterestData.videoUrl; // For video pins
      thumbnailUrl = pinterestData.imageUrls[0]; // First image as thumbnail
      title = pinterestData.title;
      description = pinterestData.description;

      console.log(`[Pinterest Import] Type: ${pinterestData.type}`);
      console.log(`[Pinterest Import] Title: ${title}`);
      console.log(`[Pinterest Import] Images: ${pinterestData.imageUrls.length}`);
      console.log(`[Pinterest Import] Description length: ${description?.length || 0} chars`);
      console.log(`[Pinterest Import] External link: ${pinterestData.link || 'none'}`);
      console.log(`[Pinterest Import] Domain: ${pinterestData.domain || 'none'}`);
    } else if (isInstagram || isCdnUrl) {
      // Process Instagram URLs (including CDN URLs from webhooks)
      if (isCdnUrl) {
        // CDN URL is already a direct video link - skip HikerAPI
        console.log('[Instagram Import] Detected CDN URL - using direct video link');
        videoUrl = url;
        thumbnailUrl = undefined; // Will be extracted from video
        description = 'Instagram reel shared via DM';
      } else {
        // Regular Instagram URL - extract data using HikerAPI
        const instagramData = await extractInstagramData(url);

        videoUrl = instagramData.videoUrl;
        thumbnailUrl = instagramData.thumbnailUrl;
        description = instagramData.caption;

        console.log(`[Instagram Import] Caption length: ${description?.length || 0} chars`);
        console.log(`[Instagram Import] Caption preview: ${description?.substring(0, 150)}...`);
      }
    } else {
      // Extract YouTube data using YouTube API
      const youtubeData = await extractYouTubeData(url);

      videoUrl = youtubeData.videoUrl; // Watch URL for now, will download later
      videoId = youtubeData.videoId;
      thumbnailUrl = youtubeData.thumbnailUrl;
      title = youtubeData.title;
      description = youtubeData.description;

      console.log(`[YouTube Import] Title: ${title}`);
      console.log(`[YouTube Import] Description length: ${description?.length || 0} chars`);
    }

    // Step 2: Upload to Mux (YouTube download disabled - only Instagram/Pinterest supported)
    let muxData = null;
    let downloadedVideoUrl = videoUrl; // Default to original URL

    // YouTube download disabled - frontend blocks YouTube URLs
    // Only Instagram and Pinterest are currently supported

    // Upload to Mux for hosting (works for Instagram, YouTube, and Pinterest video pins)
    if (downloadedVideoUrl) {
      try {
        console.log(`[${platform} Import] Uploading video to Mux...`);

        // Extract a short identifier for passthrough (max 255 chars)
        let passthrough = '';
        if (isPinterest) {
          passthrough = `pinterest:${pinterestData?.pinId}`;
        } else if (isYouTube) {
          passthrough = `youtube:${videoId}`;
        } else {
          // For Instagram CDN URLs, extract just the asset_id
          const assetIdMatch = downloadedVideoUrl.match(/asset_id=(\d+)/);
          const assetId = assetIdMatch ? assetIdMatch[1] : Date.now().toString();
          passthrough = `instagram:${assetId}`;
        }

        muxData = await uploadVideoFromUrl(downloadedVideoUrl, { passthrough });
        console.log(`[${platform} Import] ✅ Mux upload complete: ${muxData.playbackId}`);

        // Use Mux thumbnail if we don't have one yet
        if (!thumbnailUrl && muxData.playbackId) {
          thumbnailUrl = `https://image.mux.com/${muxData.playbackId}/thumbnail.jpg`;
          console.log(`[${platform} Import] Using Mux thumbnail: ${thumbnailUrl}`);
        }
      } catch (error: any) {
        console.error(`[${platform} Import] ⚠️ Mux upload failed:`, error.message);
        // Continue without Mux - will use original video URL as fallback
      }
    }

    // Step 3: Extract recipe (different flow for each platform)
    let recipe: ParsedRecipe;
    let videoSegmentsFromExtraction: VideoSegment[] | undefined;

    if (isPinterest) {
      // PINTEREST FLOW: External website → Video extraction → Gemini vision fallback
      let pinterestRecipe: ParsedRecipe | null = null;

      // Get external link - check API link first, then search description for URLs
      let externalLink = pinterestData!.link;

      if (!externalLink) {
        // Search description for recipe URLs
        const descriptionUrls = extractUrlsFromText(pinterestData!.description);
        if (descriptionUrls.length > 0) {
          externalLink = descriptionUrls[0]; // Use first valid URL
          console.log(`[Pinterest Import] Found URL in description: ${externalLink}`);
        }
      }

      // ALWAYS try external website extraction first (if pin has external link)
      if (externalLink) {
        console.log(`[Pinterest Import] Found external link: ${externalLink}`);
        try {
          const domain = new URL(externalLink).hostname.replace('www.', '');
          console.log(`[Pinterest Import] Domain: ${domain}`);
        } catch {}
        console.log('[Pinterest Import] Attempting website extraction (3-method flow)...');

        try {
          const websiteRecipe = await extractRecipeFromWebsite(
            externalLink,
            pinterestData!.imageUrls[0] // Use Pinterest image as fallback
          );

          if (websiteRecipe && websiteRecipe.title && websiteRecipe.ingredients?.length > 0) {
            pinterestRecipe = websiteRecipe;
            console.log(`[Pinterest Import] ✅ Website extraction successful: "${pinterestRecipe.title}"`);
            console.log(`[Pinterest Import] ✅ ${pinterestRecipe.ingredients.length} ingredients, ${pinterestRecipe.instructions.length} instructions`);
          } else {
            console.warn('[Pinterest Import] ⚠️ Website extraction returned incomplete data');
          }
        } catch (error: any) {
          console.warn('[Pinterest Import] ⚠️ Website extraction failed:', error.message);
        }
      } else {
        console.log('[Pinterest Import] No external link found on pin or in description');
      }

      // FALLBACK 1: Video extraction (for video pins) - uses combined extraction
      if (!pinterestRecipe && pinterestData!.type === 'video' && videoUrl) {
        console.log('[Pinterest Import] Falling back to video extraction (combined)...');
        try {
          const extractionResult = await extractRecipeWithSegments(videoUrl, title);
          pinterestRecipe = extractionResult;
          videoSegmentsFromExtraction = extractionResult.segments;
          console.log(`[Pinterest Import] ✅ Extracted from video: ${pinterestRecipe.instructions.length} instructions, ${pinterestRecipe.ingredients.length} ingredients, ${videoSegmentsFromExtraction?.length || 0} segments`);

          // Upload to Mux for instant clipping (uses outer muxData variable)
          try {
            muxData = await uploadVideoFromUrl(videoUrl);
            console.log(`[Pinterest Import] ✅ Uploaded to Mux: ${muxData.playbackId}`);
          } catch (muxError: any) {
            console.warn('[Pinterest Import] ⚠️ Mux upload failed:', muxError.message);
          }
        } catch (error: any) {
          console.warn('[Pinterest Import] ⚠️ Video extraction failed:', error.message);
        }
      }

      // FALLBACK 2: Gemini vision on images (last resort)
      if (!pinterestRecipe) {
        console.log('[Pinterest Import] Falling back to Gemini vision on images...');
        pinterestRecipe = await extractRecipeFromPinterestImage(
          pinterestData!.imageUrls,
          description,
          title
        );
        console.log(`[Pinterest Import] ✅ Extracted from image: ${pinterestRecipe.instructions.length} instructions, ${pinterestRecipe.ingredients.length} ingredients`);
      }

      // Assign to recipe
      recipe = pinterestRecipe;
    } else if (isYouTube) {
      // YOUTUBE FLOW: Regex → GPT formatting → Video analysis (always)

      // Step 3a: Try to parse recipe from description using regex
      const parsedDescription = parseYouTubeDescription(description, title || 'Recipe');

      if (parsedDescription.hasRecipe) {
        // Recipe found in description - format with GPT-4.1-nano
        console.log('[YouTube Import] Recipe found in description, formatting with GPT-4.1-nano...');

        try {
          const formatted = await formatRecipeWithGPT(
            parsedDescription.ingredients!,
            parsedDescription.instructions!,
            parsedDescription.title!,
            {
              servings: parsedDescription.servings,
              prepTime: parsedDescription.prepTime,
              cookTime: parsedDescription.cookTime,
            }
          );

          recipe = {
            title: formatted.title,
            description: formatted.description,
            ingredients: formatted.ingredients,
            instructions: formatted.instructions,
            servings: formatted.servings,
            prep_time: formatted.prep_time,
            cook_time: formatted.cook_time,
            cuisine: formatted.cuisine,
          };

          console.log(`[YouTube Import] ✅ Formatted recipe: ${recipe.ingredients.length} ingredients, ${recipe.instructions.length} instructions`);
        } catch (error: any) {
          console.warn('[YouTube Import] ⚠️ GPT formatting failed:', error.message);
          // Use unformatted recipe as fallback
          recipe = {
            title: parsedDescription.title!,
            ingredients: parsedDescription.ingredients!,
            instructions: parsedDescription.instructions!,
            servings: parsedDescription.servings,
            prep_time: parsedDescription.prepTime,
            cook_time: parsedDescription.cookTime,
          };
        }
      } else {
        // No recipe in description - extract from video (combined extraction)
        console.log('[YouTube Import] No recipe in description, extracting from video...');

        if (!videoUrl) {
          throw new Error('No video URL available for YouTube extraction');
        }

        try {
          const extractionResult = await extractRecipeWithSegments(videoUrl, title);
          recipe = extractionResult;
          videoSegmentsFromExtraction = extractionResult.segments;
          console.log(`[YouTube Import] ✅ Extracted from video: ${recipe.instructions.length} instructions, ${recipe.ingredients.length} ingredients, ${videoSegmentsFromExtraction?.length || 0} segments`);
        } catch (error: any) {
          throw new Error(`Failed to extract recipe from YouTube video: ${error.message}`);
        }
      }
    } else {
      // INSTAGRAM FLOW: Website extraction → Video extraction → Caption parsing

      let instagramRecipe: ParsedRecipe | null = null;

      // FIRST: Check if caption contains a recipe website URL
      const captionUrls = extractUrlsFromText(description);
      if (captionUrls.length > 0) {
        console.log(`[Instagram Import] Found ${captionUrls.length} URLs in caption, trying website extraction...`);

        for (const captionUrl of captionUrls.slice(0, 3)) { // Try up to 3 URLs
          console.log(`[Instagram Import] Trying URL: ${captionUrl}`);
          try {
            const websiteRecipe = await extractRecipeFromWebsite(captionUrl, thumbnailUrl);
            if (websiteRecipe && websiteRecipe.title && websiteRecipe.ingredients?.length > 0) {
              instagramRecipe = websiteRecipe;
              console.log(`[Instagram Import] ✅ Website extraction successful: "${instagramRecipe.title}"`);
              break;
            }
          } catch (error: any) {
            console.warn(`[Instagram Import] ⚠️ Website extraction failed for ${captionUrl}:`, error.message);
          }
        }
      }

      // SECOND: Try video extraction if no recipe from website
      // Uses combined extraction to get recipe + segments in ONE API call (saves 50% cost)
      if (!instagramRecipe && downloadedVideoUrl) {
        try {
          console.log('[Instagram Import] Extracting recipe WITH segments (single API call)...');

          // Only extract title from caption if it has useful content
          // (otherwise AI makes up a title that biases video extraction)
          let captionTitle: string | undefined;
          const hasUsefulCaption = description &&
            description !== 'Instagram reel shared via DM' &&
            description.length >= 50;

          if (hasUsefulCaption) {
            try {
              const captionParse = await parseRecipeWithAI(
                description,
                [],
                ''
              );
              captionTitle = captionParse.title;
              console.log('[Instagram Import] Caption title:', captionTitle);
            } catch (error) {
              console.log('[Instagram Import] Could not extract title from caption, will use video');
            }
          } else {
            console.log('[Instagram Import] Skipping caption title extraction - caption too short or generic');
          }

          // Watch video and extract full recipe WITH segments in one call
          const extractionResult = await extractRecipeWithSegments(
            downloadedVideoUrl,
            captionTitle
          );

          // Store recipe data
          instagramRecipe = extractionResult;

          // Store segments from combined extraction
          videoSegmentsFromExtraction = extractionResult.segments;

          console.log(`[Instagram Import] ✅ Extracted from video: ${instagramRecipe.instructions.length} instructions, ${instagramRecipe.ingredients.length} ingredients, ${videoSegmentsFromExtraction?.length || 0} segments`);
        } catch (error: any) {
          console.warn('[Instagram Import] ⚠️ Video extraction failed:', error.message);
        }
      }

      // THIRD: Fallback to caption parsing (only if caption has actual recipe content)
      if (!instagramRecipe) {
        // Don't fallback for DM-shared reels with no useful caption
        const isUselessCaption = !description ||
          description === 'Instagram reel shared via DM' ||
          description.length < 50; // Too short to contain a real recipe

        if (isUselessCaption) {
          console.error('[Instagram Import] ❌ Video extraction failed and no useful caption to fallback to');
          throw new Error('Failed to extract recipe from video. Please try again or try a different video.');
        }

        console.log('[Instagram Import] Falling back to caption parsing...');
        instagramRecipe = await parseRecipeWithAI(
          description,
          [],
          ''
        );
      }

      recipe = instagramRecipe;
    }

    // Step 4: Use segments from combined extraction (no separate API call needed!)
    let videoSegments: VideoSegment[] | undefined = videoSegmentsFromExtraction;
    if (videoSegments && videoSegments.length > 0) {
      console.log(`[${platform} Import] ✅ Using ${videoSegments.length} segments from combined extraction`);
    }

    // Step 4b: Use smart thumbnail if we have thumbnailTime from Gemini
    if (muxData?.playbackId && recipe.thumbnailTime !== undefined) {
      const smartThumbnailTime = Math.round(recipe.thumbnailTime); // Ensure whole seconds
      thumbnailUrl = `https://image.mux.com/${muxData.playbackId}/thumbnail.jpg?time=${smartThumbnailTime}`;
      console.log(`[${platform} Import] 🖼️ Using smart thumbnail at ${smartThumbnailTime}s: ${thumbnailUrl}`);
    }

    // Step 5: Return combined data to frontend
    const result = {
      success: true,
      recipe: {
        // Parsed recipe data
        ...recipe,

        // Unified image URL field (works for all platforms)
        // Priority: Pinterest image > Instagram thumbnail > recipe image from website
        instagramThumbnailUrl: thumbnailUrl || recipe.imageUrl,

        // Platform-specific metadata
        ...(isPinterest ? {
          pinterestUrl: url,
          pinterestPinId: pinterestData?.pinId,
          pinterestUsername: pinterestData?.username,
          pinterestBoardName: pinterestData?.boardName,
          pinterestImageUrls: pinterestData?.imageUrls,
          pinterestThumbnailUrl: thumbnailUrl,
        } : isInstagram ? {
          instagramUrl: url,
          instagramVideoUrl: downloadedVideoUrl,
        } : {
          youtubeUrl: url,
          youtubeVideoId: videoId,
          youtubeThumbnailUrl: thumbnailUrl,
        }),

        // Mux video hosting (all platforms)
        muxPlaybackId: muxData?.playbackId,
        muxAssetId: muxData?.assetId,

        // AI-analyzed video segments for step-by-step cooking mode
        videoSegments: videoSegments,

        // Source platform
        source: isPinterest ? 'pinterest' : (isYouTube ? 'youtube' : 'instagram'),
      },
    };

    console.log(`[${platform} Import] ✅ Import completed successfully\n`);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[Video Import] ❌ Error:', error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import recipe from video',
      },
      { status: 500 }
    );
  }
}
