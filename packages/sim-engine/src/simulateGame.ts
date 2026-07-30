import { createEmptyBoxScore, applyTripToBoxScore } from './boxScore';
import { LEAGUE_AVG_PACE, LEAGUE_AVG_PPP, MAX_TRIPS_PER_POSSESSION, TOTAL_GAME_SECONDS, QUARTER_SECONDS } from './constants';
import { buildHighlights } from './highlights';
import { simulateTrip } from './possession';
import { createSeededRandom, RandomFn } from './rng';
import { computeTeamRatings } from './teamRatings';
import { GameResult, PossessionEvent, TeamInput } from './types';
import { estimateWinProbability } from './winProbability';

export interface SimulateGameOptions {
  teamA: TeamInput;
  teamB: TeamInput;
  /** Fixed seed for a reproducible result; omit for a fresh random game. */
  seed?: number;
  /** How many top-leverage plays to surface as highlights. Defaults to 5. */
  highlightCount?: number;
}

type Side = 'A' | 'B';

export function simulateGame(options: SimulateGameOptions): GameResult {
  const { teamA, teamB } = options;
  const rand: RandomFn = createSeededRandom(options.seed ?? Date.now());

  const ratingsA = computeTeamRatings(teamA, LEAGUE_AVG_PPP);
  const ratingsB = computeTeamRatings(teamB, LEAGUE_AVG_PPP);

  const pace = Math.round(((teamA.pace ?? LEAGUE_AVG_PACE) + (teamB.pace ?? LEAGUE_AVG_PACE)) / 2);
  const secondsPerTrip = TOTAL_GAME_SECONDS / (pace * 2);

  const boxA = createEmptyBoxScore(teamA.players);
  const boxB = createEmptyBoxScore(teamB.players);

  const nameById = new Map<string, string>();
  for (const p of [...teamA.players, ...teamB.players]) nameById.set(p.id, p.name);

  let scoreA = 0;
  let scoreB = 0;
  let possessionsLeftA = pace;
  let possessionsLeftB = pace;
  let elapsedSeconds = 0;
  let offense: Side = 'A';
  let possessionIndex = 0;
  const events: PossessionEvent[] = [];

  while (possessionsLeftA > 0 || possessionsLeftB > 0) {
    if (offense === 'A' && possessionsLeftA === 0) offense = 'B';
    if (offense === 'B' && possessionsLeftB === 0) offense = 'A';

    const offenseTeam = offense === 'A' ? teamA : teamB;
    const defenseTeam = offense === 'A' ? teamB : teamA;
    const offenseRatings = offense === 'A' ? ratingsA : ratingsB;
    const defenseRatings = offense === 'A' ? ratingsB : ratingsA;
    const offenseBox = offense === 'A' ? boxA : boxB;
    const defenseBox = offense === 'A' ? boxB : boxA;

    let continuePossession = true;
    let trips = 0;

    while (continuePossession && trips < MAX_TRIPS_PER_POSSESSION) {
      const marginBeforeA = scoreA - scoreB;
      const secondsRemainingBefore = TOTAL_GAME_SECONDS - elapsedSeconds;

      const trip = simulateTrip(offenseTeam, defenseTeam, offenseRatings, defenseRatings, rand);
      applyTripToBoxScore(offenseBox, defenseBox, trip);

      if (offense === 'A') scoreA += trip.points;
      else scoreB += trip.points;

      elapsedSeconds = Math.min(TOTAL_GAME_SECONDS, elapsedSeconds + secondsPerTrip);

      const secondsRemainingAfter = TOTAL_GAME_SECONDS - elapsedSeconds;
      const marginAfterA = scoreA - scoreB;
      const winProbBefore = estimateWinProbability(marginBeforeA, secondsRemainingBefore);
      const winProbAfter = estimateWinProbability(marginAfterA, secondsRemainingAfter);

      events.push({
        possessionIndex,
        offenseTeamId: offenseTeam.teamId,
        gameClockSeconds: secondsRemainingAfter,
        quarter: Math.min(4, Math.floor(elapsedSeconds / QUARTER_SECONDS) + 1),
        outcome: trip.outcome,
        pointsScored: trip.points,
        shooterId: trip.shooterId,
        assisterId: trip.assisterId,
        reboundPlayerId: trip.reboundPlayerId,
        turnoverPlayerId: trip.turnoverPlayerId,
        stealPlayerId: trip.stealPlayerId,
        blockPlayerId: trip.blockPlayerId,
        scoreA,
        scoreB,
        leverageScore: winProbAfter - winProbBefore,
      });

      possessionIndex++;
      continuePossession = trip.outcome === 'miss_off_reb';
      trips++;
    }

    if (offense === 'A') possessionsLeftA--;
    else possessionsLeftB--;
    offense = offense === 'A' ? 'B' : 'A';
  }

  const highlights = buildHighlights(events, nameById, options.highlightCount ?? 5);

  // Regulation ties are vanishingly rare here (no overtime modeling in
  // Phase 1) — a coin flip covers the theoretical edge case deterministically.
  const winner: Side = scoreA === scoreB ? (rand() < 0.5 ? 'A' : 'B') : scoreA > scoreB ? 'A' : 'B';

  return {
    teamA: { teamId: teamA.teamId, teamName: teamA.teamName, score: scoreA },
    teamB: { teamId: teamB.teamId, teamName: teamB.teamName, score: scoreB },
    winner,
    boxScore: { teamA: boxA, teamB: boxB },
    possessionLog: events,
    highlights,
  };
}
