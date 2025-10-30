// API Configuration
// This file handles the API URL configuration for different environments

// Detect environment
const getApiBaseUrl = () => {
  // In development (localhost or Replit), use relative URLs which will be proxied
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // For local development, Replit development, or production deployment, use relative URLs
    if (hostname === 'localhost' ||
        hostname.includes('.replit.dev') ||
        hostname.includes('.repl.co') ||
        hostname.includes('.replit.app') ||
        hostname === 'healthymama.app') {
      return ''; // Empty string means use relative URLs
    }

    // For Whop or other external deployments, use the full Replit backend URL
    return 'https://c3104879-9615-439c-96a3-7f96d3037ce8-00-3c226nw72trsq.spock.replit.dev';
  }

  // Fallback for SSR or other environments
  return 'https://c3104879-9615-439c-96a3-7f96d3037ce8-00-3c226nw72trsq.spock.replit.dev';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build full API URLs
export function buildApiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
