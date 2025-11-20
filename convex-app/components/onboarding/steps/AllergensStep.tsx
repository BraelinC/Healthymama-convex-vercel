"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const COMMON_ALLERGENS = [
  { id: "peanuts", label: "Peanuts", emoji: "🥜" },
  { id: "tree-nuts", label: "Tree Nuts (almonds, walnuts, etc.)", emoji: "🌰" },
  { id: "dairy", label: "Dairy / Milk", emoji: "🥛" },
  { id: "eggs", label: "Eggs", emoji: "🥚" },
  { id: "shellfish", label: "Shellfish (shrimp, crab, lobster)", emoji: "🦐" },
  { id: "fish", label: "Fish", emoji: "🐟" },
  { id: "soy", label: "Soy", emoji: "🫘" },
  { id: "wheat", label: "Wheat", emoji: "🌾" },
  { id: "gluten", label: "Gluten", emoji: "🍞" },
  { id: "sesame", label: "Sesame", emoji: "🥯" },
];

interface AllergensStepProps {
  value: string[];
  onChange: (field: string, value: string[]) => void;
}

export function AllergensStep({ value, onChange }: AllergensStepProps) {
  const toggleAllergen = (allergenId: string) => {
    const newAllergens = value.includes(allergenId)
      ? value.filter((id) => id !== allergenId)
      : [...value, allergenId];
    onChange("allergens", newAllergens);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">
          Do you have any food allergies?
        </h3>
        <p className="text-sm text-gray-800 font-medium">
          Select any foods you MUST avoid due to allergies or intolerances.
          This is critical for your safety.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {COMMON_ALLERGENS.map((allergen) => (
          <div
            key={allergen.id}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-pink-50 transition-colors"
          >
            <Checkbox
              id={allergen.id}
              checked={value.includes(allergen.id)}
              onCheckedChange={() => toggleAllergen(allergen.id)}
              className="border-pink-300 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-healthymama-red data-[state=checked]:to-healthymama-logo-pink data-[state=checked]:border-pink-500"
            />
            <Label
              htmlFor={allergen.id}
              className="text-sm font-medium cursor-pointer text-gray-900 flex items-center gap-2"
            >
              <span className="text-lg">{allergen.emoji}</span>
              <span>{allergen.label}</span>
            </Label>
          </div>
        ))}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-gray-700 font-medium mt-4">
          If you don't have any allergies, you can skip this step.
        </p>
      )}
    </div>
  );
}
