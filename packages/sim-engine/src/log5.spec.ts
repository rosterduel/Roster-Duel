import { log5 } from './log5';

describe('log5', () => {
  it('returns league average when both rates equal league average', () => {
    expect(log5(1.12, 1.12, 1.12)).toBeCloseTo(1.12, 10);
  });

  it('pulls a great offense vs a great defense back toward league average instead of multiplying', () => {
    const leagueAvg = 1.12;
    const offenseRate = 1.15 * leagueAvg; // 15% above average offense
    const defenseRateAllowed = 0.9 * leagueAvg; // defense allows 10% below average

    const result = log5(offenseRate, defenseRateAllowed, leagueAvg);

    // Per spec: nets out close to league average (1.035x here), not 1.15*0.90=1.035 either way —
    // specifically NOT the naive (offenseMultiplier * defenseMultiplier) applied directly to a raw stat.
    expect(result).toBeCloseTo(1.035 * leagueAvg, 10);
    expect(result).toBeGreaterThan(leagueAvg * 0.95);
    expect(result).toBeLessThan(leagueAvg * 1.1);
  });

  it('throws on a non-positive league average', () => {
    expect(() => log5(1, 1, 0)).toThrow();
    expect(() => log5(1, 1, -1)).toThrow();
  });
});
