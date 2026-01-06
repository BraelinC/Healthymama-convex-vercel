// @ts-nocheck
/**
 * Voice Sessions Actions - Gemini Live Cooking Assistant
 * Actions only (Node.js environment)
 */

"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ========== HELPER FUNCTIONS ==========

/**
 * Generate embedding for text
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
      Authorization: `Bearer ${apiKey}`,
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

/**
 * Call Gemini Flash Lite for fact extraction
 */
async function extractFactsWithGemini(transcript: string): Promise<string[]> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not set");
  }

  const prompt = `Extract important cooking-related facts from this conversation between a user and their cooking assistant.

Focus on:
- Dietary restrictions or allergies mentioned (MOST IMPORTANT)
- Food preferences (loves/dislikes specific ingredients)
- Cooking skill observations
- Kitchen equipment mentioned
- Time constraints for cooking
- Recipe modifications or substitutions the user made
- Family size or serving preferences

Rules:
- Only extract facts that are PERSONAL to this user
- Skip generic cooking tips or recipe instructions
- Each fact should be a complete, standalone sentence
- Be specific: "User is allergic to shellfish" not "User has allergies"

Return ONLY a JSON array of strings. No markdown, no explanation.
Example: ["User is allergic to peanuts", "User loves spicy food", "User has an Instant Pot"]

If no personal facts are found, return: []

Transcript:
${transcript}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://healthymama.app",
      "X-Title": "HealthyMama Voice Assistant",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-lite-001",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini Flash Lite error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "[]";

  try {
    // Clean up the response (remove markdown if present)
    let cleaned = content.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const facts = JSON.parse(cleaned);
    return Array.isArray(facts) ? facts : [];
  } catch (e) {
    console.error("[VoiceSession] Failed to parse Gemini response:", content);
    return [];
  }
}

// ========== ACTIONS ==========

/**
 * Process a completed session - extract facts and save as memories
 */
export const processSession = internalAction({
  args: { sessionId: v.id("voiceSessions") },
  handler: async (ctx, { sessionId }) => {
    console.log(`[VoiceSession] Processing session ${sessionId}`);

    // 1. Load session
    const session = await ctx.runQuery(internal.voiceSessions.getSessionInternal, { sessionId });
    if (!session) {
      console.error(`[VoiceSession] Session ${sessionId} not found`);
      return;
    }

    if (session.status === "processed") {
      console.log(`[VoiceSession] Session ${sessionId} already processed`);
      return;
    }

    // Skip if no turns
    if (session.turns.length === 0) {
      console.log(`[VoiceSession] Session ${sessionId} has no turns, skipping`);
      await ctx.runMutation(internal.voiceSessions.markProcessed, {
        sessionId,
        extractedFactIds: [],
      });
      return;
    }

    // 2. Format transcript
    const transcript = session.turns
      .map((t: { role: string; text: string }) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text}`)
      .join("\n");

    console.log(`[VoiceSession] Transcript length: ${transcript.length} chars, ${session.turns.length} turns`);

    // 3. Extract facts with Gemini
    const facts = await extractFactsWithGemini(transcript);
    console.log(`[VoiceSession] Extracted ${facts.length} facts`);

    // 4. Generate embeddings and save each fact
    const factIds: Id<"voiceMemories">[] = [];

    for (const factText of facts) {
      try {
        const embedding = await generateEmbedding(factText);

        const id = await ctx.runMutation(internal.voiceMemoriesQueries.addFactInternal, {
          userId: session.userId,
          text: factText,
          embedding,
          sessionId,
          recipeId: session.recipeId,
          isFavourite: true, // All extracted facts are favourites
        });

        factIds.push(id);
        console.log(`[VoiceSession] Saved fact: "${factText.substring(0, 50)}..."`);
      } catch (e) {
        console.error(`[VoiceSession] Failed to save fact: ${factText}`, e);
      }
    }

    // 5. Mark session as processed
    await ctx.runMutation(internal.voiceSessions.markProcessed, {
      sessionId,
      extractedFactIds: factIds,
    });

    console.log(`[VoiceSession] Completed processing session ${sessionId}`);
  },
});

/**
 * Process timed-out sessions (called by cron job)
 */
export const processTimedOutSessions = internalAction({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    const staleSessions = await ctx.runQuery(internal.voiceSessions.getStale, {
      maxActivityAt: fiveMinutesAgo,
    });

    console.log(`[VoiceSession] Found ${staleSessions.length} stale sessions`);

    for (const session of staleSessions) {
      // End the session first
      await ctx.runMutation(internal.voiceSessions.endStaleSession, {
        sessionId: session._id,
      });

      // Then process it
      await ctx.scheduler.runAfter(0, internal.voiceSessionsActions.processSession, {
        sessionId: session._id,
      });
    }
  },
});
