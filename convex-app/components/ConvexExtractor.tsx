"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
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
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { UnifiedRecipeCard } from "@/components/UnifiedRecipeCard";
import { CookbookSelectionSheet } from "@/components/CookbookSelectionSheet";

interface ConvexExtractorProps {
  userId: string;
  communityId: string;
}

export default function ConvexExtractor({ userId, communityId }: ConvexExtractorProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [jobType, setJobType] = useState<"profile" | "recipe">("profile");
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

  // Mutations for saving recipes
  const saveRecipe = useMutation(api.userRecipes.saveRecipeToUserCookbook);
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
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Authentication Error</h3>
            <p className="text-gray-400">
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

  // Action: Run extraction
  const runExtraction = useAction(api.extractor.runExtraction);

  // Mutation: Confirm extraction count
  const confirmCount = useMutation(api.extractor.confirmExtractionCount);

  // Action: Continue extraction
  const continueExtraction = useAction(api.extractor.continueExtraction);

  // Mutation: Cancel job
  const cancelJob = useMutation(api.extractor.cancelJob);

  // Mutation: Extract more recipes
  const extractMoreRecipes = useMutation(api.extractor.extractMoreRecipes);

  // Mutation: Delete all extraction data
  const deleteAllData = useMutation(api.extractor.deleteAllExtractionData);

  // Action: Embed recipes to vector database
  const embedJobRecipes = useAction(api.recipeEmbeddings.embedJobRecipes);

  // Action: Enrich recipes with AI tags
  const enrichJobRecipes = useAction(api.enrichExistingRecipes.enrichRecipesByJobId);

  // Mutation: Clear embedded recipes (for re-embedding with new schema)
  const deleteRecipesForCommunity = useMutation(api.recipeMaintenance.deleteRecipesForCommunity);

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
          alert(`✅ Successfully enriched ${result.enrichResult.successCount} recipes with AI tags!\nRecipes are now embedded and ready for semantic search.`);
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

      console.log(`🔄 [SYNC] Starting vector DB sync for job: ${latestCompletedJob._id}`);

      const result = await embedJobRecipes({
        jobId: latestCompletedJob._id,
      });

      console.log(`✅ [SYNC] Completed:`, result);

      setSyncResult(result);

      if (result.successCount > 0) {
        alert(`✅ Successfully synced ${result.successCount} recipes to vector database!`);
      } else {
        alert(`⚠️ No recipes were synced. They may already exist in the vector database.`);
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync recipes. Please try again.");
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* URL Input Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {jobType === "profile" ? "Profile Extractor" : "Recipe Extractor"}
          </CardTitle>
          <p className="text-gray-400 text-sm">
            {jobType === "profile"
              ? "Extract creator profiles from sitemaps or link trees"
              : "Extract recipes from website sitemaps"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Job Type Toggle + Reset Button */}
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={jobType === "profile" ? "default" : "outline"}
                size="sm"
                onClick={() => setJobType("profile")}
                className={
                  jobType === "profile"
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
                }
              >
                <User className="w-4 h-4 mr-2" />
                Profiles
              </Button>
              <Button
                variant={jobType === "recipe" ? "default" : "outline"}
                size="sm"
                onClick={() => setJobType("recipe")}
                className={
                  jobType === "recipe"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600"
                }
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
              className="bg-red-900/20 text-red-400 border-red-800 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-lg">Extraction in Progress</CardTitle>
              <Badge className={getStatusColor(activeJob.status)}>
                {getStatusLabel(activeJob.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  {activeJob.processedUrls} / {activeJob.totalUrls} URLs processed
                </span>
                <span className="text-gray-400">{getProgress(activeJob)}%</span>
              </div>
              <Progress value={getProgress(activeJob)} className="h-2 bg-gray-700" />
            </div>

            {/* Job Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Source URL</p>
                <a
                  href={activeJob.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 truncate"
                >
                  {activeJob.sourceUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <p className="text-gray-500">Type</p>
                <p className="text-white capitalize">{activeJob.jobType}</p>
              </div>
              <div>
                <p className="text-gray-500">Filtered URLs</p>
                <p className="text-white">{activeJob.filteredUrls?.length || 0}</p>
              </div>
              <div>
                <p className="text-gray-500">Extracted</p>
                <p className="text-white">{activeJob.extractedCount}</p>
              </div>
            </div>

            {/* Error Display */}
            {activeJob.error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  {activeJob.error}
                </p>
              </div>
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Confirm Extraction Count</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              Found {activeJob.totalUrls} recipe URLs. How many would you like to extract?
            </p>
            <Input
              type="number"
              value={extractionLimit}
              onChange={(e) => setExtractionLimit(parseInt(e.target.value) || 10)}
              min={1}
              max={activeJob.totalUrls}
              className="bg-gray-700 border-gray-600 text-white"
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Recent Extractions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobs.slice(0, 5).map((job: any) => (
                <div
                  key={job._id}
                  className="bg-gray-700 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getStatusColor(job.status)}>
                        {getStatusLabel(job.status)}
                      </Badge>
                      <Badge variant="outline" className="text-gray-300 border-gray-600">
                        {job.jobType}
                      </Badge>
                    </div>
                    <a
                      href={job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 hover:text-blue-400 flex items-center gap-1 truncate max-w-md"
                    >
                      {job.sourceUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(job.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {job.status === "completed" ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <div>
                          <p className="text-sm font-medium">{job.extractedCount}</p>
                          <p className="text-xs text-gray-500">extracted</p>
                        </div>
                      </div>
                    ) : job.status === "failed" ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Profiles Results */}
      {profiles && profiles.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center justify-between">
              <span>Extracted Profiles ({profiles.length})</span>
              <Badge className="bg-green-600">Latest Results</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.map((profile: any) => (
                <div
                  key={profile._id}
                  className="bg-gray-700 rounded-lg p-4 space-y-3 hover:bg-gray-650 transition-colors"
                >
                  {/* Profile Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      {profile.name && (
                        <h3 className="text-white font-semibold">{profile.name}</h3>
                      )}
                      <a
                        href={profile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        View Profile
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <User className="w-5 h-5 text-gray-500" />
                  </div>

                  {/* Bio */}
                  {profile.bio && (
                    <p className="text-sm text-gray-300 line-clamp-3">{profile.bio}</p>
                  )}

                  {/* Links */}
                  {profile.links && profile.links.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        Links ({profile.links.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.links.slice(0, 3).map((link: any, idx: number) => (
                          <a
                            key={idx}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs bg-gray-800 hover:bg-gray-600 px-2 py-1 rounded flex items-center gap-1 text-gray-300"
                          >
                            {link.text || new URL(link.url).hostname}
                            <ExternalLink className="w-2 h-2" />
                          </a>
                        ))}
                        {profile.links.length > 3 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
                            +{profile.links.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {profile.metadata?.scrapedAt && (
                    <p className="text-xs text-gray-500">
                      Scraped: {new Date(profile.metadata.scrapedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Recipes Results - Carousel */}
      {recipes && recipes.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center justify-between">
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
              <CarouselPrevious className="text-white border-gray-600 hover:bg-gray-700" />
              <CarouselNext className="text-white border-gray-600 hover:bg-gray-700" />
            </Carousel>

            {/* Extract More Section */}
            {latestCompletedJob && latestCompletedJob.jobType === "recipe" && (
              <div className="border-t border-gray-700 pt-6">
                <div className="space-y-4">
                  {/* Remaining count */}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-400">
                        Total available: <span className="text-white font-medium">{latestCompletedJob.totalUrls}</span>
                      </p>
                      <p className="text-gray-400">
                        Already extracted: <span className="text-white font-medium">{(latestCompletedJob.extractedUrlsList || []).length}</span>
                      </p>
                      <p className="text-gray-400">
                        Remaining: <span className="text-green-400 font-medium">
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
                        className="bg-gray-700 border-gray-600 text-white w-32"
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
                    <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                      <p className="text-green-400 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        All recipes have been extracted!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Enrichment Section */}
            <div className="border-t border-gray-700 pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    AI Tag Enrichment
                  </h3>
                  <p className="text-sm text-gray-400">
                    Enrich recipes with 15+ AI-generated metadata fields including diet tags, allergens, cuisine,
                    cooking methods, difficulty, flavor profile, and more. This dramatically improves search accuracy.
                  </p>
                </div>

                {/* Enrichment Status */}
                {enrichResult && (
                  <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 space-y-2">
                    <p className="text-amber-400 text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Last Enrichment Results
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Total</p>
                        <p className="text-white font-medium">{enrichResult.total}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Enriched</p>
                        <p className="text-green-400 font-medium">{enrichResult.successCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Failed</p>
                        <p className="text-red-400 font-medium">{enrichResult.failureCount}</p>
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
                      Enriching with AI Tags...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Enrich {recipes.length} Recipes with AI Tags
                    </>
                  )}
                </Button>

                {/* Info message */}
                <p className="text-xs text-gray-500 text-center">
                  🤖 Using OpenRouter's gpt-oss-20b model • Cost: ~$0.06 per 1,000 recipes
                </p>
              </div>
            </div>

            {/* Sync to Vector Database Section */}
            <div className="border-t border-gray-700 pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-purple-400" />
                    Vector Database Sync (Manual)
                  </h3>
                  <p className="text-sm text-gray-400">
                    Manually sync recipes to the vector database. Note: Recipes are automatically synced during AI enrichment,
                    so only use this if you need to re-sync or sync recipes without enrichment.
                  </p>
                </div>

                {/* Sync Status */}
                {syncResult && (
                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 space-y-2">
                    <p className="text-blue-400 text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Last Sync Results
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Total</p>
                        <p className="text-white font-medium">{syncResult.total}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Synced</p>
                        <p className="text-green-400 font-medium">{syncResult.successCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Failed</p>
                        <p className="text-red-400 font-medium">{syncResult.failureCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sync Button */}
                <Button
                  onClick={handleSyncToVectorDB}
                  disabled={isSyncing || !!activeJob}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing to Vector DB...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Sync {recipes.length} Recipes to Vector DB
                    </>
                  )}
                </Button>

                {/* Info message */}
                <p className="text-xs text-gray-500 text-center">
                  💡 Tip: After syncing, you can search for these recipes using natural language in the AI Chat
                </p>
              </div>
            </div>

            {/* Clear Embeddings & Re-embed Section */}
            <div className="border-t border-gray-700 pt-6 mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2 mb-2">
                    <Trash2 className="w-5 h-5 text-red-400" />
                    Clear Embeddings & Re-embed
                  </h3>
                  <p className="text-sm text-gray-400">
                    Delete all embedded recipes and re-embed them fresh. This is useful when the schema changes
                    (e.g., adding imageUrl field). Your source recipes (extractedRecipes) are kept safe.
                  </p>
                </div>

                {/* Warning box */}
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 space-y-2">
                  <p className="text-yellow-400 text-sm font-medium">⚠️ What this does:</p>
                  <ul className="text-xs text-gray-300 space-y-1 ml-4 list-disc">
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
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <Globe className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Extractions Yet</h3>
            <p className="text-gray-400">
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
