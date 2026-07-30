import { calibrateOutcomeProbabilities } from './outcomeProbabilities';
import { LEAGUE_AVG_PPP } from './constants';

function sum(probs: Record<string, number>): number {
  return Object.values(probs).reduce((a, b) => a + b, 0);
}

describe('calibrateOutcomeProbabilities', () => {
  it('sums to 1 and stays non-negative at league average', () => {
    const probs = calibrateOutcomeProbabilities(LEAGUE_AVG_PPP, LEAGUE_AVG_PPP);
    expect(sum(probs)).toBeCloseTo(1, 10);
    Object.values(probs).forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
  });

  it('sums to 1 and stays non-negative across a wide range of effective PPP, including extremes', () => {
    const samples = [0.1, 0.5, 0.8, 1.0, LEAGUE_AVG_PPP, 1.5, 2.0, 3.0, 10.0];
    for (const ppp of samples) {
      const probs = calibrateOutcomeProbabilities(ppp, LEAGUE_AVG_PPP);
      expect(sum(probs)).toBeCloseTo(1, 10);
      Object.values(probs).forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    }
  });

  it('increases scoring-outcome mass for a more efficient matchup', () => {
    const belowAvg = calibrateOutcomeProbabilities(LEAGUE_AVG_PPP * 0.8, LEAGUE_AVG_PPP);
    const aboveAvg = calibrateOutcomeProbabilities(LEAGUE_AVG_PPP * 1.3, LEAGUE_AVG_PPP);

    const scoringMass = (p: Record<string, number>) => p.make_2 + p.make_3 + p.ft_trip;
    expect(scoringMass(aboveAvg)).toBeGreaterThan(scoringMass(belowAvg));
  });

  it('holds the offensive-rebound rate fixed regardless of scoring efficiency', () => {
    const belowAvg = calibrateOutcomeProbabilities(LEAGUE_AVG_PPP * 0.6, LEAGUE_AVG_PPP);
    const aboveAvg = calibrateOutcomeProbabilities(LEAGUE_AVG_PPP * 1.5, LEAGUE_AVG_PPP);
    expect(belowAvg.miss_off_reb).toBeCloseTo(aboveAvg.miss_off_reb, 10);
  });
});
