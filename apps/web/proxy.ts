/**
 * Clerk Proxy Configuration for Next.js 16
 *
 * Next.js 16 renamed middleware.ts to proxy.ts to clarify its role
 * as a routing/traffic layer rather than a security mechanism.
 *
 * This proxy configuration enables Clerk's auth() helper to work
 * in API routes and server components.
 */

import { clerkMiddleware } from '@clerk/nextjs/server'

// Export as default for Next.js 16 proxy
export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
