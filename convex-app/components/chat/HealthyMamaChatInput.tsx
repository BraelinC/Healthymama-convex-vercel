"use client";

import { FormEvent, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, SendHorizontal } from "lucide-react";
import { cn } from "@/lib/recipeai-utils";

type Props = {
  userId: string | null;
  email: string;
  community: string;
  onRecipes?: (recipes: any[]) => void;
};

export function HealthyMamaChatInput({ userId, email, community, onRecipes }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChat = useAction(api.chat.handleChatQuery);

  const submit = async (evt?: FormEvent) => {
    evt?.preventDefault();
    if (!message.trim() || !userId) return;
    setIsSubmitting(true);
    setError(null);
    const payload = message.trim();
    setMessage("");

    try {
      const result = await handleChat({
        userId,
        email: email || "guest@recipe.ai",
        community,
        message: payload,
      });
      onRecipes?.(result?.recipes ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Something went wrong");
      setMessage(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="border-t border-slate-800 bg-slate-900/40 px-5 pb-safe pt-4"
    >
      <div className="flex items-end gap-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            community === "community_2"
              ? "Ask for a plant-based recipe idea..."
              : "Ask for a recipe or meal plan..."
          }
          rows={1}
          className={cn(
            "max-h-40 flex-1 resize-none rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-recipeai-accent focus:outline-none focus:ring-2 focus:ring-recipeai-accent/40"
          )}
          disabled={isSubmitting || !userId}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting || !message.trim() || !userId}
          className="inline-flex items-center justify-center rounded-2xl bg-recipeai-accent px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-recipeai-accent/90 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:shadow-none"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-5 w-5" />
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      )}
    </form>
  );
}
