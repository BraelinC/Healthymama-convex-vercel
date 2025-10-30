/**
 * Memory System Actions (Mem0-style)
 * Handles LLM calls, embeddings, and orchestration
 * Actions run in Node.js environment
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { api } from "../_generated/api";
import { createExtractionPrompt, createUpdatePrompt } from "./prompts";

// ========== HELPER FUNCTIONS ==========

/**
 * Call OpenAI Embeddings API
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
 * Call LLM for fact extraction or update decisions
 */
async function callLLM(
  prompt: string,
  model: string = "gpt-4o-mini"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Low temperature for consistent extraction
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content ?? "";
}

// ========== ACTIONS ==========

/**
 * Extract facts from conversation messages
 */
export const extractFacts = action({
  args: {
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const prompt = createExtractionPrompt(args.messages);
    const response = await callLLM(prompt);

    try {
      // Parse JSON response
      const parsed = JSON.parse(response);
      return parsed.facts || [];
    } catch (error) {
      console.error("Failed to parse extraction response:", response);
      return [];
    }
  },
});

/**
 * Decide update operation for a new fact
 */
export const decideUpdate = action({
  args: {
    newFact: v.string(),
    existingMemories: v.array(
      v.object({
        id: v.string(),
        text: v.string(),
        similarity: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const prompt = createUpdatePrompt(args.newFact, args.existingMemories);
    const response = await callLLM(prompt);

    try {
      const parsed = JSON.parse(response);
      return {
        operation: parsed.operation as "ADD" | "UPDATE" | "DELETE" | "NONE",
        memoryId: parsed.memory_id,
        finalMemory: parsed.final_memory,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error("Failed to parse update decision:", response);
      return {
        operation: "NONE" as const,
        memoryId: null,
        finalMemory: "",
        reasoning: "Failed to parse LLM response",
      };
    }
  },
});

/**
 * Main memory processing pipeline
 * Called after each chat message to update user memories
 */
export const processMemoryUpdate = action({
  args: {
    sessionId: v.id("chatSessions"),
    userId: v.string(),
    latestMessages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        messageId: v.id("chatMessages"),
      })
    ),
  },
  handler: async (ctx, args) => {
    console.log(`[Memory] Processing update for user ${args.userId}`);

    try {
      // Step 1: Extract facts from conversation
      const facts = await ctx.runAction(api.memory.operations.extractFacts, {
        messages: args.latestMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      if (facts.length === 0) {
        console.log("[Memory] No facts extracted");
        return { processed: 0, added: 0, updated: 0, deleted: 0 };
      }

      console.log(`[Memory] Extracted ${facts.length} facts`);

      let addedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      // Step 2: Parallelize embedding generation for all facts
      console.log(`[Memory] Generating ${facts.length} embeddings in parallel...`);
      const embeddings = await Promise.all(
        facts.map((fact) => generateEmbedding(fact))
      );

      // Step 3: Parallelize memory searches
      console.log(`[Memory] Searching for similar memories in parallel...`);
      const similarMemoriesList = await Promise.all(
        embeddings.map((embedding) =>
          ctx.runQuery(api.memory.mutations.searchMemories, {
            userId: args.userId,
            embedding,
            topK: 5,
          })
        )
      );

      // Step 4: Parallelize LLM decision making
      console.log(`[Memory] Making ${facts.length} update decisions in parallel...`);
      const decisions = await Promise.all(
        facts.map((fact, idx) =>
          ctx.runAction(api.memory.operations.decideUpdate, {
            newFact: fact,
            existingMemories: similarMemoriesList[idx].map((m) => ({
              id: m._id,
              text: m.text,
              similarity: 0.8, // Placeholder
            })),
          })
        )
      );

      // Step 5: Execute operations (some in parallel, respecting dependencies)
      console.log(`[Memory] Executing memory operations...`);
      for (let i = 0; i < facts.length; i++) {
        const fact = facts[i];
        const embedding = embeddings[i];
        const decision = decisions[i];

        console.log(`[Memory] Decision for "${fact}": ${decision.operation}`);

        // Execute operation
        if (decision.operation === "ADD") {
          await ctx.runMutation(api.memory.mutations.addMemory, {
            userId: args.userId,
            text: fact,
            embedding,
            sessionId: args.sessionId,
            messageIds: args.latestMessages.map((m) => m.messageId),
          });
          addedCount++;
        } else if (decision.operation === "UPDATE" && decision.memoryId) {
          const newEmbedding = await generateEmbedding(decision.finalMemory);
          await ctx.runMutation(api.memory.mutations.updateMemory, {
            memoryId: decision.memoryId as Id<"userMemories">,
            newText: decision.finalMemory,
            newEmbedding,
            sessionId: args.sessionId,
          });
          updatedCount++;
        } else if (decision.operation === "DELETE" && decision.memoryId) {
          await ctx.runMutation(api.memory.mutations.deleteMemory, {
            memoryId: decision.memoryId as Id<"userMemories">,
            sessionId: args.sessionId,
          });
          deletedCount++;
        }
      }

      return {
        processed: facts.length,
        added: addedCount,
        updated: updatedCount,
        deleted: deletedCount,
      };
    } catch (error) {
      console.error("[Memory] Processing error:", error);
      throw error;
    }
  },
});

/**
 * Retrieve relevant memories for a query
 * Used to inject context into chat prompts
 */
export const retrieveMemoriesForQuery = action({
  args: {
    userId: v.string(),
    query: v.string(),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const topK = args.topK ?? 3;

    // Generate embedding for query
    const embedding = await generateEmbedding(args.query);

    // Search for similar memories
    const memories = await ctx.runQuery(api.memory.mutations.searchMemories, {
      userId: args.userId,
      embedding,
      topK,
    });

    return memories.map((m) => ({
      id: m._id,
      text: m.text,
      category: m.category,
      createdAt: m.createdAt,
    }));
  },
});
