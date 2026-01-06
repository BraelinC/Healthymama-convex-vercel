"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@healthymama/convex";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, Loader2, ZoomIn, ZoomOut, RotateCcw, X, Check } from "lucide-react";

interface ProfileImageUploaderProps {
  userId: string;
  currentImageUrl: string | null;
  userName?: string;
  onImageUpdated?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfileImageUploader({
  userId,
  currentImageUrl,
  userName,
  onImageUpdated,
}: ProfileImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  // Drag state for image positioning
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const generateUploadUrl = useMutation(api.userProfile.generateProfileImageUploadUrl);
  const updateProfileImage = useMutation(api.userProfile.updateProfileImage);
  const deleteProfileImage = useMutation(api.userProfile.deleteProfileImage);

  // Track if we're editing existing image
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const openEditor = useCallback((file: File) => {
    setError(null);

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be less than 5MB");
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setIsEditingExisting(false);
    setShowEditor(true);
  }, []);

  const openEditorWithExistingImage = useCallback(() => {
    if (!currentImageUrl) return;
    setError(null);
    setPreviewUrl(currentImageUrl);
    setSelectedFile(null); // No file, using existing URL
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setIsEditingExisting(true);
    setShowEditor(true);
  }, [currentImageUrl]);

  const closeEditor = useCallback(() => {
    if (previewUrl && !isEditingExisting) {
      URL.revokeObjectURL(previewUrl);
    }
    setShowEditor(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
    setIsEditingExisting(false);
  }, [previewUrl, isEditingExisting]);

  const handleSaveImage = async () => {
    if (!selectedFile && !isEditingExisting) return;
    if (!previewUrl) return;

    setIsUploading(true);

    try {
      // Create a canvas to crop/transform the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Set canvas size (square for profile)
      const outputSize = 400;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Load image
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = previewUrl;
      });

      // Calculate dimensions to maintain aspect ratio and apply transforms
      const containerSize = 280; // Editor preview size
      const imgAspect = img.width / img.height;

      let drawWidth, drawHeight;
      if (imgAspect > 1) {
        drawHeight = containerSize;
        drawWidth = containerSize * imgAspect;
      } else {
        drawWidth = containerSize;
        drawHeight = containerSize / imgAspect;
      }

      // Scale factor from container to output
      const scaleFactor = outputSize / containerSize;

      // Apply transforms
      const scaledWidth = drawWidth * imageScale * scaleFactor;
      const scaledHeight = drawHeight * imageScale * scaleFactor;
      const offsetX = ((outputSize - scaledWidth) / 2) + (imagePosition.x * scaleFactor);
      const offsetY = ((outputSize - scaledHeight) / 2) + (imagePosition.y * scaleFactor);

      // Fill with white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputSize, outputSize);

      // Draw transformed image
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
          "image/jpeg",
          0.9
        );
      });

      // Upload to Convex
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = await response.json();

      // Update profile
      await updateProfileImage({
        userId,
        profileImageStorageId: storageId,
      });

      closeEditor();
      onImageUpdated?.();
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      openEditor(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      openEditor(file);
    }
  };

  const handleDelete = async () => {
    if (!currentImageUrl) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteProfileImage({ userId });
      onImageUpdated?.();
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete image. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = () => {
    if (!userName) return "U";
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Zoom controls
  const handleZoomIn = () => setImageScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setImageScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetTransform = () => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Image drag handlers (mouse)
  const handleImageMouseDown = (e: React.MouseEvent) => {
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
  };

  const handleImageMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingImage) return;
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDraggingImage, dragStart]
  );

  const handleImageMouseUp = () => setIsDraggingImage(false);

  useEffect(() => {
    if (isDraggingImage) {
      window.addEventListener("mousemove", handleImageMouseMove);
      window.addEventListener("mouseup", handleImageMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleImageMouseMove);
        window.removeEventListener("mouseup", handleImageMouseUp);
      };
    }
  }, [isDraggingImage, handleImageMouseMove]);

  // Touch handlers for pinch-zoom
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
      setInitialScale(imageScale);
    } else if (e.touches.length === 1) {
      setIsDraggingImage(true);
      setDragStart({
        x: e.touches[0].clientX - imagePosition.x,
        y: e.touches[0].clientY - imagePosition.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = (distance / initialPinchDistance) * initialScale;
      setImageScale(Math.min(Math.max(scale, 0.5), 3));
    } else if (e.touches.length === 1 && isDraggingImage) {
      setImagePosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDistance(null);
    setIsDraggingImage(false);
  };

  // Editor modal
  if (showEditor && previewUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={closeEditor} className="p-2 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-semibold">Adjust Photo</h3>
            <button
              onClick={handleSaveImage}
              disabled={isUploading}
              className="p-2 hover:bg-green-100 rounded-full text-green-600"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 border-b">
            <button onClick={handleZoomOut} className="p-2 hover:bg-gray-200 rounded-full">
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-sm min-w-12 text-center">{Math.round(imageScale * 100)}%</span>
            <button onClick={handleZoomIn} className="p-2 hover:bg-gray-200 rounded-full">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={handleResetTransform} className="p-2 hover:bg-gray-200 rounded-full ml-2">
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {/* Image preview with circular crop area */}
          <div className="p-6 flex items-center justify-center bg-gray-100">
            <div
              ref={containerRef}
              className="relative w-[280px] h-[280px] rounded-full overflow-hidden cursor-move touch-none border-4 border-purple-300 shadow-lg"
              onMouseDown={handleImageMouseDown}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{
                  transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                }}
                draggable={false}
              />
            </div>
          </div>

          {/* Instructions */}
          <p className="text-center text-sm text-gray-500 p-4">
            Drag to reposition, pinch or use buttons to zoom
          </p>

          {/* Change photo button */}
          <div className="px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Camera className="w-4 h-4 mr-2" />
              Choose different photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  closeEditor();
                  setTimeout(() => openEditor(file), 100);
                }
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="hidden"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-center text-sm text-red-500 px-4 pb-4">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Avatar with upload overlay */}
      <div
        className={`relative group cursor-pointer ${isDragOver ? "scale-105" : ""} transition-transform`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (isUploading) return;
          // If there's already an image, open editor to adjust it
          if (currentImageUrl) {
            openEditorWithExistingImage();
          } else {
            // Otherwise, open file picker
            fileInputRef.current?.click();
          }
        }}
      >
        <Avatar className="h-32 w-32 border-4 border-purple-200 shadow-xl">
          <AvatarImage src={currentImageUrl || undefined} alt="Profile" />
          <AvatarFallback className="bg-gradient-to-br from-purple-500 to-emerald-500 text-white text-3xl font-bold">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay */}
        <div
          className={`absolute inset-0 rounded-full flex items-center justify-center transition-all ${
            isDragOver
              ? "bg-purple-500/60"
              : "bg-black/0 group-hover:bg-black/40"
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <Camera
              className={`h-8 w-8 text-white transition-opacity ${
                isDragOver ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            />
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={isUploading}
        />
      </div>

      {/* Insert a pic button */}
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || isDeleting}
        className="bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600 text-white px-8 py-3 rounded-full shadow-lg"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Camera className="h-5 w-5 mr-2" />
            Insert a pic
          </>
        )}
      </Button>

      {/* Remove button */}
      {currentImageUrl && !isUploading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          {isDeleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Removing...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove photo
            </>
          )}
        </Button>
      )}

      {/* Error message */}
      {error && !showEditor && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
}
