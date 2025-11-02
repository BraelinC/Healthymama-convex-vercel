# Overview

HealthyMama (branded as RecipeAI in some components) is a serverless recipe management and AI chat application built with Next.js 16 and Convex backend. The platform enables users to discover recipes, manage cookbooks, plan meals, generate grocery lists, and interact with an AI assistant for recipe recommendations. The application features URL-based recipe extraction, vector-powered recipe search, and a sophisticated memory system for personalized interactions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Framework**: Next.js 16 (App Router) with React 19
- Server-side rendering with client-side hydration
- App Router structure (`/app` directory)
- Dark mode by default with Tailwind CSS custom theming
- Responsive design optimized for mobile-first experience

**UI Component System**:
- Radix UI primitives for accessible components (dialogs, dropdowns, tabs, sheets)
- shadcn/ui component library for consistent design system
- Custom themed components with CSS variables for color management
- Lucide React for iconography

**State Management**:
- Convex React hooks for real-time data synchronization (`useQuery`, `useMutation`, `useAction`)
- TanStack React Query for non-Convex API requests
- Local React state for UI interactions
- Session-based caching system for performance optimization

**Key Pages**:
- `/` - Home page with cookbooks and communities tabs
- `/community` - Community detail view with chat, recipes, and extraction tools
- `/communities` - Browse all available communities
- `/profile` - User profile management (dietary restrictions, goals, preferences)

## Backend Architecture

**Backend-as-a-Service**: Convex
- Real-time database with TypeScript-first schema
- Serverless functions (queries, mutations, actions)
- Vector embeddings for semantic search
- Scheduled cron jobs for cache expiration
- Built-in authentication integration with Clerk

**Data Model** (key tables):
- `users` - User profiles with dietary preferences and goals
- `recipes` - Master recipe collection with vector embeddings
- `userRecipes` - User's saved recipes organized by cookbook categories
- `extractedRecipes` - Recipes extracted from URLs (pending user save)
- `chatSessions` - AI chat conversation sessions
- `chatMessages` - Individual chat messages with embeddings
- `mealPlan` - Weekly meal planning slots (breakfast/lunch/dinner/snack)
- `groceryLists` - Generated shopping lists from meal plans
- `userMemories` - Mem0-style conversational memory facts with embeddings
- `extractionJobs` - Background job tracking for recipe extraction

**Vector Search Implementation**:
- OpenAI `text-embedding-3-small` (1536 dimensions)
- Convex vector indexes on `recipes.embedding` and `messages.embedding`
- Cosine similarity search for recipe recommendations
- Filters by community, dietary tags, and user context

**AI Integration**:
- Multiple LLM providers via OpenRouter and direct APIs
- Supported models: GPT-4o-mini, GPT-4.1-mini, Grok-4-Fast, Claude Haiku 4.5
- Streaming responses with tool calling support
- Intent classification system (heuristic + Grok fallback)
- Memory system for context retention across conversations

## Authentication & Authorization

**Provider**: Clerk
- JWT-based authentication
- User session management
- Middleware for route protection (`proxy.ts`)
- Public routes: home, sign-in, sign-up, communities

**Access Control**:
- User-scoped data queries (all queries filter by `userId`)
- Community-based recipe access control
- No explicit role-based permissions (single-user focus)

## AI/ML Features

**Intelligent Recipe Extraction**:
- Multi-method extraction: Google Gemini API, Puppeteer scraping
- Automatic fallback from AI to DOM parsing
- Background job processing with status tracking
- Tag enrichment using OpenAI for metadata generation

**Conversational AI Chat**:
- Tool calling for recipe search (`search_recipes` tool)
- Context-aware responses using retrieval system
- Custom system prompts with user preferences injection
- Streaming responses for real-time feedback

**Memory System** (Mem0-style):
- Automatic fact extraction from conversations
- Vector-based memory retrieval for context
- Deduplication via content hashing
- Memory update decisions (ADD/UPDATE/DELETE)
- Audit trail for all memory operations

**Intent Classification**:
- Heuristic-based classification for simple queries
- Grok AI fallback for complex intent detection
- Three levels: simple, medium, complex
- Optimized context retrieval based on intent

**Recipe Search & Recommendations**:
- Semantic search using embeddings
- Hybrid retrieval (recent + vector similarity)
- Dietary tag filtering
- Community-scoped search

## Performance Optimizations

**Caching Strategy**:
- Session-based cache for message preprocessing
- 30-minute idle timeout with automatic expiration
- Cron job cleanup every 10 minutes
- Cache warming on app entry (`GlobalCacheWarmer`)

**Query Optimization**:
- Indexed queries for user data (`by_userId`, `by_user_createdAt`)
- Vector index filters to reduce search space
- Pagination for large result sets
- Debounced API calls for real-time features

