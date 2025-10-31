/**
 * OpenRouter AI recipe extraction using Gemini models
 * Uses OpenRouter as a proxy to access Google's Gemini models
 */

/**
 * Check if extracted recipe has complete ingredients and instructions
 */
function isRecipeComplete(recipe: any): boolean {
  const hasIngredients = recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
  const hasInstructions = recipe.instructions && Array.isArray(recipe.instructions) && recipe.instructions.length > 0;
  return hasIngredients && hasInstructions;
}

/**
 * Normalize URL for comparison (remove trailing slashes, decode URI components)
 */
function normalizeUrl(url: string): string {
  try {
    // Decode URI components
    let normalized = decodeURIComponent(url);
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    // Normalize protocol to https
    normalized = normalized.replace(/^http:/, 'https:');
    return normalized.toLowerCase();
  } catch (e) {
    // If decoding fails, just return lowercase
    return url.toLowerCase();
  }
}

/**
 * Internal helper: Try extraction with specific chunk size
 */
async function tryExtractWithSize(
  cleanedHtml: string,
  chunkSize: number,
  imageUrl: string | null | undefined,
  apiKey: string
): Promise<any> {
  const htmlSnippet = cleanedHtml.slice(0, chunkSize);

  console.log(`🔄 [OPENROUTER] Trying extraction with ${htmlSnippet.length} chars`);

  const prompt = `Extract the MAIN recipe from this HTML page. CRITICAL: Ignore sidebar recipes, related recipes, and featured recipes.

IMPORTANT: This page may contain MULTIPLE recipes in sidebars or "related recipes" sections. You MUST extract ONLY the PRIMARY recipe that this page is about, NOT sidebar content.

JSON Schema:
{
  "title": "string (recipe name)",
  "description": "string (optional, short description)",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2 with quantity", ...],
  "instructions": ["step 1", "step 2", "step 3", ...],
  "imageUrl": "${imageUrl || ''}",
  "servings": "string (e.g., '4 servings')",
  "prep_time": "string (e.g., '15 mins')",
  "cook_time": "string (e.g., '30 mins')",
  "category": "string (e.g., 'dessert', 'main', 'soup')"
}

EXTRACTION RULES:
1. Extract the MAIN recipe title (the primary recipe this page is about)
2. Ignore any recipes in sidebars, "related recipes", "you might also like", or featured content
3. List ALL ingredients with their quantities for the MAIN recipe only
4. Break instructions into clear, sequential steps for the MAIN recipe only
5. Use the provided imageUrl value
6. Extract prep time, cook time, servings if available for the MAIN recipe
7. If any field is missing, use empty string or empty array

HTML Content:
${htmlSnippet}

Return ONLY the JSON object for the MAIN recipe, no explanation or markdown code blocks.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://healthymama.app',
      'X-Title': 'HealthyMama Recipe Extractor',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`🚨 [OPENROUTER] API error (${response.status}):`, errorText);
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from OpenRouter');
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
  return parsed;
}

/**
 * Extract recipe from HTML using OpenRouter's Gemini 2.0 Flash
 * Uses progressive chunk sizing: tries small chunks first, increases on failure
 */
export async function extractRecipeWithOpenRouter(html: string, imageUrl?: string | null): Promise<any> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY environment variable is required');
  }

  console.log(`🔄 [OPENROUTER] Extracting recipe with Gemini 2.0 Flash via OpenRouter...`);
  console.log(`🔄 [OPENROUTER] Original HTML length: ${html.length} chars`);
  console.log(`🔄 [OPENROUTER] Image URL: ${imageUrl || 'none'}`);

  // Import the recipe section extractor
  const { extractRecipeSection } = await import('./recipeExtractor');

  // Progressive chunk sizes: [sectionChunkSize, geminiChunkSize]
  const chunkSizes = [
    { section: 50000, gemini: 30000, name: 'Small (30K tokens)' },
    { section: 100000, gemini: 60000, name: 'Medium (60K tokens)' },
    { section: 200000, gemini: 120000, name: 'Large (120K tokens)' },
  ];

  let lastResult: any = null;
  let lastError: Error | null = null;

  for (let i = 0; i < chunkSizes.length; i++) {
    const { section: sectionSize, gemini: geminiSize, name } = chunkSizes[i];

    try {
      console.log(`📊 [OPENROUTER] Attempt ${i + 1}/${chunkSizes.length}: ${name}`);

      // STEP 1: Extract recipe section with configurable size
      const recipeSection = extractRecipeSection(html);
      const limitedSection = recipeSection.slice(0, sectionSize);

      // STEP 2: Clean the extracted section
      let cleanedHtml = limitedSection
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // Remove styles
        .replace(/<!--[\s\S]*?-->/g, '');                  // Remove HTML comments

      console.log(`🔄 [OPENROUTER] Cleaned section: ${cleanedHtml.length} chars (${Math.round(cleanedHtml.length / html.length * 100)}% of original)`);

      // STEP 3: Try extraction with current chunk size
      const result = await tryExtractWithSize(cleanedHtml, geminiSize, imageUrl, apiKey);
      lastResult = result;

      console.log(`✅ [OPENROUTER] Successfully extracted recipe: "${result.title}"`);
      console.log(`📋 [OPENROUTER] Ingredients: ${result.ingredients?.length || 0}, Instructions: ${result.instructions?.length || 0}`);

      // Check if recipe is complete
      if (isRecipeComplete(result)) {
        console.log(`✅ [OPENROUTER] Recipe is complete! Saved tokens by using ${name}`);
        return result;
      }

      console.log(`⚠️ [OPENROUTER] Recipe incomplete (ingredients: ${result.ingredients?.length || 0}, instructions: ${result.instructions?.length || 0})`);

      // If this is the last attempt, return what we have
      if (i === chunkSizes.length - 1) {
        console.log(`⚠️ [OPENROUTER] Reached last attempt, returning incomplete recipe`);
        return result;
      }

      // Otherwise try next larger size
      console.log(`🔄 [OPENROUTER] Retrying with larger chunk size...`);

    } catch (error: any) {
      console.error(`🚨 [OPENROUTER] Attempt ${i + 1} failed:`, error.message);
      lastError = error;

      // If this is the last attempt, throw the error
      if (i === chunkSizes.length - 1) {
        throw new Error(`OpenRouter extraction failed after ${chunkSizes.length} attempts: ${error.message}`);
      }

      // Otherwise try next larger size
      console.log(`🔄 [OPENROUTER] Retrying with larger chunk size...`);
    }
  }

  // Fallback: return last result or throw last error
  if (lastResult) {
    return lastResult;
  }
  throw lastError || new Error('OpenRouter extraction failed: no result');
}

/**
 * Identify main recipe image from list of image URLs using OpenRouter's Gemini
 */
export async function identifyMainRecipeImageWithOpenRouter(imageUrls: string[]): Promise<string | null> {
  if (!imageUrls || imageUrls.length === 0) {
    console.log('🖼️ [OPENROUTER] No images provided for analysis');
    return null;
  }

  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    console.log('🖼️ [OPENROUTER] OPEN_ROUTER_API_KEY not set, using first image');
    return imageUrls[0] || null;
  }

  console.log(`🖼️ [OPENROUTER] Analyzing ${imageUrls.length} images to find main recipe image`);
  console.log(`🖼️ [OPENROUTER] Image URLs provided:`, imageUrls);

  const prompt = `You are analyzing images from a recipe webpage to identify the main recipe image.

Image URLs to analyze:
${imageUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

TASK: Identify which URL points to the main recipe image showing the finished dish.

CRITERIA:
- Look for images that show completed, prepared food/dishes
- Ignore logos, advertisements, social media icons, author photos, or generic stock photos
- Ignore small thumbnails, banners, or UI elements
- Choose the most prominent image of the actual prepared recipe/meal

RESPONSE FORMAT:
Return ONLY the complete URL of the best main recipe image.
If no suitable recipe image is found, return exactly: "none"

Example good response: https://example.com/images/finished-pasta-dish.jpg
Example bad response: none`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Recipe Extractor',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 [OPENROUTER] Image analysis error:', errorText);
      // Fallback: return first image
      return imageUrls.length > 0 ? imageUrls[0] : null;
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content.trim();

    console.log(`🖼️ [OPENROUTER] AI response: "${responseText}"`);

    // Validate the response is a URL from our list or "none"
    if (responseText === "none") {
      console.log(`🖼️ [OPENROUTER] AI returned "none", no suitable image found`);
      return null;
    }

    // Try exact match first
    if (imageUrls.includes(responseText)) {
      console.log(`✅ [OPENROUTER] Exact match found: ${responseText}`);
      return responseText;
    }

    // Try normalized URL matching
    const normalizedResponse = normalizeUrl(responseText);
    console.log(`🔍 [OPENROUTER] Trying normalized matching. Response normalized: "${normalizedResponse}"`);

    for (const url of imageUrls) {
      const normalizedUrl = normalizeUrl(url);
      console.log(`🔍 [OPENROUTER] Comparing "${normalizedResponse}" with "${normalizedUrl}"`);

      if (normalizedUrl === normalizedResponse) {
        console.log(`✅ [OPENROUTER] Normalized match found: ${url}`);
        return url;
      }
    }

    // Try partial matching as last resort
    const partialMatch = imageUrls.find(url => url.includes(responseText) || responseText.includes(url));
    if (partialMatch) {
      console.log(`⚠️ [OPENROUTER] Partial match found: ${partialMatch}`);
      return partialMatch;
    }

    // Try filename-based matching (extract filename from both and compare)
    try {
      const aiFilename = responseText.split('/').pop()?.toLowerCase() || '';
      if (aiFilename) {
        for (const url of imageUrls) {
          const urlFilename = url.split('/').pop()?.toLowerCase() || '';
          if (urlFilename && urlFilename === aiFilename) {
            console.log(`✅ [OPENROUTER] Filename match found: ${url} (matched on "${aiFilename}")`);
            return url;
          }
        }
      }
    } catch (e) {
      console.error('🚨 [OPENROUTER] Error in filename matching:', e);
    }

    // Try path suffix matching (compare last 2-3 path segments)
    try {
      const aiPathSegments = responseText.split('/').filter((s: any) => s && s !== 'http:' && s !== 'https:');
      const aiSuffix = aiPathSegments.slice(-3).join('/').toLowerCase();

      if (aiSuffix) {
        for (const url of imageUrls) {
          const urlPathSegments = url.split('/').filter(s => s && s !== 'http:' && s !== 'https:');
          const urlSuffix = urlPathSegments.slice(-3).join('/').toLowerCase();

          if (urlSuffix && urlSuffix.includes(aiSuffix) || aiSuffix.includes(urlSuffix)) {
            console.log(`✅ [OPENROUTER] Path suffix match found: ${url}`);
            return url;
          }
        }
      }
    } catch (e) {
      console.error('🚨 [OPENROUTER] Error in path suffix matching:', e);
    }

    // Fallback: return first image if available
    if (imageUrls.length > 0) {
      console.log(`⚠️ [OPENROUTER] No match found, using first image as fallback: ${imageUrls[0]}`);
      return imageUrls[0];
    }

    console.log(`❌ [OPENROUTER] No match found and no images available for AI response "${responseText}"`);
    return null;

  } catch (error: any) {
    console.error('🚨 [OPENROUTER] Image analysis error:', error);
    // Fallback: return first image if available
    return imageUrls.length > 0 ? imageUrls[0] : null;
  }
}
