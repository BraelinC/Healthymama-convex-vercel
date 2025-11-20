"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const KITCHEN_EQUIPMENT = [
  { id: "air-fryer", label: "Air Fryer" },
  { id: "instant-pot", label: "Instant Pot / Pressure Cooker" },
  { id: "slow-cooker", label: "Slow Cooker / Crock Pot" },
  { id: "food-processor", label: "Food Processor" },
  { id: "blender", label: "Blender" },
  { id: "stand-mixer", label: "Stand Mixer" },
  { id: "rice-cooker", label: "Rice Cooker" },
  { id: "grill", label: "Outdoor Grill" },
  { id: "sous-vide", label: "Sous Vide" },
];

interface EquipmentStepProps {
  value?: string[];
  onChange: (field: string, value: string[]) => void;
}

export function EquipmentStep({ value = [], onChange }: EquipmentStepProps) {
  const toggleEquipment = (equipmentId: string) => {
    const newEquipment = value.includes(equipmentId)
      ? value.filter((id) => id !== equipmentId)
      : [...value, equipmentId];
    onChange("kitchenEquipment", newEquipment);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">
          What kitchen equipment do you have?
        </h3>
        <p className="text-sm text-gray-800 font-medium">
          Select any special equipment you own. We'll suggest recipes that use them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {KITCHEN_EQUIPMENT.map((equipment) => (
          <div
            key={equipment.id}
            className="flex items-center space-x-3 p-2 rounded-lg hover:bg-pink-50 transition-colors"
          >
            <Checkbox
              id={equipment.id}
              checked={value.includes(equipment.id)}
              onCheckedChange={() => toggleEquipment(equipment.id)}
              className="border-pink-300 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-healthymama-red data-[state=checked]:to-healthymama-logo-pink data-[state=checked]:border-pink-500"
            />
            <Label
              htmlFor={equipment.id}
              className="text-sm font-medium cursor-pointer text-gray-900"
            >
              {equipment.label}
            </Label>
          </div>
        ))}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-gray-700 font-medium mt-4">
          If you only have basic equipment (pots, pans, oven), you can skip this step.
        </p>
      )}
    </div>
  );
}
