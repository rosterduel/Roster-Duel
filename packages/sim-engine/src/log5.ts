/**
 * Log5 (section 5.1): combines an offensive rate against an opposing
 * defensive rate without letting two elite (or two poor) values multiply
 * into an absurd result — both get pulled back toward league average.
 */
export function log5(offenseRate: number, defenseRateAllowed: number, leagueAverageRate: number): number {
  if (leagueAverageRate <= 0) {
    throw new Error('leagueAverageRate must be positive');
  }
  return (offenseRate * defenseRateAllowed) / leagueAverageRate;
}
