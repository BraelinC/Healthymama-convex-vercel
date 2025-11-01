/**
 * API Utilities
 * Handles URL building for API requests
 */

/**
 * Build full API URL from relative or absolute path
 * @param path - Relative path (e.g., '/api/endpoint') or full URL
 * @returns Full URL or relative path as-is
 */
export function buildApiUrl(path: string): string {
  // If it's already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // For relative paths, return as-is (Next.js will handle routing)
  // This works for both client-side requests and server-side routes
  return path;
}
