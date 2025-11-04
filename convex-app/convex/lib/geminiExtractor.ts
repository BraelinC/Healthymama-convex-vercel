/**
 * Gemini AI recipe extraction
 * Ported from server/services/geminiVision.js
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Extract recipe from HTML using Gemini AI
 */
export async function extractRecipeWithGemini(html: string, imageUrl?: string | null): Promise<any> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is required');
  }

  console.log(`🧠 [GEMINI] Extracting recipe with Gemini AI...`);
  console.log(`🧠 [GEMINI] HTML length: ${html.length} chars`);
  console.log(`🧠 [GEMINI] Image URL: ${imageUrl || 'none'}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = `Extract the recipe from this HTML content. Return ONLY valid JSON with no markdown formatting.

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
1. Extract the main recipe title
2. List ALL ingredients with their quantities (e.g., "2 cups flour", "1 tbsp salt")
3. Break instructions into clear, sequential steps
4. Use the provided imageUrl value
5. Extract prep time, cook time, servings if available
6. If any field is missing, use empty string or empty array

HTML Content (first 8000 characters):
${html.slice(0, 8000)}

Return ONLY the JSON object, no explanation or markdown code blocks.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    console.log(`🧠 [GEMINI] Response length: ${text.length} chars`);

    // Remove markdown code blocks if present
    let jsonText = text;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const parsed = JSON.parse(jsonText);

    console.log(`✅ [GEMINI] Successfully extracted recipe: "${parsed.title}"`);
    console.log(`📋 [GEMINI] Ingredients: ${parsed.ingredients?.length || 0}, Instructions: ${parsed.instructions?.length || 0}`);

    return parsed;

  } catch (error: any) {
    console.error(`🚨 [GEMINI] Extraction error:`, error);
    throw new Error(`Gemini extraction failed: ${error.message}`);
  }
}

/**
 * Identify main recipe image from list of image URLs using Gemini
 */
export async function identifyMainRecipeImage(imageUrls: string[]): Promise<string | null> {
  if (!imageUrls || imageUrls.length === 0) {
    console.log('🖼️ [GEMINI] No images provided for analysis');
    return null;
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.log('🖼️ [GEMINI] GOOGLE_AI_API_KEY not set, using first image');
    return imageUrls[0] || null;
  }

  console.log(`🖼️ [GEMINI] Analyzing ${imageUrls.length} images to find main recipe image`);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    console.log(`🖼️ [GEMINI] Identified main image: ${response}`);

    // Validate the response is a URL from our list or "none"
    if (response === "none") {
      return null;
    }

    if (imageUrls.includes(response)) {
      return response;
    }

    // If response doesn't match exactly, try to find a partial match
    const matchedUrl = imageUrls.find(url => url.includes(response) || response.includes(url));
    return matchedUrl || null;

  } catch (error: any) {
    console.error('🚨 [GEMINI] Image analysis error:', error);
    // Fallback: return first image if available
    return imageUrls.length > 0 ? imageUrls[0] : null;
  }
}
