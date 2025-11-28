/**
 * Admin API Route: Seed Blocked Domains
 *
 * POST /api/admin/seed-blocklist
 * Seeds the blocklist with known bot-blocking recipe domains
 */

import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  try {
    console.log('[Admin] Seeding blocked recipe domains...');

    const result = await convex.mutation(api.blocklist.blockedDomains.seedBlockedDomains);

    console.log(`[Admin] Seeded ${result.count} blocked domains`);

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${result.count} blocked domains`,
      domains: result.inserted,
    });
  } catch (error: any) {
    console.error('[Admin] Failed to seed blocklist:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to seed blocklist' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allDomains = await convex.query(api.blocklist.blockedDomains.getAllBlockedDomains);
    const activeDomains = await convex.query(api.blocklist.blockedDomains.getActiveBlockedDomains);

    return NextResponse.json({
      success: true,
      total: allDomains.length,
      active: activeDomains.length,
      domains: allDomains,
    });
  } catch (error: any) {
    console.error('[Admin] Failed to fetch blocklist:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch blocklist' },
      { status: 500 }
    );
  }
}
