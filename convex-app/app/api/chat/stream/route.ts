import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { decideIntent } from "@/lib/intent";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const runtime = "edge"; // Enable Vercel Edge Runtime for streaming

// SYSTEM PROMPT MODE - Switch to control AI behavior
// "greeting_first": Greet → Understand intent → Call tools (conversational, friendly)
// "direct_action": Execute requests immediately (fast, no small talk)
const PROMPT_MODE = "greeting_first" as const;

interface ChatStreamRequest {
  sessionId: string;
  userId: string;
  communityId: string;
  message: string;
  model: "gpt-5-mini" | "grok-4-fast" | "claude-haiku-4.5" | "gpt-4o-mini" | "gpt-4.1-mini";
  aiSettings: {
    aiName: string;
    persona: string;
    temperature: number;
  };
  selectedRecipe?: {
    id: string;
    name: string;
    description: string;
    ingredients: string[];
    steps: string[];
    dietTags: string[];
  };
  isRecipeSelection?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    // ⏱️ TIMING: Track request start
    const requestStartTime = Date.now();

    const body: ChatStreamRequest = await req.json();
    const { sessionId, userId, communityId, message, model, aiSettings, selectedRecipe, isRecipeSelection } = body;

    // STEP 1: Run ALL independent operations in parallel (intent + save + get + custom prompt)
    console.log(`[INTENT] Classifying query: "${message.substring(0, 50)}..."`);
    const parallelStart = Date.now();
    const [intentDecision, userMessageId, messages, customPrompt] = await Promise.all([
      // Classify intent for smart memory retrieval
      decideIntent(message),
      // Save user message to Convex (skip for recipe selections)
      isRecipeSelection
        ? Promise.resolve(undefined) // Don't save message for recipe selections
        : convex.mutation(api.communitychat.addMessage, {
            sessionId: sessionId as Id<"chatSessions">,
            role: "user",
            content: message,
          }),
      // Get session messages for context
      convex.query(api.communitychat.getSessionMessages, {
        sessionId: sessionId as Id<"chatSessions">,
      }),
      // Load custom system prompt (if user has one saved)
      convex.query(api.systemPrompts.getPrompt, { userId }),
    ]);
    const parallelLatency = Date.now() - parallelStart;

    console.log(
      `[INTENT] ${intentDecision.intent} (confidence: ${(intentDecision.confidence * 100).toFixed(0)}%, ` +
        `usedGrok: ${intentDecision.usedGrok}, parallel time: ${parallelLatency}ms)`,
    );

    // STEP 2.5: Retrieve context with smart caching
    // Cache hit → 30-50ms, Cache miss → 700-2000ms
    const memoryStart = Date.now();
    const mergedContext = await convex.action(
      api.memory.cacheIntelligence.getContextWithCache,
      {
        userId,
        sessionId: sessionId as Id<"chatSessions">,
        query: message,
        intent: intentDecision.intent,
        newMessageId: userMessageId as Id<"chatMessages"> | undefined,
      },
    );
    const memoryLatency = Date.now() - memoryStart;

    // Log cache + memory retrieval stats
    if (mergedContext && mergedContext.stats) {
      const cacheStatus = mergedContext.stats.cached ? "🎯 HIT" : "❌ MISS";
      console.log(
        `[CACHE] ${cacheStatus} - ${mergedContext.source} ` +
          `(${mergedContext.stats.totalLatencyMs}ms)` +
          (mergedContext.stats.cached
            ? ` [age=${Math.floor((mergedContext.stats.cacheAge || 0) / 1000)}s]`
            : ""),
      );
      console.log(
        `[PROFILE+MEMORY] Profile=${mergedContext.stats.hasProfile ? "YES" : "NO"}, ` +
          `Keywords=${mergedContext.stats.keywordCount}, Recent=${mergedContext.stats.recentCount}, ` +
          `Vector=${mergedContext.stats.vectorCount}, Threads=${mergedContext.stats.threadCount}`,
      );
    }

