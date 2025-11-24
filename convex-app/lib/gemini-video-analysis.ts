/**
 * Gemini Video Analysis for Recipe Segmentation
 *
 * Uses Google's Gemini 2.0 Flash to analyze cooking videos and determine
 * which time segments correspond to each recipe instruction step.
 *
 * This enables:
 * - Step-by-step cooking mode with video clips
 * - Auto-segmentation of Instagram recipe videos
 * - Mux instant clipping for each instruction
 * - Full recipe extraction from video (when caption lacks recipe)
 *
 * API: OpenRouter (Gemini 2.0 Flash supports video!)
 */

export interface VideoSegment {
  stepNumber: number;
  instruction: string;
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface VideoAnalysisResult {
  segments: VideoSegment[];
  totalDuration: number;
}

/**
 * Filter and validate video segments
 *
 * Removes:
 * - Segments shorter than 2 seconds (likely previews)
 * - Duplicate segments (same step with overlapping timestamps)
 * - Invalid timestamps (startTime >= endTime)
 * - Segments that overlap >80% with another segment
 *
 * @param segments - Raw segments from AI
 * @param totalDuration - Total video duration
 * @returns Filtered segments
 */
function filterValidSegments(segments: VideoSegment[], totalDuration: number): VideoSegment[] {
  const MIN_SEGMENT_LENGTH = 1; // seconds (Instagram reels are fast-paced!)
  const MAX_OVERLAP_PERCENT = 0.8;

  const originalCount = segments.length;

  // Step 1: Filter invalid timestamps and too-short segments
  let filtered = segments.filter(seg => {
    const duration = seg.endTime - seg.startTime;
    const isValid = seg.startTime >= 0 &&
                   seg.endTime <= totalDuration &&
                   seg.startTime < seg.endTime &&
                   duration >= MIN_SEGMENT_LENGTH;

    if (!isValid) {
      console.log(`[Gemini Video] Filtered out segment ${seg.stepNumber} (${seg.startTime}s-${seg.endTime}s): ${duration < MIN_SEGMENT_LENGTH ? `too short (${duration}s < ${MIN_SEGMENT_LENGTH}s)` : 'invalid timestamps'}`);
    }

    return isValid;
  });

  // Step 2: Remove duplicate segments (same step number)
  const seenSteps = new Set<number>();
  filtered = filtered.filter(seg => {
    if (seenSteps.has(seg.stepNumber)) {
      console.log(`[Gemini Video] Filtered out duplicate segment for step ${seg.stepNumber}`);
      return false;
    }
    seenSteps.add(seg.stepNumber);
    return true;
  });

  // Step 3: Remove segments that overlap >80% with another segment
  filtered = filtered.filter((seg, index) => {
    for (let i = 0; i < filtered.length; i++) {
      if (i === index) continue;

      const other = filtered[i];
      const overlapStart = Math.max(seg.startTime, other.startTime);
      const overlapEnd = Math.min(seg.endTime, other.endTime);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      const segDuration = seg.endTime - seg.startTime;
      const overlapPercent = overlap / segDuration;

      if (overlapPercent > MAX_OVERLAP_PERCENT) {
        console.log(`[Gemini Video] Filtered out segment ${seg.stepNumber}: ${Math.round(overlapPercent * 100)}% overlap with step ${other.stepNumber}`);
        return false;
      }
    }
    return true;
  });

  const filteredCount = originalCount - filtered.length;
  if (filteredCount > 0) {
    console.log(`[Gemini Video] Filtered ${filteredCount} of ${originalCount} segments`);
  }

  return filtered;
}

/**
 * Extract recipe from video (when caption has no recipe)
 *
 * @param videoUrl - Direct URL to video file (Instagram CDN)
 * @param captionTitle - Title extracted from caption (if any)
 * @returns Full recipe extracted from video
 */
export async function extractRecipeFromVideo(
  videoUrl: string,
  captionTitle?: string
): Promise<{
  title: string;
  ingredients: string[];
  instructions: string[];
  description?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
}> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY not configured');
  }

  console.log('[Gemini Video] Extracting recipe from video (no caption recipe found)');

  const prompt = `You are a recipe extraction expert. Watch this cooking video and extract the complete recipe.

${captionTitle ? `The recipe is called: "${captionTitle}"` : 'Determine the recipe name from the video.'}

EXTRACT FROM THE VIDEO:
1. **Ingredients**: List ALL ingredients you see being used (with quantities if visible)
2. **Instructions**: Write step-by-step cooking instructions based on what you see happening
3. **Metadata**: Estimate servings, prep time, cook time, cuisine type

RULES:
- Watch the ENTIRE video from start to finish
- Skip intro/preview sections (first few seconds often show final dish)
- List ingredients in order of use
- Write instructions as clear, actionable steps
- If you can't see quantities, use approximate measurements (e.g., "2 tablespoons oil")
- Be specific: "dice the onions" not "add onions"

Return ONLY this JSON (no markdown, no extra text):
{
  "title": "Recipe Name",
  "description": "One sentence description of the dish",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2", ...],
  "instructions": ["Step 1: Action", "Step 2: Action", ...],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian"
}`;

  try {
    // Download and encode video
    console.log('[Gemini Video] Downloading video from Instagram CDN...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const videoData = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeout);

    if (!videoData.ok) {
      throw new Error(`Failed to download video: ${videoData.status} ${videoData.statusText}`);
    }

    const videoBlob = await videoData.blob();
    const videoBuffer = await videoBlob.arrayBuffer();
    const base64Video = Buffer.from(videoBuffer).toString('base64');
    const dataUrl = `data:video/mp4;base64,${base64Video}`;

    console.log('[Gemini Video] Video encoded, size:', Math.round(base64Video.length / 1024), 'KB');

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Recipe Extraction',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'video_url',
                video_url: {
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
      console.error(`[Gemini Video] API error (${response.status}):`, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }

    const text = data.choices[0].message.content.trim();

    // Parse JSON response
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
      throw new Error('No JSON object found in response');
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);

    const recipe = JSON.parse(jsonText);

    // Validate
    if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
      throw new Error('Invalid recipe format: missing required fields');
    }

    console.log('[Gemini Video] ✅ Extracted recipe from video:', recipe.title);
    console.log('[Gemini Video] Ingredients:', recipe.ingredients.length);
    console.log('[Gemini Video] Instructions:', recipe.instructions.length);

    return recipe;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Video download timeout (30s limit exceeded)');
    }

    console.error('[Gemini Video] Recipe extraction failed:', error.message);
    throw new Error(`Video recipe extraction failed: ${error.message}`);
  }
}

