/**
 * Recipe extraction utilities - pure TypeScript (no browser needed)
 * Ported from server/services/webScraper.js
 */

/**
 * Extract JSON-LD structured recipe data from HTML
 */
export function extractJsonLdFromHtml(html: string): any | null {
  console.log('🔍 [JSON-LD] Searching for JSON-LD recipe schema in HTML...');

  // Find all JSON-LD script tags
  const scriptRegex = /<script type="application\/ld\+json">(.*?)<\/script>/gis;
  const matches = [...html.matchAll(scriptRegex)];

  console.log(`📋 [JSON-LD] Found ${matches.length} JSON-LD script tags`);

  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);

      // Handle single objects or arrays
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Check if it's a recipe schema
        if (item['@type'] === 'Recipe') {
          console.log(`✅ [JSON-LD] Found Recipe schema: ${item.name || 'Untitled'}`);
          return item;
        }

        // Check for @graph containing Recipe
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          const recipe = item['@graph'].find(g => g['@type'] === 'Recipe');
          if (recipe) {
            console.log(`✅ [JSON-LD] Found Recipe in @graph: ${recipe.name || 'Untitled'}`);
            return recipe;
          }
        }
      }
    } catch (e) {
      console.log(`⚠️ [JSON-LD] Failed to parse JSON-LD: ${e}`);
      continue;
    }
  }

  console.log(`❌ [JSON-LD] No Recipe schema found`);
  return null;
}

/**
 * Validate if JSON-LD recipe data is complete
 */
export function validateRecipeCompleteness(recipeData: any): { isComplete: boolean; reason?: string } {
  if (!recipeData) {
    return { isComplete: false, reason: 'No recipe data provided' };
  }

  const hasName = recipeData.name && recipeData.name.trim().length > 0;
  const hasIngredients = recipeData.recipeIngredient && Array.isArray(recipeData.recipeIngredient) && recipeData.recipeIngredient.length > 0;
  const hasInstructions = recipeData.recipeInstructions && Array.isArray(recipeData.recipeInstructions) && recipeData.recipeInstructions.length > 0;

  if (!hasName) {
    return { isComplete: false, reason: 'Missing recipe name' };
  }

  if (!hasIngredients) {
    return { isComplete: false, reason: 'Missing ingredients list' };
  }

  if (!hasInstructions) {
    return { isComplete: false, reason: 'Missing instructions' };
  }

  console.log(`✅ [JSON-LD] Recipe data is complete`);
  return { isComplete: true };
}

/**
 * Transform JSON-LD Recipe schema to our format
 */
export function transformJsonLdRecipe(jsonLdRecipe: any, mainImageUrl?: string | null): any {
  const ingredients = jsonLdRecipe.recipeIngredient || [];
  const instructions = jsonLdRecipe.recipeInstructions || [];

  // Extract instruction text (handle different instruction formats)
  const instructionTexts = instructions.map((instruction: any) => {
    if (typeof instruction === 'string') return instruction;
    if (instruction.text) return instruction.text;
    if (instruction.name) return instruction.name;
    return String(instruction);
  });

  // Extract image URL
  let imageUrl = mainImageUrl;
  if (!imageUrl && jsonLdRecipe.image) {
    if (Array.isArray(jsonLdRecipe.image)) {
      imageUrl = jsonLdRecipe.image[0]?.url || jsonLdRecipe.image[0];
    } else if (typeof jsonLdRecipe.image === 'object') {
      imageUrl = jsonLdRecipe.image.url;
    } else {
      imageUrl = jsonLdRecipe.image;
    }
  }

  console.log(`📋 [JSON-LD] Transformed recipe: "${jsonLdRecipe.name}"`);
  console.log(`📋 [JSON-LD] Ingredients: ${ingredients.length}, Instructions: ${instructionTexts.length}`);

  return {
    title: jsonLdRecipe.name || 'Untitled Recipe',
    description: jsonLdRecipe.description || '',
    imageUrl: imageUrl || null,
    ingredients: ingredients,
    instructions: instructionTexts,
    servings: jsonLdRecipe.recipeYield ? String(jsonLdRecipe.recipeYield) : undefined,
    prep_time: jsonLdRecipe.prepTime || undefined,
    cook_time: jsonLdRecipe.cookTime || undefined,
    category: jsonLdRecipe.recipeCategory || jsonLdRecipe.recipeCuisine || undefined,
  };
}

/**
 * Extract image URLs from HTML using regex
 */
