/**
 * YouTube Description Parser
 *
 * Uses regex patterns to detect and extract recipes from YouTube video descriptions.
 * This acts as a fast first-pass before sending to AI for formatting.
 *
 * Flow:
 * 1. Check if description contains recipe markers (INGREDIENTS, INSTRUCTIONS, etc.)
 * 2. If found, extract raw ingredients and instructions using regex
 * 3. Return structured data for GPT-4.1-nano formatting
 * 4. If not found, return hasRecipe: false (will trigger video extraction instead)
 */

export interface ParsedYouTubeRecipe {
  hasRecipe: boolean;
  title?: string;
  ingredients?: string[];
  instructions?: string[];
  servings?: string;
  prepTime?: string;
  cookTime?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 *
 * Handles:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 *
 * @param url - YouTube URL
 * @returns Video ID or null if invalid
 */
export function extractYouTubeVideoId(url: string): string | null {
  // Match various YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if YouTube description contains recipe content
 *
 * Looks for common recipe markers:
 * - INGREDIENTS, WHAT YOU'LL NEED, SHOPPING LIST
 * - INSTRUCTIONS, DIRECTIONS, METHOD, STEPS
 * - Numbered or bulleted lists
 *
 * @param description - YouTube video description text
 * @returns true if recipe markers found
 */
export function hasRecipeInDescription(description: string): boolean {
  const ingredientMarkers = [
    /INGREDIENTS?:?/i,
    /WHAT YOU('LL)? NEED:?/i,
    /SHOPPING LIST:?/i,
    /RECIPE:?/i,
  ];

  const instructionMarkers = [
    /INSTRUCTIONS?:?/i,
    /DIRECTIONS?:?/i,
    /METHOD:?/i,
    /STEPS?:?/i,
    /HOW TO MAKE:?/i,
  ];

  // Check for ingredient markers
  const hasIngredients = ingredientMarkers.some((pattern) =>
    pattern.test(description)
  );

  // Check for instruction markers
  const hasInstructions = instructionMarkers.some((pattern) =>
    pattern.test(description)
  );

  // Must have both ingredients AND instructions to be a valid recipe
  return hasIngredients && hasInstructions;
}

/**
 * Parse YouTube description to extract recipe data
 *
 * Uses regex patterns to find and extract:
 * - Ingredients list (after INGREDIENTS: marker)
 * - Instructions list (after INSTRUCTIONS: marker)
 * - Metadata (servings, prep/cook time)
 *
 * @param description - YouTube video description
 * @param title - Video title (for context)
 * @returns Parsed recipe data or hasRecipe: false
 */
export function parseYouTubeDescription(
  description: string,
  title: string
): ParsedYouTubeRecipe {
  // First check if recipe exists
  if (!hasRecipeInDescription(description)) {
    return { hasRecipe: false };
  }

  console.log('[YouTube Parser] Recipe detected in description, extracting...');

  // Extract ingredients section
  const ingredientsPattern =
    /(?:INGREDIENTS?|WHAT YOU('LL)? NEED|SHOPPING LIST)[:\s]*\n([\s\S]*?)(?:\n\n|INSTRUCTIONS?|DIRECTIONS?|METHOD|STEPS?|HOW TO MAKE|$)/i;
  const ingredientsMatch = description.match(ingredientsPattern);

  let ingredients: string[] = [];
  if (ingredientsMatch && ingredientsMatch[2]) {
    // Split by newlines and filter out empty lines
    ingredients = ingredientsMatch[2]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => {
        // Remove section headers or links
        return (
          !line.match(/^(INGREDIENTS?|INSTRUCTIONS?|DIRECTIONS?|METHOD)/i) &&
          !line.match(/^http/i)
        );
      })
      .map((line) => {
        // Clean up list markers (-, *, •, numbers)
        return line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
      });
  }

  // Extract instructions section
  const instructionsPattern =
    /(?:INSTRUCTIONS?|DIRECTIONS?|METHOD|STEPS?|HOW TO MAKE)[:\s]*\n([\s\S]*?)(?:\n\n|$)/i;
  const instructionsMatch = description.match(instructionsPattern);

  let instructions: string[] = [];
  if (instructionsMatch && instructionsMatch[1]) {
    instructions = instructionsMatch[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => {
        // Remove section headers or links
        return (
          !line.match(/^(INGREDIENTS?|INSTRUCTIONS?|DIRECTIONS?|METHOD)/i) &&
          !line.match(/^http/i)
        );
      })
      .map((line) => {
        // Clean up list markers
        return line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
      });
  }

  // Extract metadata (servings, prep time, cook time)
  const servingsMatch = description.match(/(?:serves?|servings?):?\s*(\d+(?:-\d+)?)/i);
  const servings = servingsMatch ? `${servingsMatch[1]} servings` : undefined;

  const prepTimeMatch = description.match(/prep(?:\s+time)?:?\s*(\d+\s*(?:min|minutes|hr|hours?))/i);
  const prepTime = prepTimeMatch ? prepTimeMatch[1] : undefined;

  const cookTimeMatch = description.match(/cook(?:\s+time)?:?\s*(\d+\s*(?:min|minutes|hr|hours?))/i);
  const cookTime = cookTimeMatch ? cookTimeMatch[1] : undefined;

  // Validation: Must have at least 2 ingredients and 2 instructions
  if (ingredients.length < 2 || instructions.length < 2) {
    console.log(
      `[YouTube Parser] Insufficient data: ${ingredients.length} ingredients, ${instructions.length} instructions`
    );
    return { hasRecipe: false };
  }

  console.log(
    `[YouTube Parser] ✅ Extracted ${ingredients.length} ingredients, ${instructions.length} instructions`
  );

  return {
    hasRecipe: true,
    title,
    ingredients,
    instructions,
    servings,
    prepTime,
    cookTime,
  };
}

/**
 * Detect if a URL is from YouTube
 *
 * Valid YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://youtube-nocookie.com/embed/VIDEO_ID
 *
 * @param url - Any URL string
 * @returns true if YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  const youtubePatterns = [
    /^https?:\/\/(www\.|m\.)?youtube\.com\/(watch|embed|v|shorts)/i,
    /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/i,
    /^https?:\/\/(www\.)?youtube-nocookie\.com\/embed/i,
  ];

  return youtubePatterns.some(pattern => pattern.test(url));
}

/**
 * Detect if a URL is from Instagram
 *
 * Valid Instagram URL formats:
 * - https://www.instagram.com/reel/CODE/
 * - https://instagram.com/reel/CODE/
 * - https://www.instagram.com/p/CODE/
 * - https://www.instagram.com/tv/CODE/
 * - https://www.instagram.com/stories/USERNAME/ID/
 * - https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=... (Facebook CDN URLs from webhooks)
 *
 * @param url - Any URL string
 * @returns true if Instagram URL
 */
export function isInstagramUrl(url: string): boolean {
  const instagramPatterns = [
    /^https?:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+/i,
    /^https?:\/\/(www\.)?instagram\.com\/stories\/[^/]+\/\d+/i,
    /^https?:\/\/lookaside\.fbsbx\.com\/ig_messaging_cdn\/\?asset_id=/i, // Facebook CDN URLs
  ];

  return instagramPatterns.some(pattern => pattern.test(url));
}