/**
 * Analyze a video and match instruction steps to time segments
 *
 * @param videoUrl - Direct URL to video file (Instagram CDN or Mux)
 * @param instructions - Array of recipe instruction steps
 * @returns Video segments with timestamps for each step
 */
export async function analyzeVideoSegments(
  videoUrl: string,
  instructions: string[]
): Promise<VideoAnalysisResult> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY not configured');
  }

  console.log('[Gemini Video] Analyzing video for', instructions.length, 'steps');

  // Construct prompt for video analysis
  const prompt = `You are a cooking video analysis expert. Your task is to match recipe instructions to video timestamps by OBSERVING THE VIDEO CHRONOLOGICALLY.

RECIPE INSTRUCTIONS (these may appear OUT OF ORDER in the video):
${instructions.map((instruction, i) => `${i + 1}. ${instruction}`).join('\n')}

ANALYSIS PROTOCOL - FOLLOW THESE PHASES IN ORDER:

═══ PHASE 1: OBSERVE THE VIDEO TIMELINE ═══
Watch the video from start (0 seconds) to end. Create a mental timeline:
- What happens at 0-5 seconds?
- What happens at 5-10 seconds?
- What happens at 10-15 seconds?
Continue until the end of the video.

IMPORTANT: Instagram cooking videos often show the final dish FIRST (0-10s), then show the cooking process.
The video timeline ≠ instruction order!

═══ PHASE 2: MATCH INSTRUCTIONS TO TIMELINE ═══
For each instruction, determine WHEN it appears in your mental timeline.
- Instruction 3 might appear at 5-10s
- Instruction 1 might appear at 10-15s
- Instruction 2 might appear at 15-20s
This is CORRECT if that's the actual video timeline!

═══ PHASE 3: BUILD CHRONOLOGICAL SEGMENT LIST ═══
List segments in VIDEO TIMELINE ORDER (sorted by startTime), NOT instruction order.

EXAMPLE (Instagram reel with intro):
If video shows:
- 0-8s: Final plated sandwich (skip this - it's an intro preview)
- 8-12s: Adding marinara to bread (Instruction 3)
- 12-18s: Laying fried chicken on bread (Instruction 1)
- 18-25s: Adding mozzarella cheese (Instruction 4)

CORRECT OUTPUT (sorted by timeline):
{
  "segments": [
    {"stepNumber": 3, "instruction": "Add marinara...", "startTime": 8, "endTime": 12},
    {"stepNumber": 1, "instruction": "Lay fried chicken...", "startTime": 12, "endTime": 18},
    {"stepNumber": 4, "instruction": "Add mozzarella...", "startTime": 18, "endTime": 25}
  ],
  "totalDuration": 25
}

Notice: segments are ordered by VIDEO TIMELINE (8s, 12s, 18s), NOT by stepNumber (3, 1, 4).

═══ PHASE 4: VALIDATE YOUR OUTPUT ═══
Before returning, verify:
✓ Segments are sorted by startTime (ascending)
✓ No segment starts before the previous segment ends
✓ First segment has the smallest startTime
✓ Last segment has the largest startTime
✓ All timestamps are within video duration

If validation fails, GO BACK to Phase 1 and re-watch the video.

SPECIAL RULES FOR INSTAGRAM REELS:
1. Skip intro montages (first 3-10 seconds often show final result)
2. Segments can be very short (1-3 seconds is normal)
3. If an instruction appears multiple times, use the most detailed instance
4. Omit instructions not clearly shown in the video

OUTPUT FORMAT:
Return ONLY this JSON (no markdown, no explanations, no extra text):
{
  "segments": [
    {"stepNumber": X, "instruction": "...", "startTime": ?, "endTime": ?}
  ],
  "totalDuration": ?
}

CRITICAL: Segments array MUST be sorted by startTime (earliest to latest), regardless of stepNumber order.`;

  try {
    // Download and base64 encode video (OpenRouter requires base64 for non-YouTube URLs)
    console.log('[Gemini Video] Downloading video from Instagram CDN...');
    console.log('[Gemini Video] Video URL:', videoUrl.substring(0, 100) + '...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const videoData = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    clearTimeout(timeout);

    if (!videoData.ok) {
      throw new Error(`Failed to download video: ${videoData.status} ${videoData.statusText}`);
    }

    const videoBlob = await videoData.blob();
    const videoBuffer = await videoBlob.arrayBuffer();
    const base64Video = Buffer.from(videoBuffer).toString('base64');
    const dataUrl = `data:video/mp4;base64,${base64Video}`;

    console.log('[Gemini Video] Video encoded, size:', Math.round(base64Video.length / 1024), 'KB');

    // Call OpenRouter API directly (same format as text parsing)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Video Analysis',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'video_url',
                video_url: {
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
      console.error(`[Gemini Video] API error (${response.status}):`, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }

    const text = data.choices[0].message.content.trim();

    console.log('[Gemini Video] Raw response:', text.substring(0, 200) + '...');

    // Parse JSON response with robust extraction
    let jsonText = text.trim();

    // Step 1: Remove markdown code blocks
    if (jsonText.includes('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    // Step 2: Extract JSON object (find first { and last })
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);

    const analysis: VideoAnalysisResult = JSON.parse(jsonText);

    // Validate response
    if (!analysis.segments || !Array.isArray(analysis.segments)) {
      throw new Error('Invalid response format: missing segments array');
    }

    console.log('[Gemini Video] Raw AI response:', analysis.segments.length, 'segments');
    console.log('[Gemini Video] Total duration from AI:', analysis.totalDuration, 'seconds');
    console.log('[Gemini Video] Segments:', analysis.segments.map(s => `${s.stepNumber}: ${s.startTime}s-${s.endTime}s`).join(', '));

    // Sort segments by step number to ensure they follow instruction order
    analysis.segments.sort((a, b) => a.stepNumber - b.stepNumber);

    // Validate chronological order: each segment should start after the previous one
    let lastEndTime = -1;
    const chronologicalSegments = analysis.segments.filter(seg => {
      if (seg.startTime < lastEndTime) {
        console.log(`[Gemini Video] ⚠️ Skipping segment ${seg.stepNumber} (${seg.startTime}s-${seg.endTime}s): out of chronological order (previous ended at ${lastEndTime}s)`);
        return false;
      }
      lastEndTime = seg.endTime;
      return true;
    });

    if (chronologicalSegments.length < analysis.segments.length) {
      console.log(`[Gemini Video] Removed ${analysis.segments.length - chronologicalSegments.length} out-of-order segments`);
    }

    analysis.segments = chronologicalSegments;

    // Filter and validate segments
    const originalCount = analysis.segments.length;
    analysis.segments = filterValidSegments(analysis.segments, analysis.totalDuration);
    const filteredCount = analysis.segments.length;

    // Quality check: If >75% of segments were filtered, something is wrong
    const filterRate = 1 - (filteredCount / originalCount);
    if (filterRate > 0.75 && originalCount > 2) {
      console.warn(`[Gemini Video] ⚠️ Quality check failed: ${Math.round(filterRate * 100)}% of segments filtered. Returning empty array.`);
      return {
        segments: [],
        totalDuration: analysis.totalDuration
      };
    }

    console.log('[Gemini Video] ✅ Analysis complete:', filteredCount, 'valid segments');

    return analysis;
  } catch (error: any) {
    // Provide more specific error messages
    if (error.name === 'AbortError') {
      console.error('[Gemini Video] Video download timeout (30s limit exceeded)');
      throw new Error('Video analysis failed: Download timeout - video too large or slow connection');
    }

    if (error.message?.includes('Failed to download video')) {
      console.error('[Gemini Video] Video download failed:', error.message);
      throw new Error(`Video analysis failed: Could not download video from Instagram CDN - ${error.message}`);
    }

    console.error('[Gemini Video] Analysis failed:', error.message);
    throw new Error(`Video analysis failed: ${error.message}`);
  }
}

/**
 * Generate Mux clip URLs for each video segment
 *
 * @param muxPlaybackId - Mux playback ID
 * @param segments - Video segments with timestamps
 * @returns Array of clip URLs
 */
export function generateClipUrls(
  muxPlaybackId: string,
  segments: VideoSegment[]
): Array<{ stepNumber: number; clipUrl: string }> {
  return segments.map((segment) => ({
    stepNumber: segment.stepNumber,
    clipUrl: `https://stream.mux.com/${muxPlaybackId}.m3u8?asset_start_time=${segment.startTime}&asset_end_time=${segment.endTime}`,
  }));
}

/**
 * Extract recipe from Pinterest image(s) using Gemini vision
 *
 * @param imageUrls - Array of image URLs (Pinterest pin images)
 * @param description - Pinterest pin description text
 * @param title - Pinterest pin title (optional)
 * @returns Full recipe extracted from images + text
 */
export async function extractRecipeFromPinterestImage(
  imageUrls: string[],
  description: string,
  title?: string
): Promise<{
  title: string;
  ingredients: string[];
  instructions: string[];
  description?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  cuisine?: string;
}> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY not configured');
  }

  console.log('[Gemini Image] Extracting recipe from Pinterest pin with', imageUrls.length, 'image(s)');

  const prompt = `You are a recipe extraction expert. Analyze this Pinterest recipe pin and extract the complete recipe.

${title ? `PIN TITLE: "${title}"` : ''}

PIN DESCRIPTION:
${description || 'No description provided'}

YOUR TASK:
1. **Read text from the image(s)**: Many Pinterest recipe pins have ingredients and instructions written directly on the image as text overlays, lists, or annotations
2. **Extract from description**: The Pinterest description may also contain recipe information
3. **Combine both sources**: Merge information from images and description for the most complete recipe

EXTRACTION PRIORITY:
- If ingredients are visible in the image, use those (they're often more detailed)
- If instructions are in the image, use those
- Fill in any missing information from the description
- If there's conflicting information, prefer what's visible in the image

RULES:
- List ALL ingredients with quantities (read carefully from image text)
- Write step-by-step instructions (combine image text + description)
- Estimate servings, prep time, cook time, cuisine based on available information
- If you can't see quantities, use standard measurements
- Be specific: "dice the onions" not "add onions"

Return ONLY this JSON (no markdown, no extra text):
{
  "title": "Recipe Name",
  "description": "One sentence description of the dish",
  "ingredients": ["ingredient 1 with quantity", "ingredient 2", ...],
  "instructions": ["Step 1: Action", "Step 2: Action", ...],
  "servings": "4 servings",
  "prep_time": "15 minutes",
  "cook_time": "30 minutes",
  "cuisine": "Italian"
}`;

  try {
    // Download and encode images
    console.log('[Gemini Image] Downloading', imageUrls.length, 'image(s) from Pinterest...');

    const imageDataPromises = imageUrls.map(async (imageUrl) => {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');

      // Detect image type from URL or default to jpeg
      let mimeType = 'image/jpeg';
      if (imageUrl.includes('.png')) mimeType = 'image/png';
      else if (imageUrl.includes('.webp')) mimeType = 'image/webp';

      return `data:${mimeType};base64,${base64Image}`;
    });

    const imageDataUrls = await Promise.all(imageDataPromises);

    console.log('[Gemini Image] Images encoded, total size:',
      Math.round(imageDataUrls.reduce((sum, url) => sum + url.length, 0) / 1024), 'KB');

    // Build content array with text prompt + all images
    const content: any[] = [
      {
        type: 'text',
        text: prompt,
      },
    ];

    // Add all images
    imageDataUrls.forEach((dataUrl) => {
      content.push({
        type: 'image_url',
        image_url: {
          url: dataUrl,
        },
      });
    });

    // Call OpenRouter API with Gemini 2.0 Flash vision
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://healthymama.app',
        'X-Title': 'HealthyMama Pinterest Recipe Extraction',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001', // Supports vision
        messages: [
          {
            role: 'user',
            content,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini Image] API error (${response.status}):`, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }

    const text = data.choices[0].message.content.trim();

    // Parse JSON response
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
      throw new Error('No JSON object found in response');
    }

    jsonText = jsonText.substring(firstBrace, lastBrace + 1);

    const recipe = JSON.parse(jsonText);

    // Validate
    if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
      throw new Error('Invalid recipe format: missing required fields');
    }

    console.log('[Gemini Image] ✅ Extracted recipe from Pinterest image:', recipe.title);
    console.log('[Gemini Image] Ingredients:', recipe.ingredients.length);
    console.log('[Gemini Image] Instructions:', recipe.instructions.length);

    return recipe;
  } catch (error: any) {
    console.error('[Gemini Image] Recipe extraction failed:', error.message);
    throw new Error(`Pinterest image recipe extraction failed: ${error.message}`);
  }
}
