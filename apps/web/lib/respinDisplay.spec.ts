import { computeRespinDisplay } from './respinDisplay';

describe('computeRespinDisplay', () => {
  it('shows (1) and is clickable when never used and an alternative exists', () => {
    expect(computeRespinDisplay(false, true)).toEqual({ remaining: 1, disabled: false });
  });

  it('shows (0) and is unclickable once already used', () => {
    expect(computeRespinDisplay(true, true)).toEqual({ remaining: 0, disabled: true });
  });

  it('shows (0) and is unclickable on a dead end (never used, but no alternative combo this round) -- the reported bug: previously this showed (1) while disabled', () => {
    expect(computeRespinDisplay(false, false)).toEqual({ remaining: 0, disabled: true });
  });

  it('shows (0) and is unclickable when both used and a dead end', () => {
    expect(computeRespinDisplay(true, false)).toEqual({ remaining: 0, disabled: true });
  });

  it('invariant: the displayed count and clickability never disagree, across every input combination', () => {
    for (const usedGlobally of [false, true]) {
      for (const available of [false, true]) {
        const { remaining, disabled } = computeRespinDisplay(usedGlobally, available);
        // remaining > 0 must always mean clickable, and vice versa.
        expect(remaining > 0).toBe(!disabled);
      }
    }
  });
});
