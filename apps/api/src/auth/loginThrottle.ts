/**
 * In-memory brake on password guessing: after MAX_FAILURES wrong passwords
 * for one email inside WINDOW_MS, further log-in tries for that email are
 * refused until the window passes. Per API instance and reset on restart,
 * which is fine for a single Railway instance; a shared store would be
 * needed if the API ever runs on several.
 */
export const MAX_FAILURES = 8;
export const WINDOW_MS = 15 * 60 * 1000;

export class LoginThrottle {
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  isBlocked(key: string): boolean {
    return this.recent(key).length >= MAX_FAILURES;
  }

  recordFailure(key: string): void {
    const list = this.recent(key);
    list.push(this.now());
    this.failures.set(key, list);
    if (this.failures.size > 10_000) this.prune();
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - WINDOW_MS;
    return (this.failures.get(key) ?? []).filter((t) => t > cutoff);
  }

  private prune(): void {
    for (const key of [...this.failures.keys()]) {
      if (this.recent(key).length === 0) this.failures.delete(key);
    }
  }
}
