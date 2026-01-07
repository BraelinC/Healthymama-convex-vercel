/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_elevenlabsTools from "../ai/elevenlabsTools.js";
import type * as ai_generateSuggestions from "../ai/generateSuggestions.js";
import type * as ai_userSuggestions from "../ai/userSuggestions.js";
import type * as analytics from "../analytics.js";
import type * as blocklist_blockedDomains from "../blocklist/blockedDomains.js";
import type * as chat_chat from "../chat/chat.js";
import type * as chat_communitychat from "../chat/communitychat.js";
import type * as chat_index from "../chat/index.js";
import type * as chat_messages from "../chat/messages.js";
import type * as communities from "../communities.js";
import type * as communities_files from "../communities/files.js";
import type * as communities_mutations from "../communities/mutations.js";
import type * as convex__generated_api from "../convex/_generated/api.js";
import type * as convex__generated_server from "../convex/_generated/server.js";
import type * as crons from "../crons.js";
import type * as discover from "../discover.js";
import type * as embeddings from "../embeddings.js";
import type * as extractor from "../extractor.js";
import type * as fixRecipes from "../fixRecipes.js";
import type * as friends from "../friends.js";
import type * as geminiLive_memories from "../geminiLive/memories.js";
import type * as geminiLive_queries from "../geminiLive/queries.js";
import type * as groceries from "../groceries.js";
import type * as http from "../http.js";
import type * as instagram from "../instagram.js";
import type * as lib_fuzzyMatch from "../lib/fuzzyMatch.js";
import type * as lib_geminiExtractor from "../lib/geminiExtractor.js";
import type * as lib_instacartMCP from "../lib/instacartMCP.js";
import type * as lib_instacart_units from "../lib/instacart_units.js";
import type * as lib_openRouterExtractor from "../lib/openRouterExtractor.js";
import type * as lib_recipeExtractor from "../lib/recipeExtractor.js";
import type * as lib_stripe from "../lib/stripe.js";
import type * as lib_tagEnricher from "../lib/tagEnricher.js";
import type * as mealPlan from "../mealPlan.js";
import type * as memory_cacheIntelligence from "../memory/cacheIntelligence.js";
import type * as memory_conversationSummaries from "../memory/conversationSummaries.js";
import type * as memory_keywordSearch from "../memory/keywordSearch.js";
import type * as memory_learnedPreferences from "../memory/learnedPreferences.js";
import type * as memory_memoryTriggers from "../memory/memoryTriggers.js";
import type * as memory_mutations from "../memory/mutations.js";
import type * as memory_operations from "../memory/operations.js";
import type * as memory_profileMerge from "../memory/profileMerge.js";
import type * as memory_prompts from "../memory/prompts.js";
import type * as memory_recentMeals from "../memory/recentMeals.js";
import type * as memory_recipeInteractions from "../memory/recipeInteractions.js";
import type * as memory_sessionCache from "../memory/sessionCache.js";
import type * as memory_sessionCacheQueries from "../memory/sessionCacheQueries.js";
import type * as memory_smartMemoryRouter from "../memory/smartMemoryRouter.js";
import type * as memory_smartRetrieval from "../memory/smartRetrieval.js";
import type * as memory_tieredProcessing from "../memory/tieredProcessing.js";
import type * as migrations from "../migrations.js";
import type * as mikey_actions from "../mikey/actions.js";
import type * as mikey_mutations from "../mikey/mutations.js";
import type * as mikey_queries from "../mikey/queries.js";
import type * as recipeIdentification from "../recipeIdentification.js";
import type * as recipes_enrichExistingRecipes from "../recipes/enrichExistingRecipes.js";
import type * as recipes_enrichmentWorkflow from "../recipes/enrichmentWorkflow.js";
import type * as recipes_index from "../recipes/index.js";
import type * as recipes_recipeEmbeddings from "../recipes/recipeEmbeddings.js";
import type * as recipes_recipeMaintenance from "../recipes/recipeMaintenance.js";
import type * as recipes_recipeMutations from "../recipes/recipeMutations.js";
import type * as recipes_recipeQueries from "../recipes/recipeQueries.js";
import type * as recipes_recipeRetrieval from "../recipes/recipeRetrieval.js";
import type * as recipes_recipes from "../recipes/recipes.js";
import type * as recipes_userRecipes from "../recipes/userRecipes.js";
import type * as retrieval from "../retrieval.js";
import type * as sharedCookbooks from "../sharedCookbooks.js";
import type * as sharing from "../sharing.js";
import type * as stories from "../stories.js";
import type * as stripe_actions from "../stripe/actions.js";
import type * as stripe_mutations from "../stripe/mutations.js";
import type * as stripe_queries from "../stripe/queries.js";
import type * as stripe_webhookActions from "../stripe/webhookActions.js";
import type * as systemPrompts from "../systemPrompts.js";
import type * as tagEnrichment from "../tagEnrichment.js";
import type * as userInstagram from "../userInstagram.js";
import type * as userProfile from "../userProfile.js";
import type * as users from "../users.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as videoRecipes from "../videoRecipes.js";
import type * as voiceMemoriesActions from "../voiceMemoriesActions.js";
import type * as voiceMemoriesQueries from "../voiceMemoriesQueries.js";
import type * as voiceSessions from "../voiceSessions.js";
import type * as voiceSessionsActions from "../voiceSessionsActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/elevenlabsTools": typeof ai_elevenlabsTools;
  "ai/generateSuggestions": typeof ai_generateSuggestions;
  "ai/userSuggestions": typeof ai_userSuggestions;
  analytics: typeof analytics;
  "blocklist/blockedDomains": typeof blocklist_blockedDomains;
  "chat/chat": typeof chat_chat;
  "chat/communitychat": typeof chat_communitychat;
  "chat/index": typeof chat_index;
  "chat/messages": typeof chat_messages;
  communities: typeof communities;
  "communities/files": typeof communities_files;
  "communities/mutations": typeof communities_mutations;
  "convex/_generated/api": typeof convex__generated_api;
  "convex/_generated/server": typeof convex__generated_server;
  crons: typeof crons;
  discover: typeof discover;
  embeddings: typeof embeddings;
  extractor: typeof extractor;
  fixRecipes: typeof fixRecipes;
  friends: typeof friends;
  "geminiLive/memories": typeof geminiLive_memories;
  "geminiLive/queries": typeof geminiLive_queries;
  groceries: typeof groceries;
  http: typeof http;
  instagram: typeof instagram;
  "lib/fuzzyMatch": typeof lib_fuzzyMatch;
  "lib/geminiExtractor": typeof lib_geminiExtractor;
  "lib/instacartMCP": typeof lib_instacartMCP;
  "lib/instacart_units": typeof lib_instacart_units;
  "lib/openRouterExtractor": typeof lib_openRouterExtractor;
  "lib/recipeExtractor": typeof lib_recipeExtractor;
  "lib/stripe": typeof lib_stripe;
  "lib/tagEnricher": typeof lib_tagEnricher;
  mealPlan: typeof mealPlan;
  "memory/cacheIntelligence": typeof memory_cacheIntelligence;
  "memory/conversationSummaries": typeof memory_conversationSummaries;
  "memory/keywordSearch": typeof memory_keywordSearch;
  "memory/learnedPreferences": typeof memory_learnedPreferences;
  "memory/memoryTriggers": typeof memory_memoryTriggers;
  "memory/mutations": typeof memory_mutations;
  "memory/operations": typeof memory_operations;
  "memory/profileMerge": typeof memory_profileMerge;
  "memory/prompts": typeof memory_prompts;
  "memory/recentMeals": typeof memory_recentMeals;
  "memory/recipeInteractions": typeof memory_recipeInteractions;
  "memory/sessionCache": typeof memory_sessionCache;
  "memory/sessionCacheQueries": typeof memory_sessionCacheQueries;
  "memory/smartMemoryRouter": typeof memory_smartMemoryRouter;
  "memory/smartRetrieval": typeof memory_smartRetrieval;
  "memory/tieredProcessing": typeof memory_tieredProcessing;
  migrations: typeof migrations;
  "mikey/actions": typeof mikey_actions;
  "mikey/mutations": typeof mikey_mutations;
  "mikey/queries": typeof mikey_queries;
  recipeIdentification: typeof recipeIdentification;
  "recipes/enrichExistingRecipes": typeof recipes_enrichExistingRecipes;
  "recipes/enrichmentWorkflow": typeof recipes_enrichmentWorkflow;
  "recipes/index": typeof recipes_index;
  "recipes/recipeEmbeddings": typeof recipes_recipeEmbeddings;
  "recipes/recipeMaintenance": typeof recipes_recipeMaintenance;
  "recipes/recipeMutations": typeof recipes_recipeMutations;
  "recipes/recipeQueries": typeof recipes_recipeQueries;
  "recipes/recipeRetrieval": typeof recipes_recipeRetrieval;
  "recipes/recipes": typeof recipes_recipes;
  "recipes/userRecipes": typeof recipes_userRecipes;
  retrieval: typeof retrieval;
  sharedCookbooks: typeof sharedCookbooks;
  sharing: typeof sharing;
  stories: typeof stories;
  "stripe/actions": typeof stripe_actions;
  "stripe/mutations": typeof stripe_mutations;
  "stripe/queries": typeof stripe_queries;
  "stripe/webhookActions": typeof stripe_webhookActions;
  systemPrompts: typeof systemPrompts;
  tagEnrichment: typeof tagEnrichment;
  userInstagram: typeof userInstagram;
  userProfile: typeof userProfile;
  users: typeof users;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
  videoRecipes: typeof videoRecipes;
  voiceMemoriesActions: typeof voiceMemoriesActions;
  voiceMemoriesQueries: typeof voiceMemoriesQueries;
  voiceSessions: typeof voiceSessions;
  voiceSessionsActions: typeof voiceSessionsActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
