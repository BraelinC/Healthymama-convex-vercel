/**
 * Recipe Image Identification using AI
 * Fetches image from Convex storage and identifies dish with OpenRouter
 */

import { v } from "convex/values";
import { action } from "./_generated/server";

export const identifyRecipeFromImage = action({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get the image URL from Convex storage
    const imageUrl = await ctx.storage.getUrl(args.storageId);

    if (!imageUrl) {
      throw new Error("Failed to get image URL from storage");
    }

    console.log("[Recipe Identify] Fetching image from:", imageUrl);

    // Fetch the image from Convex storage
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    // Convert to base64
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    console.log("[Recipe Identify] Image size:", Math.round(arrayBuffer.byteLength / 1024), "KB");

    // Call OpenRouter API
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OpenRouter API key not configured");
    }

    const prompt = `Identify this food dish. Return ONLY a JSON object with:
1. The name of the dish
2. The main ingredients visible or typically used in this dish

Return ONLY this JSON format (no markdown, no extra text):
{
  "dishName": "Name of the dish",
  "ingredients": ["ingredient1", "ingredient2", "ingredient3", ...]
}

IMPORTANT:
- Return ingredient names ONLY (no amounts or measurements)
- Do NOT provide instructions
- Keep ingredients to the essential ones (5-15 ingredients typically)
- If you cannot identify the dish, return {"dishName": "Unknown Dish", "ingredients": []}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Recipe Identification',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Recipe Identify] OpenRouter error:', response.status, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from AI service');
    }

    const text = data.choices[0].message.content.trim();
    console.log('[Recipe Identify] AI response:', text.substring(0, 200));

    // Parse JSON response
    const result = parseIdentificationJSON(text);

    if (!result) {
      throw new Error('Could not parse AI response');
    }

    console.log('[Recipe Identify] Identified:', result.dishName, 'with', result.ingredients.length, 'ingredients');

    return {
      success: true,
      dishName: result.dishName,
      ingredients: result.ingredients,
    };
  },
});

/**
 * Parse identification JSON from AI response
 */
function parseIdentificationJSON(text: string): { dishName: string; ingredients: string[] } | null {
  try {
    let jsonText = text.trim();

    // Remove markdown code blocks
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    // Extract JSON object
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      console.error('[Recipe Identify] No JSON braces found');
      return null;
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);

    const parsed = JSON.parse(jsonText);

    // Validate required fields
    if (!parsed.dishName) {
      console.error('[Recipe Identify] Missing dishName');
      return null;
    }

    // Ensure ingredients is an array
    let ingredients = parsed.ingredients || [];
    if (!Array.isArray(ingredients)) {
      ingredients = [ingredients];
    }

    // Clean up ingredient names
    ingredients = ingredients.map((ing: string) => {
      return ing.replace(/^[\d\s\/½¼¾⅓⅔⅛]+\s*(cups?|tbsp|tsp|oz|lbs?|g|ml|pieces?|cloves?|slices?)?\s*/i, '').trim();
    }).filter((ing: string) => ing.length > 0);

    return {
      dishName: parsed.dishName,
      ingredients,
    };

  } catch (error: any) {
    console.error('[Recipe Identify] JSON parse error:', error);
    return null;
  }
}
