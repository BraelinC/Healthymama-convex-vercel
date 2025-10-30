/** @type {import('next').NextConfig} */
const nextConfig = {
  // CRITICAL: Mark these as external to prevent bundling (Vercel 250MB limit)
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],

  // Optional: Enable experimental features for better performance
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
};

export default nextConfig;
