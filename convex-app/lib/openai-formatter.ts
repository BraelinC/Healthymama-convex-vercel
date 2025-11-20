/**
 * OpenAI Recipe Formatter
 *
 * Uses GPT-4.1-Nano via OpenRouter to format and clean up raw recipe data
 * extracted from YouTube descriptions via regex.
 *
 * This is a lightweight formatting layer that:
 * - Standardizes ingredient quantities (1 cup, 2 tbsp, etc.)
 * - Cleans up instruction text (clear, actionable steps)
 * - Extracts metadata (servings, prep/cook time)
 * - Returns structured JSON for database storage
 *
 * Model: openai/gpt-4.1-nano (ultra-cheap, fast formatting)
 * API: OpenRouter (unified AI gateway)
 */

export interface FormattedRecipe {
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
 * Format raw recipe data with GPT-4.1-Nano
 *
 * Takes regex-extracted ingredients and instructions from YouTube descriptions
 * and formats them into a clean, standardized recipe structure.
 *
 * @param rawIngredients - Array of ingredient strings from regex extraction
 * @param rawInstructions - Array of instruction strings from regex extraction
 * @param title - Video title
 * @param metadata - Optional metadata (servings, prep/cook time)
 * @returns Formatted recipe with clean, standardized data
 */
export async function formatRecipeWithGPT(
  rawIngredients: string[],
  rawInstructions: string[],
  title: string,
  metadata?: {
    servings?: string;
    prepTime?: string;
    cookTime?: string;
  }
): Promise<FormattedRecipe> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY not configured');
  }

  console.log('[OpenAI Formatter] Formatting recipe with GPT-4.1-Nano...');
  console.log(`[OpenAI Formatter] Input: ${rawIngredients.length} ingredients, ${rawInstructions.length} instructions`);

  // Build formatting prompt
  const prompt = `You are a recipe formatting expert. Clean and standardize this YouTube recipe.

Title: ${title}

Raw Ingredients (from YouTube description):
${rawIngredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Raw Instructions (from YouTube description):
${rawInstructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

${metadata?.servings ? `Servings: ${metadata.servings}` : ''}
${metadata?.prepTime ? `Prep Time: ${metadata.prepTime}` : ''}
${metadata?.cookTime ? `Cook Time: ${metadata.cookTime}` : ''}

FORMATTING RULES:
1. **Ingredients**: Parse quantities properly
   - Convert to standard units (cups, tbsp, tsp, oz, lbs, grams)
   - Ensure each ingredient has quantity + unit + item name
   - Example: "2 cups all-purpose flour" not "flour (2 cups)"

2. **Instructions**: Make each step clear and actionable
   - Start with action verbs (Preheat, Mix, Add, Cook, etc.)
   - Be specific about timing and temperature
   - Keep numbered order

3. **Metadata**: Extract or infer if not provided
   - Servings (e.g., "4 servings", "Makes 12 cookies")
   - Prep time (e.g., "15 minutes", "30 mins")
   - Cook time (e.g., "45 minutes", "1 hour")
   - Cuisine type if obvious from title/ingredients

4. **Description**: Write ONE sentence describing the dish

Return ONLY this JSON (no markdown, no code blocks, no explanations):
{
  "title": "Recipe Name",
  "description": "One sentence description",
  "ingredients": ["2 cups flour", "1 tsp salt", ...],
  "instructions": ["Preheat oven to 350°F", "Mix dry ingredients", ...],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian"
}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Recipe Formatter',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-nano', // Ultra-cheap formatting model
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2, // Low temperature for consistent formatting
        max_completion_tokens: 1500, // Plenty for most recipes
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenAI Formatter] API error (${response.status}):`, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }

    const text = data.choices[0].message.content.trim();

    console.log('[OpenAI Formatter] Raw response:', text.substring(0, 200) + '...');

    // Parse JSON response (robust extraction)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    // Extract JSON object (find first { and last })
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);

    const formatted: FormattedRecipe = JSON.parse(jsonText);

    // Validate required fields
    if (!formatted.title || !formatted.ingredients || !formatted.instructions) {
      throw new Error('Invalid recipe format: missing required fields');
    }

    console.log(`[OpenAI Formatter] ✅ Formatted: ${formatted.ingredients.length} ingredients, ${formatted.instructions.length} instructions`);

    return formatted;
  } catch (error: any) {
    console.error('[OpenAI Formatter] Formatting failed:', error.message);
    throw new Error(`Recipe formatting failed: ${error.message}`);
  }
}
