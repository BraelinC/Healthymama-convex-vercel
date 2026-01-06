import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export interface RecipeIngredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export interface RecipeInstruction {
  step: number;
  description: string;
  timestamp?: string; // MM:SS format
  keyActions?: string[]; // e.g., ["chop", "sauté", "simmer"]
}

export interface RecipeKeyFrame {
  timestamp: string; // MM:SS format
  description: string;
  actionType: 'ingredient_prep' | 'cooking_technique' | 'final_plating' | 'other';
}

export interface ExtractedRecipe {
  title: string;
  description?: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  keyFrames?: RecipeKeyFrame[];
}

/**
 * Analyzes a video file and extracts recipe information using Gemini AI
 */
export async function analyzeRecipeVideo(
  videoPath: string,
  options?: {
    sourceUrl?: string;
    videoTitle?: string;
  }
): Promise<ExtractedRecipe> {
  try {
    console.log('[Gemini] Uploading video to File API...');

    // Upload video to Gemini File API (required for videos >20MB)
    const uploadResult = await genAI.uploadFile(videoPath, {
      mimeType: 'video/mp4',
      displayName: options?.videoTitle || 'Recipe Video',
    });

    console.log(`[Gemini] File uploaded: ${uploadResult.file.uri}`);

    // Wait for file processing
    let file = await genAI.getFile(uploadResult.file.name);
    let processingAttempts = 0;
    const maxProcessingAttempts = 60; // 5 minutes max

    while (file.state === 'PROCESSING' && processingAttempts < maxProcessingAttempts) {
      console.log(`[Gemini] Processing video... (${processingAttempts * 5}s elapsed)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      file = await genAI.getFile(uploadResult.file.name);
      processingAttempts++;
    }

    if (file.state !== 'ACTIVE') {
      throw new Error(`File processing failed: ${file.state}`);
    }

    console.log('[Gemini] Video ready, analyzing with AI...');

    // Create model with enhanced vision capabilities
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp', // Best for video analysis, cost-effective
    });

    const prompt = `You are an expert recipe extraction AI analyzing a cooking video.

TASK: Extract a complete, structured recipe from this cooking video.

INSTRUCTIONS:
1. Watch the entire video carefully
2. Identify all ingredients shown (with quantities if mentioned or visible)
3. Break down cooking steps sequentially with timestamps (MM:SS format)
4. Note key cooking techniques and actions for each step
5. Identify moments showing:
   - Ingredient preparation (chopping, measuring, etc.)
   - Cooking techniques (sautéing, baking, etc.)
   - Final plating/presentation
6. Extract metadata: title, description, servings, prep time, cook time, cuisine, difficulty

EXTRACTION RULES:
- Include timestamps for each instruction step (use format MM:SS, e.g., "02:30")
- List all visible ingredients, estimate quantities if not mentioned
- Identify key frames showing important cooking moments
- Mark each instruction with key actions (e.g., ["chop", "sauté"], ["mix", "bake"])
- If audio mentions details, incorporate them
- If title/description not clear in video, infer from the dish being prepared
- Be specific and detailed in instructions
- Difficulty: "easy" (< 30 min, few steps), "medium" (30-60 min, moderate), "hard" (>60 min or complex techniques)

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "title": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    {
      "name": "flour",
      "quantity": "2",
      "unit": "cups"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "description": "Detailed step description",
      "timestamp": "00:30",
      "keyActions": ["chop", "dice"]
    }
  ],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian",
  "difficulty": "medium",
  "keyFrames": [
    {
      "timestamp": "01:23",
      "description": "Chopping onions",
      "actionType": "ingredient_prep"
    }
  ]
}`;

    // Generate content with video analysis
    const result = await model.generateContent([
      {
        fileData: {
          fileUri: file.uri,
          mimeType: file.mimeType,
        },
      },
      {
        text: prompt,
      },
    ]);

    const response = result.response.text().trim();
    console.log('[Gemini] Raw response received');

    // Clean markdown formatting if present
    let jsonText = response;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    // Parse the JSON response
    const recipe: ExtractedRecipe = JSON.parse(jsonText);

    console.log(`[Gemini] Recipe extracted successfully: "${recipe.title}"`);
    console.log(`[Gemini] - ${recipe.ingredients.length} ingredients`);
    console.log(`[Gemini] - ${recipe.instructions.length} steps`);
    console.log(`[Gemini] - ${recipe.keyFrames?.length || 0} key frames`);

    // Cleanup: Delete file from Gemini (2-day auto-expiry, but good practice)
    try {
      await genAI.deleteFile(file.name);
      console.log('[Gemini] Temporary file deleted from Gemini API');
    } catch (error) {
      console.warn('[Gemini] Could not delete temporary file:', error);
    }

    return recipe;
  } catch (error: any) {
    console.error('[Gemini] Video analysis error:', error);

    // If JSON parsing failed, show more details
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse Gemini response as JSON: ${error.message}`);
    }

    throw new Error(`Failed to analyze video with Gemini: ${error.message}`);
  }
}

/**
 * Analyzes a YouTube video using URL (FREE during preview period)
 * Note: This is experimental and may not work for all videos
 */
export async function analyzeYouTubeUrl(youtubeUrl: string): Promise<ExtractedRecipe> {
  try {
    console.log(`[Gemini] Analyzing YouTube URL directly: ${youtubeUrl}`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const prompt = `Extract a recipe from this YouTube cooking video. Return ONLY valid JSON with this structure:
{
  "title": "Recipe Name",
  "description": "Description",
  "ingredients": [{"name": "flour", "quantity": "2", "unit": "cups"}],
  "instructions": [{"step": 1, "description": "Mix ingredients", "timestamp": "00:30", "keyActions": ["mix"]}],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian",
  "difficulty": "medium",
  "keyFrames": [{"timestamp": "01:23", "description": "Mixing", "actionType": "cooking_technique"}]
}`;

    const result = await model.generateContent([
      prompt,
      {
        fileData: {
          mimeType: 'video/youtube',
          fileUri: youtubeUrl,
        },
      },
    ]);

    const response = result.response.text().trim();
    let jsonText = response;

    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const recipe: ExtractedRecipe = JSON.parse(jsonText);

    console.log(`[Gemini] YouTube URL analysis successful: "${recipe.title}"`);

    return recipe;
  } catch (error: any) {
    console.error('[Gemini] YouTube URL analysis failed:', error);
    throw new Error(`Failed to analyze YouTube URL: ${error.message}`);
  }
}
