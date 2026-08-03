/**
 * Allowed frontend origins for CORS (REST, main.ts) and Socket.IO
 * (matches.gateway.ts) — a single list shared between the two so they
 * can't drift apart. Override with CORS_ALLOWED_ORIGINS (comma-separated)
 * to point at a new frontend deployment without a code change; the
 * defaults below cover the current production Vercel URL, the custom
 * domain (both apex and www), and local dev.
 */
const DEFAULT_ALLOWED_ORIGINS = ['https://roster-duel-web.vercel.app', 'https://rosterduel.com', 'https://www.rosterduel.com', 'http://localhost:3000'];

export const ALLOWED_ORIGINS: string[] = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : DEFAULT_ALLOWED_ORIGINS;
