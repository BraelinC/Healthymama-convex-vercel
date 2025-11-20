/**
 * Instagram Recipe Import API Route (Next.js Backend)
 *
 * This API route orchestrates the Instagram recipe import process by coordinating
 * between the Railway Python service (Instagram extraction) and OpenRouter AI (recipe parsing).
 *
 * Architecture Flow:
 * 1. Frontend sends Instagram URL to this endpoint
 * 2. We call Railway Python service to extract Instagram data (caption, comments, video)
 * 3. We send that data to OpenRouter AI (Gemini 2.0 Flash) for recipe parsing
 * 4. We return the formatted recipe JSON back to frontend for preview/save
 *
 * Why This Design?:
 * - Railway handles Instagram extraction (requires Python's instagrapi library)
 * - Next.js handles AI parsing (reuses existing OpenRouter integration & retry logic)
 * - Separation of concerns: Instagram scraping vs AI processing
 * - Lower latency: AI processing happens in Vercel (closer to OpenRouter servers)
 * - Better error handling: Can retry AI parsing without re-fetching Instagram data
 *
 * Environment Variables Used:
 * - NEXT_PUBLIC_RAILWAY_INSTAGRAM_URL: Railway service endpoint
 * - OPEN_ROUTER_API_KEY: OpenRouter API key for AI parsing
 *
 * Error Handling:
 * - Network errors (Railway service down)
 * - Instagram errors (private account, deleted post)
 * - AI parsing errors (invalid JSON, missing fields)
 * - All errors return 500 with descriptive message
 */

import { NextRequest, NextResponse } from 'next/server';

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
}

/**
 * Step 1: Extract Instagram data from Railway Python service
 *
 * Calls the Railway microservice to fetch Instagram reel data using instagrapi.
 * The Railway service handles Instagram authentication and API access.
 *
 * @param url - Instagram reel URL (e.g., https://www.instagram.com/reel/ABC123/)
 * @returns Promise<InstagramExtractionResult> - Caption, comments, video URLs
 * @throws Error if Railway service is unreachable or Instagram fetch fails
 *
 * Railway Service Response:
 * {
 *   success: true,
 *   caption: "Recipe text...",
 *   comments: ["comment 1", "comment 2"],
 *   videoUrl: "https://...",
 *   thumbnailUrl: "https://...",
 *   username: "creator_username"
 * }
 */
async function extractInstagramData(url: string): Promise<InstagramExtractionResult> {
  const railwayUrl = process.env.NEXT_PUBLIC_RAILWAY_INSTAGRAM_URL;

  if (!railwayUrl) {
    throw new Error('Railway Instagram service URL not configured (NEXT_PUBLIC_RAILWAY_INSTAGRAM_URL)');
  }

  console.log(`[Instagram Import] Calling Railway service: ${railwayUrl}/extract-instagram`);

  const response = await fetch(`${railwayUrl}/extract-instagram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Railway service error: ${errorData.error || response.statusText}`);
  }

  const data: InstagramExtractionResult = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to extract Instagram data');
  }

  console.log(`[Instagram Import] ✅ Extracted data from @${data.username}`);

  return data;
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
 * - Same model used in openRouterExtractor.ts (proven reliability)
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
      model: 'google/gemini-2.0-flash-001', // Fast and cheap, same as openRouterExtractor
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

  return parsed;
}

/**
 * Main API route handler
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid Instagram URL' },
        { status: 400 }
      );
    }

    // Validate Instagram URL
    if (!url.includes('instagram.com')) {
      return NextResponse.json(
        { error: 'Invalid Instagram URL (must contain instagram.com)' },
        { status: 400 }
      );
    }

    console.log(`\n[Instagram Import] Starting import for: ${url}`);

    // Step 1: Extract Instagram data from Railway service
    const instagramData = await extractInstagramData(url);

    // Step 2: Parse recipe with AI
    const recipe = await parseRecipeWithAI(
      instagramData.caption,
      instagramData.comments,
      instagramData.username
    );

    // Step 3: Return combined data to frontend
    const result = {
      success: true,
      recipe: {
        // Parsed recipe data
        ...recipe,

        // Instagram metadata
        instagramUrl: instagramData.postUrl,
        instagramVideoUrl: instagramData.videoUrl,
        instagramThumbnailUrl: instagramData.thumbnailUrl,
        instagramUsername: instagramData.username,
      },
    };

    console.log(`[Instagram Import] ✅ Import completed successfully\n`);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[Instagram Import] ❌ Error:', error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to import Instagram recipe',
      },
      { status: 500 }
    );
  }
}
