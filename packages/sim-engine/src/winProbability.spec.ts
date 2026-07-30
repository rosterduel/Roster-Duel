import { TOTAL_GAME_SECONDS } from './constants';
import { estimateWinProbability } from './winProbability';

describe('estimateWinProbability', () => {
  it('is 0.5 for a tied game regardless of time remaining', () => {
    expect(estimateWinProbability(0, TOTAL_GAME_SECONDS)).toBeCloseTo(0.5, 10);
    expect(estimateWinProbability(0, 30)).toBeCloseTo(0.5, 10);
  });

  it('favors the leading team', () => {
    expect(estimateWinProbability(10, 600)).toBeGreaterThan(0.5);
    expect(estimateWinProbability(-10, 600)).toBeLessThan(0.5);
  });

  it('is symmetric for opposite margins', () => {
    const up = estimateWinProbability(8, 300);
    const down = estimateWinProbability(-8, 300);
    expect(up).toBeCloseTo(1 - down, 10);
  });

  it('makes the same margin matter more as time runs out', () => {
    const earlyGame = estimateWinProbability(6, TOTAL_GAME_SECONDS - 60);
    const lateGame = estimateWinProbability(6, 30);
    expect(lateGame).toBeGreaterThan(earlyGame);
  });

  it('stays within [0, 1], saturating toward the extremes for lopsided late-game margins', () => {
    expect(estimateWinProbability(12, 20)).toBeLessThan(1);
    expect(estimateWinProbability(12, 20)).toBeGreaterThan(0.9);
    expect(estimateWinProbability(-12, 20)).toBeGreaterThan(0);
    expect(estimateWinProbability(-12, 20)).toBeLessThan(0.1);
  });
});
