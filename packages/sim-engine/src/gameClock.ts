import { OVERTIME_PERIOD_SECONDS, QUARTER_SECONDS, TOTAL_GAME_SECONDS } from './constants';

export interface ClockContext {
  /** 1-4 for regulation quarters, 5+ for overtime periods (5 = OT1, 6 = OT2, ...). */
  quarter: number;
  /** Seconds remaining in the current quarter/period — what a scoreboard clock would show. */
  periodSecondsRemaining: number;
  /**
   * Seconds remaining to feed into the win-probability model. During
   * regulation this is time left in the *whole* 48-minute game (a big lead
   * means little in the 1st quarter, a lot in the 4th). During overtime
   * there's no fixed "whole game" left to weigh against — each period is
   * its own do-or-die stretch — so it's just that period's own clock.
   */
  winProbSecondsRemaining: number;
}

export function computeRegulationClock(elapsedSeconds: number): ClockContext {
  const clamped = Math.min(Math.max(elapsedSeconds, 0), TOTAL_GAME_SECONDS);
  const quarter = Math.min(4, Math.floor(clamped / QUARTER_SECONDS) + 1);
  const periodSecondsRemaining = QUARTER_SECONDS - (clamped - (quarter - 1) * QUARTER_SECONDS);
  return {
    quarter,
    periodSecondsRemaining,
    winProbSecondsRemaining: TOTAL_GAME_SECONDS - clamped,
  };
}

/** overtimePeriodNumber is 1-indexed: 1 for the first OT period, 2 for the second, etc. */
export function computeOvertimeClock(periodElapsedSeconds: number, overtimePeriodNumber: number): ClockContext {
  const clamped = Math.min(Math.max(periodElapsedSeconds, 0), OVERTIME_PERIOD_SECONDS);
  const periodSecondsRemaining = OVERTIME_PERIOD_SECONDS - clamped;
  return {
    quarter: 4 + overtimePeriodNumber,
    periodSecondsRemaining,
    winProbSecondsRemaining: periodSecondsRemaining,
  };
}
