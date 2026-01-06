/**
 * Seed Script: Initialize Blocked Recipe Domains
 *
 * Run this once after schema deployment to populate the blocklist
 * with known bot-blocking domains.
 *
 * Usage: npm run seed-blocklist
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function seedBlocklist() {
  console.log('🌱 Seeding blocked recipe domains...');

  try {
    const result = await convex.mutation(api.blocklist.blockedDomains.seedBlockedDomains);

    console.log(`✅ Seeded ${result.count} blocked domains:`);
    result.inserted.forEach(domain => {
      console.log(`   - ${domain}`);
    });

    console.log('\n✅ Blocklist seeding complete!');
  } catch (error) {
    console.error('❌ Failed to seed blocklist:', error);
    process.exit(1);
  }
}

seedBlocklist();
