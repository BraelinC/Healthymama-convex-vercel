"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FamilySizeStepProps {
  value?: number;
  onChange: (field: string, value: number) => void;
}

export function FamilySizeStep({ value, onChange }: FamilySizeStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">How many people are you cooking for?</h3>
        <p className="text-sm text-gray-800 font-medium">
          This helps us adjust recipe portions to fit your needs.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="familySize" className="text-gray-900 font-semibold">Family Size</Label>
        <Select
          value={value?.toString() || ""}
          onValueChange={(val) => onChange("familySize", parseInt(val))}
        >
          <SelectTrigger
            id="familySize"
            className="text-base text-gray-900 border-pink-200 focus:ring-pink-500 focus:border-pink-500 bg-white hover:border-pink-300"
          >
            <SelectValue placeholder="Select family size" className="text-gray-900" />
          </SelectTrigger>
          <SelectContent className="bg-white border-pink-200">
            <SelectItem value="1" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">Just me (1 person)</SelectItem>
            <SelectItem value="2" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">2 people</SelectItem>
            <SelectItem value="3" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">3 people</SelectItem>
            <SelectItem value="4" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">4 people</SelectItem>
            <SelectItem value="5" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">5 people</SelectItem>
            <SelectItem value="6" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">6 people</SelectItem>
            <SelectItem value="7" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">7 people</SelectItem>
            <SelectItem value="8" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">8 people</SelectItem>
            <SelectItem value="10" className="text-gray-900 hover:bg-pink-50 focus:bg-pink-50">10+ people</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
