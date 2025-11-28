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
    // Recipe plugin specific (WordPress) - highest priority, always use first match
    { pattern: /<div[^>]*class="[^"]*wprm-recipe-container[^"]*"/gi, name: 'WP Recipe Maker Container', priority: 1 },
    { pattern: /<div[^>]*class="[^"]*wprm-recipe[^"]*"/gi, name: 'WP Recipe Maker', priority: 1 },
    { pattern: /<div[^>]*class="[^"]*tasty-recipes[^"]*"/gi, name: 'Tasty Recipes', priority: 1 },
    { pattern: /<div[^>]*class="[^"]*mv-create[^"]*"/gi, name: 'Mediavine Create', priority: 1 },
    { pattern: /<div[^>]*class="[^"]*easyrecipe[^"]*"/gi, name: 'EasyRecipe', priority: 1 },

    // Recipe card - prefer early in page
    { pattern: /<div[^>]*class="[^"]*recipe-card[^"]*"/gi, name: 'Recipe Card', priority: 2 },

    // Generic recipe markers - prefer early occurrences
    { pattern: /<article[^>]*class="[^"]*recipe[^"]*"/gi, name: 'Article with recipe class', priority: 2 },
    { pattern: /<div[^>]*class="[^"]*recipe-content[^"]*"/gi, name: 'Recipe content div', priority: 2 },
    { pattern: /<div[^>]*class="[^"]*recipe[^"]*"/gi, name: 'Div with recipe class', priority: 3 },
    { pattern: /<section[^>]*class="[^"]*recipe[^"]*"/gi, name: 'Section with recipe class', priority: 3 },

    // Main content containers - last resort
    { pattern: /<main[^>]*>/gi, name: 'Main tag', priority: 4 },
    { pattern: /<article[^>]*>/gi, name: 'Article tag', priority: 4 },
    { pattern: /<div[^>]*class="[^"]*entry-content[^"]*"/gi, name: 'Entry content', priority: 4 },
    { pattern: /<div[^>]*class="[^"]*post-content[^"]*"/gi, name: 'Post content', priority: 4 },
  ];

  // Try each selector in priority order, prefer matches in first half of page
  let bestMatch: { position: number; name: string; priority: number } | null = null;

  for (const selector of recipeSelectors) {
    const regex = new RegExp(selector.pattern);
    let match;

    // Find ALL matches for this pattern
    const matches: Array<{ index: number }> = [];
    while ((match = regex.exec(html)) !== null) {
      matches.push({ index: match.index });
    }

    if (matches.length > 0) {
      // For high priority patterns (1-2), take the FIRST match
      // For lower priority patterns (3-4), prefer matches in first 50% of page
      const halfwayPoint = html.length / 2;

      let selectedMatch;
      if (selector.priority <= 2) {
        // High priority: use first occurrence
        selectedMatch = matches[0];
        console.log(`🎯 [SECTION] Found ${matches.length} "${selector.name}" matches, using first at position ${selectedMatch.index}`);
      } else {
        // Lower priority: prefer first half of page
        const firstHalfMatches = matches.filter(m => m.index < halfwayPoint);
        selectedMatch = firstHalfMatches.length > 0 ? firstHalfMatches[0] : matches[0];
        console.log(`🎯 [SECTION] Found ${matches.length} "${selector.name}" matches, ${firstHalfMatches.length} in first half, using position ${selectedMatch.index}`);
      }

      // Update best match if this is higher priority or earlier in page
      if (!bestMatch ||
          selector.priority < bestMatch.priority ||
          (selector.priority === bestMatch.priority && selectedMatch.index < bestMatch.position)) {
        bestMatch = {
          position: selectedMatch.index,
          name: selector.name,
          priority: selector.priority
        };
      }
    }
  }

  if (bestMatch) {
    const chunkSize = 100000; // 100K chars to ensure we get full recipe
    const extractedHtml = html.slice(bestMatch.position, bestMatch.position + chunkSize);

    console.log(`✅ [SECTION] Using best match: ${bestMatch.name} (priority ${bestMatch.priority})`);
    console.log(`📏 [SECTION] Extracted ${extractedHtml.length} chars from position ${bestMatch.position} (${Math.round(bestMatch.position / html.length * 100)}% into page)`);
    return extractedHtml;
  }

  console.log('⚠️ [SECTION] No recipe-specific markers found, returning first 150K chars');
  return html.slice(0, 150000); // Return first 150K instead of full HTML
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
