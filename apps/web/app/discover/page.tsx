"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@healthymama/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RecipeDetailSheet } from "@/components/recipe/RecipeDetailSheet";
import { AuthBlockerModal } from "@/components/auth/AuthBlockerModal";
import { useToast } from "@/hooks/use-toast";
import { Search, Home, Loader2, Clock, ExternalLink, ChefHat, Sparkles, ArrowLeft, X } from "lucide-react";

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface ExtractedRecipe {
  _id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  category?: string;
  createdAt: number;
  url: string;
  enrichedMetadata?: { dietTags?: string[]; mealTypes?: string[]; cuisine?: string };
}

export default function DiscoverPage() {
  const router = useRouter();
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BraveSearchResult[]>([]);
  const [extractingUrl, setExtractingUrl] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<ExtractedRecipe | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const discoverData = useQuery(api.discover.getAllExtractedRecipes, { limit: 50 });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const response = await fetch("/api/brave-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery + " recipe" }),
      });
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      toast({ title: "Search failed", description: "Unable to search. Try again.", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleExtractRecipe = async (url: string) => {
    setExtractingUrl(url);
    try {
      const response = await fetch("/api/recipe-url/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Extraction failed");
      }
      const data = await response.json();
      if (data.success && data.recipe) {
        setSelectedRecipe({
          _id: "temp-" + Date.now(),
          title: data.recipe.title,
          description: data.recipe.description,
          imageUrl: data.recipe.imageUrl,
          ingredients: data.recipe.ingredients || [],
          instructions: data.recipe.instructions || [],
          servings: data.recipe.servings,
          prep_time: data.recipe.prep_time,
          cook_time: data.recipe.cook_time,
          createdAt: Date.now(),
          url: url,
        });
        setIsDetailSheetOpen(true);
        toast({ title: "Recipe extracted!", description: "Found: " + data.recipe.title });
      } else {
        throw new Error("No recipe data found");
      }
    } catch (error: unknown) {
      console.error("Extraction error:", error);
      const msg = error instanceof Error ? error.message : "Unable to extract recipe";
      toast({ title: "Extraction failed", description: msg, variant: "destructive" });
    } finally {
      setExtractingUrl(null);
    }
  };

  const clearSearch = () => { setSearchQuery(""); setSearchResults([]); setShowSearchResults(false); };
  const handleRecipeClick = (recipe: ExtractedRecipe) => { setSelectedRecipe(recipe); setIsDetailSheetOpen(true); };
  const showAuthModal = isLoaded && !isSignedIn;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      <AuthBlockerModal isOpen={showAuthModal} />
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded-full"><Search className="text-white h-4 w-4" /></div>
              <h1 className="text-lg font-semibold text-gray-900">Discover Recipes</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input type="text" placeholder="Search for any recipe online..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pl-10 pr-10 h-11 bg-gray-50 border-gray-200 focus:border-pink-500" />
              {searchQuery && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>}
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} className="bg-gradient-to-r from-[#dc2626] to-[#ec4899] hover:opacity-90 text-white h-11 px-6">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {showSearchResults && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Sparkles className="h-5 w-5 text-pink-500" />Search Results</h2>
              <Button variant="ghost" size="sm" onClick={clearSearch} className="text-gray-500">Clear</Button>
            </div>
            {isSearching ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
            ) : searchResults.length === 0 ? (
              <Card className="p-6 text-center text-gray-500"><Search className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No recipes found. Try a different search term.</p></Card>
            ) : (
              <div className="space-y-3">{searchResults.map((result, index) => <SearchResultCard key={index} result={result} extractingUrl={extractingUrl} onExtract={handleExtractRecipe} />)}</div>
            )}
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4"><ChefHat className="h-5 w-5 text-pink-500" />Recently Extracted Recipes</h2>
          {!discoverData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}</div>
          ) : discoverData.recipes.length === 0 ? (
            <Card className="p-8 text-center text-gray-500"><ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" /><h3 className="font-medium text-lg mb-2">No recipes yet</h3><p className="text-sm">Search for recipes above to start discovering delicious meals!</p></Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{discoverData.recipes.map((recipe: ExtractedRecipe) => <RecipeCard key={recipe._id} recipe={recipe} onClick={() => handleRecipeClick(recipe)} />)}</div>
          )}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-4xl mx-auto flex">
          <Button variant="ghost" className="flex-1 h-16 flex flex-col items-center justify-center gap-1 rounded-none text-gray-500 hover:text-gray-700 hover:bg-gray-50" onClick={() => router.push("/")}>
            <Home className="h-5 w-5" /><span className="text-xs font-medium">Home</span>
          </Button>
          <Button variant="ghost" className="flex-1 h-16 flex flex-col items-center justify-center gap-1 rounded-none bg-gradient-to-br from-red-50 to-pink-50 text-pink-600">
            <Search className="h-5 w-5" /><span className="text-xs font-medium">Discover</span>
          </Button>
        </div>
      </nav>
      {selectedRecipe && user?.id && (
        <RecipeDetailSheet isOpen={isDetailSheetOpen} onClose={() => { setIsDetailSheetOpen(false); setSelectedRecipe(null); }} recipe={{ ...selectedRecipe, title: selectedRecipe.title, instructions: selectedRecipe.instructions }} userId={user.id} />
      )}
    </div>
  );
}

function SearchResultCard({ result, extractingUrl, onExtract }: { result: BraveSearchResult; extractingUrl: string | null; onExtract: (url: string) => void }) {
  let hostname = result.url;
  try { hostname = new URL(result.url).hostname; } catch { /* keep original */ }
  return (
    <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => onExtract(result.url)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 line-clamp-1">{result.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{result.description}</p>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 truncate"><ExternalLink className="h-3 w-3" />{hostname}</p>
        </div>
        <Button size="sm" variant="outline" disabled={extractingUrl === result.url} className="shrink-0">{extractingUrl === result.url ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extract"}</Button>
      </div>
    </Card>
  );
}

function RecipeCard({ recipe, onClick }: { recipe: ExtractedRecipe; onClick: () => void }) {
  const timeDisplay = recipe.cook_time || recipe.prep_time;
  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-lg transition-all group" onClick={onClick}>
      <div className="relative h-32 w-full bg-gray-200">
        {recipe.imageUrl ? <ImageWithFallback src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-gray-100 to-gray-200"><span className="text-4xl">🍼️</span></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {timeDisplay && <Badge variant="secondary" className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs"><Clock className="h-3 w-3 mr-1" />{timeDisplay}</Badge>}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 leading-tight">{recipe.title}</h3>
        {recipe.enrichedMetadata?.mealTypes && recipe.enrichedMetadata.mealTypes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">{recipe.enrichedMetadata.mealTypes.slice(0, 2).map((tag, i) => <Badge key={i} variant="outline" className="text-xs py-0 px-1.5 bg-pink-50 text-pink-700 border-pink-200">{tag}</Badge>)}</div>
        )}
      </div>
    </Card>
  );
}
