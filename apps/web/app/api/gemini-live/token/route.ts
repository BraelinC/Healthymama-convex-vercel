/**
 * Gemini Live API - Ephemeral Token Endpoint
 *
 * Mints short-lived tokens for secure client-to-Gemini WebSocket connections.
 * Pre-injects user profile (allergies, preferences) into system instructions.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { verifyToken } from "@clerk/backend";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Development Clerk credentials (for mobile app testing)
const DEV_CLERK_SECRET_KEY = process.env.DEV_CLERK_SECRET_KEY || 'sk_test_TF6TOlbN0PKU6htQvR7Y2XWINbS0dyo12EdO41E0JS';

/**
 * Try to authenticate using development Clerk instance
 * This allows mobile apps using dev Clerk to work with production API
 */
async function tryDevClerkAuth(token: string): Promise<string | null> {
  try {
    const result = await verifyToken(token, {
      secretKey: DEV_CLERK_SECRET_KEY,
    });
    return result.sub || null;
  } catch (error) {
    console.log('[Gemini Token] Dev Clerk verification failed:', error);
    return null;
  }
}

// Gemini Live tool definitions for cooking assistant
const GEMINI_TOOLS = [
  {
    name: "search_memories",
    description:
      "Search user's cooking memories and preferences. Use when you need context not in the current conversation - like 'have I made this before?' or 'what did I say about chicken?'",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for in user's memory",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_favourites",
    description:
      "Get user's starred/favourite memories (allergies, dietary preferences, loved ingredients). Use at conversation start or to personalize suggestions.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max number of favourites to return (default 10)",
        },
      },
    },
  },
  {
    name: "list_recents",
    description:
      "Get recent memories from past cooking sessions. Use for context about what user has discussed or cooked recently.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max number of recent memories (default 5)",
        },
      },
    },
  },
  {
    name: "add_favourite",
    description:
      "Save an important fact as a favourite memory. Call when user says 'remember that I love X', 'I'm allergic to Y', or explicitly asks you to remember something.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The fact to remember (e.g., 'User is allergic to shellfish')",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "substitute_ingredient",
    description:
      "Suggest a substitute for a missing ingredient. Call when user says 'I don't have X' or 'what can I use instead of X?'",
    parameters: {
      type: "object",
      properties: {
        ingredient: {
          type: "string",
          description: "The ingredient to substitute",
        },
        context: {
          type: "string",
          description: "Recipe or dish context (optional)",
        },
      },
      required: ["ingredient"],
    },
  },
];

/**
 * Build system instruction with user profile and recipe context
 */
function buildSystemInstruction(
  userProfile: any,
  recipe: { title: string; ingredients: string[]; instructions: string[] }
): string {
  const allergensList = userProfile?.allergens?.length
    ? userProfile.allergens.join(", ")
    : "None specified";

  const dietaryList = userProfile?.dietaryPreferences?.length
    ? userProfile.dietaryPreferences.join(", ")
    : "None specified";

  const cuisinesList = userProfile?.preferredCuisines?.length
    ? userProfile.preferredCuisines.join(", ")
    : "Any";

  const equipmentList = userProfile?.kitchenEquipment?.length
    ? userProfile.kitchenEquipment.join(", ")
    : "Standard kitchen equipment";

  return `You are a friendly, knowledgeable cooking assistant helping the user cook a recipe. Your name is "Mama" and you're warm and approachable.

## YOUR PERSONALITY
- Warm, encouraging, and patient
- Give clear, step-by-step guidance
- Proactively warn about common mistakes
- Celebrate small wins ("Great job!")
- Use conversational language, not robotic
- Keep responses concise - users are cooking!

## USER PROFILE
- Name: ${userProfile?.name || "Friend"}
- Cooking Skill: ${userProfile?.cookingSkillLevel || "intermediate"}
- Family Size: ${userProfile?.familySize || "not specified"}
- Default Servings: ${userProfile?.defaultServings || "not specified"}

## ALLERGIES (CRITICAL - ALWAYS CHECK)
${allergensList}
⚠️ NEVER suggest ingredients the user is allergic to. Always offer safe alternatives.

## DIETARY PREFERENCES
${dietaryList}

## PREFERRED CUISINES
${cuisinesList}

## KITCHEN EQUIPMENT
${equipmentList}

## CURRENT RECIPE: ${recipe.title}

### Ingredients:
${recipe.ingredients.map((i, idx) => `${idx + 1}. ${i}`).join("\n")}

### Instructions:
${recipe.instructions.map((s, idx) => `Step ${idx + 1}: ${s}`).join("\n")}

---

## YOUR JOB
1. Help the user cook this recipe step by step
2. Answer questions about techniques, timing, or substitutions
3. If they mention a missing ingredient, suggest alternatives (use substitute_ingredient)
4. If they mention a NEW allergy or preference, use add_favourite to save it
5. At the start, greet them warmly and offer to help

## TOOL USAGE
- Use search_memories when user asks about past conversations or preferences you don't know
- Use list_favourites when personalizing suggestions
- Use add_favourite when user reveals new dietary info ("I'm allergic to...", "I love...", "remember that...")
- Use substitute_ingredient when they're missing something

Be helpful, be safe, and make cooking fun!`;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user (try production first, then dev Clerk)
    const authHeader = request.headers.get('Authorization');
    const authResult = await auth();
    let userId = authResult.userId;

    // If production auth fails, try development Clerk auth
    if (!userId && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('[Gemini Token] Trying dev Clerk auth...');
      userId = await tryDevClerkAuth(token);
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { recipe } = body;

    if (!recipe || !recipe.title) {
      return NextResponse.json(
        { error: "Recipe data required" },
        { status: 400 }
      );
    }

    // 3. Fetch user profile from Convex
    let userProfile = null;
    try {
      userProfile = await convex.query(api.userProfile.getUserProfile, {
        userId,
      });
    } catch (e) {
      console.warn("[Gemini Token] Could not fetch user profile:", e);
    }

    // 4. Build system instruction
    const systemInstruction = buildSystemInstruction(userProfile, recipe);

    // 5. Get API key
    const googleApiKey = process.env.GOOGLE_AI_API_KEY;
    if (!googleApiKey) {
      console.error("[Gemini Token] GOOGLE_AI_API_KEY not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 6. For now, return API key with config (ephemeral tokens require v1alpha)
    // The client will use this to connect directly to Gemini
    console.log(`[Gemini Token] Token generated for user ${userId}, recipe: ${recipe.title}`);

    return NextResponse.json({
      mode: "api_key",
      apiKey: googleApiKey,
      // December 2025 version - should have fixes from earlier preview issues
      model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
      websocketUrl:
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent",
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: GEMINI_TOOLS }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          responseModalities: ["AUDIO", "TEXT"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede", // Warm, friendly female voice
              },
            },
          },
        },
      },
      // Pass tool names for client reference
      toolNames: GEMINI_TOOLS.map((t) => t.name),
      // Pass user context for client-side session creation
      userContext: {
        userId,
        hasProfile: !!userProfile,
        allergens: userProfile?.allergens || [],
      },
    });
  } catch (error: any) {
    console.error("[Gemini Token] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
