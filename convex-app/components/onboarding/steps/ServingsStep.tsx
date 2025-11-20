"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ServingsStepProps {
  value?: number;
  onChange: (field: string, value: number) => void;
}

export function ServingsStep({ value, onChange }: ServingsStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">
          How many servings do you typically need?
        </h3>
        <p className="text-sm text-gray-800 font-medium">
          We'll automatically scale recipes to this size by default. You can always
          adjust it later for individual recipes.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultServings" className="text-gray-900 font-semibold">Default Servings</Label>
        <Select
          value={value?.toString() || ""}
          onValueChange={(val) => onChange("defaultServings", parseInt(val))}
        >
          <SelectTrigger
            id="defaultServings"
            className="text-base border-pink-200 focus:ring-pink-500 focus:border-pink-500 bg-white hover:border-pink-300"
          >
            <SelectValue placeholder="Select default servings" />
          </SelectTrigger>
          <SelectContent className="bg-white border-pink-200">
            <SelectItem value="1" className="hover:bg-pink-50 focus:bg-pink-50">1 serving</SelectItem>
            <SelectItem value="2" className="hover:bg-pink-50 focus:bg-pink-50">2 servings</SelectItem>
            <SelectItem value="3" className="hover:bg-pink-50 focus:bg-pink-50">3 servings</SelectItem>
            <SelectItem value="4" className="hover:bg-pink-50 focus:bg-pink-50">4 servings</SelectItem>
            <SelectItem value="5" className="hover:bg-pink-50 focus:bg-pink-50">5 servings</SelectItem>
            <SelectItem value="6" className="hover:bg-pink-50 focus:bg-pink-50">6 servings</SelectItem>
            <SelectItem value="8" className="hover:bg-pink-50 focus:bg-pink-50">8 servings</SelectItem>
            <SelectItem value="10" className="hover:bg-pink-50 focus:bg-pink-50">10 servings</SelectItem>
            <SelectItem value="12" className="hover:bg-pink-50 focus:bg-pink-50">12 servings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-gradient-to-br from-pink-50 to-red-50 p-4 rounded-lg mt-4 border border-pink-200">
        <p className="text-sm text-gray-900 font-medium">
          That's it! We're ready to personalize your HealthyMama experience.
          Click "Complete Setup" to get started.
        </p>
      </div>
    </div>
  );
}
