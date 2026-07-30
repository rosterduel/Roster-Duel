import { PossessionOutcomeType } from './types';

export type OutcomeProbabilities = Record<PossessionOutcomeType, number>;

// Baseline league-average distribution per trip (section 5.2). Sums to 1.
const BASE_OUTCOME_PROBS: OutcomeProbabilities = {
  turnover: 0.13,
  miss_def_reb: 0.32,
  miss_off_reb: 0.1,
  make_2: 0.3,
  make_3: 0.1,
  ft_trip: 0.05,
};

// How far a team's per-trip scoring mass can swing from league average.
// Keeps calibration from pushing any probability negative on extreme mismatches.
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.6;

const BASE_SCORING_MASS = BASE_OUTCOME_PROBS.make_2 + BASE_OUTCOME_PROBS.make_3 + BASE_OUTCOME_PROBS.ft_trip;
const BASE_EMPTY_MASS = BASE_OUTCOME_PROBS.turnover + BASE_OUTCOME_PROBS.miss_def_reb;
const OFF_REB_MASS = BASE_OUTCOME_PROBS.miss_off_reb;
// Scoring mass can't exceed this (leaves room for turnovers/misses to exist at all).
const MAX_SCORING_MASS = 0.9 - OFF_REB_MASS;

/**
 * Scales the baseline per-trip outcome distribution so its expected point
 * value tracks effectivePpp (the log5 result for this matchup), while
 * holding the offensive-rebound rate fixed — o-reb rate is a rebounding
 * outcome, not a shot-quality one, so offense/defense scoring strength
 * shouldn't move it here.
 */
export function calibrateOutcomeProbabilities(effectivePpp: number, leagueAvgPpp: number): OutcomeProbabilities {
  const rawScale = effectivePpp / leagueAvgPpp;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

  const scoringMass = Math.min(MAX_SCORING_MASS, BASE_SCORING_MASS * scale);
  const emptyMass = 1 - OFF_REB_MASS - scoringMass;

  return {
    miss_off_reb: OFF_REB_MASS,
    make_2: scoringMass * (BASE_OUTCOME_PROBS.make_2 / BASE_SCORING_MASS),
    make_3: scoringMass * (BASE_OUTCOME_PROBS.make_3 / BASE_SCORING_MASS),
    ft_trip: scoringMass * (BASE_OUTCOME_PROBS.ft_trip / BASE_SCORING_MASS),
    turnover: emptyMass * (BASE_OUTCOME_PROBS.turnover / BASE_EMPTY_MASS),
    miss_def_reb: emptyMass * (BASE_OUTCOME_PROBS.miss_def_reb / BASE_EMPTY_MASS),
  };
}
