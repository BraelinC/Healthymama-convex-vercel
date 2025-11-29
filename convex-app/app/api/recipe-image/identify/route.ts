import { NextResponse } from 'next/server';

/**
 * API Route: Identify dish and ingredients from image (lightweight)
 *
 * Uses Google's Gemini 2.5 Flash via OpenRouter for quick identification.
 * Returns only dish name and ingredient list (no instructions/amounts).
 * This is a faster, cheaper call than full extraction.
 *
 * POST /api/recipe-image/identify
 * Body: FormData with 'image' file
 * Returns: { dishName: string, ingredients: string[] }
 */

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid image type. Supported: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const dataUrl = `data:${imageFile.type};base64,${base64Image}`;

    console.log('[Recipe Identify] Processing image:', imageFile.name, 'Size:', Math.round(imageFile.size / 1024), 'KB');

    // Lightweight prompt - only identify dish and ingredients
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

    // Call OpenRouter with Gemini 2.5 Flash
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
        temperature: 0.2, // Lower temp for more consistent identification
        max_tokens: 500, // Limit tokens since we only need dish name + ingredients
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Recipe Identify] API error:', response.status, errorText);
      return NextResponse.json(
        { error: `AI service error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      return NextResponse.json(
        { error: 'Invalid response from AI service' },
        { status: 502 }
      );
    }

    const text = data.choices[0].message.content.trim();

    console.log('[Recipe Identify] AI response text:', text.substring(0, 200)); // Log first 200 chars

    // Parse JSON response
    const result = parseIdentificationJSON(text);

    if (!result) {
      console.error('[Recipe Identify] Failed to parse response:', text);
      return NextResponse.json(
        { error: 'Could not identify dish from image. The AI returned an invalid response. Please try again.' },
        { status: 422 }
      );
    }

    console.log('[Recipe Identify] Identified dish:', result.dishName, 'with', result.ingredients.length, 'ingredients');

    return NextResponse.json({
      success: true,
      dishName: result.dishName,
      ingredients: result.ingredients,
    });

  } catch (error: any) {
    console.error('[Recipe Identify] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to identify dish' },
      { status: 500 }
    );
  }
}

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

    // Extract JSON object - find the FIRST { and LAST }
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      console.error('[Recipe Identify] No JSON braces found in response:', jsonText.substring(0, 100));
      return null;
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);

    console.log('[Recipe Identify] Extracted JSON string:', jsonText);

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

    // Clean up ingredient names (remove any amounts that slipped through)
    ingredients = ingredients.map((ing: string) => {
      // Remove common amount patterns at the start
      return ing.replace(/^[\d\s\/½¼¾⅓⅔⅛]+\s*(cups?|tbsp|tsp|oz|lbs?|g|ml|pieces?|cloves?|slices?)?\s*/i, '').trim();
    }).filter((ing: string) => ing.length > 0);

    return {
      dishName: parsed.dishName,
      ingredients,
    };

  } catch (error: any) {
    console.error('[Recipe Identify] JSON parse error:', error);
    console.error('[Recipe Identify] Failed to parse text:', text);

    // If AI returned a refusal or error message instead of JSON
    if (text.toLowerCase().includes('request') ||
        text.toLowerCase().includes('sorry') ||
        text.toLowerCase().includes('cannot') ||
        text.toLowerCase().includes('unable')) {
      console.error('[Recipe Identify] AI refused the request:', text);
    }

    return null;
  }
}
