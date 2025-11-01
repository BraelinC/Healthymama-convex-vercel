"use client";

import { useEffect, useMemo, useState } from "react";
import { HealthyMamaCommunitySelector } from "@/components/community/HealthyMamaCommunitySelector";
import { HealthyMamaChatLog } from "@/components/chat/HealthyMamaChatLog";
import { HealthyMamaChatInput } from "@/components/chat/HealthyMamaChatInput";
import { HealthyMamaProfileModal } from "@/components/chat/HealthyMamaProfileModal";
import { HealthyMamaRecipeRail } from "@/components/chat/HealthyMamaRecipeRail";
import { HealthyMamaBottomNav } from "@/components/chat/HealthyMamaBottomNav";

const COMMUNITIES = [
  { id: "community_1", label: "Community 1" },
  { id: "community_2", label: "Community 2 (Vegan)" },
];

type SuggestedRecipe = {
  _id: string;
  name: string;
  description: string;
  ingredients: string[];
  community: string;
  dietTags: string[];
};

type RecipeAIUser = {
  id: string | null;
  email: string;
};

function getInitialUser(): RecipeAIUser {
  // Always return null for SSR consistency (prevents hydration mismatch)
  return { id: null, email: "" };
}

export function HealthyMamaChatShell() {
  const [activeTab, setActiveTab] = useState<"convexAi" | "home">("convexAi");
  const [community, setCommunity] = useState(COMMUNITIES[0]);
  const [user, setUser] = useState<RecipeAIUser>(() => getInitialUser());
  const [suggestedRecipes, setSuggestedRecipes] = useState<SuggestedRecipe[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check localStorage for existing user
    const stored = window.localStorage.getItem("recipeai_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.id) {
          setUser({ id: parsed.id as string, email: (parsed.email as string) || "" });
          return;
        }
      } catch {
        // ignore invalid JSON
      }
    }

    // Generate new user ID (only on client after hydration)
    const id = crypto.randomUUID();
    const payload = { id, email: "" };
    window.localStorage.setItem("recipeai_user", JSON.stringify(payload));
    setUser(payload);
  }, []);

  const handleProfileSave = (email: string) => {
    setUser((prev) => {
      const next = { ...prev, email };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("recipeai_user", JSON.stringify(next));
      }
      return next;
    });
  };

  const recipesByCommunity = useMemo(
    () => suggestedRecipes.filter((recipe) => recipe.community === community.id),
    [suggestedRecipes, community.id]
  );

  const userId = user.id;
  const email = user.email;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      {userId && (
        <HealthyMamaProfileModal
          userId={userId}
          email={email}
          onEmailCaptured={handleProfileSave}
        />
      )}

      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
          <aside className="md:w-64">
            <div className="rounded-2xl border border-slate-800 bg-recipeai-panel p-4 shadow-lg">
              <h2 className="text-sm font-semibold text-slate-300">Community</h2>
              <HealthyMamaCommunitySelector
                communities={COMMUNITIES}
                activeCommunityId={community.id}
                onSelect={(communityId) =>
                  setCommunity(
                    COMMUNITIES.find((c) => c.id === communityId) ?? COMMUNITIES[0]
                  )
                }
              />
            </div>

            <div className="mt-4 hidden md:block">
              <HealthyMamaRecipeRail recipes={recipesByCommunity} orientation="vertical" />
            </div>
          </aside>

          <section className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Conversational AI
                </p>
                <h1 className="text-2xl font-semibold text-white">
                  RecipeAI Assistant
                </h1>
              </div>
            </div>

            <div className="flex h-full flex-1 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-recipeai-panel shadow-glow">
              <HealthyMamaChatLog userId={userId} community={community.id} />
              <HealthyMamaChatInput
                userId={userId}
                email={email}
                community={community.id}
                onRecipes={(recipes) => setSuggestedRecipes(recipes)}
              />
            </div>
          </section>
        </div>
      </main>

      <HealthyMamaBottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

      {activeTab === "home" && (
        <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center md:bottom-6">
          <div className="rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm text-slate-300 shadow-lg">
            Home tab placeholder &mdash; wire up your existing landing UI here.
          </div>
        </div>
      )}

      <div className="md:hidden">
        <HealthyMamaRecipeRail
          recipes={recipesByCommunity}
          orientation="horizontal"
          className="border-t border-slate-800 bg-slate-950"
        />
      </div>
    </div>
  );
}