    // STEP 3: Build simplified system prompt
    // Detect if message is a greeting
    const greetingWords = ['hi', 'hello', 'hey', 'greetings', 'hi there', 'hello there'];
    const isGreeting = greetingWords.some(word =>
      message.toLowerCase().trim() === word ||
      message.toLowerCase().trim().startsWith(word + ' ') ||
      message.toLowerCase().trim().startsWith(word + ',') ||
      message.toLowerCase().trim().startsWith(word + '!')
    );

    const buildSystemPrompt = (userContext: string) => {
      let prompt = "";

      // PRIMARY DIRECTIVE - Most important!
      prompt += `YOUR PRIMARY TASK: Respond DIRECTLY to what the user ACTUALLY asks for.\n\n`;

      prompt += `Before doing ANYTHING else, ask yourself:\n`;
      prompt += `"What did the user ACTUALLY ask me to do?"\n\n`;

      // AI IDENTITY & PURPOSE (2 sentences - always present)
      prompt += `You are ${aiSettings.aiName}, a helpful cooking and recipe assistant. `;
      prompt += `You continuously learn from user interactions to build a self-improving system that remembers their food preferences without asking questions.\n\n`;

      // CRITICAL: Read the user's ACTUAL message carefully!
      prompt += `## Response Strategy\n`;
      prompt += `READ THE USER'S ACTUAL MESSAGE. Understand what they are REALLY asking for.\n\n`;

      prompt += `STEP 1: What is the user asking for?\n`;
      prompt += `- Are they ONLY greeting you?\n`;
      prompt += `- Are they asking you to suggest/provide/recommend a recipe or meal?\n`;
      prompt += `- Are they asking a question?\n\n`;

      prompt += `STEP 2: Respond to what they ACTUALLY asked:\n\n`;

      prompt += `IF they are ONLY greeting (nothing else):\n`;
      prompt += `  - DO: Greet back briefly and ask what they need\n`;
      prompt += `  - DO NOT: Provide any recipe, meal plan, or food suggestion\n`;
      prompt += `  - DO NOT: Mention their profile or preferences\n`;
      prompt += `  - DO NOT: Be proactive with meal ideas\n\n`;

      prompt += `IF they are asking for a recipe/meal/suggestion:\n`;
      prompt += `  - DO: Provide full recipe immediately using their profile\n`;
      prompt += `  - DO NOT: Just ask what they want - they already told you!\n\n`;

      prompt += `IF they are asking a question:\n`;
      prompt += `  - DO: Answer it directly\n\n`;

      // User context (if available)
      if (userContext) {
        prompt += `## User Profile\n${userContext}\n\n`;
      }

      // Selected Recipe Context (if user clicked a recipe)
      if (selectedRecipe) {
        prompt += `## Selected Recipe\n`;
        prompt += `The user just selected this recipe to discuss:\n\n`;
        prompt += `**${selectedRecipe.name}**\n`;
        if (selectedRecipe.description) {
          prompt += `${selectedRecipe.description}\n\n`;
        }
        prompt += `**Ingredients:**\n`;
        selectedRecipe.ingredients.forEach((ing) => {
          prompt += `- ${ing}\n`;
        });
        prompt += `\n**Instructions:**\n`;
        selectedRecipe.steps.forEach((step, idx) => {
          prompt += `${idx + 1}. ${step}\n`;
        });
        if (selectedRecipe.dietTags && selectedRecipe.dietTags.length > 0) {
          prompt += `\n**Tags:** ${selectedRecipe.dietTags.join(", ")}\n`;
        }
        prompt += `\n`;
      }

      // Behavioral instructions
      prompt += `## Instructions\n`;
      prompt += `- Use profile information to personalize suggestions, but NEVER mention these details explicitly\n`;
      prompt += `- Be helpful and responsive to what the user ACTUALLY asked for\n\n`;

      // Tools
      prompt += `## Tools\n`;
      prompt += `You have access to the following tool:\n\n`;
      prompt += `**search_recipes**: Search the recipe database for recipes\n`;
      prompt += `- Use when user explicitly asks to find/search/show recipes or wants meal suggestions\n`;
      prompt += `- Examples: "find chicken recipes", "search for desserts", "show me low-carb meals", "what's for dinner"\n`;
      prompt += `- DO NOT use for general cooking advice or questions about recipes already shown\n\n`;
      prompt += `IMPORTANT: When users ask for recipe or meal suggestions, use the search_recipes tool to find real recipes from the database.\n\n`;
      prompt += `## Recipe Selection\n`;
      prompt += `When a user selects a recipe (you'll see "## Selected Recipe" above with full recipe details):\n`;
      prompt += `- Give a brief, warm acknowledgment (1-2 sentences maximum)\n`;
      prompt += `- Example: "Great choice! Skillet Chicken Tortilla Pie is delicious. What would you like to know?"\n`;
      prompt += `- DO NOT reproduce the full recipe text - the user can already see it on the recipe card\n`;
      prompt += `- DO NOT list ingredients, steps, or timing unless specifically asked\n`;
      prompt += `- Just warmly acknowledge their selection and invite questions\n`;
      prompt += `- Answer specific questions about the recipe when asked (substitutions, techniques, timing, etc.)`;

      return prompt;
    };

