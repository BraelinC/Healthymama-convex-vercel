// @ts-nocheck
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Extract preferences from conversation messages (Tier 2 Learning)
 * Uses Gemini Flash for cost-effective extraction
 */
export const extractPreferencesFromMessages = action({
  args: {
    userId: v.string(),
    agentId: v.optional(v.string()),
    sessionId: v.string(),
    messages: v.array(
      v.object({
        _id: v.id("chatMessages"),
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const conversationText = args.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const extractionPrompt = `Analyze this cooking conversation and extract user preferences. Focus on:
1. Food loves (what they enjoy eating)
2. Food dislikes (what they avoid by choice, not allergies)
3. Cooking habits (how they cook, when, meal prep style)
4. Time constraints (how much time they have)
5. Lifestyle context (family situation, work schedule, dietary considerations)

Conversation:
${conversationText}

Return ONLY a JSON array of preferences in this exact format:
[
  {
    "type": "food_love" | "food_dislike" | "cooking_habit" | "time_constraint" | "lifestyle_context",
    "summary": "concise statement (e.g., 'loves chicken', 'needs 30-min meals')"
  }
]

If no clear preferences are found, return an empty array [].
IMPORTANT: Return ONLY the JSON array, no other text.`;

    try {
      const result = await model.generateContent(extractionPrompt);
      const responseText = result.response.text();

      // Parse JSON response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log("[PREFERENCE EXTRACTION] No preferences found");
        return [];
      }

      const preferences = JSON.parse(jsonMatch[0]);

      // Process each extracted preference
      for (const pref of preferences) {
        await ctx.runMutation(internal.memory.learnedPreferences.upsertPreference, {
          userId: args.userId,
          agentId: args.agentId,
          preferenceType: pref.type,
          summary: pref.summary,
          sessionId: args.sessionId,
          messageIds: args.messages.map((m) => m._id),
        });
      }

      console.log(`[PREFERENCE EXTRACTION] Extracted ${preferences.length} preferences`);
      return preferences;
    } catch (error) {
      console.error("[PREFERENCE EXTRACTION] Error:", error);
      return [];
    }
  },
});

/**
 * Upsert a learned preference with consolidation logic
 * If similar preference exists, increase confidence. Otherwise, create new.
 */
export const upsertPreference = internalMutation({
  args: {
    userId: v.string(),
    agentId: v.optional(v.string()),
    preferenceType: v.union(
      v.literal("food_love"),
      v.literal("food_dislike"),
      v.literal("cooking_habit"),
      v.literal("time_constraint"),
      v.literal("lifestyle_context")
    ),
    summary: v.string(),
    sessionId: v.string(),
    messageIds: v.array(v.id("chatMessages")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Find similar existing preference (exact match or semantic similarity)
    const existingPreferences = await ctx.db
      .query("learnedPreferences")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", args.userId).eq("preferenceType", args.preferenceType)
      )
      .filter((q) =>
        args.agentId ? q.eq(q.field("agentId"), args.agentId) : q.eq(q.field("agentId"), undefined)
      )
      .collect();

    // Check for exact or very similar preference
    const similarPreference = existingPreferences.find(
      (p) =>
        p.summary.toLowerCase() === args.summary.toLowerCase() ||
        p.summary.toLowerCase().includes(args.summary.toLowerCase()) ||
        args.summary.toLowerCase().includes(p.summary.toLowerCase())
    );

    if (similarPreference) {
      // Update existing preference: increase confidence and source count
      const newConfidence = Math.min(0.95, similarPreference.confidence + 0.15);
      const newSourceCount = similarPreference.sourceCount + 1;

      await ctx.db.patch(similarPreference._id, {
        confidence: newConfidence,
        sourceCount: newSourceCount,
        lastMentionedAt: now,
        extractedFrom: {
          sessionIds: [
            ...similarPreference.extractedFrom.sessionIds,
            args.sessionId,
          ],
          messageIds: [
            ...similarPreference.extractedFrom.messageIds,
            ...args.messageIds,
          ],
        },
        updatedAt: now,
      });

      console.log(
        `[PREFERENCE] Updated existing: "${args.summary}" (confidence: ${newConfidence.toFixed(2)})`
      );
      return similarPreference._id;
    } else {
      // Create new preference with initial confidence
      // Generate embedding for semantic search
      const embeddingResponse = await fetch(
        "https://api.openai.com/v1/embeddings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            input: args.summary,
            model: "text-embedding-3-small",
          }),
        }
      );

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      const preferenceId = await ctx.db.insert("learnedPreferences", {
        userId: args.userId,
        agentId: args.agentId,
        preferenceType: args.preferenceType,
        summary: args.summary,
        confidence: 0.5, // Initial confidence
        sourceCount: 1,
        lastMentionedAt: now,
        embedding,
        embeddingModel: "text-embedding-3-small",
        extractedFrom: {
          sessionIds: [args.sessionId],
          messageIds: args.messageIds,
        },
        createdAt: now,
        updatedAt: now,
      });

      console.log(`[PREFERENCE] Created new: "${args.summary}" (confidence: 0.50)`);
      return preferenceId;
    }
  },
});

