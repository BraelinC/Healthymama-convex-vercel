"use client";

import { cn } from "@/lib/recipeai-utils";

type Community = {
  id: string;
  label: string;
};

type Props = {
  communities: Community[];
  activeCommunityId: string;
  onSelect: (id: string) => void;
};

export function HealthyMamaCommunitySelector({
  communities,
  activeCommunityId,
  onSelect,
}: Props) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {communities.map((community) => {
        const isActive = community.id === activeCommunityId;
        return (
          <button
            key={community.id}
            type="button"
            onClick={() => onSelect(community.id)}
            className={cn(
              "rounded-2xl border border-transparent px-4 py-3 text-left text-sm transition",
              isActive
                ? "border-recipeai-accent/60 bg-recipeai-accent/20 text-white shadow-glow"
                : "bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
            )}
          >
            <div className="font-medium">{community.label}</div>
            <div className="text-xs text-slate-400">{community.id}</div>
          </button>
        );
      })}
    </div>
  );
}