export function extractImageUrls(html: string): string[] {
  console.log('🖼️ [IMAGES] Extracting image URLs from HTML...');

  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(imgRegex)];

  const imageUrls = matches
    .map(m => m[1])
    .filter(url => {
      // Must be absolute URL
      if (!url.startsWith('http')) return false;

      // Filter out common non-recipe images (generic patterns for ANY blog site)
      const lowerUrl = url.toLowerCase();
      const excludePatterns = [
        'logo', 'icon', 'avatar', 'profile', 'social', 'share',
        'ad', 'banner', 'footer', 'header',
        'sidebar',     // Exclude sidebar images
        'author',      // Exclude author photos
        'writer',      // Exclude writer photos
        'editor',      // Exclude editor photos
        'contributor', // Exclude contributor photos
        'headshot',    // Exclude headshots
        'bio',         // Exclude bio images
        'cta',         // Exclude call-to-action images
        'promo',       // Exclude promotional images
        'ebook',       // Exclude ebook promo images
        'subscribe',   // Exclude subscription graphics
        'newsletter',  // Exclude newsletter graphics
        'widget',      // Exclude widget images
        'badge',       // Exclude badge images
        'button',      // Exclude button images
      ];

      return !excludePatterns.some(pattern => lowerUrl.includes(pattern));
    })
    .slice(0, 15); // Limit to 15 images

  console.log(`🖼️ [IMAGES] Found ${imageUrls.length} potential recipe images`);

  if (imageUrls.length === 0) {
    console.log('⚠️ [IMAGES] No recipe images found after filtering. This may indicate sidebar/author images were the only images on the page.');
  }

  return imageUrls;
}

/**
 * Extract the recipe section from HTML by searching for common recipe containers
 * This minimizes tokens sent to AI by extracting only relevant content
 * Uses regex to FIND position + slice() to EXTRACT (avoids nested div issues)
 */
export function extractRecipeSection(html: string): string {
  console.log('🎯 [SECTION] Searching for recipe-specific HTML sections...');

  // List of common recipe container patterns (in priority order)
  // Use regex to find WHERE marker is, then extract big chunk from that position
  const recipeSelectors = [
    // Recipe plugin specific (WordPress)
    { pattern: /<div[^>]*class="[^"]*wprm-recipe[^"]*"/i, name: 'WP Recipe Maker' },
    { pattern: /<div[^>]*class="[^"]*tasty-recipes[^"]*"/i, name: 'Tasty Recipes' },
    { pattern: /<div[^>]*class="[^"]*mv-create[^"]*"/i, name: 'Mediavine Create' },
    { pattern: /<div[^>]*class="[^"]*easyrecipe[^"]*"/i, name: 'EasyRecipe' },
    { pattern: /<div[^>]*class="[^"]*recipe-card[^"]*"/i, name: 'Recipe Card' },

    // Generic recipe markers
    { pattern: /<article[^>]*class="[^"]*recipe[^"]*"/i, name: 'Article with recipe class' },
    { pattern: /<div[^>]*class="[^"]*recipe[^"]*"/i, name: 'Div with recipe class' },
    { pattern: /<section[^>]*class="[^"]*recipe[^"]*"/i, name: 'Section with recipe class' },

    // Main content containers (WordPress and generic)
    { pattern: /<main[^>]*>/i, name: 'Main tag' },
    { pattern: /<article[^>]*>/i, name: 'Article tag' },
    { pattern: /<div[^>]*class="[^"]*entry-content[^"]*"/i, name: 'Entry content' },
    { pattern: /<div[^>]*class="[^"]*post-content[^"]*"/i, name: 'Post content' },
    { pattern: /<div[^>]*class="[^"]*content[^"]*"/i, name: 'Content div' },
  ];

  // Try each selector in priority order
  for (const selector of recipeSelectors) {
    const match = html.match(selector.pattern);
    if (match && match.index !== undefined) {
      // Found the marker! Now extract a large chunk from this position
      const startPosition = match.index;
      const chunkSize = 50000; // 50K chars should cover any recipe card
      const extractedHtml = html.slice(startPosition, startPosition + chunkSize);

      console.log(`✅ [SECTION] Found recipe section using: ${selector.name}`);
      console.log(`📏 [SECTION] Extracted ${extractedHtml.length} chars from position ${startPosition} (vs ${html.length} original = ${Math.round(extractedHtml.length / html.length * 100)}% of page)`);
      return extractedHtml;
    }
  }

  console.log('⚠️ [SECTION] No recipe-specific markers found, returning full HTML');
  return html;
}

/**
 * Extract text content from HTML (strip tags)
 */
export function extractTextFromHtml(html: string): string {
  console.log('📄 [TEXT] Extracting text content from HTML...');

  // Remove scripts and styles
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean whitespace
  text = text.replace(/\s+/g, ' ').trim();

  console.log(`📄 [TEXT] Extracted ${text.length} characters of text`);

  return text;
}
