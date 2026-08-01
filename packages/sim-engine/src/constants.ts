// League-average points per possession. Used as the denominator in log5 and
// as the baseline every team's rating is expressed relative to.
export const LEAGUE_AVG_PPP = 1.12;

// Default possessions per team per game if a roster doesn't specify pace.
export const LEAGUE_AVG_PACE = 100;

export const TOTAL_GAME_SECONDS = 48 * 60;
export const QUARTER_SECONDS = TOTAL_GAME_SECONDS / 4;
export const OVERTIME_PERIOD_SECONDS = 5 * 60;

// Guards against runaway recursion when a team strings together repeated
// offensive rebounds — astronomically unlikely to matter, just a safety cap.
export const MAX_TRIPS_PER_POSSESSION = 6;

// Same floating-point-noise guard used in apps/api's rating computation —
// a min-max spread this close to zero is "no real signal", not a real range.
export const NO_SPREAD_EPSILON = 1e-9;

// Game MVP formula (spec section 4b) — how much weight the box-score
// composite carries vs. the leverage-moment component. Box score is the
// primary signal (a full 48-minute stat line); leverage is a meaningful
// but secondary boost for players who authored the game's biggest swings.
// See mvp.ts for the full formula and reasoning.
export const MVP_BOX_SCORE_WEIGHT = 0.6;
export const MVP_LEVERAGE_WEIGHT = 0.4;
