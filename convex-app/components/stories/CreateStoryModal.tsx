"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Image, Video } from "lucide-react";
import { StoryEditor } from "./StoryEditor";

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateStoryModal({ isOpen, onClose }: CreateStoryModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedFile(file);

      // Determine media type
      if (file.type.startsWith("image/")) {
        setMediaType("image");
      } else if (file.type.startsWith("video/")) {
        setMediaType("video");
      }

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Open editor
      setShowEditor(true);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp"],
      "video/*": [".mp4", ".mov", ".webm"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setShowEditor(false);
    onClose();
  };

  const handleEditorClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setMediaType(null);
    setShowEditor(false);
  };

  const handleSuccess = () => {
    handleClose();
  };

  // Show StoryEditor if file is selected
  if (showEditor && selectedFile && previewUrl && mediaType) {
    return (
      <StoryEditor
        file={selectedFile}
        previewUrl={previewUrl}
        mediaType={mediaType}
        onClose={handleEditorClose}
        onSuccess={handleSuccess}
      />
    );
  }

  // Show file picker dialog
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-healthymama-red bg-red-50"
                : "border-gray-300 hover:border-healthymama-red"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">
              {isDragActive
                ? "Drop your image or video here"
                : "Drag & drop an image or video"}
            </p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center text-xs text-gray-400">
                <Image className="w-4 h-4 mr-1" />
                Images
              </div>
              <div className="flex items-center text-xs text-gray-400">
                <Video className="w-4 h-4 mr-1" />
                Videos
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Max file size: 50MB
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
