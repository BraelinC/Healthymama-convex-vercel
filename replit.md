# HealthyMama Recipe Platform

## Overview

HealthyMama is a comprehensive recipe discovery and meal planning platform that combines AI-powered chat assistance, community-driven content, and advanced recipe import capabilities. The application enables users to discover recipes through natural conversation, import content from social media platforms (Instagram, YouTube, TikTok), organize recipes in cookbooks, and connect with cooking communities.

The platform leverages serverless architecture with Convex for real-time data synchronization, Next.js for the frontend, and integrates multiple AI providers (OpenAI, Google Gemini, Grok) for intelligent recipe extraction and conversational assistance.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14+ with App Router pattern
- Server components for optimal performance
- Client components for interactive features
- TypeScript with strict mode enabled
- Tailwind CSS for styling with custom HealthyMama theme

**UI Component System**: shadcn/ui radix primitives
- Consistent component library across the application
- Accessible components by default
- Customizable through Tailwind classes

**State Management**:
- React hooks (useState, useEffect, useCallback) for local state
- Convex React hooks (useQuery, useMutation) for server state
- Real-time subscriptions for live data updates
- Clerk hooks for authentication state

**Routing**: Next.js App Router
- File-based routing in `/app` directory
- Dynamic routes for communities and recipes
- Preview environment at `/ui-preview` for component development

### Backend Architecture

**Database & Real-time Backend**: Convex
- Serverless functions for queries, mutations, and actions
- Real-time subscriptions for live updates
- Vector search capabilities for recipe discovery
- File storage for images and videos
- Automatic type generation for TypeScript

**Data Model** (key tables):
- `users` - User profiles with dietary preferences and goals
- `communities` - Cooking communities with subscription models
- `userRecipes` - User-saved recipes with cookbook categorization
- `extractedRecipes` - Recipes imported from external sources
- `messages` - Chat conversation history with embeddings
- `userMemories` - Mem0-style conversational memory system
- `mealPlan` - Weekly meal planning assignments
- `friendships` - Social connections between users
- `sharedCookbooks` - Collaborative recipe collections

**Authentication**: Clerk
- User authentication and session management
- JWT-based API protection
- Social login providers
- User profile management

**Caching Strategy**:
- Session-based cache for active users (memory system)
- Embedding cache to reduce API calls
- Automatic cache expiration (10-minute intervals)

### AI & Machine Learning

**Conversational AI**:
- Custom voice assistant implementation replacing ElevenLabs platform
- Speech-to-text via ElevenLabs Scribe API
- Text-to-speech streaming via ElevenLabs TTS WebSocket
- AI chat orchestration with Google Gemini 2.0 Flash
- Tool calling system for recipe search and actions

**Intent Classification**:
- Hybrid approach: heuristic rules + Grok AI fallback
- Three-tier complexity levels (simple, medium, complex)
- Adaptive context retrieval based on intent
- Latency tracking and confidence scoring

**Recipe Understanding**:
- Vector embeddings using OpenAI text-embedding-3-small (1536 dimensions)
- Semantic recipe search with cosine similarity
- Automatic dietary tag inference from ingredients
- Recipe extraction from video content using Gemini vision models

**Memory System** (Mem0-style):
- Automatic fact extraction from conversations
- Vector-based memory retrieval
- Update/deduplication logic for evolving user preferences
- Audit trail for all memory operations

**AI Providers**:
- OpenRouter for GPT-4 mini (recipe formatting, chat)
- Google Gemini 2.0 Flash (video analysis, tool calling)
- Grok 4 Fast (intent classification fallback)
- ElevenLabs (voice interaction)

### Video & Media Processing

**Video Import Pipeline**:
1. Platform detection (YouTube, Instagram, TikTok)
2. Video download via yt-dlp or platform-specific APIs
3. Upload to Mux for CDN hosting
4. AI-powered recipe extraction from video
5. Video segmentation by recipe steps
6. Storage of Mux playback IDs in Convex

**Mux Video Integration**:
- Professional video hosting with adaptive streaming
- Automatic encoding for multiple quality levels
- Global CDN delivery
- Thumbnail generation
- Instant video clipping by timestamp

**Instagram Import** (specialized flow):
- Extraction via DigitalOcean scraper service
- Direct video URL retrieval from Instagram CDN
- Mux upload for permanent hosting
- AI caption/video analysis for recipe extraction
- Automatic categorization in "Instagram" cookbook

**Image Handling**:
- Convex file storage for user uploads
- URL-based images for external content
- Placeholder system with smart category matching
- Unsplash integration for stock imagery

