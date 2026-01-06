"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NameStepProps {
  value?: string;
  onChange: (field: string, value: string) => void;
}

export function NameStep({ value, onChange }: NameStepProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-900">What's your name?</h3>
        <p className="text-sm text-gray-800 font-medium">
          This helps us personalize your experience. You can skip this if you prefer.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="text-gray-900 font-semibold">Name (optional)</Label>
        <Input
          id="name"
          type="text"
          placeholder="Enter your name"
          value={value || ""}
          onChange={(e) => onChange("name", e.target.value)}
          className="text-base border-pink-200 focus:ring-pink-500 focus:border-pink-500 bg-white"
        />
      </div>
    </div>
  );
}
