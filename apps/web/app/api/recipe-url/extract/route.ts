/**
 * Recipe URL Extraction API Route
 *
 * Extracts recipes from any recipe website URL using multiple methods:
 * 1. JSON-LD extraction (fastest, most reliable)
 * 2. Gemini AI extraction from HTML
 * 3. Puppeteer fallback for JavaScript-rendered pages
 * 4. Gemini Vision on screenshots (for complex React/JS sites)
 *
 * POST /api/recipe-url/extract
 * Body: { url: string }
 * Returns: { success: boolean, recipe: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@healthymama/convex';
import {
  extractJsonLdFromHtml,
  validateRecipeCompleteness,
  transformJsonLdRecipe,
} from '@healthymama/convex/lib/recipeExtractor';
import { extractRecipeWithOpenRouter } from '@healthymama/convex/lib/openRouterExtractor';

// Initialize Convex client for blocklist updates
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Allow up to 60 seconds for extraction
export const maxDuration = 60;

interface ParsedRecipe {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  imageUrl?: string;
}

/**
 * Extract recipe from multiple screenshots using Gemini 2.5 Flash Vision
 */
async function extractRecipeFromScreenshots(screenshots: string[]): Promise<ParsedRecipe | null> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  console.log(`[Screenshot Extraction] Sending ${screenshots.length} screenshots to Gemini 2.5 Flash...`);

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
- Include ALL measurements and quantities exactly as shown

