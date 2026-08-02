import { estimatePreThreePointStats } from './estimatePreThreePointStats';

describe('estimatePreThreePointStats', () => {
  it('gives a high-FT%/above-position-average/high-reputation shooter a well-above-baseline estimate', () => {
    // Sam Jones-shaped inputs: renowned outside shooter, solid FT%, FG% above the SG position average.
    const result = estimatePreThreePointStats({ position: 'SG', ftPct: 0.8, fgPct: 0.458, shooterReputation: 'high' });
    expect(result.threePtPct).toBeGreaterThan(0.28);
    expect(result.threePtRate).toBeGreaterThan(0.02);
  });

  it('gives a poor-FT%/below-position-average/low-reputation big man the floor estimate, not a true zero', () => {
    // Bill Russell-shaped inputs: famously poor free-throw shooter, no outside game.
    const result = estimatePreThreePointStats({ position: 'C', ftPct: 0.561, fgPct: 0.44, shooterReputation: 'low' });
    expect(result.threePtPct).toBeGreaterThan(0);
    expect(result.threePtPct).toBeGreaterThanOrEqual(0.15); // clamped floor, not zero
    expect(result.threePtRate).toBeGreaterThanOrEqual(0);
  });

  it('weighs FT% more heavily than the position-adjusted FG% residual', () => {
    const highFt = estimatePreThreePointStats({ position: 'PG', ftPct: 0.85, fgPct: 0.44, shooterReputation: 'average' });
    const highFg = estimatePreThreePointStats({ position: 'PG', ftPct: 0.75, fgPct: 0.54, shooterReputation: 'average' });
    // Both deviate from their respective baselines by the same absolute amount (+0.10 FT% vs +0.10 FG% residual);
    // FT_WEIGHT_PCT (0.5) > FG_RESIDUAL_WEIGHT_PCT (0.15), so the FT-driven estimate should come out higher.
    expect(highFt.threePtPct).toBeGreaterThan(highFg.threePtPct);
  });

  it('never returns a negative rate or a percentage outside the clamped bounds', () => {
    const result = estimatePreThreePointStats({ position: 'C', ftPct: 0.4, fgPct: 0.3, shooterReputation: 'low' });
    expect(result.threePtRate).toBeGreaterThanOrEqual(0);
    expect(result.threePtPct).toBeGreaterThanOrEqual(0.15);
    expect(result.threePtPct).toBeLessThanOrEqual(0.42);
  });

  it('is a pure function — same inputs always produce the same output', () => {
    const input = { position: 'SF' as const, ftPct: 0.786, fgPct: 0.506, shooterReputation: 'high' as const };
    expect(estimatePreThreePointStats(input)).toEqual(estimatePreThreePointStats(input));
  });
});