    // Build system prompt with user context
    let systemPrompt: string;

    if (customPrompt?.promptText) {
      // Use custom prompt from database
      console.log('[PROMPT] Using custom system prompt from database');
      systemPrompt = customPrompt.promptText;

      // Inject user context if available
      if (mergedContext?.mergedContext) {
        // Build context block: instructions BEFORE actual context
        const contextInstructions = customPrompt.contextInstructions || "";
        const contextBlock = contextInstructions
          ? `${contextInstructions}\n\n${mergedContext.mergedContext}`
          : mergedContext.mergedContext;

        // Replace placeholder with context block
        systemPrompt = systemPrompt.replace(
          '[User context will be injected here at runtime]',
          contextBlock
        );
        // Also handle variations of the placeholder
        systemPrompt = systemPrompt.replace(
          '## User Profile\n[User context will be injected here at runtime]',
          `## User Profile\n${contextBlock}`
        );
      }

      // Inject selected recipe context (if user clicked a recipe)
      if (selectedRecipe) {
        let recipeContext = `\n\n## Selected Recipe\n`;
        recipeContext += `The user just selected this recipe to discuss:\n\n`;
        recipeContext += `**${selectedRecipe.name}**\n`;
        if (selectedRecipe.description) {
          recipeContext += `${selectedRecipe.description}\n\n`;
        }
        recipeContext += `**Ingredients:**\n`;
        selectedRecipe.ingredients.forEach((ing) => {
          recipeContext += `- ${ing}\n`;
        });
        recipeContext += `\n**Instructions:**\n`;
        selectedRecipe.steps.forEach((step, idx) => {
          recipeContext += `${idx + 1}. ${step}\n`;
        });
        if (selectedRecipe.dietTags && selectedRecipe.dietTags.length > 0) {
          recipeContext += `\n**Tags:** ${selectedRecipe.dietTags.join(", ")}\n`;
        }
        recipeContext += `\n`;
        recipeContext += `IMPORTANT: Give a brief acknowledgment (1-2 sentences) and invite questions. Do NOT reproduce the full recipe.\n`;

        systemPrompt += recipeContext; // Append to custom prompt
      }
    } else {
      // Use default prompt builder
      console.log('[PROMPT] Using default system prompt builder');
      systemPrompt = mergedContext?.mergedContext
        ? buildSystemPrompt(mergedContext.mergedContext)
        : `You are ${aiSettings.aiName}, a helpful cooking and recipe assistant. ${aiSettings.persona}\n\nRespond DIRECTLY and HELPFULLY to the user's message.`;
    }

    // DEBUG: Log what context is being injected
    console.log('[DEBUG] ========== USER CONTEXT ==========');
    console.log(mergedContext?.mergedContext || 'No context');
    console.log('[DEBUG] =====================================\n');

    // DEBUG: Log the full system prompt being sent
    console.log('[DEBUG] ========== FULL SYSTEM PROMPT ==========');
    console.log(systemPrompt);
    console.log('[DEBUG] ===========================================\n');

    // No more complex message counting or SESSION INFO - simplified!

