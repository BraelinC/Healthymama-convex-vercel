// @ts-nocheck
/**
 * Tiered Memory Processing System
 * Tier 1: Raw messages (chatMessages table)
 * Tier 2: Important memories with GPT-5 Nano validation + GPT-5 Mini summarization
 * Tier 3: Thread context summaries with GPT-5 Mini
 */

"use node";

import { action, internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ========== OPENROUTER API HELPERS ==========

/**
 * Call OpenRouter with GPT-5 Nano for importance validation
 * Ultra-cheap: $0.05/$0.40 per 1M tokens
 */
async function callGPT5Nano(prompt: string): Promise<string> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://healthymama.app",
      "X-Title": "HealthyMama Memory System",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-nano",  // Ultra-cheap reasoning model
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      reasoning_effort: "low",  // Use minimal reasoning for simple scoring (20% token budget)
      max_completion_tokens: 600,  // Separate budget: reasoning tokens + actual JSON output
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GPT-5 Nano API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  // DEBUG: Log full API response structure and token usage
  console.log("[Memory] Nano FULL API response:", JSON.stringify(data, null, 2));
  console.log("[Memory] Nano token usage:", data.usage);
  console.log("[Memory] Nano choices array:", data.choices);
  console.log("[Memory] Nano first choice:", data.choices?.[0]);
  console.log("[Memory] Nano message:", data.choices?.[0]?.message);
  console.log("[Memory] Nano content:", data.choices?.[0]?.message?.content);
  console.log("[Memory] Nano reasoning:", data.choices?.[0]?.message?.reasoning);

  // Get content from response (primary location for output)
  let content = data.choices[0]?.message?.content ?? "";

  // FALLBACK: If content is empty but reasoning exists, try to extract JSON from reasoning
  if (!content && data.choices[0]?.message?.reasoning) {
    console.log("[Memory] Content empty, attempting to extract JSON from reasoning field");
    const reasoning = data.choices[0].message.reasoning;
    const jsonMatch = reasoning.match(/\{[^}]*"importance"[^}]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
      console.log("[Memory] Extracted JSON from reasoning:", content);
    }
  }

  return content;
}

/**
 * Call OpenRouter with Gemini 2.0 Flash Lite for summarization
 * Ultra-fast and cheap: $0.075/$0.30 per 1M tokens
 * Returns JSON with summary + extracted terms
 */
