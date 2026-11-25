import { ALLOWED_ORIGINS } from '../corsOrigins';

/**
 * Where links in emails point. Set WEB_BASE_URL on the API service once the
 * public site is live (e.g. https://rosterduel.com); until then it falls
 * back to the first allowed web origin, the Vercel URL.
 */
export function webBaseUrl(): string {
  const configured = process.env.WEB_BASE_URL?.trim();
  return (configured || ALLOWED_ORIGINS[0] || 'http://localhost:3000').replace(/\/+$/, '');
}
