"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/recipeai-utils";
import { Settings } from "lucide-react";

const DIET_OPTIONS = [
  { value: "", label: "No preference" },
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "keto", label: "Keto" },
];

type Props = {
  userId: string;
  email: string;
  onEmailCaptured: (email: string) => void;
};

export function HealthyMamaProfileModal({ userId, email, onEmailCaptured }: Props) {
  const hasUser = Boolean(userId);
  const profile = useQuery(
    api.users.getUserProfile,
    hasUser ? { userId } : undefined
  );
  const upsertProfile = useMutation(api.users.createOrUpdateUser);

  const [open, setOpen] = useState(false);
  const [diet, setDiet] = useState<string>("");
  const [favorites, setFavorites] = useState<string>("");
  const [emailInput, setEmailInput] = useState(email);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasUser) return;
    if (profile && !open) {
      setEmailInput(profile.email || email);
      setDiet(profile.prefs?.diet ?? "");
      setFavorites(profile.prefs?.favorites.join(", ") ?? "");
    }
  }, [profile, open, email, hasUser]);

  useEffect(() => {
    if (!hasUser) return;
    if (profile === null) {
      setOpen(true);
    }
  }, [profile, hasUser]);

  const favoritesArray = useMemo(
    () =>
      favorites
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    [favorites]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasUser) return;
    if (!emailInput.trim()) {
      setError("Email is required so we can personalise suggestions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await upsertProfile({
        userId: userId!,
        email: emailInput.trim(),
        prefs: {
          diet: diet || undefined,
          favorites: favoritesArray,
        },
      });
      onEmailCaptured(emailInput.trim());
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to save profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-200 shadow-lg backdrop-blur transition hover:border-recipeai-accent hover:text-white md:bottom-6"
      >
        <Settings className="h-4 w-4" />
        Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4 py-10 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Personalise
                </p>
                <h2 className="text-xl font-semibold text-white">Your taste profile</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 transition hover:border-recipeai-accent hover:text-white"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(event) => setEmailInput(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-recipeai-accent focus:outline-none focus:ring-2 focus:ring-recipeai-accent/30"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Diet preference
                </label>
                <select
                  value={diet}
                  onChange={(event) => setDiet(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white focus:border-recipeai-accent focus:outline-none focus:ring-2 focus:ring-recipeai-accent/30"
                >
                  {DIET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Favourite ingredients (comma separated)
                </label>
                <textarea
                  value={favorites}
                  onChange={(event) => setFavorites(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-recipeai-accent focus:outline-none focus:ring-2 focus:ring-recipeai-accent/30"
                  placeholder="chickpeas, sweet potato, spinach"
                />
              </div>

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full rounded-2xl bg-recipeai-accent px-4 py-3 text-sm font-semibold text-white shadow-lg transition",
                  submitting ? "opacity-70" : "hover:bg-recipeai-accent/90"
                )}
              >
                {submitting ? "Saving..." : "Save preferences"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
