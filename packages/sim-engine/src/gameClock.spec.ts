import { OVERTIME_PERIOD_SECONDS, QUARTER_SECONDS, TOTAL_GAME_SECONDS } from './constants';
import { computeOvertimeClock, computeRegulationClock } from './gameClock';

describe('computeRegulationClock', () => {
  it('starts the game at quarter 1 with a full quarter and full game remaining', () => {
    const clock = computeRegulationClock(0);
    expect(clock.quarter).toBe(1);
    expect(clock.periodSecondsRemaining).toBe(QUARTER_SECONDS);
    expect(clock.winProbSecondsRemaining).toBe(TOTAL_GAME_SECONDS);
  });

  it('rolls over to quarter 2 with a fresh clock exactly at the Q1/Q2 boundary', () => {
    const clock = computeRegulationClock(QUARTER_SECONDS);
    expect(clock.quarter).toBe(2);
    expect(clock.periodSecondsRemaining).toBe(QUARTER_SECONDS);
  });

  it('computes remaining time correctly mid-quarter', () => {
    // 80 seconds into Q2 (720-1440 range)
    const clock = computeRegulationClock(QUARTER_SECONDS + 80);
    expect(clock.quarter).toBe(2);
    expect(clock.periodSecondsRemaining).toBe(QUARTER_SECONDS - 80);
  });

  it('caps at quarter 4 with zero remaining at the exact end of regulation', () => {
    const clock = computeRegulationClock(TOTAL_GAME_SECONDS);
    expect(clock.quarter).toBe(4);
    expect(clock.periodSecondsRemaining).toBe(0);
    expect(clock.winProbSecondsRemaining).toBe(0);
  });

  it('clamps rather than rolling into a 5th quarter if elapsed exceeds regulation', () => {
    const clock = computeRegulationClock(TOTAL_GAME_SECONDS + 500);
    expect(clock.quarter).toBe(4);
    expect(clock.periodSecondsRemaining).toBe(0);
    expect(clock.winProbSecondsRemaining).toBe(0);
  });

  it('shrinks winProbSecondsRemaining across the whole game, not just the current quarter', () => {
    // Start of Q3: two full quarters remain in the whole game, well beyond QUARTER_SECONDS.
    const clock = computeRegulationClock(QUARTER_SECONDS * 2);
    expect(clock.winProbSecondsRemaining).toBe(TOTAL_GAME_SECONDS - QUARTER_SECONDS * 2);
    expect(clock.winProbSecondsRemaining).toBeGreaterThan(clock.periodSecondsRemaining);
  });
});

describe('computeOvertimeClock', () => {
  it('labels the first overtime period as quarter 5', () => {
    const clock = computeOvertimeClock(0, 1);
    expect(clock.quarter).toBe(5);
    expect(clock.periodSecondsRemaining).toBe(OVERTIME_PERIOD_SECONDS);
  });

  it('labels the second overtime period as quarter 6', () => {
    const clock = computeOvertimeClock(0, 2);
    expect(clock.quarter).toBe(6);
  });

  it('uses the period-local clock for win probability too (no fixed "whole game" left in OT)', () => {
    const clock = computeOvertimeClock(250, 1);
    expect(clock.periodSecondsRemaining).toBe(OVERTIME_PERIOD_SECONDS - 250);
    expect(clock.winProbSecondsRemaining).toBe(clock.periodSecondsRemaining);
  });

  it('clamps to zero remaining at or beyond the end of the period', () => {
    const clock = computeOvertimeClock(OVERTIME_PERIOD_SECONDS + 100, 1);
    expect(clock.periodSecondsRemaining).toBe(0);
    expect(clock.winProbSecondsRemaining).toBe(0);
  });
});
