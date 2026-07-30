import { computeTeamRatings } from './teamRatings';
import { PlayerRatingInput } from './types';

const LEAGUE_AVG_PPP = 1.12;

function makePlayer(overrides: Partial<PlayerRatingInput> & { id: string }): PlayerRatingInput {
  return {
    name: overrides.id,
    position: 'PG',
    offenseRating: 50,
    defenseRating: 50,
    usageRate: 0.2,
    assistRate: 0.2,
    reboundRate: 0.2,
    stealRate: 0.1,
    blockRate: 0.05,
    threePointRate: 0.3,
    freeThrowPct: 0.8,
    ...overrides,
  };
}

describe('computeTeamRatings', () => {
  it('returns league average for a roster of exactly league-average players', () => {
    const team = {
      teamId: 'avg',
      teamName: 'Average Team',
      players: Array.from({ length: 6 }, (_, i) => makePlayer({ id: `p${i}` })),
    };

    const ratings = computeTeamRatings(team, LEAGUE_AVG_PPP);
    expect(ratings.pppRating).toBeCloseTo(LEAGUE_AVG_PPP, 10);
    expect(ratings.pppAllowedRating).toBeCloseTo(LEAGUE_AVG_PPP, 10);
  });

  it('gives an elite-offense roster a pppRating above league average', () => {
    const team = {
      teamId: 'elite-offense',
      teamName: 'Elite Offense',
      players: Array.from({ length: 6 }, (_, i) => makePlayer({ id: `p${i}`, offenseRating: 90 })),
    };

    const ratings = computeTeamRatings(team, LEAGUE_AVG_PPP);
    expect(ratings.pppRating).toBeGreaterThan(LEAGUE_AVG_PPP);
  });

  it('gives an elite-defense roster a pppAllowedRating below league average', () => {
    const team = {
      teamId: 'elite-defense',
      teamName: 'Elite Defense',
      players: Array.from({ length: 6 }, (_, i) => makePlayer({ id: `p${i}`, defenseRating: 90 })),
    };

    const ratings = computeTeamRatings(team, LEAGUE_AVG_PPP);
    expect(ratings.pppAllowedRating).toBeLessThan(LEAGUE_AVG_PPP);
  });
});
