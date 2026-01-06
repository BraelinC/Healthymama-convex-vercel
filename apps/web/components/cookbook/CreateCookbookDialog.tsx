"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen } from "lucide-react";

interface CreateCookbookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCookbook: (name: string) => void;
}

export function CreateCookbookDialog({
  open,
  onOpenChange,
  onCreateCookbook,
}: CreateCookbookDialogProps) {
  const [cookbookName, setCookbookName] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    // Validation
    if (!cookbookName.trim()) {
      setError("Cookbook name is required");
      return;
    }

    if (cookbookName.trim().length > 50) {
      setError("Cookbook name must be less than 50 characters");
      return;
    }

    // Create cookbook
    onCreateCookbook(cookbookName.trim());

    // Reset and close
    setCookbookName("");
    setError("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setCookbookName("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-healthymama-pink">
            <BookOpen className="w-5 h-5" />
            Create New Cookbook
          </SheetTitle>
          <SheetDescription>
            Give your cookbook a name to organize your recipes
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cookbook-name">Cookbook Name</Label>
            <Input
              id="cookbook-name"
              placeholder="e.g., Summer Favorites, Meal Prep, Quick Dinners..."
              value={cookbookName}
              onChange={(e) => {
                setCookbookName(e.target.value);
                setError("");
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
              className={error ? "border-red-500" : ""}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-healthymama-pink hover:bg-healthymama-pink/90"
            >
              Create Cookbook
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
