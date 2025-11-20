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
      v.literal("custom")        // User-created (DIY)
    ),

    // Reference to source recipe
    extractedRecipeId: v.optional(v.id("extractedRecipes")),
    communityRecipeId: v.optional(v.id("recipes")),

    // Denormalized recipe data (for fast access)
    title: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    ingredients: v.array(v.string()),
    instructions: v.array(v.string()),

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

    // User-specific metadata
    notes: v.optional(v.string()),
    isFavorited: v.boolean(),
    lastAccessedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_cookbook", ["userId", "cookbookCategory"])
    .index("by_user_favorited", ["userId", "isFavorited"]),

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

  // ========== INSTAGRAM ACCOUNT ROTATION ==========

  instagramAccounts: defineTable({
    // Instagram credentials
    username: v.string(), // Instagram username
    password: v.string(), // Instagram password (stored securely in Convex)

    // Account status and rotation
    isActive: v.boolean(), // Whether account is available for use
    lastUsedAt: v.optional(v.number()), // Timestamp of last use (for round-robin rotation)
    usageCount: v.number(), // Total number of times used (for analytics)

    // Account health tracking
    status: v.union(
      v.literal("active"),        // Account is healthy and ready
      v.literal("rate_limited"),  // Instagram rate limit detected, skip temporarily
      v.literal("banned"),        // Account banned/blocked by Instagram
      v.literal("login_failed")   // Login credentials invalid
    ),

    // Optional proxy configuration (for scaling)
    proxyUrl: v.optional(v.string()), // Format: "http://username:password@host:port"

    // Metadata
    notes: v.optional(v.string()), // Admin notes (e.g., "Main account", "Backup #3")

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isActive", ["isActive"])
    .index("by_status", ["status"])
    .index("by_lastUsedAt", ["lastUsedAt"]) // For round-robin: get account with oldest lastUsedAt
    .index("by_username", ["username"]), // For duplicate detection
});
