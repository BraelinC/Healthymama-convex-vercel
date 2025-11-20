"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const GOALS = [
  {
    id: "lose-weight" as const,
    label: "Lose Weight",
    description: "I want to lose weight and eat healthier portions",
    emoji: "⚖️",
  },
  {
    id: "gain-weight" as const,
    label: "Gain Weight",
    description: "I want to gain weight and build muscle",
    emoji: "💪",
  },
  {
    id: "maintain" as const,
    label: "Maintain Weight",
    description: "I want to maintain my current weight and stay healthy",
    emoji: "✨",
  },
  {
    id: "try-more-foods" as const,
    label: "Try More Foods",
    description: "I want to explore new recipes and expand my palate",
    emoji: "🍽️",
  },
];

interface GoalsStepProps {
  value?: string;
  onChange: (field: string, value: string) => void;
}

export function GoalsStep({ value, onChange }: GoalsStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">What's your main goal?</h3>
        <p className="text-sm text-gray-800 font-medium">
          This helps us recommend the right recipes and portions for you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {GOALS.map((goal) => (
          <button
            key={goal.id}
            type="button"
            onClick={() => onChange("goal", goal.id)}
            className={cn(
              "flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
              value === goal.id
                ? "border-pink-500 bg-gradient-to-br from-pink-50 to-red-50 shadow-md"
                : "border-pink-200 bg-white hover:border-pink-300 hover:bg-pink-50"
            )}
          >
            <span className="text-3xl">{goal.emoji}</span>
            <div className="flex-1">
              <Label className="text-base font-bold cursor-pointer text-gray-900">
                {goal.label}
              </Label>
              <p className="text-sm text-gray-800 mt-1">
                {goal.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
