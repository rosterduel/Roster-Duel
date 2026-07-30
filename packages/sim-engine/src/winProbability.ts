import { TOTAL_GAME_SECONDS } from './constants';

const SENSITIVITY = 0.35;

/**
 * Simple win-probability model (section 5.5) as a function of score margin
 * and time remaining: a lookup-table/logistic starting point, refinable later.
 * The same margin matters far more late in the game than early — dividing
 * the margin by sqrt(timeFraction) inflates its effective weight as time
 * runs out, without a hard discontinuity at the buzzer.
 */
export function estimateWinProbability(marginForTeamA: number, secondsRemaining: number): number {
  const clampedSeconds = Math.max(0, Math.min(secondsRemaining, TOTAL_GAME_SECONDS));
  const timeFraction = clampedSeconds / TOTAL_GAME_SECONDS;
  const effectiveMargin = marginForTeamA / Math.sqrt(timeFraction + 0.02);
  return 1 / (1 + Math.exp(-SENSITIVITY * effectiveMargin));
}
