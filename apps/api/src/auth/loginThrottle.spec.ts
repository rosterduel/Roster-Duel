import { LoginThrottle, MAX_FAILURES, WINDOW_MS } from './loginThrottle';

describe('LoginThrottle', () => {
  it('blocks after too many failures and lets up once the window passes', () => {
    let now = 1_000_000;
    const throttle = new LoginThrottle(() => now);
    for (let i = 0; i < MAX_FAILURES; i++) throttle.recordFailure('a@b.co');
    expect(throttle.isBlocked('a@b.co')).toBe(true);
    expect(throttle.isBlocked('other@b.co')).toBe(false);
    now += WINDOW_MS + 1;
    expect(throttle.isBlocked('a@b.co')).toBe(false);
  });

  it('clears on a successful log-in', () => {
    const throttle = new LoginThrottle();
    for (let i = 0; i < MAX_FAILURES; i++) throttle.recordFailure('a@b.co');
    throttle.reset('a@b.co');
    expect(throttle.isBlocked('a@b.co')).toBe(false);
  });
});
