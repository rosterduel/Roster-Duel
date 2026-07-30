export interface RawPlayerStats {
  playerId: string;
  position: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  threePtPct: number;
  astRate: number;
  rebRate: number;
  stlRate: number;
  blkRate: number;
}

export interface ComputedRating {
  playerId: string;
  offenseRating: number;
  defenseRating: number;
  baseRating: number;
}

interface WeightedStat {
  key: keyof Pick<
    RawPlayerStats,
    'ppg' | 'rpg' | 'apg' | 'spg' | 'bpg' | 'fgPct' | 'threePtPct' | 'astRate' | 'rebRate' | 'stlRate' | 'blkRate'
  >;
  weight: number;
}

const OFFENSE_STATS: WeightedStat[] = [
  { key: 'ppg', weight: 0.35 },
  { key: 'apg', weight: 0.2 },
  { key: 'astRate', weight: 0.15 },
  { key: 'fgPct', weight: 0.15 },
  { key: 'threePtPct', weight: 0.15 },
];

const DEFENSE_STATS: WeightedStat[] = [
  { key: 'rpg', weight: 0.25 },
  { key: 'rebRate', weight: 0.15 },
  { key: 'spg', weight: 0.2 },
  { key: 'stlRate', weight: 0.15 },
  { key: 'bpg', weight: 0.15 },
  { key: 'blkRate', weight: 0.1 },
];

const RATING_MIDPOINT = 50;
// One position-relative standard deviation of production = +/-15 rating
// points. A judgment call, not derived from anything — picked so a player
// two standard deviations better than their positional peers lands near the
// top of the 0-100 scale without every extreme case slamming into the cap.
const RATING_SPREAD = 15;
// Box stats observe offensive production far more directly than defensive
// impact (no blocks/steals-adjacent stat captures things like positioning
// or help defense), so a straight 50/50 blend would overstate how much this
// box-score-only formula actually knows about a player's defense.
const OFFENSE_WEIGHT_IN_BASE = 0.6;

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdev(values: number[], avg: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Below this, treat a position group as having no real spread. Needed
// because floating-point mean/variance on near-identical inputs (e.g. every
// value being exactly 0.35) lands a hair off zero rather than exactly zero
// — an exact `sd === 0` check misses that noise and then divides by it,
// amplifying a rounding error into a spurious +/-1 z-score.
const NO_SPREAD_EPSILON = 1e-9;

function zScore(value: number, avg: number, sd: number): number {
  // No real spread in this position group (or a group of 1) — nobody can stand out.
  if (sd < NO_SPREAD_EPSILON) return 0;
  return (value - avg) / sd;
}

function weightedZComposite(player: RawPlayerStats, positionPeers: RawPlayerStats[], stats: WeightedStat[]): number {
  let composite = 0;
  for (const { key, weight } of stats) {
    const values = positionPeers.map((p) => p[key]);
    const avg = mean(values);
    const sd = stdev(values, avg);
    composite += weight * zScore(player[key], avg, sd);
  }
  return composite;
}

function scaleToRating(zComposite: number): number {
  const rating = RATING_MIDPOINT + zComposite * RATING_SPREAD;
  return Math.max(0, Math.min(100, rating));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes base/offense/defense ratings for every player in `pool` via a
 * position-adjusted z-score blend of raw box stats (spec section 6: "Box-
 * score production (position-adjusted z-scores)").
 *
 * This is an original, simplified formula — NOT a reproduction of BPM, PER,
 * VORP, or any other named/proprietary metric (spec section 10 draws a hard
 * line against reusing those names or formulas, even when the underlying
 * calculation is "similar in spirit"). It captures the intent section 6
 * describes — position-adjusted production, with enough shooting-efficiency
 * weight that pure high-volume/low-efficiency players don't dominate —
 * without replicating anyone's specific published coefficients.
 *
 * Z-scoring is computed against `pool` itself, not a league-wide reference.
 * With Phase 1's small hand-curated pool (6 players per position), that's a
 * genuinely noisy sample — a group of 6 has an unstable mean/stdev. This is
 * an accepted Phase 1 limitation: the real offline batch job (section 6)
 * should eventually z-score against the full league-wide player database
 * once one exists, not this placeholder pool.
 */
export function computeRatings(pool: RawPlayerStats[]): ComputedRating[] {
  const byPosition = new Map<string, RawPlayerStats[]>();
  for (const player of pool) {
    const peers = byPosition.get(player.position) ?? [];
    peers.push(player);
    byPosition.set(player.position, peers);
  }

  return pool.map((player) => {
    const positionPeers = byPosition.get(player.position)!;
    const offenseRating = scaleToRating(weightedZComposite(player, positionPeers, OFFENSE_STATS));
    const defenseRating = scaleToRating(weightedZComposite(player, positionPeers, DEFENSE_STATS));
    const baseRating = OFFENSE_WEIGHT_IN_BASE * offenseRating + (1 - OFFENSE_WEIGHT_IN_BASE) * defenseRating;

    return {
      playerId: player.playerId,
      offenseRating: round2(offenseRating),
      defenseRating: round2(defenseRating),
      baseRating: round2(baseRating),
    };
  });
}
