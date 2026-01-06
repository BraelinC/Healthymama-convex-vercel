"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const DIETARY_PREFERENCES = [
  { id: "vegan", label: "Vegan", description: "No animal products", emoji: "🌱" },
  { id: "vegetarian", label: "Vegetarian", description: "No meat or fish", emoji: "🥗" },
  { id: "pescatarian", label: "Pescatarian", description: "No meat, fish OK", emoji: "🐟" },
  { id: "keto", label: "Keto", description: "Very low carb, high fat", emoji: "🥑" },
  { id: "paleo", label: "Paleo", description: "Whole foods, no grains/dairy", emoji: "🍖" },
  { id: "low-carb", label: "Low Carb", description: "Reduced carbohydrates", emoji: "🥩" },
  { id: "gluten-free", label: "Gluten-Free", description: "No gluten (lifestyle choice)", emoji: "🌾" },
  { id: "dairy-free", label: "Dairy-Free", description: "No dairy (lifestyle choice)", emoji: "🥛" },
  { id: "mediterranean", label: "Mediterranean", description: "Plant-based, healthy fats", emoji: "🫒" },
  { id: "whole30", label: "Whole30", description: "Whole foods, no processed", emoji: "🥦" },
];

interface DietaryPreferencesStepProps {
  value: string[];
  onChange: (field: string, value: string[]) => void;
}

export function DietaryPreferencesStep({
  value,
  onChange,
}: DietaryPreferencesStepProps) {
  const togglePreference = (prefId: string) => {
    const newPreferences = value.includes(prefId)
      ? value.filter((id) => id !== prefId)
      : [...value, prefId];
    onChange("dietaryPreferences", newPreferences);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">
          Do you follow any dietary preferences?
        </h3>
        <p className="text-sm text-gray-800 font-medium">
          Select any dietary lifestyles you follow. These are preferences, not
          allergies.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-[320px] overflow-y-auto pr-2">
        {DIETARY_PREFERENCES.map((pref) => (
          <div
            key={pref.id}
            className="flex items-start space-x-3 p-2 rounded-lg hover:bg-pink-50 transition-colors"
          >
            <Checkbox
              id={pref.id}
              checked={value.includes(pref.id)}
              onCheckedChange={() => togglePreference(pref.id)}
              className="mt-1 border-pink-300 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-healthymama-red data-[state=checked]:to-healthymama-logo-pink data-[state=checked]:border-pink-500"
            />
            <div className="flex-1">
              <Label
                htmlFor={pref.id}
                className="text-sm font-semibold cursor-pointer text-gray-900 flex items-center gap-2"
              >
                <span className="text-lg">{pref.emoji}</span>
                <span>{pref.label}</span>
              </Label>
              <p className="text-xs text-gray-700 ml-7">
                {pref.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-gray-700 font-medium mt-4">
          If you don't follow any specific diet, you can skip this step.
        </p>
      )}
    </div>
  );
}
