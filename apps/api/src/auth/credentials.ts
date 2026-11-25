export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailCheck = { valid: true; email: string } | { valid: false; reason: string };

/** Trims and lowercases an email address and checks its shape. */
export function checkEmailAddress(rawEmail: unknown): EmailCheck {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return { valid: false, reason: 'Enter a valid email address.' };
  }
  return { valid: true, email };
}

export type CredentialsCheck = { valid: true; email: string; password: string } | { valid: false; reason: string };

/** Normalizes the email (trimmed, lowercased) and checks both fields. */
export function checkCredentials(rawEmail: unknown, rawPassword: unknown): CredentialsCheck {
  if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
    return { valid: false, reason: 'Enter an email and a password.' };
  }
  const checked = checkEmailAddress(rawEmail);
  if (!checked.valid) return checked;
  const email = checked.email;
  const passwordProblem = newPasswordProblem(rawPassword);
  if (passwordProblem) return { valid: false, reason: passwordProblem };
  return { valid: true, email, password: rawPassword };
}

/** Why a new password isn't acceptable, or null if it's fine. */
export function newPasswordProblem(rawPassword: unknown): string | null {
  if (typeof rawPassword !== 'string' || rawPassword.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
  }
  if (rawPassword.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters for your password.`;
  }
  return null;
}
