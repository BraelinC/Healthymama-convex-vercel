"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Id } from "@/convex/_generated/dataModel";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Upload, X, Loader2, Users, Shuffle } from "lucide-react";

interface Friend {
  userId: string;
  name: string;
  email: string;
}

interface CreateSharedCookbookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friend: Friend | null;
  onSuccess?: (cookbookId: Id<"sharedCookbooks">) => void;
}

export function CreateSharedCookbookModal({
  open,
  onOpenChange,
  friend,
  onSuccess,
}: CreateSharedCookbookModalProps) {
  const { user } = useUser();
  const createSharedCookbook = useMutation(api.sharedCookbooks.createSharedCookbook);
  const generateUploadUrl = useMutation(api.sharedCookbooks.generateUploadUrl);

  // UploadStuff hook for file uploads
  const { startUpload } = useUploadFiles(generateUploadUrl);

  // Form state
  const [cookbookName, setCookbookName] = useState("");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Upload using UploadStuff
      const uploaded = await startUpload(files);

      if (uploaded && uploaded.length > 0) {
        const storageId = uploaded[0].response.storageId as Id<"_storage">;
        setImageStorageId(storageId);

        // Create preview URL
        const preview = URL.createObjectURL(file);
        setPreviewUrl(preview);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!user?.id) {
      setError("You must be logged in");
      return;
    }

    if (!friend) {
      setError("No friend selected");
      return;
    }

    if (!cookbookName.trim()) {
      setError("Cookbook name is required");
      return;
    }

    if (cookbookName.trim().length > 50) {
      setError("Cookbook name must be less than 50 characters");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const cookbookId = await createSharedCookbook({
        name: cookbookName.trim(),
        imageStorageId: imageStorageId || undefined,
        creatorId: user.id,
        inviteFriendId: friend.userId,
      });

      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      // Reset form
      setCookbookName("");
      setImageStorageId(null);
      setPreviewUrl("");

      onOpenChange(false);
      onSuccess?.(cookbookId);
    } catch (err: any) {
      setError(err.message || "Failed to create shared cookbook");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setCookbookName("");
    setImageStorageId(null);
    setPreviewUrl("");
    setError(null);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-healthymama-pink">
            <Shuffle className="w-5 h-5" />
            Create Shared Cookbook
          </SheetTitle>
          <SheetDescription>
            Create a cookbook to share recipes with your friend
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Friend Info */}
          {friend && (
            <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg">
              <Avatar className="w-10 h-10 bg-healthymama-pink">
                <AvatarFallback className="text-white">
                  {friend.name?.[0]?.toUpperCase() || friend.email?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{friend.name}</p>
                <p className="text-sm text-gray-500">{friend.email}</p>
              </div>
              <Users className="w-5 h-5 text-healthymama-pink" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Cookbook Name */}
          <div className="space-y-2">
            <Label htmlFor="cookbook-name">Cookbook Name *</Label>
            <Input
              id="cookbook-name"
              placeholder="e.g., Family Favorites, Date Night Recipes..."
              value={cookbookName}
              onChange={(e) => {
                setCookbookName(e.target.value);
                setError(null);
              }}
              className={error && !cookbookName.trim() ? "border-red-500" : ""}
              autoFocus
            />
          </div>

          {/* Cover Image Upload */}
          <div className="space-y-2">
            <Label>Cover Image (optional)</Label>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Cover Image
                  </>
                )}
              </Button>
              <p className="text-xs text-gray-500">
                Upload an image (max 5MB, JPG/PNG)
              </p>
            </div>

            {/* Image Preview */}
            {previewUrl && (
              <div className="relative mt-2">
                <img
                  src={previewUrl}
                  alt="Cookbook cover preview"
                  className="w-full h-40 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl("");
                    setImageStorageId(null);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || isUploading || !cookbookName.trim()}
              className="flex-1 bg-healthymama-pink hover:bg-healthymama-pink/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Cookbook"
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
