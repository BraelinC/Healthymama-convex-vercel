/**
 * Vercel API route for Puppeteer-based recipe scraping
 * This is the fallback when JSON-LD and Gemini extraction fail
 * Uses puppeteer-extra with stealth plugin to avoid bot detection
 */

import { NextRequest, NextResponse } from 'next/server';

// Allow up to 60 seconds for scraping (Vercel FREE tier limit)
export const maxDuration = 60;

/**
 * Get browser instance based on environment
 * Uses puppeteer-extra with stealth plugin for bot detection avoidance
 * Production (Vercel): Uses serverless Chromium
 * Local Dev: Uses full Puppeteer
 */
async function getBrowser() {
  // Dynamic import to avoid Next.js static analysis issues
  const puppeteerExtra = (await import('puppeteer-extra')).default;
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;

  // Apply stealth plugin
  puppeteerExtra.use(StealthPlugin());

  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    // PRODUCTION: Serverless Chromium for Vercel with stealth
    console.log('🚀 [BROWSER] Launching serverless Chromium with stealth (Vercel)');
    const chromium = await import('@sparticuz/chromium');

    return puppeteerExtra.launch({
      args: [
        ...chromium.default.args,
        '--disable-blink-features=AutomationControlled', // Hide automation flag
      ],
      defaultViewport: null, // We'll set random viewport later
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });
  } else {
    // LOCAL DEV: Full Puppeteer with stealth
    console.log('🚀 [BROWSER] Launching full Puppeteer with stealth (local dev)');

    return puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
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

/**
 * Expand all hidden content before taking screenshots
 * Handles tabs, accordions, "show more" buttons, and removes popups
 */
async function expandAllContent(page: any) {
  console.log('🔓 [EXPAND] Clicking all expandable elements...');

  await page.evaluate(() => {
    // 1. Click "Jump to Recipe" buttons first
    const jumpSelectors = [
      'a[href*="recipe-card"]', 'a[href*="recipe"]',
      '[class*="jump-to-recipe"]', '[class*="skip-to-recipe"]',
      '[class*="jump-recipe"]', '[class*="go-to-recipe"]',
      'button[class*="jump"]', 'a[class*="jump"]'
    ];
    jumpSelectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach((el: any) => {
          if (el.textContent?.toLowerCase().includes('jump') ||
              el.textContent?.toLowerCase().includes('skip') ||
              el.textContent?.toLowerCase().includes('go to recipe')) {
            el.click?.();
          }
        });
      } catch (e) {}
    });

    // 2. Expand accordions and collapsed sections
    const expandSelectors = [
      'button[aria-expanded="false"]',
      '[class*="expand"]', '[class*="toggle"]', '[class*="collapse"]',
      '[class*="show-more"]', '[class*="read-more"]', '[class*="see-more"]',
      '[class*="view-more"]', '[class*="load-more"]',
      '.accordion-header', '.accordion-trigger', '.accordion-button',
      'details:not([open]) summary',
      '[data-toggle]', '[data-expand]', '[data-collapse]'
    ];

    expandSelectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach((el: any) => el.click?.());
      } catch (e) {}
    });

    // 3. Click ALL tabs to reveal content (ingredients, instructions, nutrition)
    const tabSelectors = [
      '[role="tab"]', '.tab', '.tab-button', '[class*="tab-"]',
      '[data-tab]', '[data-toggle="tab"]', '[data-bs-toggle="tab"]',
      'button[class*="ingredient"]', 'button[class*="instruction"]',
      'button[class*="direction"]', 'button[class*="step"]',
      '.nav-link', '.tab-link'
    ];

    tabSelectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach((el: any) => el.click?.());
      } catch (e) {}
    });

    // 4. Open HTML5 <details> elements
    document.querySelectorAll('details:not([open])').forEach((d: any) => d.setAttribute('open', ''));

    // 5. Remove common overlay/popup blockers
    const overlaySelectors = [
      '[class*="modal"]', '[class*="popup"]', '[class*="overlay"]',
      '[class*="newsletter"]', '[class*="subscribe"]', '[class*="cookie"]',
      '[class*="gdpr"]', '[class*="consent"]', '[class*="banner"]',
      '[class*="interstitial"]', '[class*="ad-"]', '[class*="promo"]'
    ];

    overlaySelectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach((el: any) => {
          // Only remove if it looks like an overlay (fixed/absolute position)
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'absolute') {
            el.remove?.();
          }
        });
      } catch (e) {}
    });

    // 6. Click any "close" buttons on remaining overlays
    const closeSelectors = [
      '[class*="close"]', '[aria-label*="close"]', '[aria-label*="Close"]',
      'button[class*="dismiss"]', '[class*="x-button"]'
    ];

    closeSelectors.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach((el: any) => el.click?.());
      } catch (e) {}
    });
  });

  // Wait for animations/transitions to complete
  await new Promise(r => setTimeout(r, 1000));
  console.log('✅ [EXPAND] All expandable content processed');
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

    // Launch browser (environment-aware with stealth)
    const browser = await getBrowser();
    const page = await browser.newPage();

    // === ANTI-DETECTION FEATURES ===

    // 1. Random viewport to avoid fingerprinting
    const viewportWidth = 1280 + Math.floor(Math.random() * 200);
    const viewportHeight = 800 + Math.floor(Math.random() * 200);
    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    });
    console.log(`🖥️ [STEALTH] Random viewport: ${viewportWidth}x${viewportHeight}`);

    // 2. Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 3. Mask webdriver property (extra protection on top of stealth plugin)
    await page.evaluateOnNewDocument(() => {
      // Hide webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => false });

      // Fake plugins to appear like real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Fake languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // 4. Set additional headers for better bot evasion
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

    // 5. Human-like delay before navigation
    const humanDelay = 500 + Math.floor(Math.random() * 1000);
    await new Promise(r => setTimeout(r, humanDelay));
    console.log(`⏱️ [STEALTH] Human-like delay: ${humanDelay}ms`);

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

    // === MULTI-SCREENSHOT FALLBACK FOR REACT/JS-RENDERED SITES ===
    // If no JSON-LD found, expand content, then take multiple screenshots while scrolling
    let screenshots: string[] = [];

    if (!jsonLdData) {
      console.log('📸 [VERCEL SCRAPER] No JSON-LD found, preparing multi-screenshot capture...');

      try {
        // Step 1: Expand all hidden content (tabs, accordions, etc.)
        await expandAllContent(page);

        // Step 2: Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 500));

        // Step 3: Get page dimensions AFTER expanding (page may be taller now)
        const pageHeight = await page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = 800;
        const scrollSteps = Math.min(5, Math.ceil(pageHeight / viewportHeight)); // Max 5 screenshots

        console.log(`📸 [VERCEL SCRAPER] Page height: ${pageHeight}px, taking ${scrollSteps} screenshots...`);

        // Step 4: Take screenshots while scrolling
        for (let i = 0; i < scrollSteps; i++) {
          // Scroll to position
          await page.evaluate((scrollY: number) => window.scrollTo(0, scrollY), i * viewportHeight);
          await new Promise(r => setTimeout(r, 500)); // Wait for render

          // Take screenshot of current viewport
          const screenshot = await page.screenshot({
            encoding: 'base64',
            type: 'jpeg',
            quality: 70, // Slightly lower quality for multiple images
          }) as string;

          screenshots.push(`data:image/jpeg;base64,${screenshot}`);
          console.log(`📸 [VERCEL SCRAPER] Screenshot ${i + 1}/${scrollSteps} captured (${Math.round(screenshot.length / 1024)}KB)`);
        }

        console.log(`📸 [VERCEL SCRAPER] Total screenshots: ${screenshots.length}, combined size: ${Math.round(screenshots.reduce((sum, s) => sum + s.length, 0) / 1024)}KB`);
      } catch (e: any) {
        console.warn('📸 [VERCEL SCRAPER] Screenshot capture failed:', e.message);
      }
    }

    await browser.close();

    console.log(`✅ [VERCEL SCRAPER] Extraction complete`);
    console.log(`📋 [VERCEL SCRAPER] JSON-LD: ${jsonLdData ? 'Found' : 'Not found'}`);
    console.log(`📄 [VERCEL SCRAPER] HTML length: ${html.length} chars`);
    console.log(`🖼️ [VERCEL SCRAPER] Images: ${imageUrls.length}`);
    console.log(`📸 [VERCEL SCRAPER] Screenshots: ${screenshots.length > 0 ? `${screenshots.length} images` : 'Not needed'}`);

    return NextResponse.json({
      success: true,
      jsonLdData,
      html,
      imageUrls,
      // Include screenshots array when no JSON-LD found - for Claude Haiku Vision OCR fallback
      screenshots: screenshots.length > 0 ? screenshots : null,
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
