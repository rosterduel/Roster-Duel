import { generateRoomCode } from './roomCode';

describe('generateRoomCode', () => {
  it('generates a 6-character uppercase alphanumeric code', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it('excludes visually-ambiguous characters (0, O, 1, I, L)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it('produces varied codes across many calls (not a constant or narrow range)', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()));
    // Collisions are possible but should be rare at this sample size given ~32^6 combinations.
    expect(codes.size).toBeGreaterThan(190);
  });
});
