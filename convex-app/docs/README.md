# RecipeAI Convex Prototype

A production-ready starter for a serverless recipe assistant that combines **Convex** for the backend, semantic search, and real-time chat with a **Next.js 14** frontend. The assistant embeds user prompts, performs community-scoped vector search, and feeds curated recipe matches to an LLM response.

## Features

- **Convex data model** with vector indexes for recipes, user profiles, and chat history.
- **OpenAI integration** for embeddings (`text-embedding-3-small`) and conversational replies (`gpt-4o-mini`).
- **Multi-community routing** so recipes stay scoped to the selected community (e.g., vegan vs. general).
- **Real-time chat UI** inspired by the existing community chat, renamed with the `RecipeAI_` prefix.
- **User preference modal** to capture dietary constraints and favourites, stored in Convex.
- **Cached embeddings** via Convex action caching to keep latency low.
- **Sample recipes** seeding action for immediate demos.

## Prerequisites

- Node.js ≥ 20
- A Convex project (`npx convex init`)
- OpenAI API key with access to GPT-4o (or update the models)
- Vercel CLI (optional, for deployment)

## Environment Variables

Create a `.env.local` (or use `.env`) with:

```
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
CONVEX_DEPLOYMENT=<deployment-name-or-id>
OPENAI_API_KEY=sk-...
VERCEL_ENV=development
```

You can copy `.env.example` as a starting point.

## Install & Run

```bash
cd convex-app

# Install dependencies
npm install

# Initialize Convex (only needed first time)
npx convex init    # if you have not linked this repo to Convex yet

# Start development servers
npm run dev        # runs `convex dev` and `next dev` in parallel
```

Visit `http://localhost:3000` to interact with the assistant.

**Note:** The project includes an `.npmrc` file that automatically handles peer dependency conflicts. No need to use `--legacy-peer-deps` flag manually.

## Seeding Sample Recipes

Open the Convex dashboard or run the action directly using the CLI:

```bash
npx convex run recipes:seedSampleRecipes
```

This loads a mix of general and vegan recipes so semantic search has high-quality context immediately.

## Project Structure

```
convex-app/
  app/
    layout.tsx          # Wraps the app in Convex provider & global styles
    page.tsx            # RecipeAI chat page
    globals.css         # Tailwind base styles
  components/
    RecipeAI_*          # All UI pieces with RecipeAI_ prefix
  convex/
    schema.ts           # Tables, indexes, and vector definitions
    users.ts            # Profile upsert/query logic
    recipes.ts          # Recipe mutations, vector search helper, seed action
    chat.ts             # Chat mutations + LLM-driven action
    _generated/api.ts   # Typed bindings (placeholder – run `npx convex codegen`)
  lib/
    recipeai-utils.ts   # Tailwind class combiner
  package.json
  tailwind.config.ts
  tsconfig.json
```

> **Note:** The generated files under `convex/_generated/*` are hand-written stubs for this prototype. After running `npx convex dev` the real codegen will overwrite them with fully typed bindings.

## Scripts

| Script       | Description                                          |
|--------------|------------------------------------------------------|
| `npm run dev`   | Starts Convex dev server + Next.js in parallel       |
| `npm run build` | Builds the Next.js application                       |
| `npm run start` | Runs the production Next.js build                    |
| `npm run deploy`| Deploys Convex, then launches Vercel production     |

## Deployment

1. Ensure your Convex project is initialised and `.env` files are set up.
2. Deploy Convex backend:
   ```bash
   npx convex deploy
   ```
3. Deploy the frontend to Vercel:
   ```bash
   vercel --prod
   ```

The `deploy` script (`npm run deploy`) combines both steps if you prefer a single command.

## Customisation Notes

- Swap `COMPLETIONS_MODEL` / `TOOL_CLASSIFIER_MODEL` in `convex/chat.ts` if you want to use Grok or another LLM.
- Adjust the community list in `RecipeAI_ChatShell.tsx` to match your production communities.
- Extend the profile schema to include household members, allergens, or subscription data as needed.
- Replace the placeholder Home tab with your existing landing or dashboard experience.

## Testing

This starter focuses on integration with external APIs, so automated tests are not included. You can add component tests with Playwright or unit tests with Vitest/Jest if required.

---

Happy cooking! 🥑
