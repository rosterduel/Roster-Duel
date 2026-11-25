import { checkCredentials } from './credentials';

describe('checkCredentials', () => {
  it('trims and lowercases the email', () => {
    expect(checkCredentials('  Jeff@Example.COM ', 'longenough')).toEqual({ valid: true, email: 'jeff@example.com', password: 'longenough' });
  });

  it('rejects a bad email', () => {
    expect(checkCredentials('not-an-email', 'longenough').valid).toBe(false);
    expect(checkCredentials('', 'longenough').valid).toBe(false);
  });

  it('rejects a short or missing password', () => {
    expect(checkCredentials('a@b.co', 'short').valid).toBe(false);
    expect(checkCredentials('a@b.co', undefined).valid).toBe(false);
  });
});
