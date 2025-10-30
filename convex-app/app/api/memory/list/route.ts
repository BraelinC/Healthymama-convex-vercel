import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const limit = searchParams.get("limit");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const memories = await convex.query(api.memory.mutations.listMemories, {
      userId,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({
      memories: memories.map((m: any) => ({
        id: m._id,
        text: m.text,
        category: m.category,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        version: m.version,
        extractedFrom: m.extractedFrom,
      })),
      count: memories.length,
    });
  } catch (error) {
    console.error("Memory list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