### Payment & Monetization

**Stripe Integration**:
- Multi-tier subscription model per community (monthly/yearly/lifetime)
- Webhook handler for subscription events
- Customer portal for subscription management
- Product and price creation via Convex mutations

**Creator Features**:
- Community creation with cover image upload
- Custom pricing configuration
- Member management and analytics
- Revenue tracking (future feature)

### Social Features

**Friendship System**:
- Friend requests with accept/decline flow
- Alphabetically sorted user ID pairs for deduplication
- Friendship status tracking (pending, accepted, declined)

**Shared Cookbooks**:
- Collaborative recipe collections
- Role-based permissions (owner, collaborator)
- Invitation system for friends
- Recipe count and member tracking

**Recipe Sharing**:
- Direct recipe sharing between users
- Message attachments for context
- Read/unread status tracking
- Notification system for new shares

### API Architecture

**Next.js API Routes** (`/app/api/*`):
- `/api/ai-chat` - Streaming chat with Gemini and tool calling
- `/api/chat/stream` - Legacy OpenAI chat endpoint
- `/api/instagram/import` - Instagram recipe extraction
- `/api/stripe/*` - Payment processing endpoints
- `/api/memory/*` - Memory management APIs

**Convex HTTP Endpoints**:
- `/stripe-webhook` - Stripe event processing
- `/elevenlabs/tools` - Voice assistant tool callbacks

**External Services**:
- DigitalOcean server (167.172.20.313:3001) - Instagram scraper
- Instacart MCP server - Grocery list creation

## External Dependencies

### Third-Party APIs

**Authentication & User Management**:
- Clerk (clerk.dev) - JWT authentication, user profiles, session management

**AI & ML Services**:
- OpenRouter API - Unified gateway for OpenAI GPT models
- Google AI API (Gemini) - Video analysis, tool calling, multimodal understanding
- xAI (Grok) - Intent classification
- OpenAI Embeddings API - Vector generation (text-embedding-3-small)
- ElevenLabs - Voice synthesis (TTS) and speech recognition (Scribe)

**Video & Media**:
- Mux - Video hosting, encoding, streaming CDN
- yt-dlp - Video download utility for YouTube, TikTok, etc.

**Payment Processing**:
- Stripe - Subscriptions, customer portal, webhook events

**Feedback & Analytics**:
- UserJot - User feedback widget and roadmap

### Infrastructure Services

**Database & Backend**: Convex Cloud
- Hosted at: fearless-goldfinch-827.convex.cloud
- Real-time database with vector search
- Serverless function execution
- File storage with CDN

**Deployment**: Vercel
- Next.js application hosting
- Automatic deployments from Git
- Environment variable management
- Edge network distribution

**External Scraper**: DigitalOcean Droplet
- Custom Instagram scraper service
- Node.js application on port 3001
- Puppeteer-based video extraction

### Package Dependencies

**Core Framework**:
- Next.js 16+ (App Router, server components)
- React 19+
- Convex SDK with helpers

**UI & Styling**:
- Tailwind CSS with custom configuration
- shadcn/ui (Radix UI primitives)
- Lucide React (icons)
- Embla Carousel

**AI & Data Processing**:
- @google/generative-ai (Gemini SDK)
- @elevenlabs/client and @elevenlabs/react
- openai (OpenAI SDK)
- yt-dlp-wrap (video downloads)

**Video Processing**:
- @mux/mux-node (Mux SDK)
- @mux/mux-player-react (video player)
- ytdl-core (YouTube downloads)
- puppeteer-core (web scraping)

**Utilities**:
- axios (HTTP client)
- react-markdown (content rendering)
- class-variance-authority and clsx (styling utilities)
- @tanstack/react-query (data fetching)

### Environment Variables Required

**Authentication**:
- `CLERK_JWT_ISSUER_DOMAIN`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

**AI Services**:
- `OPENAI_API_KEY` (embeddings)
- `OPEN_ROUTER_API_KEY` (chat models)
- `GOOGLE_AI_API_KEY` (Gemini)
- `XAI_API_KEY` (Grok)
- `NEXT_PUBLIC_ELEVENLABS_API_KEY`

**Video & Media**:
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

**Payments**:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**External Services**:
- `DIGITALOCEAN_SCRAPER_URL` (Instagram scraper endpoint)
- `INSTACART_CLIENT_ID` and `INSTACART_CLIENT_SECRET` (grocery integration)

**Convex**:
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`