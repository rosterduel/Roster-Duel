import leoProfanity from 'leo-profanity';

const MIN_LENGTH = 2;
const MAX_LENGTH = 24;
// Letters (any language — leo-profanity's dictionary isn't English-only),
// digits, spaces, underscore, hyphen. Deliberately excludes punctuation
// that could be used for impersonation tricks or layout-breaking input.
const ALLOWED_CHARS_PATTERN = /^[\p{L}\p{N} _-]+$/u;

export type DisplayNameValidation = { valid: true; normalized: string } | { valid: false; reason: string };

/**
 * Spec section 9a: display-name moderation is required, not optional, since
 * minors may use the app — must use an established filter, not a hand-rolled
 * wordlist. Uses leo-profanity (actively maintained, multi-language) rather
 * than a bespoke implementation. Applied at both account-creation-adjacent
 * auto-naming (which can't collide with real words, so this mainly matters
 * for user-initiated changes) and every explicit name change.
 *
 * Pure and synchronous — no DB access, so it's testable without Prisma and
 * reusable from both the display-name-change endpoint and any future
 * validation call site.
 */
export function validateDisplayName(rawName: string): DisplayNameValidation {
  const normalized = rawName.trim().replace(/\s+/g, ' ');

  if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
    return { valid: false, reason: `Display name must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters.` };
  }
  if (!ALLOWED_CHARS_PATTERN.test(normalized)) {
    return { valid: false, reason: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores.' };
  }
  if (leoProfanity.check(normalized)) {
    return { valid: false, reason: 'That name isn’t allowed. Please choose another.' };
  }

  return { valid: true, normalized };
}
