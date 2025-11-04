"use client";

import { cn } from "@/lib/recipeai-utils";
import { Home, Sparkles } from "lucide-react";

type Props = {
  activeTab: "convexAi" | "home";
  onChangeTab: (tab: "convexAi" | "home") => void;
};

const NAV_ITEMS: Array<{
  id: "convexAi" | "home";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "convexAi", label: "Convex AI", icon: Sparkles },
  { id: "home", label: "Home", icon: Home },
];

export function HealthyMamaBottomNav({ activeTab, onChangeTab }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 pb-safe">
      <div className="mx-auto flex max-w-xl justify-evenly px-4 py-3">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTab(id)}
              className={cn(
                "flex flex-1 flex-col items-center rounded-2xl px-4 py-2 text-xs font-medium transition",
                isActive
                  ? "bg-recipeai-accent/10 text-recipeai-accent shadow-glow"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              )}
            >
              <Icon className={cn("mb-1 h-5 w-5", isActive && "text-recipeai-accent")} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
