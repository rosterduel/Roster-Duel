const STORAGE_KEY = 'rd_session_token';

/**
 * Phase 1 has no login (spec: "anonymous sessions") — the client generates
 * its own random identity and persists it in localStorage, sending it as
 * X-Session-Token on every API call. See apps/api/src/session/session.guard.ts
 * for the server-side half and the tradeoffs this implies (not a security
 * boundary, just a casual per-browser identity).
 */
export function getSessionToken(): string {
  if (typeof window === 'undefined') {
    throw new Error('getSessionToken() must only be called client-side.');
  }
  let token = window.localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}
