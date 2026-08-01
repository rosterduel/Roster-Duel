import { validateDisplayName } from './validateDisplayName';

describe('validateDisplayName', () => {
  it('accepts a normal name', () => {
    const result = validateDisplayName('Chris P');
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.normalized).toBe('Chris P');
  });

  it('trims surrounding whitespace and collapses internal runs', () => {
    const result = validateDisplayName('  Chris   Paul  ');
    expect(result).toEqual({ valid: true, normalized: 'Chris Paul' });
  });

  it('rejects a name that is too short', () => {
    const result = validateDisplayName('A');
    expect(result).toEqual({ valid: false, reason: expect.stringContaining('between 2 and 24') });
  });

  it('rejects a name that is too long', () => {
    const result = validateDisplayName('A'.repeat(25));
    expect(result.valid).toBe(false);
  });

  it('accepts a name at exactly the length boundaries', () => {
    expect(validateDisplayName('AB').valid).toBe(true);
    expect(validateDisplayName('A'.repeat(24)).valid).toBe(true);
  });

  it('rejects disallowed punctuation', () => {
    const result = validateDisplayName('Chris<Paul>');
    expect(result).toEqual({ valid: false, reason: expect.stringContaining('letters, numbers') });
  });

  it('allows hyphens, underscores, digits, and international letters', () => {
    expect(validateDisplayName('J-P_99').valid).toBe(true);
    expect(validateDisplayName('Nikola Jokić').valid).toBe(true);
  });

  it('rejects profanity via the established filter', () => {
    // Using a mild, unambiguous entry from the standard English wordlist so
    // this test doesn't depend on us maintaining our own list.
    const result = validateDisplayName('fuck');
    expect(result.valid).toBe(false);
  });

  it('rejects an all-whitespace name after trimming', () => {
    const result = validateDisplayName('   ');
    expect(result.valid).toBe(false);
  });
});
