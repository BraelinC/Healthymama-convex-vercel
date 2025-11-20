"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SKILL_LEVELS = [
  {
    id: "beginner" as const,
    label: "Beginner",
    description: "I'm just starting out and prefer simple recipes",
    emoji: "🌱",
  },
  {
    id: "intermediate" as const,
    label: "Intermediate",
    description: "I'm comfortable in the kitchen and can try new techniques",
    emoji: "👨‍🍳",
  },
  {
    id: "advanced" as const,
    label: "Advanced",
    description: "I'm experienced and enjoy complex cooking challenges",
    emoji: "⭐",
  },
];

interface CookingSkillStepProps {
  value?: "beginner" | "intermediate" | "advanced";
  onChange: (field: string, value: "beginner" | "intermediate" | "advanced") => void;
}

export function CookingSkillStep({ value, onChange }: CookingSkillStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">What's your cooking skill level?</h3>
        <p className="text-sm text-gray-800 font-medium">
          This helps us recommend recipes that match your experience.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {SKILL_LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            onClick={() => onChange("cookingSkillLevel", level.id)}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
              value === level.id
                ? "border-pink-500 bg-gradient-to-br from-pink-50 to-red-50 shadow-md"
                : "border-pink-200 bg-white hover:border-pink-300 hover:bg-pink-50"
            )}
          >
            <span className="text-3xl">{level.emoji}</span>
            <div className="flex-1">
              <Label className="text-base font-bold cursor-pointer text-gray-900">
                {level.label}
              </Label>
              <p className="text-sm text-gray-800 mt-1">
                {level.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