**Bundle Optimization**:
- Next.js automatic code splitting
- Dynamic imports for heavy components
- Image optimization with `ImageWithFallback` component
- Lazy loading for sheets and modals

## Background Jobs & Automation

**Cron Jobs** (`convex/crons.ts`):
- Cache expiration cleanup (every 10 minutes)
- Future: Recipe sync, analytics aggregation

**Action-Based Background Processing**:
- Recipe embedding generation after extraction
- Batch recipe enrichment
- Grocery list generation with AI consolidation
- Memory fact extraction post-conversation

## Data Flow Patterns

**Recipe Discovery Flow**:
1. User searches via AI chat or browses communities
2. Vector search retrieves semantically similar recipes
3. Results rendered in carousel with detailed sheets
4. User saves to cookbook (creates `userRecipe` entry)

**Meal Planning Flow**:
1. User opens meal plan view (7-day grid)
2. Selects time slot (day + meal type)
3. Chooses recipe from cookbook selector sheet
4. Mutation creates `mealPlan` entry
5. Grocery list generator aggregates all meal ingredients

**Chat Conversation Flow**:
1. User sends message → creates `chatMessage` entry
2. System retrieves relevant context (memories + recent messages + recipes)
3. AI streams response with tool calls
4. Background: extract facts → create `userMemories` entries
5. Background: generate embeddings for message and memories

# External Dependencies

## Third-Party Services

**Convex** (Backend-as-a-Service)
- Real-time database with vector search
- Serverless functions and scheduled jobs
- Authentication integration
- Deployed backend URL configured via `NEXT_PUBLIC_CONVEX_URL`

**Clerk** (Authentication)
- User management and session handling
- JWT token issuance for Convex auth
- Configuration: `CLERK_JWT_ISSUER_DOMAIN`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

**OpenAI** (AI/ML)
- Embeddings: `text-embedding-3-small` for vectors
- Chat completion: `gpt-4o-mini`, `gpt-4.1-mini`
- API key: `OPENAI_API_KEY`

**xAI** (Grok)
- Intent classification with `grok-4-fast` model
- Fallback for complex query understanding
- API key: `XAI_API_KEY`

**OpenRouter** (Multi-Model Gateway)
- Access to Claude, Grok, and other models
- Alternative to direct provider APIs
- API key: `OPEN_ROUTER_API_KEY`

**Google Gemini** (Recipe Extraction)
- Primary method for URL-based recipe extraction
- Structured output for ingredients/instructions
- API key: `GOOGLE_GENERATIVE_AI_API_KEY` (via `@google/generative-ai` package)

**Puppeteer** (Web Scraping)
- Fallback for recipe extraction when AI fails
- Chromium automation for DOM parsing
- Headless browser via `@sparticuz/chromium` for serverless

## External APIs (Potential)

**Instacart Developer Platform** (Referenced but not implemented)
- Grocery delivery integration
- Unit normalization defined in `lib/instacart-units.ts`
- Shopping cart link generation

## Key NPM Packages

**React Ecosystem**:
- `next@16.0.0` - React framework
- `react@19.2.0`, `react-dom@19.2.0` - Core React
- `@tanstack/react-query` - Server state management for non-Convex APIs

**Convex**:
- `convex@1.27.4` - Backend client and runtime

**UI Libraries**:
- `@radix-ui/*` - Headless UI primitives
- `tailwindcss@3.4.17` - Utility-first CSS
- `lucide-react` - Icon library
- `embla-carousel-react` - Carousel component

**AI/ML**:
- `openai@4.104.0` - OpenAI SDK
- `@google/generative-ai@0.21.0` - Gemini API client

**Utilities**:
- `clsx`, `tailwind-merge` - Class name utilities
- `react-markdown` - Markdown rendering for AI responses
- `class-variance-authority` - Component variant management

## Environment Variables

**Required**:
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_JWT_ISSUER_DOMAIN` - Clerk JWT domain
- `OPENAI_API_KEY` - OpenAI API key

**Optional**:
- `XAI_API_KEY` - xAI Grok API key
- `OPEN_ROUTER_API_KEY` - OpenRouter API key
- `INTENT_CONFIDENCE_THRESHOLD` - Intent classification threshold (default: 0.8)

## Deployment

**Platform**: Vercel (configured in `vercel.json`)
- Build command: `cd convex-app && npm run build`
- Output directory: `convex-app/.next`
- Framework: Next.js
- Custom dev command with specific port (5000)

**Build Process**:
1. `prebuild` runs Convex codegen
2. Next.js build with static optimization
3. Convex schema deployment (manual via `npx convex deploy`)