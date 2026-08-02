import { drawEraRespinCombo, drawRandomCombo, drawTeamRespinCombo, hasEraRespinAlternative, hasTeamRespinAlternative, TeamEraCombo } from './slotAssignment';

const COMBOS: TeamEraCombo[] = [
  { teamId: 'boston', era: 'sixties' },
  { teamId: 'boston', era: 'two_thousands' },
  { teamId: 'new_york', era: 'seventies' },
  { teamId: 'la', era: 'eighties' },
  { teamId: 'la', era: 'two_thousands' },
  { teamId: 'philadelphia', era: 'eighties' },
];

describe('drawRandomCombo', () => {
  it('returns a combo from the pool', () => {
    const result = drawRandomCombo(COMBOS, undefined, () => 0);
    expect(result).toEqual(COMBOS[0]);
  });

  it('excludes the given combo from the draw pool', () => {
    // random() always returns 0 -> would normally pick index 0 (boston/sixties),
    // but it's excluded, so the pool shifts and index 0 becomes boston/two_thousands.
    const result = drawRandomCombo(COMBOS, { teamId: 'boston', era: 'sixties' }, () => 0);
    expect(result).toEqual({ teamId: 'boston', era: 'two_thousands' });
  });

  it('returns null when the pool is empty after exclusion', () => {
    const onlyCombo: TeamEraCombo[] = [{ teamId: 'new_york', era: 'seventies' }];
    const result = drawRandomCombo(onlyCombo, { teamId: 'new_york', era: 'seventies' });
    expect(result).toBeNull();
  });

  it('never returns the excluded combo across repeated draws', () => {
    const exclude = { teamId: 'la', era: 'eighties' };
    for (let i = 0; i < 20; i++) {
      const result = drawRandomCombo(COMBOS, exclude, () => i / 20);
      expect(result).not.toEqual(exclude);
    }
  });
});

describe('hasTeamRespinAlternative', () => {
  it('is true when another team shares the same era', () => {
    // Both LA and Philadelphia have an "eighties" combo.
    expect(hasTeamRespinAlternative({ teamId: 'la', era: 'eighties' }, COMBOS)).toBe(true);
  });

  it('is false when no other team shares the era (dead end)', () => {
    // Only New York has a "seventies" combo.
    expect(hasTeamRespinAlternative({ teamId: 'new_york', era: 'seventies' }, COMBOS)).toBe(false);
  });
});

describe('hasEraRespinAlternative', () => {
  it('is true when the same team has another seeded era', () => {
    // Boston has both sixties and two_thousands.
    expect(hasEraRespinAlternative({ teamId: 'boston', era: 'sixties' }, COMBOS)).toBe(true);
  });

  it('is false when the team only has one seeded era (dead end)', () => {
    // Philadelphia only has eighties.
    expect(hasEraRespinAlternative({ teamId: 'philadelphia', era: 'eighties' }, COMBOS)).toBe(false);
  });
});

describe('drawTeamRespinCombo', () => {
  it('keeps the era fixed and picks a different team', () => {
    const result = drawTeamRespinCombo({ teamId: 'la', era: 'eighties' }, COMBOS, () => 0);
    expect(result).toEqual({ teamId: 'philadelphia', era: 'eighties' });
  });

  it('returns null at a dead end (no other team shares the era)', () => {
    const result = drawTeamRespinCombo({ teamId: 'new_york', era: 'seventies' }, COMBOS);
    expect(result).toBeNull();
  });
});

describe('drawEraRespinCombo', () => {
  it('keeps the team fixed and picks a different era', () => {
    const result = drawEraRespinCombo({ teamId: 'boston', era: 'sixties' }, COMBOS, () => 0);
    expect(result).toEqual({ teamId: 'boston', era: 'two_thousands' });
  });

  it('returns null at a dead end (no other era for that team)', () => {
    const result = drawEraRespinCombo({ teamId: 'philadelphia', era: 'eighties' }, COMBOS);
    expect(result).toBeNull();
  });
});
