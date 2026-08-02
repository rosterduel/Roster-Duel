import { NbaPosition } from '@roster-duel/sim-engine';

export type ShooterReputation = 'low' | 'average' | 'high';

export interface PreThreePointInputs {
  position: NbaPosition;
  /** Free-throw percentage — the primary signal (see doc comment below). */
  ftPct: number;
  /** Raw field goal percentage — compared against POSITION_AVG_FG_PCT to get the position-adjusted residual (the secondary signal). */
  fgPct: number;
  /** Qualitative nudge from contemporary scoring role/reputation (spec section 10, signal 3) — hand-assigned per player in nbaStints.ts, not derived. */
  shooterReputation: ShooterReputation;
}

export interface PreThreePointEstimate {
  threePtPct: number;
  threePtRate: number;
}

/**
 * Rough historical league-average FT% for the pre-1980 eras this function
 * applies to (1960s-70s) — used as the zero point for the FT% signal.
 * Illustrative, not sourced season-by-season (consistent with the rest of
 * nbaStints.ts's accuracy caveats).
 */
const LEAGUE_AVG_FT_PCT_ERA = 0.75;

/**
 * Rough position-average FG% for the same eras, used to compute the
 * "position-adjusted FG%" secondary signal (spec section 10: raw FG% alone
 * is a poor signal since a rim-running center can post a great FG% with no
 * perimeter game at all — comparing within position isolates shooting touch
 * from shot selection). One flat table rather than per-decade tables — an
 * MVP simplification, not a researched historical trend line.
 */
const POSITION_AVG_FG_PCT: Record<NbaPosition, number> = {
  PG: 0.44,
  SG: 0.45,
  SF: 0.46,
  PF: 0.48,
  C: 0.49,
  '6MAN': 0.45,
};

/**
 * Calibration constants for the weighted blend (spec section 10's four-step
 * methodology). Baselines are anchored to the "cross-check against
 * comparable players' actual 3PT numbers from just after the line was
 * introduced" step: league-wide 3PT shooting in the early 1980s hovered
 * around a ~28% clip on very low attempt volume (a few percent of a team's
 * field goal attempts) — these are the starting points every player's
 * estimate is nudged away from, not researched season-by-season figures.
 */
const BASELINE_3PT_PCT = 0.28;
const BASELINE_3PT_RATE = 0.02;

const FT_WEIGHT_PCT = 0.5;
const FG_RESIDUAL_WEIGHT_PCT = 0.15;
const REPUTATION_BONUS_PCT: Record<ShooterReputation, number> = { low: -0.03, average: 0, high: 0.04 };

const FT_WEIGHT_RATE = 0.04;
const REPUTATION_BONUS_RATE: Record<ShooterReputation, number> = { low: -0.012, average: 0, high: 0.02 };

// Historically-plausible bounds for a hypothetical pre-1980 estimate — wide
// enough to separate a Bill Russell (no outside game at all) from a Bill
// Bradley (a well-regarded set shooter), narrow enough to stay honest that
// this is a modest, low-confidence "what if," not a real shooter's number.
const MIN_3PT_PCT = 0.15;
const MAX_3PT_PCT = 0.42;
const MIN_3PT_RATE = 0;
const MAX_3PT_RATE = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Estimates hypothetical 3-point shooting numbers for a stint that predates
 * the 1979-80 introduction of the 3-point line (spec section 10's
 * "Estimating stats from pre-tracking eras" subsection) — NOT a recovery of
 * a real unrecorded number (no such number exists; the shot didn't exist),
 * but a deliberately modest, explainable "how would this player likely have
 * shot from three" signal, useful for draft decision-making rather than an
 * unhelpful hard zero.
 *
 * Concrete weighted blend, per spec (in order of weight):
 * 1. FT% (primary) — available every era, isolates shooting touch/mechanics
 *    from shot selection or defense.
 * 2. Position-adjusted FG% (secondary) — the player's FG% relative to
 *    POSITION_AVG_FG_PCT, not raw FG%, so a rim-running center's dunks don't
 *    read as "good shooter."
 * 3. Shooter reputation (qualitative nudge) — contemporary scoring role/
 *    reputation, hand-assigned per player (same category of signal as the
 *    pre-1974 defensive-stat estimates' All-Defensive-voting/reputation
 *    signals, applied here to shooting instead).
 * 4. Cross-check against early-3PT-era comparables — not a runtime input;
 *    this is *how* the baseline/weight constants above were chosen (early-
 *    1980s league 3PT%/volume), not a fourth per-player term.
 *
 * Explicitly does NOT use shot-location/zone data (doesn't exist as
 * sourceable data pre-1980 — spec is explicit not to try) or NBA 2K ratings
 * (proprietary editorial judgment, off-limits per spec section 10 alongside
 * DVOA/PFF/etc.) — every input here is open box-score data plus a hand-
 * authored reputation tag.
 */
export function estimatePreThreePointStats(input: PreThreePointInputs): PreThreePointEstimate {
  const ftDeviation = input.ftPct - LEAGUE_AVG_FT_PCT_ERA;
  const fgResidual = input.fgPct - POSITION_AVG_FG_PCT[input.position];

  const threePtPct = clamp(
    BASELINE_3PT_PCT + FT_WEIGHT_PCT * ftDeviation + FG_RESIDUAL_WEIGHT_PCT * fgResidual + REPUTATION_BONUS_PCT[input.shooterReputation],
    MIN_3PT_PCT,
    MAX_3PT_PCT,
  );

  const threePtRate = clamp(
    BASELINE_3PT_RATE + FT_WEIGHT_RATE * ftDeviation + REPUTATION_BONUS_RATE[input.shooterReputation],
    MIN_3PT_RATE,
    MAX_3PT_RATE,
  );

  return {
    threePtPct: round(threePtPct, 3),
    threePtRate: round(threePtRate, 2),
  };
}
