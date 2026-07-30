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
