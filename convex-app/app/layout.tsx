import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RecipeAI_ConvexProvider } from "@/components/RecipeAI_ConvexProvider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "RecipeAI Chat",
  description: "Serverless recipe assistant powered by Convex and OpenAI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <RecipeAI_ConvexProvider>
          {children}
          <Toaster />
        </RecipeAI_ConvexProvider>
      </body>
    </html>
  );
}