async function callGeminiFlashLite(prompt: string, maxTokens: number = 500): Promise<string> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not set");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://healthymama.app",
      "X-Title": "HealthyMama Memory System",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-lite-001",
      messages: [
        {
          role: "system",
          content: "You are a cooking preference analyzer. Your job is to extract clear, actionable information about what the user likes, dislikes, needs to avoid, and prefers in cooking. Be literal and direct - if they say 'I love chicken', extract that they love chicken. Capture sentiment clearly: loves, hates, prefers, avoids, enjoys, dislikes."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_completion_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Memory] Gemini API error:", errorText);
    throw new Error(`Gemini Flash Lite API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // DEBUG: Log full API response
  console.log("[Memory] Gemini FULL API response:", JSON.stringify(data, null, 2));
  console.log("[Memory] Gemini token usage:", data.usage);
  console.log("[Memory] Gemini content:", data.choices?.[0]?.message?.content);

  const content = data.choices[0]?.message?.content ?? "";

  if (!content || content.trim().length === 0) {
    console.error("[Memory] Gemini returned empty content");
  }

  return content;
}

/**
 * Generate embedding via OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI Embeddings API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ========== TIER 2: IMPORTANCE VALIDATION + SUMMARIZATION ==========

/**
 * Step 1: Validate message importance with GPT-5 Nano
 * Returns importance score 0-1
 */
async function validateImportance(messageContent: string): Promise<number> {
  // Simplified prompt for reasoning models (they prefer direct, minimal instructions)
  const prompt = `Rate this message's importance for cooking memory (0-1). High = preferences/restrictions/facts, Low = chit-chat. Output JSON: {"importance": 0.8}

"${messageContent}"`;

  let response = "";
  try {
    response = await callGPT5Nano(prompt);

    // DEBUG: Log full response to see what Nano returns
    console.log("[Memory] Nano RAW response:", response);
    console.log("[Memory] Nano response length:", response.length);
    console.log("[Memory] Nano response type:", typeof response);

    if (!response || response.trim().length === 0) {
      console.error("[Memory] Nano returned empty response");
      return 0;
    }

    // Try to extract JSON from response (might be embedded in text)
    const jsonMatch = response.match(/\{[^}]*"importance"[^}]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : response;

    const parsed = JSON.parse(jsonString);
    console.log("[Memory] Nano parsed successfully:", parsed);
    return parsed.importance || 0;
  } catch (error) {
    console.error("[Memory] Nano validation failed:", error);
    console.error("[Memory] Failed to parse response:", response);
    return 0; // Default to not important on error
  }
}

/**
 * Step 2: Summarize important message with Gemini Flash Lite
 * Returns JSON with summary + extracted cooking terms
 */
async function summarizeMessage(messageContent: string): Promise<{
  summary: string;
  extractedTerms: {
    proteins: string[];
    restrictions: string[];
    preferences: string[];
    timeConstraints: string[];
    dietaryTags: string[];
    equipment: string[];
  };
}> {
  const prompt = `Analyze this cooking-related message and return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "summary": "A clear, direct summary capturing what the user said about their food preferences, restrictions, or cooking needs",
  "extractedTerms": {
    "proteins": ["chicken", "fish"],              // Specific protein/meat mentions
    "restrictions": ["nut allergy", "dairy"],     // Things they MUST avoid (allergies, intolerances)
    "preferences": ["loves chicken", "dislikes broccoli", "quick meals"],  // Things they like/dislike + cooking styles
    "timeConstraints": ["30 minutes", "weeknight"],
    "dietaryTags": ["dairy-free", "low-carb"],
    "equipment": ["instant pot", "air fryer"]
  }
}

IMPORTANT: For food preferences with sentiment (love, hate, prefer, enjoy, dislike):
- Extract the food item to its category (e.g., "chicken" → proteins)
- ALSO add the full sentiment to preferences (e.g., "loves chicken" → preferences)

EXAMPLES:

Example 1 - Simple positive preference:
Input: "I love chicken"
Output:
{
  "summary": "User has a strong preference for chicken as a primary protein source. Actively seeks and enjoys chicken-based recipes.",
  "extractedTerms": {
    "proteins": ["chicken"],
    "restrictions": [],
    "preferences": ["loves chicken"],
    "timeConstraints": [],
    "dietaryTags": [],
    "equipment": []
  }
}

Example 2 - Simple dislike:
Input: "I hate broccoli"
Output:
{
  "summary": "User has a strong aversion to broccoli and prefers to avoid it in meal planning. Should not be included in recipe recommendations.",
  "extractedTerms": {
    "proteins": [],
    "restrictions": [],
    "preferences": ["dislikes broccoli"],
    "timeConstraints": [],
    "dietaryTags": [],
    "equipment": []
  }
}

Example 3 - Restriction/allergy:
Input: "I'm allergic to shellfish"
Output:
{
  "summary": "User has a shellfish allergy and must completely avoid shellfish in all recipes.",
  "extractedTerms": {
    "proteins": [],
    "restrictions": ["shellfish allergy"],
    "preferences": [],
    "timeConstraints": [],
    "dietaryTags": [],
    "equipment": []
  }
}

Example 4 - Complex statement:
Input: "I love chicken but I'm allergic to shellfish. I usually cook quick meals under 30 minutes."
Output:
{
  "summary": "User loves chicken as a protein source. Has shellfish allergy requiring complete avoidance. Prioritizes quick cooking with maximum 30-minute preparation time.",
  "extractedTerms": {
    "proteins": ["chicken"],
    "restrictions": ["shellfish allergy"],
    "preferences": ["loves chicken", "quick meals"],
    "timeConstraints": ["30 minutes"],
    "dietaryTags": [],
    "equipment": []
  }
}

Now analyze this message:
\`\`\`
${messageContent}
\`\`\``;

  try {
    const response = await callGeminiFlashLite(prompt, 300);

    console.log("[Memory] Gemini RAW response:", response);
    console.log("[Memory] Gemini response length:", response.length);

    if (!response || response.trim().length === 0) {
      console.error("[Memory] Gemini returned empty response, using fallback");
      return {
        summary: messageContent,
        extractedTerms: {
          proteins: [],
          restrictions: [],
          preferences: [],
          timeConstraints: [],
          dietaryTags: [],
          equipment: []
        }
      };
    }

    // Parse JSON response (Gemini might wrap in markdown code blocks)
    let jsonString = response.trim();

    // Remove markdown code blocks if present
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/```\n?/g, "");
    }

    const parsed = JSON.parse(jsonString);
    console.log("[Memory] Gemini parsed successfully:", parsed);

    // Validate structure
    if (!parsed.summary || !parsed.extractedTerms) {
      throw new Error("Invalid JSON structure from Gemini");
    }

    return {
      summary: parsed.summary,
      extractedTerms: {
        proteins: parsed.extractedTerms.proteins || [],
        restrictions: parsed.extractedTerms.restrictions || [],
        preferences: parsed.extractedTerms.preferences || [],
        timeConstraints: parsed.extractedTerms.timeConstraints || [],
        dietaryTags: parsed.extractedTerms.dietaryTags || [],
        equipment: parsed.extractedTerms.equipment || []
      }
    };

  } catch (error) {
    console.error("[Memory] Gemini summarization failed:", error);
    // Fallback to basic structure
    return {
      summary: messageContent,
      extractedTerms: {
        proteins: [],
        restrictions: [],
        preferences: [],
        timeConstraints: [],
        dietaryTags: [],
        equipment: []
      }
    };
  }
}

/**
 * Main processing function: Validate → Summarize → Save
 * Called asynchronously after each message
 */
export const processMessageMemory = action({
  args: {
    messageId: v.id("chatMessages"),
    sessionId: v.id("chatSessions"),
    userId: v.string(),
    communityId: v.string(),
    messageContent: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    // Only process user messages for now
    if (args.role !== "user") {
      return { processed: false, reason: "Not a user message" };
    }

    // Skip very short messages
    if (args.messageContent.trim().length < 20) {
      return { processed: false, reason: "Message too short" };
    }

    console.log(`[Memory] Processing message ${args.messageId}`);

    try {
      // STEP 1: Validate importance with GPT-5 Nano (ultra-cheap)
      const importance = await validateImportance(args.messageContent);
      console.log(`[Memory] Importance score: ${importance}`);

      // STEP 2: If important, escalate to Gemini Flash Lite for summarization
      if (importance > 0.5) {
        const result = await summarizeMessage(args.messageContent);
        console.log(`[Memory] Summary: ${result.summary.substring(0, 50)}...`);
        console.log(`[Memory] Extracted terms:`, result.extractedTerms);

        // STEP 3: Generate embedding from summary
        const embedding = await generateEmbedding(result.summary);

        // STEP 4: Save to userMemories (Tier 2) with structured terms
        await ctx.runMutation(api.memory.mutations.addMemory, {
          userId: args.userId,
          text: result.summary,
          embedding,
          extractedTerms: result.extractedTerms,
          sessionId: args.sessionId,
          messageIds: [args.messageId],
          category: "conversation",
          agentId: "cooking_assistant",
        });

        console.log(`[Memory] Saved important memory for user ${args.userId}`);
      }

      // STEP 5: Check if we should trigger thread summary
      await checkAndTriggerThreadSummary(ctx, args.sessionId, args.userId);

      return { processed: true, importance };
    } catch (error) {
      console.error("[Memory] Processing error:", error);
      return { processed: false, error: String(error) };
    }
  },
});

// ========== TIER 3: THREAD CONTEXT SUMMARIES ==========

/**
 * Check if we should create/update thread summary
 * Triggers every 10 messages
 */
async function checkAndTriggerThreadSummary(
  ctx: any,
  sessionId: Id<"chatSessions">,
  userId: string
) {
  // Get message count for this session
  const messages = await ctx.runQuery(internal.memory.mutations.getSessionMessageCount, {
    sessionId,
  });

  // COMMENTED OUT: Tier 3 thread summaries not needed for simplified approach
  // Trigger summary every 10 messages
  // if (messages.count > 0 && messages.count % 10 === 0) {
  //   console.log(`[Memory] Triggering thread summary at ${messages.count} messages`);
  //   await ctx.scheduler.runAfter(0, internal.memory.tieredProcessing.summarizeThread, {
  //     sessionId,
  //     userId,
  //     messageCount: 10,
  //   });
  // }
}

// Note: getSessionMessageCount moved to memory/mutations.ts (queries must be in V8 isolate, not Node.js)

// COMMENTED OUT: Tier 3 thread summaries not needed for simplified approach
/**
 * Summarize last N messages in a thread with GPT-5 Mini
 */
// export const summarizeThread = internalAction({
//   args: {
//     sessionId: v.id("chatSessions"),
//     userId: v.string(),
//     messageCount: v.number(),
//   },
//   handler: async (ctx, args) => {
//     console.log(`[Memory] Summarizing thread ${args.sessionId} (${args.messageCount} messages)`);
//
//     try {
//       // Get recent messages
//       const messages = await ctx.runQuery(api.chat.communitychat.getSessionMessages, {
//         sessionId: args.sessionId,
//         limit: args.messageCount,
//       });
//
//       if (messages.length === 0) {
//         return { summarized: false, reason: "No messages" };
//       }
//
//       // Format conversation for summarization
//       const conversationText = messages
//         .slice(-args.messageCount)
//         .map((m) => `${m.role}: ${m.content}`)
//         .join("\n\n");
//
//       // Summarize with GPT-5 Mini
//       const prompt = `Summarize this ${args.messageCount}-message conversation thread into key themes, user preferences, dietary needs, and important cooking context for long-term memory.
//
// Keep it under 150 words but preserve essential insights like:
// - Dietary restrictions/preferences
// - Cooking skill level
// - Cultural preferences
// - Specific requests or goals
//
// Conversation:
// ${conversationText}`;
//
//       const summary = await callGeminiFlashLite(prompt, 200);
//
//       // Generate embedding
//       const embedding = await generateEmbedding(summary);
//
//       // Save/update thread context
//       await ctx.runMutation(internal.memory.mutations.upsertThreadContext, {
//         userId: args.userId,
//         sessionId: args.sessionId,
//         summary,
//         embedding,
//         messageCount: messages.length,
//       });
//
//       console.log(`[Memory] Thread summary saved for session ${args.sessionId}`);
//       return { summarized: true, summary: summary.substring(0, 100) };
//     } catch (error) {
//       console.error("[Memory] Thread summarization error:", error);
//       return { summarized: false, error: String(error) };
//     }
//   },
// });

// Note: upsertThreadContext moved to memory/mutations.ts (mutations must be in V8 isolate, not Node.js)

// COMMENTED OUT: Tier 3 thread summaries not needed for simplified approach
/**
 * Finalize thread on exit (summarize remaining messages)
 */
// export const finalizeThreadOnExit = action({
//   args: { sessionId: v.id("chatSessions"), userId: v.string() },
//   handler: async (ctx, args) => {
//     const messages = await ctx.runQuery(api.chat.communitychat.getSessionMessages, {
//       sessionId: args.sessionId,
//     });
//
//     // If there are unsummarized messages (not a multiple of 10), summarize them
//     const count = messages.length;
//     if (count > 0 && count % 10 !== 0) {
//       const remainder = count % 10;
//       await ctx.runAction(internal.memory.tieredProcessing.summarizeThread, {
//         sessionId: args.sessionId,
//         userId: args.userId,
//         messageCount: remainder,
//       });
//     }
//   },
// });
