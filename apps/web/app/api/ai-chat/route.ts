import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@healthymama/convex";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Tool definitions for the AI
const tools = [
  {
    name: "search_recipes",
    description: "Search the recipe database for recipes matching a query. Use this when users ask for recipes, ingredients, or meal ideas.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (e.g., 'chicken recipes', 'quick breakfast', 'pasta dinner')",
        },
        limit: {
          type: "number",
          description: "Maximum number of recipes to return (default: 5)",
          default: 5,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "show_recipe_details",
    description: "Display detailed information about a specific recipe. Use when user wants to see more about a recipe.",
    parameters: {
      type: "object",
      properties: {
        recipeId: {
          type: "string",
          description: "The ID of the recipe to display",
        },
      },
      required: ["recipeId"],
    },
  },
];

// Execute tool calls
async function executeTool(toolName: string, parameters: any, userId: string) {
  console.log(`[AI CHAT] Executing tool: ${toolName}`, parameters);

  switch (toolName) {
    case "search_recipes": {
      const recipes = await convex.action(api.recipes.recipeRetrieval.searchRecipesByQuery, {
        query: parameters.query,
        communityId: "default",
        userId,
        limit: parameters.limit || 5,
      });

      return {
        recipes,
        count: recipes.length,
      };
    }

    case "show_recipe_details": {
      // Return the recipe ID to be handled by the UI
      return {
        recipeId: parameters.recipeId,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, userId, conversationHistory = [], stream = true } = await request.json();

    if (!message || !userId) {
      return NextResponse.json(
        { error: "Missing message or userId" },
        { status: 400 }
      );
    }

    console.log(`[AI CHAT] Processing message from user ${userId}:`, message);
    console.log(`[AI CHAT] Conversation history length:`, conversationHistory.length);

    // Call OpenRouter with Gemini 2.0 Flash
    const apiKey = process.env.OPEN_ROUTER_API_KEY!;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://healthymama.app",
        "X-Title": "HealthyMama Voice Assistant",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-exp:free",
        messages: [
          {
            role: "system",
            content: `You are a friendly voice assistant for HealthyMama, a recipe app.

Your personality:
- Warm, encouraging, and concise
- Keep responses SHORT (1-2 sentences) - you're speaking out loud
- Use casual language like a helpful friend
- Remember previous messages in the conversation and reference them naturally

When users ask for recipes:
1. Use the search_recipes tool with their query
2. Tell them how many recipes you found
3. Briefly describe 1-2 top results

Examples:
User: "I want chicken recipes"
You: [call search_recipes with query="chicken recipes"]
Response: "I found 8 chicken recipes! The top one is a honey garlic chicken that takes 25 minutes."

User: "What should I make for dinner?"
You: [call search_recipes with query="dinner ideas"]
Response: "I've got 12 dinner ideas for you! How about a quick pasta primavera or sheet pan salmon?"

Conversation context awareness:
User: "Find me breakfast recipes"
You: "I found 15 breakfast recipes! There's a quick avocado toast and fluffy pancakes."
User: "What about lunch?"
You: [remember they were looking at breakfast] "For lunch, I've got 20 options! How about a chicken caesar wrap or tomato soup?"`,
          },
          ...conversationHistory,
        ],
        tools: tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
        tool_choice: "auto",
        temperature: 0.7,
        max_tokens: 200, // Keep responses concise for voice
        stream, // Enable streaming
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[AI CHAT] OpenRouter error:", error);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    // If streaming is enabled, return SSE stream
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            let buffer = "";
            let toolCalls: any[] = [];
            let currentToolCall: any = null;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Decode chunk
              buffer += new TextDecoder().decode(value);
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.trim() || line.startsWith(":")) continue;
                if (!line.startsWith("data: ")) continue;

                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices[0]?.delta;

                  // Handle tool calls
                  if (delta?.tool_calls) {
                    const toolCallDelta = delta.tool_calls[0];

                    if (toolCallDelta.index !== undefined) {
                      if (!currentToolCall || currentToolCall.index !== toolCallDelta.index) {
                        currentToolCall = {
                          index: toolCallDelta.index,
                          id: toolCallDelta.id || "",
                          type: "function",
                          function: {
                            name: toolCallDelta.function?.name || "",
                            arguments: toolCallDelta.function?.arguments || "",
                          },
                        };
                        toolCalls.push(currentToolCall);
                      } else {
                        if (toolCallDelta.function?.name) {
                          currentToolCall.function.name += toolCallDelta.function.name;
                        }
                        if (toolCallDelta.function?.arguments) {
                          currentToolCall.function.arguments += toolCallDelta.function.arguments;
                        }
                      }
                    }

                    // Send tool call event
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "tool_call", data: currentToolCall })}\n\n`)
                    );
                  }

                  // Handle content tokens
                  if (delta?.content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "token", data: delta.content })}\n\n`)
                    );
                  }

                  // Handle finish
                  if (parsed.choices[0]?.finish_reason) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "finish", data: parsed.choices[0].finish_reason })}\n\n`)
                    );
                  }
                } catch (e) {
                  console.error("[AI CHAT] Failed to parse SSE chunk:", e);
                }
              }
            }

            // Execute tool calls if any
            if (toolCalls.length > 0) {
              console.log("[AI CHAT] Executing tools:", toolCalls);

              for (const toolCall of toolCalls) {
                try {
                  const parameters = JSON.parse(toolCall.function.arguments);
                  const result = await executeTool(toolCall.function.name, parameters, userId);

                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "tool_result", data: { toolCall, result } })}\n\n`)
                  );
                } catch (error) {
                  console.error(`[AI CHAT] Tool execution failed:`, error);
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "tool_error", data: { toolCall, error: error instanceof Error ? error.message : "Tool execution failed" } })}\n\n`)
                  );
                }
              }

              // Make second streaming call with tool results
              const toolResultsMessage = {
                role: "assistant",
                content: "",
                tool_calls: toolCalls,
              };

              const toolResults = toolCalls.map((tc: any) => ({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(tc.result || {}),
              }));

              const finalResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://healthymama.app",
                  "X-Title": "HealthyMama Voice Assistant",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.0-flash-exp:free",
                  messages: [
                    {
                      role: "system",
                      content: `You are a friendly voice assistant for HealthyMama. Keep responses SHORT (1-2 sentences) for voice output.`,
                    },
                    { role: "user", content: message },
                    toolResultsMessage,
                    ...toolResults,
                  ],
                  temperature: 0.7,
                  max_tokens: 200,
                  stream: true,
                }),
              });

              // Stream final response
              const finalReader = finalResponse.body?.getReader();
              if (finalReader) {
                let finalBuffer = "";
                while (true) {
                  const { done, value } = await finalReader.read();
                  if (done) break;

                  finalBuffer += new TextDecoder().decode(value);
                  const finalLines = finalBuffer.split("\n");
                  finalBuffer = finalLines.pop() || "";

                  for (const line of finalLines) {
                    if (!line.trim() || line.startsWith(":")) continue;
                    if (!line.startsWith("data: ")) continue;

                    const data = line.slice(6);
                    if (data === "[DONE]") continue;

                    try {
                      const parsed = JSON.parse(data);
                      const delta = parsed.choices[0]?.delta;

                      if (delta?.content) {
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ type: "token", data: delta.content })}\n\n`)
                        );
                      }

                      if (parsed.choices[0]?.finish_reason) {
                        controller.enqueue(
                          encoder.encode(`data: ${JSON.stringify({ type: "finish", data: parsed.choices[0].finish_reason })}\n\n`)
                        );
                      }
                    } catch (e) {
                      console.error("[AI CHAT] Failed to parse final SSE chunk:", e);
                    }
                  }
                }
              }
            }

            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          } catch (error) {
            console.error("[AI CHAT] Streaming error:", error);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", data: error instanceof Error ? error.message : "Streaming error" })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming fallback (original code)
    const data = await response.json();
    const aiMessage = data.choices[0].message;

    console.log("[AI CHAT] AI response:", aiMessage);

    // Execute tool calls if any
    const toolCalls = [];
    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      for (const toolCall of aiMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const parameters = JSON.parse(toolCall.function.arguments);

        try {
          const result = await executeTool(toolName, parameters, userId);
          toolCalls.push({
            id: toolCall.id,
            name: toolName,
            parameters,
            result,
          });
        } catch (error) {
          console.error(`[AI CHAT] Tool execution failed:`, error);
          toolCalls.push({
            id: toolCall.id,
            name: toolName,
            parameters,
            error: error instanceof Error ? error.message : "Tool execution failed",
          });
        }
      }

      // If we executed tools, make a second call to get the final response
      if (toolCalls.length > 0 && toolCalls[0].result) {
        const toolResultsMessage = {
          role: "assistant",
          content: aiMessage.content || "",
          tool_calls: aiMessage.tool_calls,
        };

        const toolResults = toolCalls.map((tc) => ({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(tc.result),
        }));

        const finalResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://healthymama.app",
            "X-Title": "HealthyMama Voice Assistant",
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [
              {
                role: "system",
                content: `You are a friendly voice assistant for HealthyMama. Keep responses SHORT (1-2 sentences) for voice output.`,
              },
              { role: "user", content: message },
              toolResultsMessage,
              ...toolResults,
            ],
            temperature: 0.7,
            max_tokens: 200,
          }),
        });

        const finalData = await finalResponse.json();
        const finalMessage = finalData.choices[0].message.content;

        return NextResponse.json({
          message: finalMessage,
          tool_calls: toolCalls,
        });
      }
    }

    // No tool calls, return direct response
    return NextResponse.json({
      message: aiMessage.content || "I'm here to help! What would you like to cook?",
      tool_calls: toolCalls,
    });
  } catch (error) {
    console.error("[AI CHAT] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        message: "Sorry, I encountered an error. Could you try again?",
      },
      { status: 500 }
    );
  }
}
