import { buildPersonKeyToSlot, isAlreadyDrafted, openPositionsForPlayer } from './draftPool';

describe('openPositionsForPlayer', () => {
  const OPEN = ['PG', 'SF', 'C', '6MAN'];

  it('returns the eligible positions that are still open, plus 6MAN (always offered when open)', () => {
    expect(openPositionsForPlayer(['PG', 'SG'], OPEN)).toEqual(['PG', '6MAN']);
  });

  it('excludes a center-only player from open guard slots but still offers 6MAN', () => {
    expect(openPositionsForPlayer(['C'], OPEN)).toEqual(['C', '6MAN']);
  });

  it('returns every open eligible position for a multi-position player, plus 6MAN', () => {
    expect(openPositionsForPlayer(['SF', 'PF', 'SG'], OPEN)).toEqual(['SF', '6MAN']);
  });

  it('6th Man is a flex — always offered when open, regardless of eligiblePositions (spec 4f)', () => {
    expect(openPositionsForPlayer(['SG'], OPEN)).toEqual(['6MAN']);
  });

  it('returns empty when the player has no eligible open position and 6MAN is not open', () => {
    expect(openPositionsForPlayer(['SG'], ['PG', 'SF', 'C'])).toEqual([]);
  });

  it('returns empty when there are no open positions at all', () => {
    expect(openPositionsForPlayer(['PG', 'SG'], [])).toEqual([]);
  });
});

describe('buildPersonKeyToSlot + isAlreadyDrafted', () => {
  it('is not a duplicate when the person has not been picked anywhere yet', () => {
    const map = buildPersonKeyToSlot([]);
    expect(isAlreadyDrafted('lebron', map)).toBe(false);
  });

  it('is a duplicate once locked into any slot', () => {
    const map = buildPersonKeyToSlot([{ slotPosition: 'SF', personKey: 'lebron' }]);
    expect(isAlreadyDrafted('lebron', map)).toBe(true);
  });

  it('applies across different stints of the same real person, not just the same stint', () => {
    // LeBron picked via his Cleveland stint into SF; his Miami stint (different id, same personKey) must show as a duplicate in any later round.
    const map = buildPersonKeyToSlot([{ slotPosition: 'SF', personKey: 'lebron_james' }]);
    expect(isAlreadyDrafted('lebron_james', map)).toBe(true);
  });

  it('does not flag an unrelated person as a duplicate', () => {
    const map = buildPersonKeyToSlot([{ slotPosition: 'SF', personKey: 'lebron_james' }]);
    expect(isAlreadyDrafted('kobe_bryant', map)).toBe(false);
  });
});
