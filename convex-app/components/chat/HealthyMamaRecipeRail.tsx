"use client";

import { cn } from "@/lib/recipeai-utils";
import { Leaf, UtensilsCrossed } from "lucide-react";

type Recipe = {
  _id: string;
  name: string;
  description: string;
  ingredients: string[];
  community: string;
  dietTags: string[];
};

type Props = {
  recipes: Recipe[];
  orientation: "horizontal" | "vertical";
  className?: string;
};

export function HealthyMamaRecipeRail({ recipes, orientation, className }: Props) {
  if (!recipes.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner",
        orientation === "horizontal"
          ? "mx-4 mb-20 overflow-x-auto"
          : "max-h-[calc(100vh-14rem)] overflow-y-auto",
        className
      )}
    >
      <div className="flex items-center gap-2 pb-3 text-xs uppercase tracking-widest text-slate-400">
        <UtensilsCrossed className="h-4 w-4" />
        Fresh from search
      </div>
      <div
        className={cn(
          "flex gap-3",
          orientation === "horizontal" ? "" : "flex-col"
        )}
      >
        {recipes.map((recipe) => (
          <article
            key={recipe._id}
            className={cn(
              "w-full flex-shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200 shadow-md transition hover:border-recipeai-accent/60 hover:shadow-glow",
              orientation === "horizontal" ? "max-w-xs" : ""
            )}
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
              <span>{recipe.community}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-[11px]">
                <Leaf className="h-3 w-3" />
                {recipe.dietTags[0] ?? "balanced"}
              </span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-white">{recipe.name}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400 line-clamp-3">
              {recipe.description}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Key ingredients: {recipe.ingredients.slice(0, 4).join(", ")}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
