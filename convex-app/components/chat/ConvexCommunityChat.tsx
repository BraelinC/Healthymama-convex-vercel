"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  Plus,
  Settings,
  Menu,
  X,
  Bot,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { UnifiedRecipeCard } from "@/components/recipe/UnifiedRecipeCard";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";

interface ConvexCommunityChatProps {
  userId: string;
  communityId: string;
}

export default function ConvexCommunityChat({
  userId,
  communityId,
}: ConvexCommunityChatProps) {
  // State
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [tempSessionId, setTempSessionId] = useState<string | null>(null); // Temporary session (not saved to DB)
  const [selectedSessionId, setSelectedSessionId] = useState<Id<"chatSessions"> | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState<"gpt-5-mini" | "grok-4-fast" | "claude-haiku-4.5" | "gpt-4o-mini" | "gpt-4.1-mini">("grok-4-fast");
  const [aiName, setAiName] = useState("Community AI Assistant");
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState("");
  const [contextInstructions, setContextInstructions] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [selectedRecipeForCookbook, setSelectedRecipeForCookbook] = useState<any>(null);

  // Use temp session if no real session selected (allows chatting before saving to DB)
  const activeSessionId = selectedSessionId || (tempSessionId as any);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Convex hooks
  const sessions = useQuery(
    api.chat.communitychat.listSessions,
    userId ? { userId, communityId } : "skip"
  );
  const aiSettings = useQuery(
    api.chat.communitychat.getAISettings,
    userId ? { userId } : "skip"
  );
  const customPrompt = useQuery(
    api.systemPrompts.getPrompt,
    userId ? { userId } : "skip"
  );
  const messages = useQuery(
    api.chat.communitychat.getSessionMessages,
    selectedSessionId ? { sessionId: selectedSessionId } : "skip" // Skip for temp sessions
  );

  const createSession = useMutation(api.chat.communitychat.createSession);
  const savePrompt = useMutation(api.systemPrompts.savePrompt);
  const saveRecipe = useMutation(api.recipes.userRecipes.saveRecipeToUserCookbook);
  // COMMENTED OUT: const finalizeThread = useAction(api.memory.tieredProcessing.finalizeThreadOnExit);

  const [isSending, setIsSending] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [currentRecipes, setCurrentRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any | null>(null);

  // Build default system prompt (same as backend)
  const buildDefaultPrompt = () => {
    let prompt = "";

    // Read the actual user message first
    prompt += `IMPORTANT: Read the user's message carefully and respond to what they actually wrote.\n\n`;

    // PRIMARY DIRECTIVE
    prompt += `YOUR PRIMARY TASK: Respond DIRECTLY to what the user ACTUALLY asks for.\n\n`;
    prompt += `Before doing ANYTHING else, ask yourself:\n`;
    prompt += `"What did the user ACTUALLY ask me to do?"\n\n`;

    // AI IDENTITY & PURPOSE
    prompt += `You are ${aiSettings?.aiName || "Community AI Assistant"}, a helpful cooking and recipe assistant. `;
    prompt += `You continuously learn from user interactions to build a self-improving system that remembers their food preferences without asking questions.\n\n`;

    // RESPONSE STRATEGY
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

    // USER PROFILE
    prompt += `## User Profile\n`;
    prompt += `[User context will be injected here at runtime]\n\n`;

    // INSTRUCTIONS
    prompt += `## Instructions\n`;
    prompt += `- Use profile information to personalize suggestions, but NEVER mention these details explicitly\n`;
    prompt += `- Be helpful and responsive to what the user ACTUALLY asked for\n\n`;

    // TOOLS
    prompt += `## Tools\n`;
    prompt += `You have access to the following tool:\n\n`;
    prompt += `**search_recipes**: Search the recipe database for recipes\n`;
    prompt += `- Use when user explicitly asks to find/search/show recipes or wants meal suggestions\n`;
    prompt += `- Examples: "find chicken recipes", "search for desserts", "show me low-carb meals", "what's for dinner"\n`;
    prompt += `- DO NOT use for general cooking advice or questions about recipes already shown\n\n`;
    prompt += `IMPORTANT: When users ask for recipe or meal suggestions, use the search_recipes tool to find real recipes from the database.\n\n`;
    prompt += `## Recipe Selection\n`;
    prompt += `When a user selects a recipe:\n`;
    prompt += `- Give a brief, warm acknowledgment (1-2 sentences maximum)\n`;
    prompt += `- Example: "Great choice! Skillet Chicken Tortilla Pie is delicious. What would you like to know?"\n`;
    prompt += `- DO NOT reproduce the full recipe text - the user can already see it on the recipe card\n`;
    prompt += `- DO NOT list ingredients, steps, or timing unless specifically asked\n`;
    prompt += `- Just warmly acknowledge their selection and invite questions\n`;
    prompt += `- Answer specific questions about the recipe when asked (substitutions, techniques, timing, etc.)`;

    return prompt;
  };

  // Load AI settings
  useEffect(() => {
    if (aiSettings) {
      setAiName(aiSettings.aiName || "Community AI Assistant");
      setSelectedModel(aiSettings.defaultModel as "gpt-5-mini" | "grok-4-fast" | "claude-haiku-4.5" | "gpt-4o-mini" | "gpt-4.1-mini" || "grok-4-fast");
    }
  }, [aiSettings]);

  // Load prompt when overlay opens
  useEffect(() => {
    if (showSettingsOverlay) {
      // Load custom prompt if exists, otherwise build default
      const promptToLoad = customPrompt?.promptText || buildDefaultPrompt();
      setEditablePrompt(promptToLoad);

      // Load context instructions if they exist
      setContextInstructions(customPrompt?.contextInstructions || "");

      setSaveStatus("idle");
    }
  }, [showSettingsOverlay, customPrompt, aiSettings]);

  // Auto-create temporary session on mount (not saved to DB until first message)
  useEffect(() => {
    if (userId && !selectedSessionId && !tempSessionId) {
      // Create temporary session ID (client-side only, not in DB)
      const newTempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log('[CHAT] Creating temporary session:', newTempId);
      setTempSessionId(newTempId);
    }
  }, [userId, selectedSessionId, tempSessionId]);

  // ========== SMART MEMORY: CACHE INITIALIZATION ==========
  // Initialize session cache when user opens chat or switches sessions
  const initializeCache = useAction(api.memory.sessionCache.initializeSessionCache);

  useEffect(() => {
    // Only initialize cache for real sessions (not temp sessions)
    if (selectedSessionId && userId && !tempSessionId) {
      initializeCache({
        sessionId: selectedSessionId,
        userId,
      }).then(() => {
        console.log("[CHAT] Session cache initialized for session:", selectedSessionId);
      }).catch((error) => {
        console.error("[CHAT] Failed to initialize cache:", error);
      });
    }
  }, [selectedSessionId, userId, tempSessionId, initializeCache]);

  // ========== SMART MEMORY: ON-EXIT FINALIZATION ==========
  // COMMENTED OUT: Tier 3 thread finalization not needed for simplified memory approach
  // useEffect(() => {
  //   return () => {
  //     // Only finalize real sessions (not temp sessions)
  //     if (selectedSessionId && userId && !tempSessionId) {
  //       finalizeThread({
  //         sessionId: selectedSessionId,
  //         userId
  //       }).catch((error) => {
  //         console.error("[Memory] Failed to finalize thread on exit:", error);
  //       });
  //     }
  //   };
  // }, [selectedSessionId, userId, tempSessionId, finalizeThread]);

  // Clear state when switching sessions
  useEffect(() => {
    // Clear recipe and streaming state when session changes
    setCurrentRecipes([]);
    setStreamingMessage("");
    setSelectedRecipe(null);
    console.log("[CHAT] Session changed, clearing state");
  }, [selectedSessionId]);

  // Auto-scroll functions
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100;
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  const handleScroll = () => {
    setShouldAutoScroll(isNearBottom());
  };

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom();
    }
  }, [messages, streamingMessage, currentRecipes, shouldAutoScroll]);

  // Handlers
  const handleCreateSession = async () => {
    // Clear any lingering state from previous sessions
    setCurrentRecipes([]);
    setStreamingMessage("");
    setSelectedRecipe(null);

    const sessionId = await createSession({
      userId,
      communityId,
      title: "New Chat",
      model: selectedModel,
    });
    setSelectedSessionId(sessionId);
    setShowMobileMenu(false);

    // 🔥 Pre-warm cache for new session (WAIT for it to complete!)
    console.log('[CHAT] Pre-warming cache for new session:', sessionId);
    try {
      await initializeCache({
        sessionId,
        userId,
      });
      console.log('[CHAT] Cache pre-warmed successfully for new session');
    } catch (error) {
      console.error('[CHAT] Failed to pre-warm cache:', error);
      // Continue anyway - worst case is a cache miss
    }
  };

  const handleSavePrompt = async () => {
    if (!userId || !editablePrompt.trim()) return;

    setIsSavingPrompt(true);
    setSaveStatus("idle");

    try {
      await savePrompt({
        userId,
        promptText: editablePrompt,
        contextInstructions: contextInstructions.trim() || undefined,
      });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save prompt:", error);
      setSaveStatus("error");
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    // If using temp session, create real session now (first message saves to DB)
    let sessionId = selectedSessionId;
    if (tempSessionId && !selectedSessionId) {
      console.log('[CHAT] First message - creating real session in DB');
      sessionId = await createSession({
        userId,
        communityId,
        title: "New Chat",
        model: selectedModel,
      });
      setSelectedSessionId(sessionId);
      setTempSessionId(null); // Clear temp session
      console.log('[CHAT] Real session created:', sessionId);

      // 🔥 Pre-warm cache for new session (WAIT for it to complete!)
      console.log('[CHAT] Pre-warming cache for first-message session:', sessionId);
      try {
        await initializeCache({
          sessionId,
          userId,
        });
        console.log('[CHAT] Cache pre-warmed successfully before message send');
      } catch (error) {
        console.error('[CHAT] Failed to pre-warm cache:', error);
        // Continue anyway - worst case is a cache miss
      }
    }

    if (!sessionId) {
      console.error('[CHAT] No session ID available');
      return;
    }

    setIsSending(true);
    const messageToSend = inputMessage;
    setInputMessage("");
    setCurrentRecipes([]); // Clear previous recipes

    // ⏱️ OPTIMISTIC UI: Show instant typing indicator (feels instant!)
    setStreamingMessage("..."); // Shows AI is "thinking" immediately

    // ⏱️ TIMING: Track client-side timing
    const clientStartTime = Date.now();
    let firstChunkTime: number | null = null;
    console.log(`⏱️ [CLIENT] Message send initiated at ${new Date(clientStartTime).toISOString()}`);

    try {
      // Call streaming API route
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId,
          userId,
          communityId,
          message: messageToSend,
          model: selectedModel,
          selectedRecipe: selectedRecipe, // Pass selected recipe with all messages for context
          aiSettings: {
            aiName: aiSettings?.aiName || "Community AI Assistant",
            persona: aiSettings?.persona || "You are a helpful cooking assistant with expertise in recipes, meal planning, and nutrition.",
            temperature: aiSettings?.temperature || 0.7,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedMessage = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                // ⏱️ TIMING: Track first chunk arrival
                if (!firstChunkTime) {
                  firstChunkTime = Date.now();
                  const networkLatency = firstChunkTime - clientStartTime;
                  console.log(`⏱️ [CLIENT] First chunk received: ${networkLatency}ms (includes network + TTFT)`);
                  // Clear optimistic "..." indicator when real content arrives
                  accumulatedMessage = "";
                }

                accumulatedMessage += parsed.content;
                setStreamingMessage(accumulatedMessage);
              }
              // Capture recipe data separately
              if (parsed.recipeData) {
                console.log("[CHAT] Received recipe data:", parsed.recipeData);
                setCurrentRecipes(parsed.recipeData);
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk:", e);
            }
          }
        }
      }

      // ⏱️ TIMING: Log completion timing
      const clientCompletionTime = Date.now();
      const totalClientTime = clientCompletionTime - clientStartTime;
      const streamingDuration = firstChunkTime ? clientCompletionTime - firstChunkTime : null;

      console.log('\n⏱️ ========== CLIENT TIMING ==========');
      console.log(`⏱️ Total client-side time: ${totalClientTime}ms`);
      if (firstChunkTime) {
        console.log(`⏱️ Time to first chunk: ${firstChunkTime - clientStartTime}ms`);
        if (streamingDuration !== null) {
          console.log(`⏱️ Streaming duration: ${streamingDuration}ms`);
        }
      }
      console.log('⏱️ ====================================\n');

      // Clear streaming message and recipes after complete
      // Recipes will now display from the persisted message's metadata
      setStreamingMessage("");
      setCurrentRecipes([]);
    } catch (error) {
      console.error("Error sending message:", error);
      setInputMessage(messageToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRecipeSelect = async (recipe: any) => {
    if (isSending) return; // Prevent selection during message send
    if (selectedRecipe) return; // LOCK: Prevent changing recipe once selected

    // Set selected recipe
    setSelectedRecipe(recipe);

    // Automatically trigger AI response with recipe context
    // We'll send a hidden message indicating the recipe was selected
    if (!selectedSessionId && !tempSessionId) {
      console.error('[CHAT] No session ID available for recipe selection');
      return;
    }

    // Create real session if needed
    let sessionId = selectedSessionId;
    if (tempSessionId && !selectedSessionId) {
      console.log('[CHAT] Creating session for recipe selection');
      sessionId = await createSession({
        userId,
        communityId,
        title: "New Chat",
        model: selectedModel,
      });
      setSelectedSessionId(sessionId);
      setTempSessionId(null);

      // Pre-warm cache
      try {
        await initializeCache({
          sessionId,
          userId,
        });
      } catch (error) {
        console.error('[CHAT] Failed to pre-warm cache:', error);
      }
    }

    if (!sessionId) return;

    // Send request to AI with selected recipe context
    setIsSending(true);
    setStreamingMessage("...");

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId,
          userId,
          communityId,
          message: "[RECIPE_SELECTED]", // Internal trigger - won't be saved as user message
          model: selectedModel,
          aiSettings: {
            aiName: aiSettings?.aiName || "Community AI Assistant",
            persona: aiSettings?.persona || "You are a helpful cooking assistant with expertise in recipes, meal planning, and nutrition.",
            temperature: aiSettings?.temperature || 0.7,
          },
          selectedRecipe: recipe, // Pass recipe context to API
          isRecipeSelection: true, // Flag to indicate this is a recipe selection
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Process streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedMessage = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                if (!accumulatedMessage) {
                  accumulatedMessage = "";
                }
                accumulatedMessage += parsed.content;
                setStreamingMessage(accumulatedMessage);
              }
            } catch (e) {
              console.error("Failed to parse SSE chunk:", e);
            }
          }
        }
      }

      setStreamingMessage("");
    } catch (error) {
      console.error("Error sending recipe selection:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Action button handlers for UnifiedRecipeCard
  const handleToggleFavorite = (recipeId: string) => {
    console.log("Toggle favorite:", recipeId);
    // TODO: Implement toggle favorite for already-saved recipes
  };

  const handleAddToCookbook = (recipe: any) => {
    console.log("Add to cookbook:", recipe);
    setSelectedRecipeForCookbook(recipe);
    setIsCookbookSelectionOpen(true);
  };

  const handleSelectCookbook = async (cookbookId: string, cookbookName: string) => {
    if (!userId || !selectedRecipeForCookbook) return;

    try {
      await saveRecipe({
        userId,
        recipeType: "community",
        cookbookCategory: cookbookId,

        title: selectedRecipeForCookbook.name || selectedRecipeForCookbook.title,
        description: selectedRecipeForCookbook.description,
        imageUrl: selectedRecipeForCookbook.imageUrl,
        ingredients: selectedRecipeForCookbook.ingredients || [],
        instructions: selectedRecipeForCookbook.steps || selectedRecipeForCookbook.instructions || [],

        communityRecipeId: selectedRecipeForCookbook.id,

        isFavorited: false,
      });

      alert(`Recipe saved to ${cookbookName}!`);
    } catch (error) {
      console.error("Save recipe error:", error);
      alert("Failed to save recipe");
    }
  };

  const handleShare = (recipe: any) => {
    navigator.clipboard.writeText(recipe.name || recipe.title);
    alert("Recipe name copied to clipboard!");
  };

  return (
    <div className="flex flex-col h-full relative bg-white overflow-hidden">
      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Sliding Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out border-r border-gray-200 ${
          showMobileMenu ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(false)}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex flex-col h-full space-y-4 p-4">
          {/* New Chat Button */}
          <Button
            onClick={handleCreateSession}
            className="w-full justify-start gap-2 h-10 bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            variant="outline"
          >
            <Plus size={16} />
            New Chat
          </Button>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {sessions && sessions.length > 0 ? (
              sessions.map((session: any) => (
                <button
                  key={session._id}
                  onClick={async () => {
                    // Clear state from previous session
                    setCurrentRecipes([]);
                    setStreamingMessage("");
                    setSelectedRecipe(null);

                    setSelectedSessionId(session._id);
                    setShowMobileMenu(false);

                    // 🔥 Pre-warm cache when switching sessions (async in background)
                    console.log('[CHAT] Pre-warming cache for switched session:', session._id);
                    initializeCache({
                      sessionId: session._id,
                      userId,
                    }).catch((error) => {
                      console.error('[CHAT] Failed to pre-warm cache:', error);
                    });
                  }}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    selectedSessionId === session._id
                      ? "bg-purple-50 border border-purple-200 text-gray-900"
                      : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                  }`}
                >
                  <div className="font-medium truncate">{session.title || "New Chat"}</div>
                  {session.lastMessageAt && (
                    <div className="text-gray-500 text-xs mt-1">
                      {new Date(session.lastMessageAt).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm py-8">
                No conversations yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
        {/* AI Name Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button - Integrated in Header */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileMenu(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Chat History"
            >
              <Menu size={20} />
            </Button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{aiName}</h3>
              <p className="text-xs text-gray-600">AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreateSession}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Start New Conversation"
            >
              <Plus size={18} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettingsOverlay(true)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="View AI Settings"
            >
              <Settings size={18} />
            </Button>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-white"
          onScroll={handleScroll}
        >
          {messages && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Community AI Assistant
              </h2>
              <p className="text-gray-600 mb-6 max-w-md">
                Your intelligent cooking assistant with perfect memory of your preferences,
                dietary restrictions, and cooking history.
              </p>
              <div className="text-left space-y-2 text-sm text-gray-700 max-w-md">
                <p>• Ask about recipes from any creator</p>
                <p>• Get personalized recommendations based on your dietary needs</p>
                <p>• Receive suggestions that learn from your feedback</p>
                <p>• Explore cultural cuisines that match your taste</p>
              </div>
            </div>
          ) : (
            messages?.map((msg: any) => (
              <div key={msg._id}>
                <div
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-purple-500 text-white"
                        : "bg-gray-50 text-gray-900 border border-gray-200"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-base prose-h1:font-semibold prose-h1:mb-3 prose-h2:text-sm prose-h2:font-medium prose-h2:mb-2 prose-h2:mt-4 prose-ul:list-disc prose-ul:ml-4 prose-ul:my-2 prose-ol:list-decimal prose-ol:ml-4 prose-ol:my-2 prose-li:my-1 prose-li:leading-relaxed prose-strong:font-semibold prose-p:text-gray-700 prose-li:text-gray-700">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-sm">{msg.content}</div>
                    )}
                  </div>
                </div>

                {/* Render recipe carousel if this message has recipe data */}
                {msg.role === "assistant" && msg.metadata?.recipeData && msg.metadata.recipeData.length > 0 && (
                  <div className="px-12 py-6">
                    <Carousel
                      opts={{
                        align: "start",
                        loop: false,
                      }}
                      className="w-full"
                    >
                      <CarouselContent className="-ml-4">
                        {msg.metadata.recipeData.map((recipe: any) => (
                          <CarouselItem key={recipe.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                            <div onClick={() => handleRecipeSelect(recipe)}>
                              <UnifiedRecipeCard
                                recipe={recipe}
                                onToggleFavorite={() => handleToggleFavorite(recipe.id)}
                                onAddToCookbook={() => handleAddToCookbook(recipe)}
                                onShare={() => handleShare(recipe)}
                              />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious className="text-gray-900 border-gray-300 hover:bg-gray-100" />
                      <CarouselNext className="text-gray-900 border-gray-300 hover:bg-gray-100" />
                    </Carousel>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Streaming message indicator */}
          {isSending && streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 bg-gray-50 text-gray-900 border border-gray-200">
                <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-base prose-h1:font-semibold prose-h1:mb-3 prose-h2:text-sm prose-h2:font-medium prose-h2:mb-2 prose-h2:mt-4 prose-ul:list-disc prose-ul:ml-4 prose-ul:my-2 prose-ol:list-decimal prose-ol:ml-4 prose-ol:my-2 prose-li:my-1 prose-li:leading-relaxed prose-strong:font-semibold prose-p:text-gray-700 prose-li:text-gray-700">
                  <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-purple-400">
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse"></div>
                  <span>Streaming...</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isSending && !streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[70%]">
                <div className="text-sm text-gray-600 px-4 py-3 flex items-center gap-2 animate-pulse">
                  <div
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  ></div>
                  <div
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  ></div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Recipe Carousel */}
          {currentRecipes.length > 0 && (
            <div className="px-12 py-6">
              <Carousel
                opts={{
                  align: "start",
                  loop: false,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-4">
                  {currentRecipes.map((recipe) => (
                    <CarouselItem key={recipe.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                      <div onClick={() => handleRecipeSelect(recipe)}>
                        <UnifiedRecipeCard
                          recipe={recipe}
                          onToggleFavorite={() => handleToggleFavorite(recipe.id)}
                          onAddToCookbook={() => handleAddToCookbook(recipe)}
                          onShare={() => handleShare(recipe)}
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="text-gray-900 border-gray-300 hover:bg-gray-100" />
                <CarouselNext className="text-gray-900 border-gray-300 hover:bg-gray-100" />
              </Carousel>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll to Bottom Button */}
        {!shouldAutoScroll && messages && messages.length > 0 && (
          <div className="absolute bottom-32 right-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShouldAutoScroll(true);
                scrollToBottom();
              }}
              className="h-10 w-10 rounded-full shadow-lg"
            >
              <ChevronDown size={16} />
            </Button>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-shrink-0 z-40 p-4 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
          {/* Model Selector */}
          <div className="max-w-3xl mx-auto mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-600">AI Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as "gpt-5-mini" | "grok-4-fast" | "claude-haiku-4.5" | "gpt-4o-mini" | "gpt-4.1-mini")}
              className="border border-blue-500 bg-blue-950 text-blue-100 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="grok-4-fast">⚡ Grok-4-Fast</option>
              <option value="gpt-5-mini">🤖 GPT-5-Mini</option>
              <option value="claude-haiku-4.5">🧠 Claude Haiku 4.5</option>
              <option value="gpt-4o-mini">✨ GPT-4o Mini</option>
              <option value="gpt-4.1-mini">🔮 GPT-4.1-Mini</option>
            </select>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="relative bg-white rounded-2xl shadow-lg border border-gray-300">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about recipes, cooking, or dietary needs..."
                className="w-full border-0 bg-transparent text-gray-900 placeholder-gray-500 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isSending || !activeSessionId}
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || !inputMessage.trim() || !activeSessionId}
                className={`absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-lg text-white transition-colors ${
                  inputMessage.trim() && !isSending && activeSessionId
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-gray-600"
                }`}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettingsOverlay && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowSettingsOverlay(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-gray-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">System Prompt Editor</h2>
                <p className="text-xs text-gray-600 mt-1">
                  {customPrompt?.promptText ? "Editing custom prompt" : "Viewing default prompt"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettingsOverlay(false)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Prompt Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Current Active Prompt</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      {showPreview ? "Hide Preview" : "Show Preview"}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={editablePrompt}
                  onChange={(e) => setEditablePrompt(e.target.value)}
                  className="w-full h-96 p-4 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your system prompt here..."
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-600">
                    {editablePrompt.length} characters
                  </p>
                  {saveStatus === "success" && (
                    <p className="text-xs text-green-400">✓ Saved successfully</p>
                  )}
                  {saveStatus === "error" && (
                    <p className="text-xs text-red-400">✗ Failed to save</p>
                  )}
                </div>
              </div>

              {/* Context Instructions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Context Usage Instructions</h3>
                  <p className="text-xs text-gray-600">Optional: How should the AI use the user context?</p>
                </div>
                <textarea
                  value={contextInstructions}
                  onChange={(e) => setContextInstructions(e.target.value)}
                  className="w-full h-24 p-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Use the profile below to personalize responses. Never mention these details explicitly."
                />
                <p className="text-xs text-gray-600 mt-1">
                  These instructions will be placed BEFORE the user context in the prompt
                </p>
              </div>

              {/* Preview Mode */}
              {showPreview && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Preview (with sample context)</h3>
                  <div className="bg-white rounded p-3 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                      {editablePrompt.replace(
                        '[User context will be injected here at runtime]',
                        contextInstructions
                          ? `${contextInstructions}\n\n- Name: Sample User\n- Dietary Restrictions: Vegetarian\n- Preferences: Italian cuisine, quick meals\n- Goals: Healthy eating, meal prep`
                          : `- Name: Sample User\n- Dietary Restrictions: Vegetarian\n- Preferences: Italian cuisine, quick meals\n- Goals: Healthy eating, meal prep`
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {/* Quick Info */}
              <details className="bg-gray-50 border border-gray-200 rounded-lg">
                <summary className="p-3 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
                  Current AI Settings
                </summary>
                <div className="p-3 pt-0 space-y-2 text-xs text-gray-600">
                  <p><span className="text-gray-700">Model:</span> {selectedModel}</p>
                  <p><span className="text-gray-700">AI Name:</span> {aiSettings?.aiName || "Community AI Assistant"}</p>
                  <p><span className="text-gray-700">Temperature:</span> {aiSettings?.temperature ?? 0.7}</p>
                  <p><span className="text-gray-700">Persona:</span> {aiSettings?.persona || "Default"}</p>
                </div>
              </details>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSavePrompt}
                  disabled={isSavingPrompt || !userId || !editablePrompt.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white"
                >
                  {isSavingPrompt ? "Saving..." : "Save Prompt"}
                </Button>
                <Button
                  onClick={() => {
                    setEditablePrompt(buildDefaultPrompt());
                    setSaveStatus("idle");
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white"
                >
                  Reset to Default
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cookbook Selection Sheet */}
      {selectedRecipeForCookbook && (
        <CookbookSelectionSheet
          isOpen={isCookbookSelectionOpen}
          onClose={() => setIsCookbookSelectionOpen(false)}
          recipe={selectedRecipeForCookbook}
          onSelectCookbook={handleSelectCookbook}
        />
      )}
    </div>
  );
}
