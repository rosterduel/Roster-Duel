import { PlayerRatingInput, TeamInput } from '../src/types';

// Illustrative sample data for the standalone demo only — real players'
// names, but hand-tuned placeholder ratings (not derived from any dataset).
// The offline rating pipeline from spec section 6 replaces this once it
// exists; the seed script (a later step) will use real box-score data.

function player(input: Omit<PlayerRatingInput, never>): PlayerRatingInput {
  return input;
}

export const teamLegacy: TeamInput = {
  teamId: 'legacy',
  teamName: 'Team Legacy',
  players: [
    player({
      id: 'legacy-pg', name: 'Magic Johnson', position: 'PG',
      offenseRating: 88, defenseRating: 60, usageRate: 0.22, assistRate: 0.55,
      reboundRate: 0.1, stealRate: 0.18, blockRate: 0.01, threePointRate: 0.1, freeThrowPct: 0.85,
    }),
    player({
      id: 'legacy-sg', name: 'Michael Jordan', position: 'SG',
      offenseRating: 95, defenseRating: 75, usageRate: 0.3, assistRate: 0.2,
      reboundRate: 0.1, stealRate: 0.22, blockRate: 0.03, threePointRate: 0.2, freeThrowPct: 0.84,
    }),
    player({
      id: 'legacy-sf', name: 'LeBron James', position: 'SF',
      offenseRating: 92, defenseRating: 70, usageRate: 0.28, assistRate: 0.35,
      reboundRate: 0.15, stealRate: 0.15, blockRate: 0.05, threePointRate: 0.3, freeThrowPct: 0.73,
    }),
    player({
      id: 'legacy-pf', name: 'Tim Duncan', position: 'PF',
      offenseRating: 75, defenseRating: 90, usageRate: 0.18, assistRate: 0.12,
      reboundRate: 0.22, stealRate: 0.08, blockRate: 0.12, threePointRate: 0.02, freeThrowPct: 0.69,
    }),
    player({
      id: 'legacy-c', name: 'Shaquille O’Neal', position: 'C',
      offenseRating: 80, defenseRating: 82, usageRate: 0.2, assistRate: 0.1,
      reboundRate: 0.25, stealRate: 0.05, blockRate: 0.15, threePointRate: 0.0, freeThrowPct: 0.53,
    }),
    player({
      id: 'legacy-6man', name: 'Manu Ginobili', position: '6MAN',
      offenseRating: 78, defenseRating: 65, usageRate: 0.18, assistRate: 0.25,
      reboundRate: 0.08, stealRate: 0.16, blockRate: 0.02, threePointRate: 0.35, freeThrowPct: 0.83,
    }),
  ],
};

export const teamDynasty: TeamInput = {
  teamId: 'dynasty',
  teamName: 'Team Dynasty',
  players: [
    player({
      id: 'dynasty-pg', name: 'Stephen Curry', position: 'PG',
      offenseRating: 93, defenseRating: 55, usageRate: 0.28, assistRate: 0.32,
      reboundRate: 0.08, stealRate: 0.14, blockRate: 0.01, threePointRate: 0.55, freeThrowPct: 0.91,
    }),
    player({
      id: 'dynasty-sg', name: 'Kobe Bryant', position: 'SG',
      offenseRating: 90, defenseRating: 72, usageRate: 0.3, assistRate: 0.18,
      reboundRate: 0.1, stealRate: 0.13, blockRate: 0.03, threePointRate: 0.25, freeThrowPct: 0.84,
    }),
    player({
      id: 'dynasty-sf', name: 'Kevin Durant', position: 'SF',
      offenseRating: 92, defenseRating: 68, usageRate: 0.29, assistRate: 0.2,
      reboundRate: 0.15, stealRate: 0.1, blockRate: 0.06, threePointRate: 0.35, freeThrowPct: 0.88,
    }),
    player({
      id: 'dynasty-pf', name: 'Dirk Nowitzki', position: 'PF',
      offenseRating: 84, defenseRating: 60, usageRate: 0.24, assistRate: 0.12,
      reboundRate: 0.18, stealRate: 0.05, blockRate: 0.04, threePointRate: 0.35, freeThrowPct: 0.88,
    }),
    player({
      id: 'dynasty-c', name: 'Hakeem Olajuwon', position: 'C',
      offenseRating: 78, defenseRating: 88, usageRate: 0.2, assistRate: 0.1,
      reboundRate: 0.22, stealRate: 0.1, blockRate: 0.2, threePointRate: 0.0, freeThrowPct: 0.71,
    }),
    player({
      id: 'dynasty-6man', name: 'Ray Allen', position: '6MAN',
      offenseRating: 76, defenseRating: 58, usageRate: 0.16, assistRate: 0.12,
      reboundRate: 0.06, stealRate: 0.1, blockRate: 0.01, threePointRate: 0.45, freeThrowPct: 0.89,
    }),
  ],
};
