import { autoFillRosterSlots, RatedCandidate } from './draftAutoFill';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', '6MAN'];

function candidate(id: string, position: string, baseRating: number): RatedCandidate {
  return { id, position, baseRating };
}

describe('autoFillRosterSlots', () => {
  it('leaves already-filled slots untouched', () => {
    const candidates = [candidate('pg-1', 'PG', 90), candidate('pg-2', 'PG', 50)];
    const result = autoFillRosterSlots(POSITIONS, { PG: 'pg-2' }, candidates);
    expect(result.PG).toBe('pg-2');
  });

  it('fills an empty slot with the highest-rated available candidate at that position', () => {
    const candidates = [candidate('pg-1', 'PG', 70), candidate('pg-2', 'PG', 95), candidate('pg-3', 'PG', 60)];
    const result = autoFillRosterSlots(POSITIONS, {}, candidates);
    expect(result.PG).toBe('pg-2');
  });

  it('does not pick the same player twice across two slots on the same roster', () => {
    // A player incorrectly tagged at two positions in the candidate pool
    // (shouldn't happen in real data, but the function must still be safe).
    const candidates = [
      candidate('star', 'PG', 99),
      candidate('star', 'SG', 99),
      candidate('backup-sg', 'SG', 40),
    ];
    const result = autoFillRosterSlots(['PG', 'SG'], {}, candidates);
    expect(result.PG).toBe('star');
    expect(result.SG).toBe('backup-sg');
  });

  it('skips a position with no candidates rather than throwing', () => {
    const candidates = [candidate('pg-1', 'PG', 80)];
    const result = autoFillRosterSlots(POSITIONS, {}, candidates);
    expect(result.PG).toBe('pg-1');
    expect(result.SG).toBeUndefined();
  });

  it('fills a full six-slot roster from a realistic candidate pool', () => {
    const candidates: RatedCandidate[] = POSITIONS.flatMap((pos) => [
      candidate(`${pos}-best`, pos, 85),
      candidate(`${pos}-worst`, pos, 40),
    ]);
    const result = autoFillRosterSlots(POSITIONS, {}, candidates);
    for (const pos of POSITIONS) {
      expect(result[pos]).toBe(`${pos}-best`);
    }
  });

  it('does not mutate the input slots object', () => {
    const currentSlots = { PG: 'pg-2' };
    const candidates = [candidate('sg-1', 'SG', 80)];
    autoFillRosterSlots(POSITIONS, currentSlots, candidates);
    expect(currentSlots).toEqual({ PG: 'pg-2' });
  });
});
