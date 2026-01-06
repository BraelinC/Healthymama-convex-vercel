"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UIPreviewPage() {
  const [selectedComponent, setSelectedComponent] = useState<string>("welcome");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
            UI Preview Lab
          </h1>
          <p className="text-muted-foreground">
            Generate and preview UI components in isolation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Component List */}
          <aside className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Components</CardTitle>
                <CardDescription>Generated UI elements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={selectedComponent === "welcome" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedComponent("welcome")}
                >
                  Welcome
                </Button>

                {/* Generated components will appear here */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Use the AI agent to generate components:
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block mb-1">
                    /ui create a card
                  </code>
                  <code className="text-xs bg-muted px-2 py-1 rounded block mb-1">
                    /component Name
                  </code>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    /page PageName
                  </code>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Preview Area */}
          <main className="lg:col-span-3">
            <Card className="min-h-[600px]">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Components render here with full app context
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedComponent === "welcome" && (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center">
                    <div className="mb-6">
                      <div className="text-6xl mb-4">🎨</div>
                      <h2 className="text-2xl font-bold mb-2">Welcome to UI Preview Lab</h2>
                      <p className="text-muted-foreground max-w-md">
                        Use AI to generate React components and see them live in this preview environment.
                      </p>
                    </div>

                    <div className="space-y-4 max-w-2xl">
                      <Card className="border-purple-200 bg-purple-50/50">
                        <CardContent className="pt-6">
                          <h3 className="font-semibold mb-2">🤖 Quick Start</h3>
                          <ol className="text-sm text-left space-y-2 list-decimal list-inside">
                            <li>Type <code className="bg-white px-2 py-0.5 rounded">/ui</code> in chat to describe a component</li>
                            <li>AI generates the component in <code className="bg-white px-2 py-0.5 rounded">components/</code></li>
                            <li>Component appears here automatically with hot reload</li>
                            <li>Iterate with feedback to refine</li>
                          </ol>
                        </CardContent>
                      </Card>

                      <Card className="border-pink-200 bg-pink-50/50">
                        <CardContent className="pt-6">
                          <h3 className="font-semibold mb-2">✨ Features</h3>
                          <ul className="text-sm text-left space-y-1 list-disc list-inside">
                            <li>Tailwind CSS + shadcn/ui components</li>
                            <li>TypeScript with full type safety</li>
                            <li>Next.js 14 App Router patterns</li>
                            <li>Convex & Clerk integration</li>
                            <li>Responsive design built-in</li>
                            <li>Accessibility best practices</li>
                          </ul>
                        </CardContent>
                      </Card>

                      <div className="pt-4">
                        <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600">
                          Start Building 🚀
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generated components will be imported and rendered here */}
              </CardContent>
            </Card>
          </main>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Generated components are created in <code className="bg-muted px-2 py-0.5 rounded">app/ui-preview/components/</code>
          </p>
          <p className="mt-1">
            Move to <code className="bg-muted px-2 py-0.5 rounded">components/</code> when ready for production
          </p>
        </div>
      </div>
    </div>
  );
}
