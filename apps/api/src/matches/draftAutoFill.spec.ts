import { autoFillRosterSlots, RatedCandidate } from './draftAutoFill';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C', '6MAN'];

function candidate(id: string, personKey: string, baseRating: number): RatedCandidate {
  return { id, personKey, baseRating };
}

describe('autoFillRosterSlots', () => {
  it('leaves already-filled slots untouched', () => {
    const candidatesBySlot = { PG: [candidate('pg-1', 'p1', 90), candidate('pg-2', 'p2', 50)] };
    const result = autoFillRosterSlots(POSITIONS, { PG: 'pg-2' }, candidatesBySlot);
    expect(result.PG).toBe('pg-2');
  });

  it('fills an empty slot with the highest-rated available candidate for that slot', () => {
    const candidatesBySlot = { PG: [candidate('pg-1', 'p1', 70), candidate('pg-2', 'p2', 95), candidate('pg-3', 'p3', 60)] };
    const result = autoFillRosterSlots(POSITIONS, {}, candidatesBySlot);
    expect(result.PG).toBe('pg-2');
  });

  it('each slot only draws from its own candidate list (already combo-scoped by the caller)', () => {
    const candidatesBySlot = {
      PG: [candidate('pg-1', 'p1', 99)],
      SG: [candidate('sg-1', 'p2', 40)],
    };
    const result = autoFillRosterSlots(['PG', 'SG'], {}, candidatesBySlot);
    expect(result.PG).toBe('pg-1');
    expect(result.SG).toBe('sg-1');
  });

  it('does not let the same real person (personKey) fill two slots, even via different stint ids', () => {
    // LeBron-style case: same personKey, two different stint ids, each eligible for a different slot.
    const candidatesBySlot = {
      SF: [candidate('lebron-cleveland', 'lebron_james', 90), candidate('other-sf', 'p2', 80)],
      PF: [candidate('lebron-miami', 'lebron_james', 95)],
    };
    const result = autoFillRosterSlots(['SF', 'PF'], {}, candidatesBySlot);
    // SF is processed first and picks LeBron (highest rated); PF's only
    // candidate is also LeBron (already used), so PF is skipped.
    expect(result.SF).toBe('lebron-cleveland');
    expect(result.PF).toBeUndefined();
  });

  it('respects personKeys already used by picks made before this call', () => {
    const candidatesBySlot = { SG: [candidate('sg-1', 'already_picked', 99), candidate('sg-2', 'fresh', 60)] };
    const result = autoFillRosterSlots(['SG'], {}, candidatesBySlot, new Set(['already_picked']));
    expect(result.SG).toBe('sg-2');
  });

  it('skips a slot with no candidates rather than throwing', () => {
    const candidatesBySlot = { PG: [candidate('pg-1', 'p1', 80)] };
    const result = autoFillRosterSlots(POSITIONS, {}, candidatesBySlot);
    expect(result.PG).toBe('pg-1');
    expect(result.SG).toBeUndefined();
  });

  it('fills 6MAN from whatever candidate list the caller provides for it (flex rule is the caller\'s responsibility)', () => {
    const candidatesBySlot = {
      PG: [candidate('pg-1', 'p1', 80)],
      '6MAN': [candidate('c-1', 'p2', 70), candidate('sf-1', 'p3', 85)],
    };
    const result = autoFillRosterSlots(['PG', '6MAN'], {}, candidatesBySlot);
    expect(result['6MAN']).toBe('sf-1');
  });

  it('does not mutate the input slots object', () => {
    const currentSlots = { PG: 'pg-2' };
    const candidatesBySlot = { SG: [candidate('sg-1', 'p1', 80)] };
    autoFillRosterSlots(POSITIONS, currentSlots, candidatesBySlot);
    expect(currentSlots).toEqual({ PG: 'pg-2' });
  });
});
