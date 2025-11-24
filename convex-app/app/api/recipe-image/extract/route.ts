import { NextResponse } from 'next/server';

/**
 * API Route: Extract recipe from uploaded image
 *
 * Uses Google's Gemini 2.5 Flash via OpenRouter to analyze:
 * - Photos of food dishes (generates estimated recipe)
 * - Recipe screenshots (extracts visible text)
 *
 * POST /api/recipe-image/extract
 * Body: FormData with 'image' file and optional 'context' text
 */

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const context = formData.get('context') as string | null;

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

    console.log('[Recipe Image] Processing image:', imageFile.name, 'Size:', Math.round(imageFile.size / 1024), 'KB');
    if (context) {
      console.log('[Recipe Image] User context:', context);
    }

    // Build the prompt
    const prompt = buildExtractionPrompt(context);

    // Call OpenRouter with Gemini 2.5 Flash
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Recipe Image Extraction',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview-05-20', // Gemini 2.5 Flash as requested
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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Recipe Image] API error:', response.status, errorText);
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

    // Parse JSON response
    const recipe = parseRecipeJSON(text);

    if (!recipe) {
      return NextResponse.json(
        { error: 'Could not extract recipe from image. Please try a clearer image or add more context.' },
        { status: 422 }
      );
    }

    console.log('[Recipe Image] Extracted recipe:', recipe.title);

    return NextResponse.json({
      success: true,
      recipe: {
        title: recipe.title || 'Untitled Recipe',
        description: recipe.description || '',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings || '',
        prep_time: recipe.prep_time || '',
        cook_time: recipe.cook_time || '',
        cuisine: recipe.cuisine || '',
        diet: recipe.diet || '',
        // Note: imageUrl will be the uploaded image, handled by frontend
      },
    });

  } catch (error: any) {
    console.error('[Recipe Image] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process image' },
      { status: 500 }
    );
  }
}

/**
 * Build the extraction prompt based on whether user provided context
 */
function buildExtractionPrompt(context?: string | null): string {
  const basePrompt = `You are a recipe extraction expert. Analyze this image and extract recipe information.

IMAGE TYPE DETECTION:
1. **Recipe Screenshot/Text**: If the image contains written recipe text (ingredients list, instructions, etc.), extract ALL visible text accurately
2. **Food Photo**: If it's a photo of a prepared dish, identify the dish and provide a reasonable recipe to recreate it

${context ? `USER CONTEXT: "${context}"\nUse this information to better understand what dish this is or to fill in details.` : ''}

EXTRACTION RULES:
- Extract ONLY what you can see or reasonably infer from the image
- For recipe screenshots: Copy text exactly as shown
- For food photos: Identify the dish and provide standard recipe
- Include specific quantities for ingredients when visible
- Write clear, numbered instructions
- Estimate prep/cook times based on the dish complexity

IMPORTANT: Only extract visible/inferable information. The user will edit the recipe afterward to add missing details.

Return ONLY this JSON (no markdown, no extra text):
{
  "title": "Recipe Name",
  "description": "Brief one-sentence description of the dish",
  "ingredients": ["1 cup flour", "2 eggs", "..."],
  "instructions": ["Step 1: Preheat oven to 350°F", "Step 2: Mix dry ingredients", "..."],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "American",
  "diet": "vegetarian or none if not applicable"
}`;

  return basePrompt;
}

/**
 * Parse recipe JSON from AI response
 */
function parseRecipeJSON(text: string): any | null {
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
      console.error('[Recipe Image] No JSON found in response');
      return null;
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    const recipe = JSON.parse(jsonText);

    // Validate required fields
    if (!recipe.title && !recipe.ingredients && !recipe.instructions) {
      console.error('[Recipe Image] Missing required fields');
      return null;
    }

    // Ensure arrays
    if (!Array.isArray(recipe.ingredients)) {
      recipe.ingredients = recipe.ingredients ? [recipe.ingredients] : [];
    }
    if (!Array.isArray(recipe.instructions)) {
      recipe.instructions = recipe.instructions ? [recipe.instructions] : [];
    }

    return recipe;

  } catch (error) {
    console.error('[Recipe Image] JSON parse error:', error);
    return null;
  }
}
