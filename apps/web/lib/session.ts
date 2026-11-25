const STORAGE_KEY = 'rd_session_token';

/**
 * Every API call sends X-Session-Token from localStorage. An anonymous
 * player's token is generated here in the browser; signing up or logging in
 * swaps it for a server-issued token (setSessionToken), and logging out
 * drops it so a fresh anonymous one is made next time (clearSessionToken).
 * See apps/api/src/session/session.guard.ts for the server side.
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

/** Stores the token the server issued at sign-up or log-in. */
export function setSessionToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
}

/** Forgets this browser's token; the next API call starts a new anonymous player. */
export function clearSessionToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
