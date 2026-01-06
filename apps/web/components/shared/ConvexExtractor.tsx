"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@healthymama/convex";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Globe,
  User,
  Link2,
  Trash2,
  Database,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { UnifiedRecipeCard } from "@/components/recipe/UnifiedRecipeCard";
import { CookbookSelectionSheet } from "@/components/cookbook/CookbookSelectionSheet";

interface ConvexExtractorProps {
  userId: string;
  communityId: string;
}

export default function ConvexExtractor({ userId, communityId }: ConvexExtractorProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [jobType, setJobType] = useState<"profile" | "recipe">("recipe");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionLimit, setExtractionLimit] = useState(30);
  const [additionalExtractionCount, setAdditionalExtractionCount] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    total: number;
    successCount: number;
    failureCount: number;
  } | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isCookbookSelectionOpen, setIsCookbookSelectionOpen] = useState(false);
  const [selectedRecipeForCookbook, setSelectedRecipeForCookbook] = useState<any>(null);

  // Actions and mutations for saving recipes
  const saveRecipe = useAction(api.recipes.userRecipes.saveRecipeWithParsedIngredients);
  const [enrichResult, setEnrichResult] = useState<{
    total: number;
    successCount: number;
    failureCount: number;
  } | null>(null);

  // ============ DEBUGGING: Props ============
  console.log("=== [CONVEX EXTRACTOR] Component Mounted ===");
  console.log("[PROPS] userId:", userId || "❌ NO USER ID");
  console.log("[PROPS] communityId:", communityId);

  // Safety check: Ensure userId is provided
  if (!userId || userId.trim() === "") {
    console.error("❌ [CONVEX EXTRACTOR] userId is empty or undefined!");

    return (
      <div className="max-w-5xl mx-auto">
        <Card className="bg-white border-gray-200">
          <CardContent className="py-12 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h3>
            <p className="text-gray-600">
              Please sign in to use the Recipe Extractor. A valid user session is required to connect to the extraction service.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Query: Get all jobs for this user
  console.log("[CONVEX QUERY] Calling listJobs with userId:", userId);
  const jobs = useQuery(
    api.extractor.listJobs,
    userId ? { userId, limit: 10 } : "skip"
  );
  console.log("[CONVEX QUERY] listJobs result:", jobs ? `${jobs.length} jobs` : "undefined/loading");

  // Query: Get currently active job (if any)
  const activeJob = jobs?.find(
    (job: any) => job.status !== "completed" && job.status !== "failed"
  );

  // Query: Get profiles from most recent completed job
  const latestCompletedJob = jobs?.find((job: any) => job.status === "completed");
  const profiles = useQuery(
    api.extractor.getJobProfiles,
    latestCompletedJob ? { jobId: latestCompletedJob._id } : "skip"
  );

  // Query: Get recipes from most recent completed job
  const recipes = useQuery(
    api.extractor.getJobRecipes,
    latestCompletedJob && latestCompletedJob.jobType === "recipe"
      ? { jobId: latestCompletedJob._id }
      : "skip"
  );

  // Query: Get completion status for active job (debugging)
  const completionStatus = useQuery(
    api.extractor.getJobCompletionStatus,
    activeJob ? { jobId: activeJob._id } : "skip"
  );

  // Action: Run extraction
  const runExtraction = useAction(api.extractor.runExtraction);

  // Mutation: Confirm extraction count
  const confirmCount = useMutation(api.extractor.confirmExtractionCount);

  // Action: Continue extraction
  const continueExtraction = useAction(api.extractor.continueExtraction);

  // Mutation: Cancel job
  const cancelJob = useMutation(api.extractor.cancelJob);

  // Mutation: Retry failed chunks
  const retryFailedChunks = useMutation(api.extractor.retryFailedChunks);

  // Mutation: Retry single chunk
  const retrySingleChunk = useMutation(api.extractor.retrySingleChunk);

  // Mutation: Extract more recipes
  const extractMoreRecipes = useMutation(api.extractor.extractMoreRecipes);

  // Mutation: Delete all extraction data
  const deleteAllData = useMutation(api.extractor.deleteAllExtractionData);

  // Action: Embed recipes to vector database
  const embedJobRecipes = useAction(api.recipes.recipeEmbeddings.embedJobRecipes);

  // Action: Enrich recipes with AI tags
  const enrichJobRecipes = useAction(api.recipes.enrichExistingRecipes.enrichRecipesByJobId);

  // Mutation: Clear embedded recipes (for re-embedding with new schema)
  const deleteRecipesForCommunity = useMutation(api.recipes.recipeMaintenance.deleteRecipesForCommunity);

  const handleExtract = async () => {
    if (!sourceUrl.trim() || !userId) return;

    try {
      setIsExtracting(true);
      await runExtraction({
        userId,
        communityId,
        sourceUrl: sourceUrl.trim(),
        jobType,
      });
      setSourceUrl(""); // Clear input after starting
    } catch (error) {
      console.error("Extraction error:", error);
      alert("Failed to start extraction. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Calculate progress percentage
  const getProgress = (job: any) => {
    if (job.status === "completed") return 100;
    if (job.status === "failed") return 0;

    // For chunked processing, calculate based on chunks (completed + failed)
    if (job.totalChunks && job.totalChunks > 0) {
      const completedChunks = job.completedChunks || 0;
      const failedChunks = (job.failedChunks || []).length;
      const totalProcessed = completedChunks + failedChunks;
      return Math.round((totalProcessed / job.totalChunks) * 100);
    }

    // Fallback to URL-based progress
    if (job.totalUrls === 0) return 0;
    return Math.round((job.processedUrls / job.totalUrls) * 100);
  };

  const handleConfirmCount = async () => {
    if (!activeJob) return;

    try {
      // Update job with extraction limit
      await confirmCount({
        jobId: activeJob._id,
        extractionLimit,
      });

      // Start extraction
      await continueExtraction({
        jobId: activeJob._id,
      });
    } catch (error) {
      console.error("Confirmation error:", error);
      alert("Failed to start extraction. Please try again.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-600";
      case "failed":
        return "bg-red-600";
      case "extracting_urls":
        return "bg-blue-600";
      case "filtering":
        return "bg-yellow-600";
      case "awaiting_confirmation":
        return "bg-orange-600";
      case "extracting_data":
        return "bg-purple-600";
      default:
        return "bg-gray-600";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "extracting_urls":
        return "Extracting URLs";
      case "filtering":
        return "Filtering URLs";
      case "awaiting_confirmation":
        return "Awaiting Confirmation";
      case "extracting_data":
        return "Extracting Data";
      case "completed":
        return "Completed";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const handleExtractMore = async () => {
    if (!latestCompletedJob) return;

    try {
      await extractMoreRecipes({
        jobId: latestCompletedJob._id,
        additionalCount: additionalExtractionCount,
      });
    } catch (error) {
      console.error("Extract more error:", error);
      alert("Failed to extract more recipes. Please try again.");
    }
  };

  const handleResetAll = async () => {
    if (!confirm("⚠️ Are you sure you want to delete ALL extraction data? This will permanently delete all jobs, URLs, profiles, and recipes for this community. This action cannot be undone!")) {
      return;
    }

    try {
      const result = await deleteAllData({
        userId,
        communityId,
      });

      alert(`✅ Successfully deleted:\n${result.deletedCounts.jobs} jobs\n${result.deletedCounts.recipes} recipes\n${result.deletedCounts.profiles} profiles\n${result.deletedCounts.urls} URL batches`);
    } catch (error) {
      console.error("Reset error:", error);
      alert("Failed to reset extraction data. Please try again.");
    }
  };

  const handleEnrichRecipes = async () => {
    if (!latestCompletedJob) return;

    try {
      setIsEnriching(true);
      setEnrichResult(null);

      console.log(`🤖 [ENRICH] Starting AI enrichment for job: ${latestCompletedJob._id}`);

      const result = await enrichJobRecipes({
        jobId: latestCompletedJob._id,
      });

      console.log(`✅ [ENRICH] Completed:`, result);

      if (result.success && result.enrichResult) {
        setEnrichResult(result.enrichResult);

        if (result.enrichResult.successCount > 0) {
          alert(`✅ Successfully enriched & imported ${result.enrichResult.successCount} recipes to the community!\n\nRecipes now have AI tags and are searchable in AI Chat.`);
        } else {
          alert(`⚠️ No recipes were enriched. They may already have AI tags.`);
        }
      } else {
        alert(`⚠️ Enrichment completed but some recipes may have failed. Check console for details.`);
      }
    } catch (error) {
      console.error("Enrichment error:", error);
      alert("Failed to enrich recipes. Please try again.");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSyncToVectorDB = async () => {
    if (!latestCompletedJob) return;

    try {
      setIsSyncing(true);
      setSyncResult(null);

      console.log(`🔄 [IMPORT] Starting import to community for job: ${latestCompletedJob._id}`);

      const result = await embedJobRecipes({
        jobId: latestCompletedJob._id,
      });

      console.log(`✅ [IMPORT] Completed:`, result);

      setSyncResult(result);

      if (result.successCount > 0) {
        alert(`✅ Successfully imported ${result.successCount} recipes to the community!\n\nThey are now searchable in AI Chat and visible in the Recipes tab.`);
      } else {
        alert(`⚠️ No recipes were imported. They may already exist in the community recipes collection.`);
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to import recipes. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAndReEmbed = async () => {
    if (!latestCompletedJob) return;

    // Confirmation dialog
    if (!confirm("⚠️ Clear Embeddings & Re-embed?\n\nThis will:\n✓ Delete all embedded recipes from vector database\n✓ Keep your source recipes (extractedRecipes)\n✓ Re-enrich with AI tags\n✓ Re-embed with updated schema (includes imageUrl)\n\nThis is safe and will populate missing fields like images. Continue?")) {
      return;
    }

    try {
      setIsEnriching(true);
      setEnrichResult(null);

      // Step 1: Delete all embedded recipes
      console.log(`🗑️ [CLEAR] Deleting embedded recipes for community: ${communityId}`);
      const deleteResult = await deleteRecipesForCommunity({
        communityId,
      });
      console.log(`✅ [CLEAR] Deleted ${deleteResult.deletedCount} recipes`);

      // Step 2: Re-enrich and re-embed
      console.log(`🤖 [RE-EMBED] Starting enrichment and embedding for job: ${latestCompletedJob._id}`);
      const enrichResult = await enrichJobRecipes({
        jobId: latestCompletedJob._id,
      });
      console.log(`✅ [RE-EMBED] Completed:`, enrichResult);

      if (enrichResult.success && enrichResult.enrichResult) {
        setEnrichResult(enrichResult.enrichResult);
        alert(`✅ Success!\n\n• Deleted ${deleteResult.deletedCount} old embeddings\n• Re-enriched ${enrichResult.enrichResult.successCount} recipes\n• Recipes now include images and updated metadata\n\nSearch for recipes in AI Chat to see the updates!`);
      } else {
        alert(`⚠️ Embeddings cleared but enrichment had issues. Check console for details.`);
      }
    } catch (error) {
      console.error("Clear and re-embed error:", error);
      alert("Failed to clear and re-embed recipes. Please try again.");
    } finally {
      setIsEnriching(false);
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
        recipeType: "extracted",
        cookbookCategory: cookbookId,

        title: selectedRecipeForCookbook.title,
        description: selectedRecipeForCookbook.description,
        imageUrl: selectedRecipeForCookbook.imageUrl,
        ingredients: selectedRecipeForCookbook.ingredients || [],
        instructions: selectedRecipeForCookbook.instructions || [],

        servings: selectedRecipeForCookbook.servings,
        prep_time: selectedRecipeForCookbook.prep_time,
        cook_time: selectedRecipeForCookbook.cook_time,
        cuisine: selectedRecipeForCookbook.enrichedMetadata?.cuisine,
        diet: selectedRecipeForCookbook.enrichedMetadata?.dietTags?.[0],
        category: selectedRecipeForCookbook.category,

        extractedRecipeId: selectedRecipeForCookbook._id,

        isFavorited: false,
      });

      alert(`Recipe saved to ${cookbookName}!`);
    } catch (error) {
      console.error("Save recipe error:", error);
      alert("Failed to save recipe");
    }
  };

  const handleShare = (recipe: any) => {
    navigator.clipboard.writeText(recipe.title);
    alert("Recipe name copied to clipboard!");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 w-full">
      {/* URL Input Card */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Recipe Extractor
          </CardTitle>
          <p className="text-gray-600 text-sm">
            Extract recipes from website sitemaps
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Job Type Toggle + Reset Button */}
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled
              >
                <Download className="w-4 h-4 mr-2" />
                Recipes
              </Button>
            </div>

            {/* Reset All Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={!jobs || jobs.length === 0}
              className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset All
            </Button>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Input
              placeholder="https://example.com/sitemap.xml or https://example.com"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              disabled={isExtracting || !!activeJob}
            />
            <p className="text-xs text-gray-500">
              Enter a sitemap URL or website homepage. We'll automatically find and extract from sitemaps.
            </p>
          </div>

          {/* Extract Button */}
          <Button
            onClick={handleExtract}
            disabled={!sourceUrl.trim() || isExtracting || !!activeJob}
            className="w-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500"
          >
            {isExtracting || activeJob ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Start Extraction
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Active Job Progress */}
      {activeJob && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 text-lg">Extraction in Progress</CardTitle>
              <Badge className={getStatusColor(activeJob.status)}>
                {getStatusLabel(activeJob.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {activeJob.totalChunks && activeJob.totalChunks > 0 ? (
                    <>
                      {(activeJob.completedChunks || 0)} / {activeJob.totalChunks} chunks completed
                      {activeJob.failedChunks && activeJob.failedChunks.length > 0 && (
                        <span className="text-yellow-700 ml-2">
                          ({activeJob.failedChunks.length} failed)
                        </span>
                      )}
                    </>
                  ) : (
                    <>{activeJob.processedUrls} / {activeJob.totalUrls} URLs processed</>
                  )}
                </span>
                <span className="text-gray-600">{getProgress(activeJob)}%</span>
              </div>
              <Progress value={getProgress(activeJob)} className="h-2 bg-gray-300" />
            </div>

            {/* Job Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Source URL</p>
                <a
                  href={activeJob.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 truncate"
                >
                  {activeJob.sourceUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <p className="text-gray-600">Type</p>
                <p className="text-gray-900 capitalize">{activeJob.jobType}</p>
              </div>
              <div>
                <p className="text-gray-600">Filtered URLs</p>
                <p className="text-gray-900">{activeJob.filteredUrls?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-600">Extracted</p>
                <p className="text-gray-900">{activeJob.extractedCount}</p>
              </div>
            </div>

            {/* Error Display */}
            {activeJob.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {activeJob.error}
                </p>
              </div>
            )}

            {/* Failed Chunks Display */}
            {activeJob.failedChunks && activeJob.failedChunks.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-yellow-700 text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {activeJob.failedChunks.length} chunk{activeJob.failedChunks.length !== 1 ? 's' : ''} failed
                  </p>
                  <Button
                    onClick={async () => {
                      if (confirm(`Retry ${activeJob.failedChunks.length} failed chunk(s)?`)) {
                        try {
                          await retryFailedChunks({ jobId: activeJob._id });
                        } catch (error: any) {
                          console.error("Failed to retry chunks:", error);
                          alert(error.message || "Failed to retry chunks. Please try again.");
                        }
                      }
                    }}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    disabled={(activeJob.retryCount || 0) >= 3}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry All {(activeJob.retryCount || 0) >= 3 && '(Max Reached)'}
                  </Button>
                </div>

                <div className="max-h-32 overflow-y-auto space-y-2">
                  {activeJob.failedChunks.map((chunk: any, idx: number) => (
                    <div key={idx} className="bg-gray-100 rounded p-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-yellow-700 font-medium">
                            Chunk {chunk.chunkNumber}: URLs {chunk.startIndex}-{chunk.endIndex}
                          </p>
                          <p className="text-gray-600 truncate mt-1">{chunk.error}</p>
                        </div>
                        <Button
                          onClick={async () => {
                            try {
                              await retrySingleChunk({
                                jobId: activeJob._id,
                                chunkNumber: chunk.chunkNumber
                              });
                            } catch (error: any) {
                              console.error("Failed to retry chunk:", error);
                              alert(error.message || "Failed to retry chunk. Please try again.");
                            }
                          }}
                          size="sm"
                          variant="ghost"
                          className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100 shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {(activeJob.retryCount || 0) >= 3 && (
                  <p className="text-xs text-gray-600 italic">
                    Maximum retry limit reached (3 attempts). Contact support if issues persist.
                  </p>
                )}
              </div>
            )}

            {/* Diagnostic Info (Development) */}
            {completionStatus && process.env.NODE_ENV === 'development' && (
              <details className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  🔧 Debug Info (Development Only)
                </summary>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Should Transition:</span>
                      <span className={`ml-2 font-mono ${completionStatus.shouldTransition ? 'text-yellow-400' : 'text-green-400'}`}>
                        {completionStatus.shouldTransition ? 'YES ⚠️' : 'NO'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Completed Chunks:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.completedChunks}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Failed Chunks:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.failedChunksCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Chunks:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.totalChunks}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total Processed:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.totalProcessed}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Is Complete:</span>
                      <span className={`ml-2 font-mono ${completionStatus.isComplete ? 'text-green-400' : 'text-yellow-400'}`}>
                        {completionStatus.isComplete ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Failure Rate:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.failureRate}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Progress:</span>
                      <span className="ml-2 text-white font-mono">{completionStatus.progressPercent}%</span>
                    </div>
                  </div>

                  {completionStatus.shouldTransition && (
                    <div className="mt-3 p-2 bg-yellow-900/20 border border-yellow-800 rounded text-yellow-300">
                      ⚠️ Job should have transitioned to "awaiting_confirmation" but is still in "filtering" status!
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Cancel Job Button */}
            <Button
              onClick={async () => {
                if (confirm("Are you sure you want to cancel this extraction job?")) {
                  try {
                    await cancelJob({ jobId: activeJob._id });
                  } catch (error) {
                    console.error("Failed to cancel job:", error);
                    alert("Failed to cancel job. Please try again.");
                  }
                }
              }}
              variant="outline"
              className="w-full bg-gray-700 text-red-400 border-red-800 hover:bg-red-900/20"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Job
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Modal */}
      {activeJob?.status === "awaiting_confirmation" && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Confirm Extraction Count</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">
              Found {activeJob.totalUrls} recipe URLs. How many would you like to extract?
            </p>
            <Input
              type="number"
              value={extractionLimit}
              onChange={(e) => setExtractionLimit(parseInt(e.target.value) || 10)}
              min={1}
              max={activeJob.totalUrls}
              className="bg-white border-gray-300 text-gray-900"
            />
            <Button
              onClick={handleConfirmCount}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Start Extraction
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs History */}
      {jobs && jobs.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 text-lg">Recent Extractions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.slice(0, 5).map((job: any) => (
                <div
                  key={job._id}
                  className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusLabel(job.status)}
                      </Badge>
                      <Badge variant="outline" className="text-gray-700 border-gray-400">
                        {job.jobType}
                      </Badge>
                    </div>
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1 truncate max-w-md"
                    >
                      {job.sourceUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {job.status === "completed" ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <div>
                          <p className="text-sm font-medium">{job.extractedCount}</p>
                          <p className="text-xs text-gray-600">extracted</p>
                        </div>
                      </div>
                    ) : job.status === "failed" ? (
                      <XCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* Extracted Recipes Results - Carousel */}
      {recipes && recipes.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 text-lg flex items-center justify-between">
              <span>Extracted Recipes ({recipes.length})</span>
              <Badge className="bg-green-600">Latest Results</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-12 space-y-6">
            <Carousel
              opts={{
                align: "start",
                loop: false,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-4">
                {recipes.map((recipe: any) => (
                  <CarouselItem key={recipe._id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                    <UnifiedRecipeCard
                      recipe={recipe}
                      onToggleFavorite={() => handleToggleFavorite(recipe._id)}
                      onAddToCookbook={() => handleAddToCookbook(recipe)}
                      onShare={() => handleShare(recipe)}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="text-gray-900 border-gray-300 hover:bg-gray-100" />
              <CarouselNext className="text-gray-900 border-gray-300 hover:bg-gray-100" />
            </Carousel>

            {/* Extract More Section */}
            {latestCompletedJob && latestCompletedJob.jobType === "recipe" && (
              <div className="border-t border-gray-200 pt-6">
                <div className="space-y-4">
                  {/* Remaining count */}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-600">
                        Total available: <span className="text-gray-900 font-medium">{latestCompletedJob.totalUrls}</span>
                      </p>
                      <p className="text-gray-600">
                        Already extracted: <span className="text-gray-900 font-medium">{(latestCompletedJob.extractedUrlsList || []).length}</span>
                      </p>
                      <p className="text-gray-600">
                        Remaining: <span className="text-green-600 font-medium">
                          {latestCompletedJob.totalUrls - (latestCompletedJob.extractedUrlsList || []).length}
                        </span> recipes
                      </p>
                    </div>
                  </div>

                  {/* Extract More Input & Button */}
                  {latestCompletedJob.totalUrls > (latestCompletedJob.extractedUrlsList || []).length && (
                    <div className="flex gap-3">
                      <Input
                        type="number"
                        value={additionalExtractionCount}
                        onChange={(e) => setAdditionalExtractionCount(parseInt(e.target.value) || 10)}
                        min={1}
                        max={latestCompletedJob.totalUrls - (latestCompletedJob.extractedUrlsList || []).length}
                        className="bg-white border-gray-300 text-gray-900 w-32"
                      />
                      <Button
                        onClick={handleExtractMore}
                        className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={!!activeJob}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Extract {additionalExtractionCount} More Recipes
                      </Button>
                    </div>
                  )}

                  {/* No more recipes message */}
                  {latestCompletedJob.totalUrls <= (latestCompletedJob.extractedUrlsList || []).length && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-green-700 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        All recipes have been extracted!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Enrichment Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    AI Tag Enrichment
                  </h3>
                  <p className="text-sm text-gray-600">
                    Enrich recipes with 15+ AI-generated metadata fields including diet tags, allergens, cuisine,
                    cooking methods, difficulty, flavor profile, and more. This dramatically improves search accuracy.
                  </p>
                </div>

                {/* Enrichment Status */}
                {enrichResult && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                    <p className="text-amber-700 text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Last Enrichment Results
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total</p>
                        <p className="text-gray-900 font-medium">{enrichResult.total}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Enriched</p>
                        <p className="text-green-600 font-medium">{enrichResult.successCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Failed</p>
                        <p className="text-red-600 font-medium">{enrichResult.failureCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enrichment Button */}
                <Button
                  onClick={handleEnrichRecipes}
                  disabled={isEnriching || !!activeJob}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enriching & Importing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Enrich & Import {recipes.length} Recipes to Community
                    </>
                  )}
                </Button>

                {/* Info message */}
                <p className="text-xs text-gray-500 text-center">
                  🤖 Using OpenRouter's gpt-oss-20b model • Cost: ~$0.06 per 1,000 recipes
                </p>
              </div>
            </div>

            {/* Import to Community Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-purple-600" />
                    Quick Import (Skip AI Enrichment)
                  </h3>
                  <p className="text-sm text-gray-600">
                    Import recipes directly to the community without AI enrichment. This is faster but recipes won't have AI-generated tags.
                    Use this if you want to quickly import recipes or if they're already enriched.
                  </p>
                </div>

                {/* Import Status */}
                {syncResult && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <p className="text-blue-700 text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Last Import Results
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Total</p>
                        <p className="text-gray-900 font-medium">{syncResult.total}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Imported</p>
                        <p className="text-green-600 font-medium">{syncResult.successCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Failed</p>
                        <p className="text-red-600 font-medium">{syncResult.failureCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Button */}
                <Button
                  onClick={handleSyncToVectorDB}
                  disabled={isSyncing || !!activeJob}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing to Community...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Import All {recipes.length} Recipes to Community
                    </>
                  )}
                </Button>

                {/* Info message */}
                <p className="text-xs text-gray-500 text-center">
                  💡 Tip: Imported recipes will be searchable in the community's AI Chat and visible in the Recipes tab
                </p>
              </div>
            </div>

            {/* Clear Embeddings & Re-embed Section */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-gray-900 font-semibold flex items-center gap-2 mb-2">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    Clear Embeddings & Re-embed
                  </h3>
                  <p className="text-sm text-gray-600">
                    Delete all embedded recipes and re-embed them fresh. This is useful when the schema changes
                    (e.g., adding imageUrl field). Your source recipes (extractedRecipes) are kept safe.
                  </p>
                </div>

                {/* Warning box */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                  <p className="text-yellow-700 text-sm font-medium">⚠️ What this does:</p>
                  <ul className="text-xs text-gray-700 space-y-1 ml-4 list-disc">
                    <li>Deletes all embedded recipes from vector database</li>
                    <li>Keeps your source recipes (extractedRecipes) safe</li>
                    <li>Re-enriches with AI tags</li>
                    <li>Re-embeds with updated schema (includes images)</li>
                  </ul>
                </div>

                {/* Clear & Re-embed Button */}
                <Button
                  onClick={handleClearAndReEmbed}
                  disabled={isEnriching || !!activeJob}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500"
                >
                  {isEnriching ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Clearing & Re-embedding...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear & Re-embed {recipes.length} Recipes
                    </>
                  )}
                </Button>

                {/* Info message */}
                <p className="text-xs text-gray-500 text-center">
                  🔒 Safe operation: Source data is preserved, only embeddings are refreshed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!jobs || (jobs.length === 0 && !isExtracting && (
        <Card className="bg-white border-gray-200">
          <CardContent className="py-12 text-center">
            <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Extractions Yet</h3>
            <p className="text-gray-600">
              Enter a sitemap URL above to start extracting {jobType}s
            </p>
          </CardContent>
        </Card>
      ))}

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
