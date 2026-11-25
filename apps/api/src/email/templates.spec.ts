import { passwordResetEmail, resultReadyEmail } from './templates';

describe('email templates', () => {
  it('builds the result email with a Run your simulation button and no score', () => {
    const email = resultReadyEmail('Ray', 'https://example.com/match/ABC123?play=1');
    expect(email.subject).toBe('Your RosterDuel matchup is ready');
    expect(email.html).toContain('Run your simulation');
    expect(email.html).toContain('href="https://example.com/match/ABC123?play=1"');
    expect(email.text).toContain('https://example.com/match/ABC123?play=1');
  });

  it('escapes a display name so it cannot inject markup', () => {
    const email = resultReadyEmail('<img src=x onerror=alert(1)>', 'https://example.com/m');
    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;img');
  });

  it('builds the password reset email with the link and expiry', () => {
    const email = passwordResetEmail('https://example.com/reset-password?token=abc', 60);
    expect(email.html).toContain('Choose a new password');
    expect(email.text).toContain('expires in 60 minutes');
  });
});