    // Build messages array for API with enriched system prompt
    const apiMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      // Include full message history (filtered for malformed content)
      ...messages
        .filter((msg: any) => {
          // Filter out messages containing XML function calls
          const hasXML =
            msg.content &&
            (msg.content.includes("<function_call") ||
              msg.content.includes("</function_call>"));
          if (hasXML) {
            console.log(
              `[FILTER] Removed XML function call from history: ${msg.content.substring(0, 50)}`,
            );
          }
          return !hasXML;
        })
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      // Current message (emphasized by being last in conversation)
      {
        role: "user" as const,
        content: isRecipeSelection ? `I'd like to know more about ${selectedRecipe?.name}` : message,
      },
      // Final system reminder (keeps focus on current request)
      {
        role: "system" as const,
        content: isRecipeSelection
          ? "The user selected a recipe (see ## Selected Recipe section above). Respond in EXACTLY 2 sentences. Briefly reference specific recipe ingredients in your response."
          : selectedRecipe
            ? "Answer the user's question about the selected recipe using the ingredients listed above."
            : "The message above is the user's CURRENT request. Respond to it directly while using conversation history for context.",
      },
    ];

    // Determine which API to call
    const apiKey = process.env.OPEN_ROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPEN_ROUTER_API_KEY not configured");
    }

    const modelName =
      model === "grok-4-fast" ? "x-ai/grok-4-fast" :
      model === "claude-haiku-4.5" ? "anthropic/claude-haiku-4.5" :
      model === "gpt-4o-mini" ? "openai/gpt-4o-mini" :
      model === "gpt-4.1-mini" ? "openai/gpt-4.1-mini" :
      "openai/gpt-5-mini";

    // TOOLS ENABLED - Recipe search + memory retrieval (with explicit negative examples to prevent over-calling)
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "search_recipes",
          description:
            "Search the recipe database for recipes. USE ONLY when user explicitly requests to find/search/show recipes OR asks 'what recipes do you have'. Examples: 'find chicken recipes', 'search for desserts', 'show me low-carb meals'. DO NOT use for: general cooking advice, questions about recipes already shown, greetings/thanks, ingredient substitutions, cooking techniques, or 'tell me about myself'.",
          parameters: {
            type: "object" as const,
            properties: {
              query: {
                type: "string" as const,
                description:
                  "The search query describing what recipe to find (e.g., 'pasta recipes', 'vegan dinner', 'chocolate dessert')",
              },
              dietaryTags: {
                type: "array" as const,
                description:
                  "ONLY include if user explicitly mentions dietary restrictions. Valid values: 'vegan', 'vegetarian', 'pescatarian', 'gluten-free', 'dairy-free', 'omnivore'. Omit this field for general recipe searches.",
                items: {
                  type: "string" as const,
                },
              },
              limit: {
                type: "number" as const,
                description: "Number of recipes to return (default: 3)",
              },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "retrieve_user_memories",
          description:
            "Search AI-learned memories about the user's cooking habits, preferences, and past interactions. Supports time-based filtering. USE ONLY when user explicitly references past information (e.g., 'What did I say about chicken?', 'pasta from last week', 'Remember when I mentioned...'). DO NOT use for: current conversation context, profile info (already provided), recipe requests, or general cooking questions.",
          parameters: {
            type: "object" as const,
            properties: {
              query: {
                type: "string" as const,
                description:
                  "The search query to find relevant memories (e.g., 'chicken preferences', 'cooking equipment user owns', 'pasta dishes', 'time constraints mentioned'). Be specific to get better results.",
              },
              timeRangeDays: {
                type: "number" as const,
                description:
                  "Optional: Filter memories by time range in days (e.g., 7 for 'last week', 30 for 'last month', 365 for 'last year'). Omit for all-time search.",
              },
            },
            required: ["query"],
          },
        },
      },
    ];

    // DEBUG: Log the API request details
    console.log('[DEBUG] ========== API REQUEST ==========');
    console.log('Model:', modelName);
    console.log('Messages count:', apiMessages.length);
    console.log('\nALL MESSAGES BEING SENT TO API:');
    apiMessages.forEach((msg, idx) => {
      console.log(`\n--- Message ${idx} (${msg.role}) ---`);
      console.log(msg.content);
    });
    console.log('\n[DEBUG] ====================================\n');

    // ⏱️ TIMING: Track API call start
    const apiCallStartTime = Date.now();
    console.log(`⏱️ [TIMING] API call initiated to ${modelName} at ${new Date(apiCallStartTime).toISOString()}`);

    // Create streaming response (tools disabled for now)
    const apiResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://healthymama.app",
          "X-Title": "HealthyMama Community Chat",
        },
        body: JSON.stringify({
          model: modelName,
          messages: apiMessages,
          temperature: aiSettings.temperature,
          max_tokens: 2000,
          stream: true, // Enable streaming
          reasoning_effort: "low", // Reduce thinking time for faster responses (GPT-5 parameter)
          // TOOLS ENABLED
          tools, // Always provide tools - AI decides when to use them based on system prompt
          tool_choice: "auto",
        }),
      },
    );

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(
        `OpenRouter API error: ${apiResponse.status} - ${errorText}`,
      );
    }

    // Create a TransformStream to process the streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let assistantResponse = "";
    let toolCalls: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }> = [];
    let currentToolCallIndex = -1;
    let foundRecipes: any[] = []; // Track recipes for persistence
    let recipesDisplayed = false; // Track if recipe cards have been shown (to block duplicate text)

    // ⏱️ TIMING: Track first token and completion
    let firstTokenTime: number | null = null;
    let completionTime: number | null = null;

    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = apiResponse.body?.getReader();
          if (!reader) {
            throw new Error("No response body");
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Handle tool calls if present
              if (toolCalls.length > 0) {
                console.log(
                  `[TOOL CALLS] Processing ${toolCalls.length} tool calls`,
                );

                let toolResults = "";

                for (const toolCall of toolCalls) {
                  if (toolCall.function.name === "search_recipes") {
                    try {
                      const args = JSON.parse(toolCall.function.arguments);
                      console.log(
                        `[TOOL CALLS] Searching recipes with query: "${args.query}"`,
                      );

                      // Set flag IMMEDIATELY to activate content filter (blocks ingredient lists from showing as text)
                      recipesDisplayed = true;

                      // Send status update to user
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content: "\n\n🔍 Searching recipes...\n\n" })}\n\n`,
                        ),
                      );

                      // Call recipe search action (with userId for profile enhancement)
                      const recipes = await convex.action(
                        api.recipeRetrieval.searchRecipesByQuery,
                        {
                          query: args.query,
                          communityId,
                          userId, // Pass userId for profile-based query enhancement
                          limit: args.limit || 3,
                          dietaryTags: args.dietaryTags,
                        },
                      );

                      console.log(
                        `[TOOL CALLS] Found ${recipes.length} recipes`,
                      );

                      // Store recipes for persistence in message metadata
                      foundRecipes = recipes;

                      // Format recipes for response
                      if (recipes.length > 0) {
                        // Send brief acknowledgment to UI
                        const acknowledgment = `✨ I found ${recipes.length} recipe${recipes.length > 1 ? "s" : ""} for you! Click on any recipe to discuss it further.\n\n`;
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({ content: acknowledgment })}\n\n`,
                          ),
                        );

                        // Stream the recipe DATA to frontend (visual cards only, no duplicate text)
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({ recipeData: recipes })}\n\n`,
                          ),
                        );

                        // Add ONLY the brief acknowledgment to saved message (no full ingredient lists)
                        // Recipe details are preserved in metadata.recipeData for display as cards
                        toolResults += acknowledgment;
                      } else {
                        const noResults =
                          "I couldn't find any recipes matching your request. Try a different search!\n\n";
                        toolResults += noResults;
                        controller.enqueue(
                          encoder.encode(
                            `data: ${JSON.stringify({ content: noResults })}\n\n`,
                          ),
                        );
                      }
                    } catch (error: any) {
                      console.error(
                        "[TOOL CALLS] Recipe search failed:",
                        error,
                      );
                      const errorMsg =
                        "Sorry, I encountered an error while searching for recipes. Please try again.\n\n";
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content: errorMsg })}\n\n`,
                        ),
                      );
                    }
                  } else if (
                    toolCall.function.name === "retrieve_user_memories"
                  ) {
                    try {
                      const args = JSON.parse(toolCall.function.arguments);
                      const searchQuery = args.query || message; // Use provided query or fall back to current message
                      const timeRangeDays = args.timeRangeDays; // Optional time filter

                      const timeInfo = timeRangeDays
                        ? ` (last ${timeRangeDays} days)`
                        : " (all time)";

                      console.log(
                        `[TOOL CALLS] SIMPLIFIED memory search: "${searchQuery}"${timeInfo}`,
                      );

                      // Send status update to user
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content: `\n\n🔍 Searching memories${timeInfo}...\n\n` })}\n\n`,
                        ),
                      );

                      // SIMPLIFIED: Single-path retrieval with optional time filtering
                      const memories = await convex.action(
                        api.memory.smartRetrieval.retrieveMemoriesSimplified,
                        {
                          userId,
                          query: searchQuery,
                          timeRangeDays,
                          limit: 10,
                        },
                      );

                      let memoryContext = "";
                      if (memories && memories.formattedContext) {
                        memoryContext = memories.formattedContext;
                      }

                      console.log(
                        `[TOOL CALLS] Memory retrieval complete: ${memories?.stats.memoryCount || 0} memories found`,
                      );

                      // TWO-PHASE FLOW: Make second API call with memory context
                      console.log("[TOOL CALLS] Phase 2: Sending memories to AI for final response");

                      // Build enriched messages array with tool results
                      const enrichedMessages = [
                        {
                          role: "system" as const,
                          content: systemPrompt,
                        },
                        ...messages
                          .filter((msg: any) => {
                            const hasXML =
                              msg.content &&
                              (msg.content.includes("<function_call") ||
                                msg.content.includes("</function_call>"));
                            return !hasXML;
                          })
                          .map((msg: any) => ({
                            role: msg.role as "user" | "assistant",
                            content: msg.content,
                          })),
                        {
                          role: "user" as const,
                          content: message,
                        },
                        // AI's tool call (assistant message with tool_calls)
                        {
                          role: "assistant" as const,
                          content: null as any,
                          tool_calls: [
                            {
                              id: toolCall.id,
                              type: "function" as const,
                              function: {
                                name: "retrieve_user_memories",
                                arguments: toolCall.function.arguments,
                              },
                            },
                          ],
                        },
                        // Tool result
                        {
                          role: "tool" as const,
                          tool_call_id: toolCall.id,
                          content: memoryContext || "No memories found for this query.",
                        },
                      ];

                      // Make second API call with enriched conversation
                      const secondApiResponse = await fetch(
                        "https://openrouter.ai/api/v1/chat/completions",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${apiKey}`,
                            "HTTP-Referer": "https://healthymama.app",
                            "X-Title": "HealthyMama Community Chat",
                          },
                          body: JSON.stringify({
                            model: modelName,
                            messages: enrichedMessages,
                            temperature: aiSettings.temperature,
                            max_tokens: 2000,
                            stream: true,
                            reasoning_effort: "low",
                          }),
                        },
                      );

                      if (!secondApiResponse.ok) {
                        throw new Error(`Second API call failed: ${secondApiResponse.status}`);
                      }

                      // Stream the AI's final response that uses the memories
                      const secondReader = secondApiResponse.body?.getReader();
                      if (!secondReader) {
                        throw new Error("No response body from second API call");
                      }

                      let secondBuffer = "";
                      let finalResponse = "";

                      while (true) {
                        const { done: secondDone, value: secondValue } = await secondReader.read();

                        if (secondDone) {
                          console.log(
                            `[TOOL CALLS] Phase 2 complete: AI generated ${finalResponse.length} char response using memories`,
                          );
                          toolResults += finalResponse;
                          break;
                        }

                        secondBuffer += decoder.decode(secondValue, { stream: true });
                        const secondSegments = secondBuffer.split("\n");
                        secondBuffer = secondSegments.pop() ?? "";

                        const secondLines = secondSegments
                          .map((line) => line.trim())
                          .filter((line) => line.length > 0);

                        for (const line of secondLines) {
                          if (line.startsWith("data: ")) {
                            const data = line.slice(6);

                            if (data === "[DONE]") {
                              continue;
                            }

                            try {
                              const parsed = JSON.parse(data);
                              const delta = parsed.choices?.[0]?.delta;
                              const content = delta?.content || "";

                              if (content) {
                                finalResponse += content;
                                // Stream to user
                                controller.enqueue(
                                  encoder.encode(
                                    `data: ${JSON.stringify({ content })}\n\n`,
                                  ),
                                );
                              }
                            } catch (e) {
                              console.error("Failed to parse second API response chunk:", e);
                            }
                          }
                        }
                      }
                    } catch (error: any) {
                      console.error(
                        "[TOOL CALLS] Memory retrieval failed:",
                        error,
                      );
                      const errorMsg =
                        "Sorry, I encountered an error retrieving your information. Please try again.\n\n";
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content: errorMsg })}\n\n`,
                        ),
                      );
                      toolResults += errorMsg;
                    }
                  }
                }

                // Append tool results to assistant response for memory
                assistantResponse += toolResults;
              }

              // ⏱️ TIMING: Mark completion
              completionTime = Date.now();

              // Calculate comprehensive timing metrics
              const totalLatency = completionTime - requestStartTime;
              const apiLatency = completionTime - apiCallStartTime;
              const ttft = firstTokenTime ? firstTokenTime - apiCallStartTime : null;
              const streamingDuration = firstTokenTime ? completionTime - firstTokenTime : null;
              const preprocessingTime = apiCallStartTime - requestStartTime;

              // Log comprehensive timing summary
              console.log('\n⏱️ ========== TIMING SUMMARY ==========');
              console.log(`⏱️ Total Request Time: ${totalLatency}ms`);
              console.log(`⏱️ Preprocessing (parallel ops + memory): ${preprocessingTime}ms`);
              console.log(`⏱️   - Parallel ops (intent + save + get): ${parallelLatency}ms`);
              console.log(`⏱️   - Memory retrieval: ${memoryLatency}ms`);
              console.log(`⏱️ API Response Time: ${apiLatency}ms`);
              if (ttft !== null) {
                console.log(`⏱️   - Time to First Token (TTFT): ${ttft}ms`);
              }
              if (streamingDuration !== null) {
                console.log(`⏱️   - Streaming duration: ${streamingDuration}ms`);
              }
              console.log(`⏱️ Model: ${modelName}`);
              console.log(`⏱️ Response length: ${assistantResponse.length} chars`);
              console.log('⏱️ =====================================\n');

              // Save complete assistant response to Convex with recipe metadata
              const assistantMessageId = await convex.mutation(
                api.communitychat.addMessage,
                {
                  sessionId: sessionId as Id<"chatSessions">,
                  role: "assistant",
                  content: assistantResponse,
                  metadata:
                    foundRecipes.length > 0
                      ? {
                          recipeData: foundRecipes,
                        }
                      : undefined,
                },
              );

              // STEP 4: Auto-name chat session after 2nd user message (async, non-blocking)
              const userMessageCount = messages.filter((msg: any) => msg.role === "user").length;
              if (userMessageCount === 2) {
                console.log("[AutoTitle] Triggering auto-naming after 2nd user message");
                convex
                  .action(api.communitychat.generateSessionTitle, {
                    sessionId: sessionId as Id<"chatSessions">,
                  })
                  .then(() => {
                    console.log("[AutoTitle] Session title generation complete");
                  })
                  .catch((error) => {
                    console.error("[AutoTitle] Failed to generate title:", error);
                    // Don't throw - title generation failures shouldn't break chat
                  });
              }

              // Trigger NEW tiered memory processing (GPT-5 Nano + GPT-5 Mini)
              // This replaces the old aggressive DELETE system
              console.log(
                `[STREAM] Triggering memory processing for message: "${message.substring(0, 50)}..."`,
              );
              convex
                .action(api.memory.tieredProcessing.processMessageMemory, {
                  messageId: userMessageId as Id<"chatMessages">,
                  sessionId: sessionId as Id<"chatSessions">,
                  userId,
                  communityId,
                  messageContent: message,
                  role: "user",
                })
                .then(() => {
                  console.log(
                    "[STREAM] Memory processing triggered successfully",
                  );
                })
                .catch((error) => {
                  console.error("[STREAM] Memory processing failed:", error);
                  // Don't throw - memory processing failures shouldn't break chat
                });

              // Send final event
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              break;
            }

            // Decode and process chunks
            buffer += decoder.decode(value, { stream: true });
            const segments = buffer.split("\n");
            buffer = segments.pop() ?? "";

            const lines = segments
              .map((line) => line.trim())
              .filter((line) => line.length > 0);

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6); // Remove "data: " prefix

                if (data === "[DONE]") {
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta;
                  const finishReason = parsed.choices?.[0]?.finish_reason;

                  // Debug: Log finish_reason when present
                  if (finishReason) {
                    console.log(`[STREAM] Finish reason: ${finishReason}`);
                    if (finishReason === "length") {
                      console.warn(
                        "[STREAM] ⚠️ Response truncated - hit max_tokens limit",
                      );
                    } else if (finishReason === "content_filter") {
                      console.warn(
                        "[STREAM] ⚠️ Response blocked by content filter",
                      );
                    } else if (finishReason === "tool_calls") {
                      console.log(
                        "[STREAM] ✓ Response stopped for tool execution",
                      );
                    } else if (finishReason === "stop") {
                      console.log("[STREAM] ✓ Response completed normally");
                    }
                  }

                  // Handle tool calls
                  if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                      const index = toolCall.index ?? 0;

                      // Initialize tool call if this is the first chunk
                      if (!toolCalls[index]) {
                        toolCalls[index] = {
                          id: toolCall.id || `call_${index}`,
                          type: toolCall.type || "function",
                          function: {
                            name: toolCall.function?.name || "",
                            arguments: toolCall.function?.arguments || "",
                          },
                        };
                        currentToolCallIndex = index;
                        console.log(
                          `[TOOL CALLS] Initiated: ${toolCall.function?.name || "unknown"} (index ${index})`,
                        );
                      } else {
                        // Append to existing tool call arguments
                        if (toolCall.function?.arguments) {
                          toolCalls[index].function.arguments +=
                            toolCall.function.arguments;
                        }
                      }
                    }
                  }

                  // Handle regular content
                  const content = delta?.content || "";
                  if (content) {
                    // ⏱️ TIMING: Track first token arrival
                    if (!firstTokenTime) {
                      firstTokenTime = Date.now();
                      const ttft = firstTokenTime - apiCallStartTime;
                      console.log(`⏱️ [TIMING] First token received: ${ttft}ms (TTFT)`);
                    }

                    // Filter out both XML AND JSON function call text (Grok fallback behavior)
                    const containsXML =
                      content.includes("<function_call") ||
                      content.includes("</function_call>");
                    const containsJSON =
                      (content.includes('"tool_calls"') ||
                        (content.includes('"function"') &&
                          content.includes('"name"'))) &&
                      content.includes("{");

                    // Filter out recipe details (ingredients, instructions) if recipes have already been displayed
                    const containsRecipeDetails =
                      recipesDisplayed &&
                      (content.includes("Ingredients:") ||
                        content.includes("**Ingredients**") ||
                        content.includes("tablespoon") ||
                        content.includes("cup") ||
                        content.includes("teaspoon") ||
                        content.includes("Instructions:") ||
                        content.match(/^\d+\.\s/)); // Numbered list items

                    assistantResponse += content;

                    // Only stream to client if not a function call AND not duplicate recipe details
                    if (
                      !containsXML &&
                      !containsJSON &&
                      !containsRecipeDetails
                    ) {
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content })}\n\n`,
                        ),
                      );
                    } else if (containsRecipeDetails) {
                      console.warn(
                        "[STREAM] ⚠️ Filtered duplicate recipe details from display:",
                        content.substring(0, 50),
                      );
                    } else {
                      console.warn(
                        "[STREAM] ⚠️ Filtered function call text from display:",
                        content.substring(0, 50),
                      );
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.error("Failed to parse SSE chunk:", e);
                }
              }
            }
          }
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat stream error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
