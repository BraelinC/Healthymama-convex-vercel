/**
 * Vercel API route for Puppeteer-based recipe scraping
 * This is the fallback when JSON-LD and Gemini extraction fail
 */

import { NextRequest, NextResponse } from 'next/server';

// Allow up to 60 seconds for scraping (Vercel Pro plan limit)
export const maxDuration = 60;

/**
 * Get browser instance based on environment
 * Production (Vercel): Uses serverless Chromium
 * Local Dev: Uses full Puppeteer
 */
async function getBrowser() {
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    // PRODUCTION: Serverless Chromium for Vercel
    console.log('🚀 [BROWSER] Launching serverless Chromium (Vercel)');
    const chromium = await import('@sparticuz/chromium');
    const puppeteer = await import('puppeteer-core');

    return puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });
  } else {
    // LOCAL DEV: Full Puppeteer
    console.log('🚀 [BROWSER] Launching full Puppeteer (local dev)');
    const puppeteer = await import('puppeteer');
    return puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

/**
 * Smart content loading with network idle waiting and progressive scrolling
 * Ported from old scraper - ensures ingredients/instructions load fully
 */
async function smartContentLoading(page: any) {
  console.log('🎯 [SMART LOAD] Step 1: Wait for network idle');
  try {
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 });
    console.log('✅ [SMART LOAD] Network settled after initial load');
  } catch (e) {
    console.log('⏰ [SMART LOAD] Network idle timeout, continuing...');
  }

  console.log('🎯 [SMART LOAD] Step 2: Scroll to ingredients section');
  await (page as any).evaluate(() => {
    const selectors = [
      '[class*="ingredient"]', '[id*="ingredient"]',
      '.recipe-ingredients', '#ingredients',
      'h2', 'h3',
      '.ingredients-section', '[data-module="ingredients"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log(`Found ingredients at: ${selector}`);
        return;
      }
    }

    // Fallback: scroll to middle of page
    window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'smooth' });
  });

  await new Promise(r => setTimeout(r, 1500));

  // Wait for network to settle after scrolling
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
    console.log('✅ [SMART LOAD] Network settled after scrolling to ingredients');
  } catch (e) {
    console.log('⏰ [SMART LOAD] Network idle timeout after scrolling');
  }

  console.log('🎯 [SMART LOAD] Step 3: Verify ingredients loaded');
  const hasIngredients = await (page as any).evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    const ingredientKeywords = ['cup', 'tablespoon', 'teaspoon', 'tsp', 'tbsp', 'flour', 'sugar', 'egg'];
    return ingredientKeywords.some(keyword => text.includes(keyword));
  });

  if (!hasIngredients) {
    console.log('⚠️ [SMART LOAD] No ingredients found, scrolling more...');
    await (page as any).evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' });
    });
    await new Promise(r => setTimeout(r, 2000));
    // Try to wait for more content after additional scrolling
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 });
    } catch (e) {
      console.log('⏰ [SMART LOAD] No additional network activity detected');
    }
  }

  console.log('🎯 [SMART LOAD] Step 4: Scroll to instructions section');
  await (page as any).evaluate(() => {
    const instructionsSelectors = [
      '[class*="instruction"]', '[id*="instruction"]',
      '.recipe-instructions', '#instructions', '#directions',
      'h2', 'h3',
      '.instructions-section', '[data-module="instructions"]'
    ];

    for (const selector of instructionsSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log(`Found instructions at: ${selector}`);
        return;
      }
    }

    // Fallback: scroll further down
    window.scrollTo({ top: window.innerHeight * 3, behavior: 'smooth' });
  });

  await new Promise(r => setTimeout(r, 1500));

  // Wait for network to settle after scrolling to instructions
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
    console.log('✅ [SMART LOAD] Network settled after scrolling to instructions');
  } catch (e) {
    console.log('⏰ [SMART LOAD] Network idle timeout after instructions scroll');
  }

  console.log('🎯 [SMART LOAD] Step 5: Final content check');
  const contentStats = await (page as any).evaluate(() => {
    const text = document.body.innerText;
    const ingredientCount = (text.match(/\b(cup|tablespoon|teaspoon|tsp|tbsp)\b/gi) || []).length;
    const stepCount = (text.match(/\b(step|preheat|mix|add|bake|cook)\b/gi) || []).length;

    return {
      textLength: text.length,
      ingredientCount,
      stepCount,
      hasRecipeContent: ingredientCount > 0 && stepCount > 0
    };
  });

  if (!contentStats.hasRecipeContent && contentStats.textLength < 1000) {
    console.log('⏰ [SMART LOAD] Content still loading, waiting 5 more seconds...');
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`✅ [SMART LOAD] Complete: ${contentStats.textLength} chars, ${contentStats.ingredientCount} ingredients, ${contentStats.stepCount} steps`);
  return hasIngredients;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL parameter is required'
      }, { status: 400 });
    }

    console.log(`🌐 [VERCEL SCRAPER] Starting Puppeteer for: ${url}`);

    // Launch browser (environment-aware)
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set realistic user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set additional headers for better bot evasion
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      // Critical Sec-Fetch headers for modern bot detection evasion
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    });

    // Set viewport to common desktop resolution
    await page.setViewport({ width: 1366, height: 768 });

    // Navigate with retries
    let attempts = 0;
    while (attempts < 3) {
      try {
        console.log(`🧭 [VERCEL SCRAPER] Navigate attempt ${attempts + 1}/3`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (e) {
        attempts++;
        if (attempts === 3) {
          throw new Error(`Failed to navigate after 3 attempts: ${e}`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    console.log(`🔍 [VERCEL SCRAPER] Page loaded, waiting for content...`);

    // Wait for body to ensure page is rendered
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch (e) {
      console.log(`⚠️ [VERCEL SCRAPER] Body selector timeout, continuing...`);
    }

    // Confirm page is ready (guard against SPA redirects)
    try {
      await (page as any).waitForFunction(
        'document.readyState === "complete" || document.readyState === "interactive"',
        { timeout: 8000 }
      );
      console.log(`✅ [VERCEL SCRAPER] Document ready state: ${await (page as any).evaluate(() => document.readyState)}`);
    } catch (e) {
      console.log(`⏰ [VERCEL SCRAPER] Ready state check timeout, continuing...`);
    }

    // Smart content loading with progressive scrolling and network idle waiting
    await smartContentLoading(page);

    console.log(`📄 [VERCEL SCRAPER] Extracting data...`);

    // Extract JSON-LD structured data
    const jsonLdData = await (page as any).evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Recipe') return item;
            if (item['@graph']) {
              const recipe = item['@graph'].find((g: any) => g['@type'] === 'Recipe');
              if (recipe) return recipe;
            }
          }
        } catch (e) {
          // Skip malformed JSON-LD
        }
      }
      return null;
    });

    // Extract full HTML content
    const html = await page.content();

    // Extract image URLs
    const imageUrls = await (page as any).evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter((img: HTMLImageElement) => {
          // Filter by size - recipe images are usually substantial
          if (img.naturalWidth < 200 || img.naturalHeight < 150) return false;

          // Filter out common non-recipe images
          const src = img.src.toLowerCase();
          const alt = (img.alt || '').toLowerCase();
          const excludePatterns = [
            'logo', 'icon', 'avatar', 'profile', 'social', 'share',
            'advertisement', 'banner', 'header', 'footer', 'sidebar'
          ];

          return !excludePatterns.some(pattern =>
            src.includes(pattern) || alt.includes(pattern)
          );
        })
        .map((img: HTMLImageElement) => img.src)
        .filter((src: string) => src && src.startsWith('http'));
    });

    await browser.close();

    console.log(`✅ [VERCEL SCRAPER] Extraction complete`);
    console.log(`📋 [VERCEL SCRAPER] JSON-LD: ${jsonLdData ? 'Found' : 'Not found'}`);
    console.log(`📄 [VERCEL SCRAPER] HTML length: ${html.length} chars`);
    console.log(`🖼️ [VERCEL SCRAPER] Images: ${imageUrls.length}`);

    return NextResponse.json({
      success: true,
      jsonLdData,
      html,
      imageUrls,
      method: 'puppeteer'
    });

  } catch (error: any) {
    console.error(`🚨 [VERCEL SCRAPER] Error:`, error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
