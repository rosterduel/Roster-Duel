import { TeamInput } from './types';

export interface TeamRatings {
  /** This team's own points-per-possession rate on offense. */
  pppRating: number;
  /** Points per possession this team's defense allows. */
  pppAllowedRating: number;
}

const RATING_MIDPOINT = 50;
// Divisor controlling how far a rating pushes production off league average:
// a rating of 100 (max) swings PPP by +50%, a rating of 0 swings it -50%.
const RATING_SWING = 100;

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Aggregates a 6-player roster into the team-level rates log5 operates on. */
export function computeTeamRatings(team: TeamInput, leagueAvgPpp: number): TeamRatings {
  const avgOffense = average(team.players.map((p) => p.offenseRating));
  const avgDefense = average(team.players.map((p) => p.defenseRating));

  const pppRating = leagueAvgPpp * (1 + (avgOffense - RATING_MIDPOINT) / RATING_SWING);
  const pppAllowedRating = leagueAvgPpp * (1 + (RATING_MIDPOINT - avgDefense) / RATING_SWING);

  return { pppRating, pppAllowedRating };
}
