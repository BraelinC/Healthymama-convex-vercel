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

    const history = await convex.query(api.memory.mutations.getMemoryHistory, {
      userId,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({
      history: history.map((h: any) => ({
        id: h._id,
        memoryId: h.memoryId,
        operation: h.operation,
        beforeState: h.beforeState ? JSON.parse(h.beforeState) : null,
        afterState: JSON.parse(h.afterState),
        triggeredBy: h.triggeredBy,
        timestamp: h.timestamp,
        timestampFormatted: new Date(h.timestamp).toISOString(),
      })),
      count: history.length,
    });
  } catch (error) {
    console.error("Memory history error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
