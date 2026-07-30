import { computeRatings, RawPlayerStats } from './computeRatings';

function player(overrides: Partial<RawPlayerStats> & { playerId: string; position: string }): RawPlayerStats {
  return {
    ppg: 15,
    rpg: 5,
    apg: 4,
    spg: 1,
    bpg: 0.5,
    fgPct: 0.46,
    threePtPct: 0.35,
    astRate: 0.15,
    rebRate: 0.1,
    stlRate: 0.1,
    blkRate: 0.03,
    ...overrides,
  };
}

describe('computeRatings', () => {
  it('rates every player at exactly league average (50) when a position group is uniform', () => {
    const pool = [
      player({ playerId: 'a', position: 'PG' }),
      player({ playerId: 'b', position: 'PG' }),
      player({ playerId: 'c', position: 'PG' }),
    ];

    const ratings = computeRatings(pool);
    for (const r of ratings) {
      expect(r.offenseRating).toBeCloseTo(50, 5);
      expect(r.defenseRating).toBeCloseTo(50, 5);
      expect(r.baseRating).toBeCloseTo(50, 5);
    }
  });

  it('rates a player above average when they outproduce their positional peers offensively', () => {
    const pool = [
      player({ playerId: 'star', position: 'SG', ppg: 30, apg: 8, fgPct: 0.52, threePtPct: 0.42, astRate: 0.3 }),
      player({ playerId: 'avg1', position: 'SG' }),
      player({ playerId: 'avg2', position: 'SG' }),
      player({ playerId: 'avg3', position: 'SG' }),
    ];

    const ratings = computeRatings(pool);
    const star = ratings.find((r) => r.playerId === 'star')!;
    const avg = ratings.find((r) => r.playerId === 'avg1')!;
    expect(star.offenseRating).toBeGreaterThan(avg.offenseRating);
  });

  it('rates a player below average when they underproduce defensively relative to peers', () => {
    const pool = [
      player({ playerId: 'weak', position: 'C', rpg: 2, bpg: 0.1, rebRate: 0.02, blkRate: 0.01, stlRate: 0.02 }),
      player({ playerId: 'avg1', position: 'C' }),
      player({ playerId: 'avg2', position: 'C' }),
      player({ playerId: 'avg3', position: 'C' }),
    ];

    const ratings = computeRatings(pool);
    const weak = ratings.find((r) => r.playerId === 'weak')!;
    const avg = ratings.find((r) => r.playerId === 'avg1')!;
    expect(weak.defenseRating).toBeLessThan(avg.defenseRating);
  });

  it('clamps ratings to [0, 100] for extreme outliers', () => {
    const pool = [
      player({ playerId: 'legend', position: 'PF', ppg: 50, apg: 15, fgPct: 0.7, threePtPct: 0.6, astRate: 0.5 }),
      player({ playerId: 'replacement', position: 'PF', ppg: 0.5, apg: 0.1, fgPct: 0.2, threePtPct: 0.05, astRate: 0.01 }),
    ];

    const ratings = computeRatings(pool);
    for (const r of ratings) {
      expect(r.offenseRating).toBeGreaterThanOrEqual(0);
      expect(r.offenseRating).toBeLessThanOrEqual(100);
      expect(r.defenseRating).toBeGreaterThanOrEqual(0);
      expect(r.defenseRating).toBeLessThanOrEqual(100);
    }
  });

  it('blends base rating as 60% offense / 40% defense', () => {
    const pool = [
      player({ playerId: 'a', position: 'SF', ppg: 25 }),
      player({ playerId: 'b', position: 'SF' }),
      player({ playerId: 'c', position: 'SF' }),
    ];

    const ratings = computeRatings(pool);
    const a = ratings.find((r) => r.playerId === 'a')!;
    // Loose precision: baseRating is rounded once from unrounded offense/
    // defense internally, while this re-derives it from the already-rounded
    // public offenseRating/defenseRating, so a sub-cent rounding-order
    // difference is expected and not a bug.
    expect(a.baseRating).toBeCloseTo(0.6 * a.offenseRating + 0.4 * a.defenseRating, 1);
  });

  it('z-scores each position independently, not against the whole pool', () => {
    // A center who is a poor rebounder for a center, but would look elite
    // among point guards, must be judged against centers only.
    const pool = [
      player({ playerId: 'mediocre-center', position: 'C', rpg: 6, rebRate: 0.15 }),
      player({ playerId: 'elite-reb-center-1', position: 'C', rpg: 14, rebRate: 0.28 }),
      player({ playerId: 'elite-reb-center-2', position: 'C', rpg: 13, rebRate: 0.27 }),
      player({ playerId: 'typical-pg', position: 'PG', rpg: 3, rebRate: 0.06 }),
    ];

    const ratings = computeRatings(pool);
    const center = ratings.find((r) => r.playerId === 'mediocre-center')!;
    expect(center.defenseRating).toBeLessThan(50);
  });
});
