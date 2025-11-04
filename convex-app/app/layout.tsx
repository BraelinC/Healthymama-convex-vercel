import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { HealthyMamaConvexProvider } from "@/components/shared/HealthyMamaConvexProvider";
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
        <HealthyMamaConvexProvider>
          {children}
          <Toaster />
        </HealthyMamaConvexProvider>
      </body>
    </html>
  );
}
