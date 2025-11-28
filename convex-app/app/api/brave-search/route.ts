import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

/**
 * API Route: Brave Search API wrapper
 *
 * Searches the web for recipes using Brave Search API.
 * Filters results to prioritize recipe-related pages and remove blocked domains.
 *
 * POST /api/brave-search
 * Body: { query: string }
 * Returns: { results: [{ title, url, description }] }
 */

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveAPIResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description?: string;
    }>;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Brave Search API key not configured' },
        { status: 500 }
      );
    }

    console.log('[Brave Search] Searching for:', query);

    // Fetch blocked domains from Convex
    const blockedDomains = await convex.query(api.blocklist.blockedDomains.getActiveBlockedDomains);
    console.log(`[Brave Search] Loaded ${blockedDomains.length} blocked domains from Convex`);

    // Call Brave Search API
    const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', '15'); // Increased from 10 to 15 to compensate for filtering

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Brave Search] API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Search service error: ${response.status}` },
        { status: 502 }
      );
    }

    const data: BraveAPIResponse = await response.json();

    if (!data.web?.results || data.web.results.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    // Transform and filter results
    const results: BraveSearchResult[] = data.web.results.map(result => ({
      title: result.title || 'Untitled',
      url: result.url,
      description: result.description || '',
    }));

    // Prioritize recipe-related results
    const recipeResults = results.filter(r =>
      r.title.toLowerCase().includes('recipe') ||
      r.url.toLowerCase().includes('recipe') ||
      r.description.toLowerCase().includes('recipe') ||
      isKnownRecipeSite(r.url)
    );

    // Fill remaining slots with other results
    const finalResults: BraveSearchResult[] = [...recipeResults];

    if (finalResults.length < 5) {
      for (const result of results) {
        if (finalResults.length >= 5) break;
        if (!finalResults.find(r => r.url === result.url)) {
          finalResults.push(result);
        }
      }
    }

    // FILTER OUT BLOCKED DOMAINS before returning
    const unblocked = finalResults.filter(r => !isBlockedDomain(r.url, blockedDomains));
    const blocked = finalResults.filter(r => isBlockedDomain(r.url, blockedDomains));

    if (blocked.length > 0) {
      console.log(`[Brave Search] Filtered out ${blocked.length} blocked domains:`,
        blocked.map(r => {
          try {
            return new URL(r.url).hostname;
          } catch {
            return r.url;
          }
        })
      );
    }

    console.log(`[Brave Search] Returning ${unblocked.length} unblocked results`);

    return NextResponse.json({
      success: true,
      results: unblocked.slice(0, 10), // Return up to 10 unblocked results
    });

  } catch (error: any) {
    console.error('[Brave Search] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}

/**
 * Check if URL is from a known recipe website
 */
function isKnownRecipeSite(url: string): boolean {
  const recipeSites = [
    'allrecipes.com',
    'foodnetwork.com',
    'epicurious.com',
    'bonappetit.com',
    'seriouseats.com',
    'simplyrecipes.com',
    'tasty.co',
    'delish.com',
    'food52.com',
    'cookinglight.com',
    'myrecipes.com',
    'eatingwell.com',
    'tasteofhome.com',
    'recipetineats.com',
    'budgetbytes.com',
    'skinnytaste.com',
    'minimalistbaker.com',
    'pinchofyum.com',
    'halfbakedharvest.com',
    'damndelicious.net',
    'loveandlemons.com',
    'cookieandkate.com',
  ];

  const lowerUrl = url.toLowerCase();
  return recipeSites.some(site => lowerUrl.includes(site));
}

/**
 * Check if URL is from a domain that blocks bots
 * @param url - The URL to check
 * @param blockedDomains - Array of blocked domain strings from Convex
 */
function isBlockedDomain(url: string, blockedDomains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return blockedDomains.some(blocked =>
      hostname === blocked || hostname.endsWith('.' + blocked.replace('www.', ''))
    );
  } catch {
    return false;
  }
}