If this is NOT a recipe page, return:
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

  screenshots.forEach((screenshot) => {
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
      'X-Title': 'HealthyMama Recipe URL Extraction',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Screenshot Extraction] API error (${response.status}):`, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response format from Gemini');
  }

  let jsonText = data.choices[0].message.content.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '').trim();
  }

  const parsed = JSON.parse(jsonText);

  if (parsed.error) {
    console.warn(`[Screenshot Extraction] Not a recipe page: ${parsed.reason}`);
    return null;
  }

  if (!parsed.title || !parsed.ingredients || !parsed.instructions) {
    return null;
  }

  console.log(`[Screenshot Extraction] ✅ Extracted: "${parsed.title}"`);
  return parsed;
}

/**
 * Main extraction logic - tries multiple methods
 */
async function extractRecipeFromUrl(url: string): Promise<ParsedRecipe | null> {
  console.log(`[Recipe URL] Starting extraction for: ${url}`);

  let mainImageUrl: string | undefined;

  try {
    // METHOD 1: Direct fetch + JSON-LD extraction
    console.log('[Recipe URL] METHOD 1: Trying JSON-LD extraction...');

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorMessage = `Website returned ${response.status}`;

      // If 403 Forbidden, record domain to blocklist
      if (response.status === 403) {
        console.log(`[Recipe URL] 403 Forbidden - Adding ${url} to blocklist`);
        try {
          await convex.mutation(api.blocklist.blockedDomains.recordDomainBlock, {
            url,
            errorMessage: '403 Forbidden - Anti-bot protection detected',
          });
        } catch (blocklistError) {
          console.error('[Recipe URL] Failed to update blocklist:', blocklistError);
          // Don't fail extraction if blocklist update fails
        }
      }

      throw new Error(errorMessage);
    }

    const html = await response.text();
    console.log(`[Recipe URL] Fetched ${html.length} chars of HTML`);

    // Try JSON-LD
    const jsonLdRecipe = extractJsonLdFromHtml(html);
    if (jsonLdRecipe) {
      const validation = validateRecipeCompleteness(jsonLdRecipe);
      if (validation.isComplete) {
        console.log('[Recipe URL] ✅ JSON-LD extraction successful!');
        const transformed = transformJsonLdRecipe(jsonLdRecipe);
        return {
          title: transformed.title,
          description: transformed.description,
          ingredients: transformed.ingredients,
          instructions: transformed.instructions,
          servings: transformed.servings,
          prep_time: transformed.prep_time,
          cook_time: transformed.cook_time,
          cuisine: transformed.category,
          imageUrl: transformed.imageUrl,
        };
      }
      console.log(`[Recipe URL] JSON-LD incomplete: ${validation.reason}`);
    }

    // METHOD 2: Gemini AI extraction from HTML
    console.log('[Recipe URL] METHOD 2: Trying Gemini AI extraction...');

    try {
      const geminiRecipe = await extractRecipeWithOpenRouter(html, mainImageUrl);
      if (geminiRecipe?.title && geminiRecipe?.ingredients?.length > 0 && geminiRecipe?.instructions?.length > 0) {
        console.log('[Recipe URL] ✅ Gemini extraction successful!');
        return {
          title: geminiRecipe.title,
          description: geminiRecipe.description || '',
          ingredients: geminiRecipe.ingredients,
          instructions: geminiRecipe.instructions,
          servings: geminiRecipe.servings,
          prep_time: geminiRecipe.prep_time,
          cook_time: geminiRecipe.cook_time,
          cuisine: geminiRecipe.category,
          imageUrl: geminiRecipe.imageUrl,
        };
      }
    } catch (error: any) {
      console.warn('[Recipe URL] Gemini extraction failed:', error.message);
    }

    // METHOD 3: Puppeteer fallback
    console.log('[Recipe URL] METHOD 3: Trying Puppeteer fallback...');

    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const puppeteerResponse = await fetch(`${baseUrl}/api/scrape-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(45000),
      });

      if (puppeteerResponse.ok) {
        const puppeteerData = await puppeteerResponse.json();

        // Check Puppeteer JSON-LD
        if (puppeteerData.jsonLdData) {
          const validation = validateRecipeCompleteness(puppeteerData.jsonLdData);
          if (validation.isComplete) {
            console.log('[Recipe URL] ✅ Puppeteer JSON-LD extraction successful!');
            const transformed = transformJsonLdRecipe(puppeteerData.jsonLdData);
            return {
              title: transformed.title,
              description: transformed.description,
              ingredients: transformed.ingredients,
              instructions: transformed.instructions,
              servings: transformed.servings,
              prep_time: transformed.prep_time,
              cook_time: transformed.cook_time,
              cuisine: transformed.category,
              imageUrl: transformed.imageUrl || puppeteerData.imageUrls?.[0],
            };
          }
        }

        // Try Gemini on Puppeteer HTML
        if (puppeteerData.html) {
          const geminiRecipe = await extractRecipeWithOpenRouter(
            puppeteerData.html,
            puppeteerData.imageUrls?.[0]
          );
          if (geminiRecipe?.title && geminiRecipe?.ingredients?.length > 0) {
            console.log('[Recipe URL] ✅ Puppeteer + Gemini extraction successful!');
            return {
              title: geminiRecipe.title,
              description: geminiRecipe.description || '',
              ingredients: geminiRecipe.ingredients,
              instructions: geminiRecipe.instructions,
              servings: geminiRecipe.servings,
              prep_time: geminiRecipe.prep_time,
              cook_time: geminiRecipe.cook_time,
              cuisine: geminiRecipe.category,
              imageUrl: geminiRecipe.imageUrl || puppeteerData.imageUrls?.[0],
            };
          }
        }

        // METHOD 4: Vision on screenshots
        if (puppeteerData.screenshots?.length > 0) {
          console.log(`[Recipe URL] METHOD 4: Trying Vision on ${puppeteerData.screenshots.length} screenshots...`);
          try {
            const visionRecipe = await extractRecipeFromScreenshots(puppeteerData.screenshots);
            if (visionRecipe?.title && visionRecipe?.ingredients?.length > 0) {
              console.log('[Recipe URL] ✅ Vision extraction successful!');
              return {
                ...visionRecipe,
                imageUrl: puppeteerData.imageUrls?.[0],
              };
            }
          } catch (visionError: any) {
            console.warn('[Recipe URL] Vision extraction failed:', visionError.message);
          }
        }
      }
    } catch (error: any) {
      console.warn('[Recipe URL] Puppeteer fallback failed:', error.message);
    }

    console.log('[Recipe URL] ❌ All methods failed');
    return null;
  } catch (error: any) {
    console.error('[Recipe URL] Fatal error:', error.message);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Log auth debug info
    const authHeader = request.headers.get('Authorization');
    console.log('[Recipe URL Extract] Auth header present:', !!authHeader);
    console.log('[Recipe URL Extract] Auth header starts with Bearer:', authHeader?.startsWith('Bearer '));

    // Validate authentication
    const authResult = await auth();
    console.log('[Recipe URL Extract] Auth result:', { userId: authResult.userId, sessionId: authResult.sessionId });

    const { userId } = authResult;
    if (!userId) {
      console.log('[Recipe URL Extract] No userId - returning 401');
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid URL' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`[Recipe URL Extract] Starting extraction for: ${url}`);

    const recipe = await extractRecipeFromUrl(url);

    if (!recipe) {
      return NextResponse.json(
        { success: false, error: 'Could not extract recipe from this URL' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      recipe: {
        ...recipe,
        sourceUrl: url,
      },
    });
  } catch (error: any) {
    console.error('[Recipe URL Extract] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to extract recipe' },
      { status: 500 }
    );
  }
}
