import { buildPersonKeyToSlot, filterEligibleForSlot, isDuplicateInSlot, PoolStint } from './draftPool';

const STINTS: PoolStint[] = [
  { id: 's1', personKey: 'mitchell', eligiblePositions: ['PG', 'SG'] },
  { id: 's2', personKey: 'gobert', eligiblePositions: ['C'] },
  { id: 's3', personKey: 'lebron', eligiblePositions: ['SF', 'PF', 'SG'] },
];

describe('filterEligibleForSlot', () => {
  it('only includes players eligible for the given real position', () => {
    const pgPool = filterEligibleForSlot(STINTS, 'PG');
    expect(pgPool.map((s) => s.personKey)).toEqual(['mitchell']);
  });

  it('excludes a center-only player from a guard slot', () => {
    const pgPool = filterEligibleForSlot(STINTS, 'PG');
    expect(pgPool.some((s) => s.personKey === 'gobert')).toBe(false);
  });

  it('includes a multi-position player in every one of their eligible slots', () => {
    expect(filterEligibleForSlot(STINTS, 'SF').map((s) => s.personKey)).toContain('lebron');
    expect(filterEligibleForSlot(STINTS, 'PF').map((s) => s.personKey)).toContain('lebron');
    expect(filterEligibleForSlot(STINTS, 'SG').map((s) => s.personKey)).toContain('lebron');
  });

  it('6MAN is unfiltered — every player from the combo is eligible regardless of position (spec 4f)', () => {
    const sixManPool = filterEligibleForSlot(STINTS, '6MAN');
    expect(sixManPool).toHaveLength(3);
  });
});

describe('buildPersonKeyToSlot + isDuplicateInSlot', () => {
  it('is not a duplicate when the person has not been picked anywhere yet', () => {
    const map = buildPersonKeyToSlot([]);
    expect(isDuplicateInSlot('lebron', 'SF', map)).toBe(false);
  });

  it('is not a duplicate in the exact slot they were picked into (that is just "selected")', () => {
    const map = buildPersonKeyToSlot([{ slotPosition: 'SF', personKey: 'lebron' }]);
    expect(isDuplicateInSlot('lebron', 'SF', map)).toBe(false);
  });

  it('is a duplicate when shown in a DIFFERENT slot than where they were picked', () => {
    const map = buildPersonKeyToSlot([{ slotPosition: 'SF', personKey: 'lebron' }]);
    expect(isDuplicateInSlot('lebron', 'PF', map)).toBe(true);
  });

  it('applies across different stints of the same real person, not just the same stint', () => {
    // LeBron picked via his Cleveland stint into SF; his Miami stint (different id, same personKey) shows up in PF's pool.
    const map = buildPersonKeyToSlot([{ slotPosition: 'SF', personKey: 'lebron_james' }]);
    expect(isDuplicateInSlot('lebron_james', 'PF', map)).toBe(true);
  });
});
