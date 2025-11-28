import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    userId: v.string(),
    email: v.string(),
    isCreator: v.optional(v.boolean()), // Creators can create communities
    stripeCustomerId: v.optional(v.string()), // Stripe customer ID for payments
    prefs: v.object({
      diet: v.optional(v.string()),
      favorites: v.array(v.string()),
      profileName: v.optional(v.string()),
      primaryGoal: v.optional(v.string()),
      dietaryRestrictions: v.optional(v.array(v.string())),
      goals: v.optional(v.array(v.string())),
      preferences: v.optional(v.array(v.string())),
      culturalBackground: v.optional(v.array(v.string())),
      lastVisitedCommunityId: v.optional(v.id("communities")),
      lastVisitedAt: v.optional(v.number()),
    }),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_isCreator", ["isCreator"])
    .index("by_stripeCustomerId", ["stripeCustomerId"]),

  communities: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    memberCount: v.number(),
    isPublic: v.boolean(),
    coverImage: v.optional(v.string()), // Legacy: URL-based images
    coverImageStorageId: v.optional(v.id("_storage")), // New: UploadStuff storage ID
    rating: v.optional(v.number()),
    recipeCount: v.number(),
    nationalities: v.array(v.string()),
    creator: v.object({
      name: v.string(),
      avatar: v.optional(v.string()),
    }),
    creatorId: v.optional(v.string()), // Clerk user ID of the creator

    // Multi-tier pricing - Creator can enable any combination
    stripeProductId: v.optional(v.string()), // One product per community

    monthlyPrice: v.optional(v.number()), // Price in cents (e.g., 999 = $9.99)
    monthlyStripePriceId: v.optional(v.string()),

    yearlyPrice: v.optional(v.number()), // Price in cents
    yearlyStripePriceId: v.optional(v.string()),

    lifetimePrice: v.optional(v.number()), // Price in cents
    lifetimeStripePaymentLinkId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_isPublic", ["isPublic"])
    .index("by_createdAt", ["createdAt"])
    .index("by_creatorId", ["creatorId"]),

  recipes: defineTable({
    name: v.string(),
    description: v.string(),
    ingredients: v.array(v.string()),
    steps: v.array(v.string()),
    community: v.string(),
    dietTags: v.array(v.string()),
    embeddingModel: v.string(),
    embedding: v.array(v.float64()),
    imageUrl: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_community", ["community"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["community"], // Combined: can filter by community or search all
    }),

  ingredientEmbeddings: defineTable({
    recipeId: v.id("recipes"),
    ingredient: v.string(),
    ingredientType: v.union(v.literal("main"), v.literal("other")),
    embedding: v.array(v.float64()),
    embeddingModel: v.string(),
    createdAt: v.number(),
  })
    .index("by_recipe", ["recipeId"])
    .index("by_ingredient_type", ["ingredientType"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["recipeId", "ingredientType"],
    }),

  chatSessions: defineTable({
    userId: v.string(),
    communityId: v.string(),
    title: v.optional(v.string()),
    model: v.string(), // "gpt-5-mini" or "grok-4-fast"
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user_community", ["userId", "communityId"])
    .index("by_user_lastMessage", ["userId", "lastMessageAt"]),

  chatMessages: defineTable({
    sessionId: v.optional(v.id("chatSessions")), // Link to session
    userId: v.string(),
    community: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    metadata: v.optional(v.object({
      model: v.optional(v.string()),
      temperature: v.optional(v.number()),
      persona: v.optional(v.string()),
      recipeData: v.optional(v.array(v.object({
        id: v.string(),
        name: v.string(),
        description: v.string(),
        ingredients: v.array(v.string()),
        steps: v.array(v.string()),
        dietTags: v.array(v.string()),
        imageUrl: v.optional(v.string()),
        sourceUrl: v.optional(v.string()),
        similarity: v.optional(v.number()),
      }))),
    })),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_user_community_createdAt", ["userId", "community", "createdAt"])
    .index("by_community_createdAt", ["community", "createdAt"]),

  aiSettings: defineTable({
    userId: v.string(),
    aiName: v.string(),
    persona: v.string(),
    temperature: v.number(),
    defaultModel: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  extractionJobs: defineTable({
    userId: v.string(),
    communityId: v.string(),
    sourceUrl: v.string(),
    jobType: v.union(v.literal("profile"), v.literal("recipe")),
    status: v.union(
      v.literal("extracting_urls"),
      v.literal("filtering"),
      v.literal("awaiting_confirmation"),
      v.literal("extracting_data"),
      v.literal("completed"),
      v.literal("failed")
    ),
    totalUrls: v.number(),
    processedUrls: v.number(),
    filteredUrls: v.optional(v.array(v.string())),
    extractedCount: v.number(),
    extractionLimit: v.optional(v.number()),
    error: v.optional(v.string()),

    // Track already-extracted URLs to support "Extract More"
    extractedUrlsList: v.optional(v.array(v.string())),

    // Chunk tracking for parallel processing
    totalChunks: v.optional(v.number()),
    completedChunks: v.optional(v.number()),
    failedChunks: v.optional(v.array(v.object({
      chunkNumber: v.number(),
      startIndex: v.number(),
      endIndex: v.number(),
      error: v.string(),
      timestamp: v.number(),
    }))),

    // Retry tracking
    retryCount: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_created", ["userId", "createdAt"]),

  extractedUrls: defineTable({
    jobId: v.id("extractionJobs"),
    urls: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"]),

  extractedProfiles: defineTable({
    jobId: v.id("extractionJobs"),
    userId: v.string(),
    communityId: v.string(),
    url: v.string(),
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    links: v.optional(v.array(v.object({
      url: v.string(),
      text: v.optional(v.string()),
    }))),
    metadata: v.optional(v.object({
      scrapedAt: v.number(),
      error: v.optional(v.string()),
    })),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_user", ["userId"])
    .index("by_url", ["url"]),

  extractedRecipes: defineTable({
    jobId: v.id("extractionJobs"),
    userId: v.string(),
    communityId: v.string(),
    url: v.string(),

    // Recipe data
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),

    // Optional metadata
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    category: v.optional(v.string()),

    // Extraction metadata
    method: v.string(), // "json-ld", "gemini", "puppeteer-jsonld", "puppeteer-gemini"
    createdAt: v.number(),

    // AI-enriched metadata (added post-extraction)
    enrichedMetadata: v.optional(v.object({
      dietTags: v.array(v.string()),
      allergens: v.array(v.string()),
      cuisine: v.optional(v.string()),
      mealTypes: v.array(v.string()),
      cookingMethods: v.array(v.string()),
      difficulty: v.optional(v.string()),
      timeCommitment: v.optional(v.string()),
      flavorProfile: v.array(v.string()),
      mainIngredients: v.array(v.string()),
      makeAhead: v.boolean(),
      mealPrepFriendly: v.boolean(),
      model: v.string(),
      enrichedAt: v.number(),
    })),

    // Enrichment status tracking
    enrichmentStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("enriching"),
      v.literal("completed"),
      v.literal("failed")
    )),
    enrichmentError: v.optional(v.string()),
  })
    .index("by_job", ["jobId"])
    .index("by_user", ["userId"])
    .index("by_url", ["url"]),

  // ========== VIDEO RECIPES (YouTube, Instagram, TikTok imports) ==========

  videoRecipes: defineTable({
    userId: v.string(),

    // Source platform info
    sourcePlatform: v.union(
      v.literal("youtube"),
      v.literal("instagram"),
      v.literal("tiktok"),
      v.literal("other")
    ),
    sourceUrl: v.string(),
    videoId: v.optional(v.string()), // Platform-specific video ID

    // Mux storage data
    muxAssetId: v.string(),
    muxPlaybackId: v.string(),
    muxUploadId: v.string(),
    muxThumbnailUrl: v.string(),

    // Recipe data (extracted by Gemini)
    title: v.string(),
    description: v.optional(v.string()),
    ingredients: v.array(v.object({
      name: v.string(),
      quantity: v.optional(v.string()),
      unit: v.optional(v.string()),
    })),
    instructions: v.array(v.object({
      step: v.number(),
      description: v.string(),
      timestamp: v.optional(v.string()), // MM:SS format
      keyActions: v.optional(v.array(v.string())), // e.g., ["chop", "sauté", "simmer"]
    })),

    // Metadata
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    cuisine: v.optional(v.string()),
    difficulty: v.optional(v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard")
    )),

    // Key frames for timeline scrubbing
    keyFrames: v.optional(v.array(v.object({
      timestamp: v.string(), // MM:SS format
      description: v.string(),
      thumbnailUrl: v.string(), // Mux thumbnail URL
      actionType: v.union(
        v.literal("ingredient_prep"),
        v.literal("cooking_technique"),
        v.literal("final_plating"),
        v.literal("other")
      ),
    }))),

    // Processing status
    extractionStatus: v.union(
      v.literal("downloading"),
      v.literal("uploading_to_mux"),
      v.literal("analyzing_with_ai"),
      v.literal("completed"),
      v.literal("failed")
    ),
    extractionError: v.optional(v.string()),

    // Video metadata
    videoDuration: v.optional(v.number()), // seconds
    videoResolution: v.optional(v.string()), // e.g., "1280x720"

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["extractionStatus"])
    .index("by_user_created", ["userId", "createdAt"])
    .index("by_source_url", ["sourceUrl"])
    .index("by_mux_asset", ["muxAssetId"])
    .index("by_platform", ["sourcePlatform"]),

  // ========== USER RECIPES (Saved to Cookbooks) ==========

  userRecipes: defineTable({
    userId: v.string(),

    // Recipe source - can be from different places
    recipeType: v.union(
      v.literal("extracted"),    // From extractor
      v.literal("community"),    // From AI chat/community recipes
      v.literal("custom"),       // User-created (DIY)
      v.literal("ai_generated")  // AI chat generated (no source table)
    ),

    // NEW: Universal source reference (replaces extractedRecipeId/communityRecipeId)
    sourceRecipeId: v.optional(v.union(
      v.id("recipes"),           // Community recipes
      v.id("extractedRecipes"),  // Extracted recipes
      v.id("userRecipes")        // User recipes (for saving from stories)
    )),
    sourceRecipeType: v.optional(v.union(
      v.literal("community"),
      v.literal("extracted"),
      v.literal("userRecipe")    // From another user's recipe
    )),

    // OLD: Legacy reference fields (keep for migration, will be removed)
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
    communityRecipeId: v.optional(v.id("recipes")),

    // NEW: Custom recipe data (only populated for custom/ai_generated recipes)
    customRecipeData: v.optional(v.object({
      title: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      ingredients: v.array(v.string()),
      instructions: v.array(v.string()),
      servings: v.optional(v.string()),
      prep_time: v.optional(v.string()),
      cook_time: v.optional(v.string()),
      time_minutes: v.optional(v.number()),
      cuisine: v.optional(v.string()),
      diet: v.optional(v.string()),
      category: v.optional(v.string()),
    })),

    // OLD: Denormalized recipe data (keep optional for migration)
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.optional(v.array(v.string())),
    instructions: v.optional(v.array(v.string())),

    // Pre-parsed ingredients for instant grocery list generation
    parsedIngredients: v.optional(v.array(v.object({
      name: v.string(),           // Simple product name: "flour"
      display_text: v.string(),   // Full text: "2 cups all-purpose flour"
      measurements: v.array(v.object({
        quantity: v.number(),     // Numeric quantity: 2
        unit: v.string(),         // Measurement unit: "cup"
      })),
    }))),

    // Optional metadata
    servings: v.optional(v.string()),
    prep_time: v.optional(v.string()),
    cook_time: v.optional(v.string()),
    time_minutes: v.optional(v.number()),
    cuisine: v.optional(v.string()),
    diet: v.optional(v.string()),
    category: v.optional(v.string()),

    // Cookbook organization
    cookbookCategory: v.string(), // "breakfast", "lunch", "dinner", "dessert", "snacks", "uncategorized"

    // NEW: Cached data for fallback (when source recipe is deleted)
    cachedTitle: v.optional(v.string()),      // Fallback title if source deleted
    cachedImageUrl: v.optional(v.string()),   // Fallback image if source deleted

    // NEW: Modification tracking
    isModified: v.optional(v.boolean()),      // True if user edited a referenced recipe

    // User-specific metadata
    notes: v.optional(v.string()),
    isFavorited: v.boolean(),
    lastAccessedAt: v.optional(v.number()),

    // Video import source (Instagram, YouTube, or Pinterest)
    source: v.optional(v.union(
      v.literal("instagram"),
      v.literal("youtube"),
      v.literal("pinterest")
    )),

    // Mux video hosting (for Instagram, YouTube & Pinterest video imports)
    muxPlaybackId: v.optional(v.string()),    // Mux playback ID for video player
    muxAssetId: v.optional(v.string()),       // Mux asset ID for management

    // Instagram-specific fields
    instagramVideoUrl: v.optional(v.string()), // Original Instagram video URL (fallback)
    instagramUsername: v.optional(v.string()), // Creator username for attribution

    // YouTube-specific fields
    youtubeVideoId: v.optional(v.string()),    // YouTube video ID (e.g., "dQw4w9WgXcQ")
    youtubeUrl: v.optional(v.string()),        // Full YouTube URL
    youtubeThumbnailUrl: v.optional(v.string()), // YouTube thumbnail URL

    // Pinterest-specific fields
    pinterestUrl: v.optional(v.string()),          // Pinterest pin URL
    pinterestPinId: v.optional(v.string()),        // Pinterest pin ID
    pinterestUsername: v.optional(v.string()),     // Pinterest user who created the pin
    pinterestBoardName: v.optional(v.string()),    // Board where pin is saved
    pinterestImageUrls: v.optional(v.array(v.string())), // Array of image URLs (for carousels)
    pinterestThumbnailUrl: v.optional(v.string()), // Thumbnail URL

    // AI-analyzed video segments for step-by-step cooking mode (both platforms)
    videoSegments: v.optional(v.array(v.object({
      stepNumber: v.number(),      // Which instruction step (1-based)
      instruction: v.string(),     // The instruction text
      startTime: v.number(),       // Start time in seconds
      endTime: v.number(),         // End time in seconds
    }))),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_cookbook", ["userId", "cookbookCategory"])
    .index("by_user_favorited", ["userId", "isFavorited"])
    .index("by_mux_asset", ["muxAssetId"]), // For finding recipes by Mux asset


  // ========== MEAL PLAN (Day-based Planning) ==========

  mealPlan: defineTable({
    userId: v.string(),

    // Reference to saved recipe
    userRecipeId: v.id("userRecipes"),

    // Meal plan assignment
    dayNumber: v.number(), // 1, 2, 3, etc.
    mealType: v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack")
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_day", ["userId", "dayNumber"])
    .index("by_user_day_mealtype", ["userId", "dayNumber", "mealType"]),

  // ========== GROCERY LISTS ==========

  groceryLists: defineTable({
    userId: v.string(),

    // Snapshot of meal plan recipes used
    mealPlanSnapshot: v.array(v.id("userRecipes")),

    // AI-consolidated ingredients with categories
    consolidatedIngredients: v.array(v.object({
      name: v.string(),
      quantity: v.optional(v.string()),
      unit: v.optional(v.string()),
      category: v.string(), // "produce", "meat", "dairy", "bakery", "seafood", "eggs", "vegetables", "pantry", "other"
      displayText: v.string(), // Full formatted text (e.g., "2 cups flour")
    })),

    // Checked items tracking
    checkedItems: v.array(v.string()), // Array of ingredient names that are checked

    // Instacart integration
    instacartUrl: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  // ========== MEMORY SYSTEM (Mem0-style) ==========

  userMemories: defineTable({
    userId: v.string(),
    agentId: v.optional(v.string()), // e.g., "cooking_assistant"
    runId: v.optional(v.string()), // session/conversation ID

    // Memory content
    text: v.string(), // The actual memory fact
    category: v.optional(v.string()), // "preference", "fact", "plan", etc.

    // Structured cooking data (extracted by Gemini Flash Lite)
    extractedTerms: v.optional(v.object({
      proteins: v.array(v.string()),
      restrictions: v.array(v.string()),
      preferences: v.array(v.string()),
      timeConstraints: v.array(v.string()),
      dietaryTags: v.array(v.string()),
      equipment: v.array(v.string()),
    })),

    // Vector for similarity search
    embedding: v.array(v.float64()),
    embeddingModel: v.string(), // "text-embedding-3-small"

    // Deduplication
    contentHash: v.string(), // SHA-256 of normalized text

    // Metadata
    extractedFrom: v.object({
      sessionId: v.id("chatSessions"),
      messageIds: v.array(v.id("chatMessages")),
      extractedAt: v.number(),
    }),

    // Lifecycle
    createdAt: v.number(),
    updatedAt: v.number(),
    version: v.number(), // Increment on UPDATE operations
  })
    .index("by_user", ["userId"])
    .index("by_user_agent", ["userId", "agentId"])
    .index("by_user_run", ["userId", "runId"])
    .index("by_hash", ["contentHash"]) // Deduplication
    .index("by_user_createdAt", ["userId", "createdAt"]) // For time-based queries (hybrid search)
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // text-embedding-3-small
      filterFields: ["userId", "agentId"], // NOTE: Only strings allowed (no createdAt number field)
    }),

  memoryHistory: defineTable({
    memoryId: v.optional(v.id("userMemories")), // null for ADD operations before creation
    userId: v.string(),

    operation: v.union(
      v.literal("ADD"),
      v.literal("UPDATE"),
      v.literal("DELETE")
    ),

    // Snapshots
    beforeState: v.optional(v.string()), // JSON of old memory
    afterState: v.string(), // JSON of new memory

    // Context
    triggeredBy: v.object({
      sessionId: v.id("chatSessions"),
      messageContent: v.string(),
    }),

    timestamp: v.number(),
  })
    .index("by_memory", ["memoryId"])
    .index("by_user_timestamp", ["userId", "timestamp"]),

  // ========== CHAT CONTEXT & ANALYTICS ==========

  messages: defineTable({
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    intent: v.optional(v.union(v.literal("simple"), v.literal("medium"), v.literal("complex"))),
    confidence: v.optional(v.number()),
    embeddingModel: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    createdAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId"],
    }),

  profiles: defineTable({
    userId: v.string(),
    preferences: v.string(),
    lastUpdated: v.number(),
  }).index("by_user", ["userId"]),

  intentLogs: defineTable({
    userId: v.string(),
    query: v.string(),
    intent: v.union(v.literal("simple"), v.literal("medium"), v.literal("complex")),
    confidence: v.number(),
    usedAI: v.boolean(),
    latency: v.number(),
    metadata: v.optional(v.object({
      heuristicLatency: v.optional(v.number()),
      grokLatency: v.optional(v.number()),
    })),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  // ========== THREAD CONTEXT SUMMARIES (Tier 3 - Long-term) ==========
  // COMMENTED OUT: Tier 3 not needed for simplified memory approach
  // threadContexts: defineTable({
  //   userId: v.string(),
  //   sessionId: v.id("chatSessions"),
  //   summary: v.string(),              // Full thread summary from GPT-5 Mini
  //   embedding: v.array(v.float64()),  // Vector for semantic search
  //   messageCount: v.number(),         // How many messages were summarized
  //   lastMessageAt: v.number(),
  //   createdAt: v.number(),
  //   updatedAt: v.number(),
  // })
  //   .index("by_user_session", ["userId", "sessionId"])
  //   .index("by_session", ["sessionId"])
  //   .vectorIndex("by_embedding", {
  //     vectorField: "embedding",
  //     dimensions: 1536,
  //     filterFields: ["userId"],
  //   }),

  // ========== SESSION CACHE (Smart 2-Minute TTL) ==========

  sessionCache: defineTable({
    // Identity
    userId: v.string(),
    sessionId: v.id("chatSessions"),

    // Cached Context (merged profile + AI memories)
    cachedContext: v.string(), // Formatted context ready for AI prompt

    // Cache Metadata
    version: v.number(),              // Increments with each message (0 = profile only)
    messageCount: v.number(),         // How many messages included in cache
    lastMessageAt: v.number(),        // Timestamp of last user activity
    expiresAt: v.number(),            // Auto-expire after 2 min idle

    // Cache Hit Stats
    hitCount: v.number(),             // How many times cache was used
    missCount: v.number(),            // How many times rebuilt

    // Ranked Context (for gradual pruning)
    recentMessages: v.array(v.object({
      messageId: v.id("chatMessages"),
      content: v.string(),
      rank: v.number(),               // 0-100, higher = more important (decays over time)
      timestamp: v.number(),
    })),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_session", ["userId", "sessionId"])
    .index("by_expiry", ["expiresAt"]), // For cron cleanup

  // ========== SYSTEM PROMPTS (Visual Builder) ==========

  systemPrompts: defineTable({
    userId: v.string(),
    promptText: v.string(), // The full prompt as typed in the editor
    contextInstructions: v.optional(v.string()), // Instructions for how AI should use the user context
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ========== STRIPE SUBSCRIPTIONS & PAYMENTS ==========

  subscriptions: defineTable({
    // User and community
    userId: v.string(), // Clerk user ID
    communityId: v.id("communities"),

    // Stripe references
    stripeSubscriptionId: v.string(), // Stripe subscription ID
    stripeCustomerId: v.string(), // Stripe customer ID (denormalized)
    stripePriceId: v.string(), // Stripe price ID

    // Status tracking
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("incomplete"),
      v.literal("incomplete_expired"),
      v.literal("trialing"),
      v.literal("unpaid")
    ),

    // Billing details
    currentPeriodStart: v.number(), // Unix timestamp
    currentPeriodEnd: v.number(), // Unix timestamp
    cancelAtPeriodEnd: v.boolean(),
    canceledAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_community", ["communityId"])
    .index("by_user_community", ["userId", "communityId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"])
    .index("by_status", ["status"]),

  purchases: defineTable({
    // User and community
    userId: v.string(), // Clerk user ID
    communityId: v.id("communities"),

    // Stripe references
    stripePaymentIntentId: v.string(), // Stripe Payment Intent ID
    stripeCustomerId: v.string(), // Stripe customer ID (denormalized)

    // Purchase details
    amount: v.number(), // Amount in cents
    status: v.union(
      v.literal("succeeded"),
      v.literal("pending"),
      v.literal("failed"),
      v.literal("canceled")
    ),

    // Timestamps
    purchasedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_community", ["communityId"])
    .index("by_user_community", ["userId", "communityId"])
    .index("by_payment_intent", ["stripePaymentIntentId"])
    .index("by_status", ["status"]),

  creatorStripeAccounts: defineTable({
    // Creator identity
    creatorId: v.string(), // Clerk user ID

    // Stripe Connect account
    stripeAccountId: v.string(), // Stripe Connect account ID
    accountStatus: v.union(
      v.literal("pending"), // Onboarding not complete
      v.literal("active"), // Ready to receive payouts
      v.literal("disabled") // Disabled by platform or Stripe
    ),

    // Onboarding
    onboardingComplete: v.boolean(),
    detailsSubmitted: v.boolean(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),

    // Account metadata
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    email: v.optional(v.string()),

    // Platform fee customization
    customPlatformFeePercent: v.optional(v.number()), // Override default fee (e.g., 15 instead of 25)
    feeType: v.union(
      v.literal("default"), // Uses PLATFORM_FEE_PERCENT from env
      v.literal("custom")   // Uses customPlatformFeePercent
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_stripe_account", ["stripeAccountId"])
    .index("by_status", ["accountStatus"]),

  platformSettings: defineTable({
    // Setting key (only one row expected with key "default")
    key: v.string(),

    // Platform fee configuration
    platformFeePercent: v.number(), // e.g., 25 for 25%

    // Stripe keys (stored in env vars, this is just for reference)
    // We won't store actual keys here, just metadata

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // ==================== SOCIAL FEATURES ====================

  // Meal Sharing: Track recipes shared between users
  sharedRecipes: defineTable({
    fromUserId: v.string(),        // User who shared the recipe
    toUserId: v.string(),          // User receiving the recipe
    recipeId: v.id("userRecipes"), // Recipe being shared
    recipeTitle: v.string(),       // Denormalized for quick display
    recipeImageUrl: v.optional(v.string()),

    message: v.optional(v.string()), // Optional sharing message
    status: v.union(
      v.literal("unread"),   // Not yet viewed by recipient
      v.literal("viewed"),   // Recipient viewed it
      v.literal("saved")     // Recipient saved to their cookbook
    ),

    createdAt: v.number(),
    viewedAt: v.optional(v.number()),
    savedAt: v.optional(v.number()),
  })
    .index("by_sender", ["fromUserId"])
    .index("by_receiver", ["toUserId"])
    .index("by_receiver_status", ["toUserId", "status"]) // For notification counts
    .index("by_recipe", ["recipeId"]), // See who you've shared a recipe with

  // Friendships: Basic mutual friend connections
  friendships: defineTable({
    userId1: v.string(),  // First user (alphabetically sorted)
    userId2: v.string(),  // Second user (alphabetically sorted)
    status: v.union(
      v.literal("pending"),   // Friend request sent
      v.literal("accepted"),  // Mutual friends
      v.literal("declined")   // Request declined
    ),
    requestedBy: v.string(), // Who initiated the friend request

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user1", ["userId1"])
    .index("by_user2", ["userId2"])
    .index("by_user1_status", ["userId1", "status"]) // Get all friends for a user
    .index("by_user2_status", ["userId2", "status"])
    .index("by_requested_by", ["requestedBy", "status"]), // Get pending requests sent by user

  // ========== MULTI-TIERED MEMORY SYSTEM ==========

  // Tier 1: Basic User Profile (Static - Onboarding Data)
  userProfiles: defineTable({
    userId: v.string(), // Clerk user ID

    // Basic information
    name: v.optional(v.string()),
    country: v.optional(v.string()), // User's country/nationality
    familySize: v.optional(v.number()), // Number of people cooking for
    cookingSkillLevel: v.optional(v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    )),

    // Allergens (MUST avoid - life-threatening allergies)
    allergens: v.array(v.string()), // ["peanuts", "shellfish", "tree nuts"]

    // Dietary preferences (lifestyle choices, not allergies)
    dietaryPreferences: v.array(v.string()), // ["vegan", "keto", "paleo", "gluten-free"]

    // Preferences set during onboarding
    preferredCuisines: v.optional(v.array(v.string())), // ["Italian", "Mexican"]
    goal: v.optional(v.string()), // "lose-weight", "gain-weight", "maintain", "try-more-foods"

    // Legacy fields (deprecated)
    kitchenEquipment: v.optional(v.array(v.string())), // ["air fryer", "instant pot"]
    defaultServings: v.optional(v.number()), // Default number of servings

    // Profile image
    profileImageStorageId: v.optional(v.id("_storage")), // Convex storage ID for profile image

    // Ayrshare / Instagram integration
    ayrshareProfileKey: v.optional(v.string()), // Ayrshare profile key for this user
    instagramConnected: v.optional(v.boolean()), // Whether Instagram is connected
    instagramUsername: v.optional(v.string()), // Connected Instagram username

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Tier 2: Learned Preferences (Dynamic - AI-Extracted from Conversations)
  learnedPreferences: defineTable({
    userId: v.string(), // Clerk user ID
    agentId: v.optional(v.string()), // Community/agent-specific learning

    // Preference details
    preferenceType: v.union(
      v.literal("food_love"),        // "loves chicken"
      v.literal("food_dislike"),     // "dislikes broccoli"
      v.literal("cooking_habit"),    // "meal preps on Sundays"
      v.literal("time_constraint"),  // "needs 30-min meals"
      v.literal("lifestyle_context") // "picky kids", "works night shifts"
    ),
    summary: v.string(), // Human-readable summary

    // Confidence & repetition tracking
    confidence: v.number(), // 0-1 scale, increases with repetition
    sourceCount: v.number(), // How many conversations confirmed this
    lastMentionedAt: v.number(), // Unix timestamp

    // Semantic search
    embedding: v.array(v.float64()), // Vector embedding (1536 dimensions)
    embeddingModel: v.string(), // "text-embedding-3-small"

    // Source tracking
    extractedFrom: v.object({
      sessionIds: v.array(v.string()),
      messageIds: v.array(v.id("chatMessages")),
    }),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "preferenceType"])
    .index("by_user_agent", ["userId", "agentId"])
    .index("by_confidence", ["userId", "confidence"]) // For top-N queries
    .index("by_lastMentioned", ["userId", "lastMentionedAt"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId", "agentId"],
    }),

  // Tier 3: Conversation Summaries (Contextual - Time-Based Retrieval)
  conversationSummaries: defineTable({
    sessionId: v.string(), // Chat session ID
    userId: v.string(), // Clerk user ID
    communityId: v.string(), // Community ID

    // Summary content
    summary: v.string(), // AI-generated summary of key discussion points
    topics: v.array(v.string()), // Main topics discussed
    recipesDiscussed: v.optional(v.array(v.object({
      recipeId: v.string(),
      recipeName: v.string(),
      recipeType: v.string(), // "community", "extracted", "user", "ai_generated"
    }))),
    decisionsMade: v.optional(v.array(v.string())), // Decisions/plans made

    // Time range of conversation
    timeRange: v.object({
      startTime: v.number(), // First message timestamp
      endTime: v.number(),   // Last message timestamp
    }),
    messageCount: v.number(), // Number of messages in conversation

    // Semantic search
    embedding: v.array(v.float64()), // Vector embedding (1536 dimensions)
    embeddingModel: v.string(), // "text-embedding-3-small"

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "timeRange.startTime"])
    .index("by_community", ["communityId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId", "communityId"],
    }),

  // Tier 2.5: Recent Meals (Recipe Discussion Tracking)
  recentMeals: defineTable({
    userId: v.string(), // Clerk user ID

    // Recipe reference
    recipeId: v.string(), // Can be from recipes, extractedRecipes, or userRecipes
    recipeName: v.string(), // Name for display
    recipeType: v.union(
      v.literal("community"),     // From community recipes
      v.literal("extracted"),     // From extractedRecipes (Instagram)
      v.literal("user"),          // From userRecipes
      v.literal("ai_generated")   // AI-generated recipes
    ),

    // Context where discussed
    discussedInSession: v.id("chatSessions"),
    discussedInMessage: v.id("chatMessages"),

    // Optional meal context
    mealType: v.optional(v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack")
    )),

    // Timestamps
    discussedAt: v.number(), // When user discussed this recipe
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "discussedAt"])
    .index("by_user_recipe", ["userId", "recipeId"])
    .index("by_session", ["discussedInSession"]),

  // Recipe Interactions (Global tracking across all app features)
  recipeInteractions: defineTable({
    userId: v.string(), // Clerk user ID

    // Recipe reference
    recipeId: v.string(), // Can be from recipes, extractedRecipes, or userRecipes
    recipeName: v.string(), // Name for display
    recipeType: v.union(
      v.literal("community"),
      v.literal("extracted"),
      v.literal("user"),
      v.literal("ai_generated")
    ),

    // Type of interaction
    interactionType: v.union(
      v.literal("viewed"),              // User viewed recipe details
      v.literal("discussed"),           // Discussed in chat
      v.literal("saved_to_cookbook"),   // Saved to cookbook
      v.literal("cooked"),              // Marked as cooked
      v.literal("shared"),              // Shared recipe
      v.literal("imported")             // Imported from Instagram
    ),

    // Optional context (depends on interaction type)
    contextId: v.optional(v.string()),     // cookbookId, sessionId, etc.
    contextType: v.optional(v.string()),   // "cookbook", "chat_session", etc.

    // Timestamps
    timestamp: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_time", ["userId", "timestamp"])
    .index("by_user_recipe", ["userId", "recipeId"])
    .index("by_user_recipe_time", ["userId", "recipeId", "timestamp"])
    .index("by_interaction_type", ["userId", "interactionType", "timestamp"]),

  // AI-Generated User Suggestions (Voice Interface)
  userSuggestions: defineTable({
    userId: v.string(), // Clerk user ID

    // Generated suggestions (20 contextual meal suggestions)
    suggestions: v.array(v.string()), // ["Quick breakfast", "Healthy lunch", "Easy dinner", ...]

    // Generation metadata
    generatedAt: v.number(),
    expiresAt: v.number(), // Refresh after expiry (e.g., 24 hours)

    // Context used for generation (for debugging/tracking)
    contextSnapshot: v.optional(v.string()), // Brief summary of user context used

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_expires", ["userId", "expiresAt"]),

  // ========== SHARED COOKBOOKS (Spotify Playlist-style) ==========

  // Shared Cookbooks: Collaborative recipe collections between friends
  sharedCookbooks: defineTable({
    name: v.string(), // Cookbook name
    description: v.optional(v.string()), // Optional description
    imageStorageId: v.optional(v.id("_storage")), // Uploaded cover image
    creatorId: v.string(), // Clerk user ID of creator

    // Stats (denormalized for performance)
    recipeCount: v.number(), // Number of recipes in cookbook
    memberCount: v.number(), // Number of collaborators (including creator)

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_updated", ["updatedAt"]),

  // Shared Cookbook Members: Links users to shared cookbooks
  sharedCookbookMembers: defineTable({
    cookbookId: v.id("sharedCookbooks"),
    userId: v.string(), // Clerk user ID
    role: v.union(
      v.literal("owner"),       // Creator, can delete cookbook
      v.literal("collaborator") // Can add/remove recipes
    ),
    invitedBy: v.optional(v.string()), // Who invited this user

    createdAt: v.number(),
  })
    .index("by_cookbook", ["cookbookId"])
    .index("by_user", ["userId"])
    .index("by_cookbook_user", ["cookbookId", "userId"]), // Check membership

  // Shared Cookbook Recipes: Recipes in shared cookbooks with attribution
  sharedCookbookRecipes: defineTable({
    cookbookId: v.id("sharedCookbooks"),
    recipeId: v.id("userRecipes"), // Reference to the actual recipe
    addedByUserId: v.string(), // Who added this recipe (for avatar display)

    // Denormalized recipe info for display (avoids joins)
    recipeTitle: v.string(),
    recipeImageUrl: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_cookbook", ["cookbookId"])
    .index("by_recipe", ["recipeId"])
    .index("by_cookbook_recipe", ["cookbookId", "recipeId"]) // Prevent duplicates
    .index("by_added_by", ["addedByUserId"]),




  // ========== INSTAGRAM-STYLE STORIES ==========

  // Stories: User-posted images/videos with attached recipes (24-hour expiry)
  stories: defineTable({
    userId: v.string(), // Clerk user ID of story creator

    // Media content
    mediaStorageId: v.id("_storage"), // Image or video in Convex storage
    mediaType: v.union(v.literal("image"), v.literal("video")),

    // Attached recipe (optional)
    recipeId: v.optional(v.id("userRecipes")),
    recipeTitle: v.optional(v.string()), // Denormalized for quick display
    recipeImageUrl: v.optional(v.string()),

    // Story content
    caption: v.optional(v.string()),

    // Image transform (for positioning/cropping in 9:16 frame)
    imageTransform: v.optional(v.object({
      scale: v.number(),  // 1 = fit, >1 = zoomed in
      x: v.number(),      // X offset from center
      y: v.number(),      // Y offset from center
    })),

    // Text overlays (rich text on image)
    textOverlays: v.optional(v.array(v.object({
      id: v.string(),
      text: v.string(),
      x: v.number(),      // Position as percentage (0-100)
      y: v.number(),      // Position as percentage (0-100)
      font: v.string(),   // 'sans' | 'serif' | 'handwritten'
      color: v.string(),  // Hex color
      size: v.number(),   // Font size in px
    }))),

    // Timing (24-hour expiry)
    createdAt: v.number(),
    expiresAt: v.number(), // createdAt + 24 hours
  })
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // Story Views: Track who has viewed each story
  storyViews: defineTable({
    storyId: v.id("stories"),
    viewerId: v.string(), // Clerk user ID of viewer
    viewedAt: v.number(),
  })
    .index("by_story", ["storyId"])
    .index("by_viewer", ["viewerId"])
    .index("by_viewer_story", ["viewerId", "storyId"]), // Check if user viewed

  // ========== RECIPE EXTRACTION BLOCKLIST ==========

  // Blocked Recipe Domains: Sites that block bot traffic (403 errors)
  blockedRecipeDomains: defineTable({
    domain: v.string(), // Domain name (e.g., "allrecipes.com")
    reason: v.string(), // Why blocked (e.g., "403 Forbidden - Cloudflare protection")

    // Auto-detection metadata
    errorCount: v.number(), // How many 403 errors triggered this
    lastErrorAt: v.number(), // Last time we saw a 403 from this domain

    // Manual override
    isManualBlock: v.boolean(), // true if manually added, false if auto-detected

    // Status
    isActive: v.boolean(), // Can be temporarily disabled for testing

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_domain", ["domain"])
    .index("by_active", ["isActive"])
    .index("by_last_error", ["lastErrorAt"]),
});
