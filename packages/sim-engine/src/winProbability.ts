import { TOTAL_GAME_SECONDS } from './constants';

const SENSITIVITY = 0.35;

/**
 * Simple win-probability model (section 5.5) as a function of score margin
 * and time remaining: a lookup-table/logistic starting point, refinable later.
 * The same margin matters far more late in the game than early — dividing
 * the margin by sqrt(timeFraction) inflates its effective weight as time
 * runs out, without a hard discontinuity at the buzzer.
 *
 * Symmetric and team-agnostic: pass whichever team's margin (that team's
 * score minus the opponent's) you want the win probability for.
 */
export function estimateWinProbability(marginForTeam: number, secondsRemaining: number): number {
  const clampedSeconds = Math.max(0, Math.min(secondsRemaining, TOTAL_GAME_SECONDS));
  const timeFraction = clampedSeconds / TOTAL_GAME_SECONDS;
  const effectiveMargin = marginForTeam / Math.sqrt(timeFraction + 0.02);
  return 1 / (1 + Math.exp(-SENSITIVITY * effectiveMargin));
}
