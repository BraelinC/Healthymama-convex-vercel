"use client";

import { useMemo, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RecipeAI_MessageBubble } from "./RecipeAI_MessageBubble";

type Props = {
  userId: string | null;
  community: string;
};

export function RecipeAI_ChatLog({ userId, community }: Props) {
  const messages = useQuery(
    api.chat.listMessages,
    userId ? { userId, community } : undefined
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    if (!messages) return [];
    return [...messages].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [sortedMessages]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-6 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700"
    >
      {sortedMessages.length === 0 && (
        <div className="mx-auto mt-12 max-w-sm rounded-3xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-center text-slate-400">
          <p className="text-sm font-medium text-slate-200">Welcome to RecipeAI</p>
          <p className="mt-2 text-xs leading-relaxed">
            Ask for ideas like &ldquo;quick vegan pasta&rdquo; or &ldquo;high-protein
            breakfast meal prep&rdquo; to see community-tailored recipes.
          </p>
        </div>
      )}

      {sortedMessages.map((message) => (
        <RecipeAI_MessageBubble
          key={message._id}
          role={message.role}
          content={message.content}
          createdAt={message.createdAt}
        />
      ))}
    </div>
  );
}