/**
 * Get top N learned preferences by confidence
 */
export const getTopPreferences = query({
  args: {
    userId: v.string(),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const preferences = await ctx.db
      .query("learnedPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        args.agentId ? q.eq(q.field("agentId"), args.agentId) : q.eq(q.field("agentId"), undefined)
      )
      .collect();

    // Sort by confidence (descending) and take top N
    return preferences
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  },
});

/**
 * Get all preferences for a user (grouped by type)
 */
export const getPreferencesByType = query({
  args: {
    userId: v.string(),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("learnedPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        args.agentId ? q.eq(q.field("agentId"), args.agentId) : q.eq(q.field("agentId"), undefined)
      )
      .collect();

    // Group by preference type
    const grouped = {
      food_love: [] as any[],
      food_dislike: [] as any[],
      cooking_habit: [] as any[],
      time_constraint: [] as any[],
      lifestyle_context: [] as any[],
    };

    preferences.forEach((pref) => {
      grouped[pref.preferenceType].push(pref);
    });

    // Sort each group by confidence
    Object.keys(grouped).forEach((type) => {
      grouped[type as keyof typeof grouped].sort((a, b) => b.confidence - a.confidence);
    });

    return grouped;
  },
});

/**
 * Search preferences by semantic similarity
 */
export const searchPreferences = action({
  args: {
    userId: v.string(),
    agentId: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    // Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      input: args.query,
      model: "text-embedding-3-small",
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Vector search (filter by userId only - Convex doesn't support q.and())
    const results = await ctx.vectorSearch("learnedPreferences", "by_embedding", {
      vector: queryEmbedding,
      limit: args.agentId ? limit * 2 : limit, // Get more results if we need to post-filter
      filter: (q) => q.eq("userId", args.userId),
    });

    // Post-filter by agentId if specified
    const filteredResults = args.agentId
      ? results.filter((r) => r.agentId === args.agentId).slice(0, limit)
      : results.slice(0, limit);

    return filteredResults;
  },
});

/**
 * Decay old preferences (reduce confidence for preferences not mentioned in 90+ days)
 * Run as a cron job
 */
export const decayOldPreferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const oldPreferences = await ctx.db
      .query("learnedPreferences")
      .filter((q) => q.lt(q.field("lastMentionedAt"), ninetyDaysAgo))
      .collect();

    let decayedCount = 0;
    for (const pref of oldPreferences) {
      const newConfidence = Math.max(0.1, pref.confidence * 0.7); // 30% decay, min 0.1
      await ctx.db.patch(pref._id, {
        confidence: newConfidence,
        updatedAt: now,
      });
      decayedCount++;
    }

    console.log(`[PREFERENCE DECAY] Decayed ${decayedCount} old preferences`);
    return decayedCount;
  },
});

/**
 * Delete a learned preference
 */
export const deletePreference = mutation({
  args: {
    preferenceId: v.id("learnedPreferences"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.preferenceId);
  },
});
