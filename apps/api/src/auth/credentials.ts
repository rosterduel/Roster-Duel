export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CredentialsCheck = { valid: true; email: string; password: string } | { valid: false; reason: string };

/** Normalizes the email (trimmed, lowercased) and checks both fields. */
export function checkCredentials(rawEmail: unknown, rawPassword: unknown): CredentialsCheck {
  if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
    return { valid: false, reason: 'Enter an email and a password.' };
  }
  const email = rawEmail.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { valid: false, reason: 'Enter a valid email address.' };
  }
  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, reason: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
  }
  if (rawPassword.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, reason: `Use at most ${MAX_PASSWORD_LENGTH} characters for your password.` };
  }
  return { valid: true, email, password: rawPassword };
}
