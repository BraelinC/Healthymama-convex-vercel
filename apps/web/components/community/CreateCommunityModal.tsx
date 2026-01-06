"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { useUser } from "@clerk/nextjs";
import { Id } from "@healthymama/convex/dataModel";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Upload, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";

interface CreateCommunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (communityId: string) => void;
}

export function CreateCommunityModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCommunityModalProps) {
  const { user } = useUser();
  const createCommunity = useMutation(api.communities.createCommunity);
  const generateUploadUrl = useMutation(api.communities.files.generateUploadUrl);

  // UploadStuff hook for file uploads
  const { startUpload } = useUploadFiles(generateUploadUrl);

  // Form state
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Name + Cover Image
  const [name, setName] = useState("");
  const [coverImageStorageId, setCoverImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Pricing + Cuisine Type
  const [category, setCategory] = useState("");
  const [nationalityInput, setNationalityInput] = useState("");
  const [nationalities, setNationalities] = useState<string[]>([]);

  // Multi-tier pricing
  const [enableMonthly, setEnableMonthly] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [enableYearly, setEnableYearly] = useState(false);
  const [yearlyPrice, setYearlyPrice] = useState(0);
  const [enableLifetime, setEnableLifetime] = useState(false);
  const [lifetimePrice, setLifetimePrice] = useState(0);

  // Step 3: Description
  const [description, setDescription] = useState("");

  const totalSteps = 3;

  const handleAddNationality = () => {
    if (nationalityInput.trim() && !nationalities.includes(nationalityInput.trim())) {
      setNationalities([...nationalities, nationalityInput.trim()]);
      setNationalityInput("");
    }
  };

  const handleRemoveNationality = (nationality: string) => {
    setNationalities(nationalities.filter((n) => n !== nationality));
  };

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
        setCoverImageStorageId(storageId);

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

  const handleNext = () => {
    // Validation for each step
    if (step === 1 && !name.trim()) {
      setError("Community name is required");
      return;
    }
    if (step === 2 && !category.trim()) {
      setError("Category is required");
      return;
    }
    if (step === 2 && nationalities.length === 0) {
      setError("Please add at least one cuisine type");
      return;
    }
    if (step === 3 && !description.trim()) {
      setError("Description is required");
      return;
    }

    setError(null);
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      setError("You must be logged in to create a community");
      return;
    }

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCommunity({
        userId: user.id,
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        coverImageStorageId: coverImageStorageId || undefined,
        nationalities,
        // Multi-tier pricing (prices in cents)
        monthlyPrice: enableMonthly ? Math.round(monthlyPrice * 100) : undefined,
        yearlyPrice: enableYearly ? Math.round(yearlyPrice * 100) : undefined,
        lifetimePrice: enableLifetime ? Math.round(lifetimePrice * 100) : undefined,
      });

      if (result.success && result.communityId) {
        // Clean up preview URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        // Reset form
        setStep(1);
        setName("");
        setCoverImageStorageId(null);
        setPreviewUrl("");
        setCategory("");
        setNationalities([]);
        setDescription("");
        setEnableMonthly(false);
        setMonthlyPrice(0);
        setEnableYearly(false);
        setYearlyPrice(0);
        setEnableLifetime(false);
        setLifetimePrice(0);

        onOpenChange(false);
        onSuccess?.(result.communityId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create community");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Community Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Italian Pasta Masters"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="coverImage">Cover Image (optional)</Label>
              <div className="space-y-2 mt-1">
                <div className="flex gap-2">
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
                    className="flex-1"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Image
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Upload an image (max 5MB, JPG/PNG)
                </p>
              </div>
              {previewUrl && (
                <div className="mt-2 relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-md"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl("");
                      setCoverImageStorageId(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cuisine">Cuisine</SelectItem>
                  <SelectItem value="Diet">Diet</SelectItem>
                  <SelectItem value="Lifestyle">Lifestyle</SelectItem>
                  <SelectItem value="Health">Health</SelectItem>
                  <SelectItem value="Religious">Religious</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cuisine Types / Nationalities *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="e.g., Italian, Japanese"
                  value={nationalityInput}
                  onChange={(e) => setNationalityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNationality();
                    }
                  }}
                />
                <Button onClick={handleAddNationality} variant="outline" type="button">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {nationalities.map((nationality) => (
                  <Badge
                    key={nationality}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {nationality}
                    <button
                      onClick={() => handleRemoveNationality(nationality)}
                      className="ml-2 hover:text-red-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Pricing Options</Label>
              <p className="text-sm text-gray-500">
                Enable the pricing tiers you want to offer (leave all unchecked for free)
              </p>

              {/* Monthly Pricing */}
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id="enableMonthly"
                  checked={enableMonthly}
                  onChange={(e) => setEnableMonthly(e.target.checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="enableMonthly" className="cursor-pointer">
                    Monthly Subscription
                  </Label>
                  {enableMonthly && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-gray-600">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="9.99"
                        value={monthlyPrice || ""}
                        onChange={(e) => setMonthlyPrice(parseFloat(e.target.value) || 0)}
                        className="max-w-[120px]"
                      />
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Yearly Pricing */}
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id="enableYearly"
                  checked={enableYearly}
                  onChange={(e) => setEnableYearly(e.target.checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="enableYearly" className="cursor-pointer">
                    Yearly Subscription
                  </Label>
                  {enableYearly && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-gray-600">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="99.99"
                        value={yearlyPrice || ""}
                        onChange={(e) => setYearlyPrice(parseFloat(e.target.value) || 0)}
                        className="max-w-[120px]"
                      />
                      <span className="text-sm text-gray-500">/year</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lifetime Pricing */}
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id="enableLifetime"
                  checked={enableLifetime}
                  onChange={(e) => setEnableLifetime(e.target.checked)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="enableLifetime" className="cursor-pointer">
                    Lifetime Access
                  </Label>
                  {enableLifetime && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-gray-600">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="299.99"
                        value={lifetimePrice || ""}
                        onChange={(e) => setLifetimePrice(parseFloat(e.target.value) || 0)}
                        className="max-w-[120px]"
                      />
                      <span className="text-sm text-gray-500">one-time</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Tell people what makes your community special..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                {description.length} characters
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Community</DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-healthymama-logo-pink h-2 rounded-full transition-all"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="py-4">{renderStepContent()}</div>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {step < totalSteps ? (
            <Button
              onClick={handleNext}
              className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-healthymama-logo-pink text-white hover:bg-[#D81B60]"
            >
              {isSubmitting ? (
                "Creating..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create Community
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
