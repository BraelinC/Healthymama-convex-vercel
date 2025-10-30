"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { updateMessageEmbedding, EMBEDDING_MODEL } from "./messages";

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding request failed: ${err}`);
  }

  const payload = await response.json();
  return payload.data[0].embedding as number[];
}

export const embedMessage = action({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const embedding = await generateEmbedding(args.content);
    await ctx.runMutation(updateMessageEmbedding as any, {
      messageId: args.messageId,
      embedding,
    });
    return embedding;
  },
});

export const embedQuery = action({
  args: {
    query: v.string(),
  },
  handler: async (_ctx, args) => {
    return await generateEmbedding(args.query);
  },
});
