"use client";

import { HandPlatter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

export default function DownloadLogoPage() {
  const logoRef = useRef<HTMLDivElement>(null);

  const downloadLogo = (size: number) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#dc2626'); // Red
    gradient.addColorStop(1, '#ec4899'); // Pink
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Draw icon (simplified - using text as placeholder)
    ctx.fillStyle = 'white';
    ctx.font = `${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍽️', size / 2, size / 2);

    // Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthymama-logo-${size}x${size}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#dc2626] to-[#ec4899] bg-clip-text text-transparent">
        HealthyMama Logo Download
      </h1>

      {/* Logo Preview - Multiple Sizes */}
      <div className="space-y-8 mb-12">
        {/* 512x512 - Large */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">512x512 (Large)</p>
          <div
            ref={logoRef}
            className="inline-block p-8 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded-3xl shadow-2xl"
            style={{ width: '512px', height: '512px' }}
          >
            <HandPlatter className="text-white w-full h-full" strokeWidth={1.5} />
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                const element = logoRef.current;
                if (!element) return;

                // Use html2canvas or similar library, or right-click save
                alert('Right-click on the logo above and select "Save image as..." to download');
              }}
              className="bg-gradient-to-r from-[#dc2626] to-[#ec4899]"
            >
              Right-click logo to save
            </Button>
          </div>
        </div>

        {/* 256x256 - Medium */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">256x256 (Medium)</p>
          <div
            className="inline-block p-4 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded-2xl shadow-xl"
            style={{ width: '256px', height: '256px' }}
          >
            <HandPlatter className="text-white w-full h-full" strokeWidth={1.5} />
          </div>
        </div>

        {/* 128x128 - Small */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">128x128 (Small)</p>
          <div
            className="inline-block p-2 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded-xl shadow-lg"
            style={{ width: '128px', height: '128px' }}
          >
            <HandPlatter className="text-white w-full h-full" strokeWidth={1.5} />
          </div>
        </div>

        {/* 64x64 - Extra Small */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">64x64 (Icon)</p>
          <div
            className="inline-block p-2 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded-lg shadow-md"
            style={{ width: '64px', height: '64px' }}
          >
            <HandPlatter className="text-white w-full h-full" strokeWidth={1.5} />
          </div>
        </div>

        {/* 32x32 - Favicon */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">32x32 (Favicon)</p>
          <div
            className="inline-block p-1 bg-gradient-to-br from-[#dc2626] to-[#ec4899] rounded shadow-sm"
            style={{ width: '32px', height: '32px' }}
          >
            <HandPlatter className="text-white w-full h-full" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="max-w-2xl bg-gray-50 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">How to Download</h2>
        <ol className="text-left space-y-2 text-gray-700">
          <li><strong>1.</strong> Right-click on any logo above</li>
          <li><strong>2.</strong> Select "Save image as..." or "Copy image"</li>
          <li><strong>3.</strong> Save with your desired filename</li>
        </ol>
        <p className="mt-4 text-sm text-gray-500">
          Or take a screenshot of the logo at your desired size
        </p>
      </div>

      {/* Navigation back */}
      <div className="mt-8">
        <Button
          onClick={() => window.location.href = '/'}
          variant="outline"
          className="border-2 border-[#dc2626] text-[#dc2626] hover:bg-red-50"
        >
          ← Back to Home
        </Button>
      </div>
    </div>
  );
}
