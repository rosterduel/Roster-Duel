import { createEmptyBoxScore, applyTripToBoxScore } from './boxScore';
import { LEAGUE_AVG_PACE, LEAGUE_AVG_PPP, MAX_TRIPS_PER_POSSESSION, OVERTIME_PERIOD_SECONDS, TOTAL_GAME_SECONDS } from './constants';
import { ClockContext, computeOvertimeClock, computeRegulationClock } from './gameClock';
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
  // Overtime plays at the same pace as regulation (possessions per second),
  // just over a much shorter period — the spec gives no OT possession count,
  // so this derives one from regulation's own trip length.
  const otPossessionsPerTeam = Math.max(1, Math.round(OVERTIME_PERIOD_SECONDS / secondsPerTrip / 2));

  const boxA = createEmptyBoxScore(teamA.players);
  const boxB = createEmptyBoxScore(teamB.players);

  const nameById = new Map<string, string>();
  for (const p of [...teamA.players, ...teamB.players]) nameById.set(p.id, p.name);

  let scoreA = 0;
  let scoreB = 0;
  let possessionIndex = 0;
  const events: PossessionEvent[] = [];

  /**
   * Plays one period (regulation or a single overtime period) of alternating
   * possessions. `computeClock` maps this period's own elapsed seconds to a
   * quarter label plus the two flavors of "time remaining" — see gameClock.ts
   * for why regulation and overtime compute win-probability seconds
   * differently.
   */
  function simulatePeriod(possessionsPerTeam: number, startingOffense: Side, computeClock: (periodElapsedSeconds: number) => ClockContext): void {
    let possessionsLeftA = possessionsPerTeam;
    let possessionsLeftB = possessionsPerTeam;
    let periodElapsedSeconds = 0;
    let offense: Side = startingOffense;

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
        // Leverage and highlight text are framed relative to whichever team is
        // on offense this trip, not a fixed team A — "Down 2, {player} buries
        // the go-ahead three" only reads correctly if "Down 2" describes the
        // shooter's own team, matching how a real highlight reel narrates it.
        const marginBeforeOffense = offense === 'A' ? scoreA - scoreB : scoreB - scoreA;
        const beforeClock = computeClock(periodElapsedSeconds);

        const trip = simulateTrip(offenseTeam, defenseTeam, offenseRatings, defenseRatings, rand);
        applyTripToBoxScore(offenseBox, defenseBox, trip);

        if (offense === 'A') scoreA += trip.points;
        else scoreB += trip.points;

        periodElapsedSeconds += secondsPerTrip;
        const afterClock = computeClock(periodElapsedSeconds);

        const marginAfterOffense = offense === 'A' ? scoreA - scoreB : scoreB - scoreA;
        const winProbBefore = estimateWinProbability(marginBeforeOffense, beforeClock.winProbSecondsRemaining);
        const winProbAfter = estimateWinProbability(marginAfterOffense, afterClock.winProbSecondsRemaining);

        events.push({
          possessionIndex,
          offenseTeamId: offenseTeam.teamId,
          periodSecondsRemaining: afterClock.periodSecondsRemaining,
          quarter: afterClock.quarter,
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
          offenseMarginAfter: marginAfterOffense,
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
  }

  // Regulation: four quarters, win probability weighed against the whole
  // 48-minute game.
  simulatePeriod(pace, 'A', computeRegulationClock);

  // Overtime: real extra periods at regulation pace, repeating until someone
  // is ahead when a period ends — no fatigue/foul-out modeling in Phase 1,
  // so a period can't end in anything but a decisive score either way over
  // enough possessions. Alternate which team starts each period, mirroring
  // the alternating-possession rule real overtime uses in lieu of a jump ball.
  let overtimePeriods = 0;
  while (scoreA === scoreB) {
    overtimePeriods++;
    const periodNumber = overtimePeriods;
    const startingOffense: Side = overtimePeriods % 2 === 1 ? 'A' : 'B';
    simulatePeriod(otPossessionsPerTeam, startingOffense, (elapsed) => computeOvertimeClock(elapsed, periodNumber));
  }

  const highlights = buildHighlights(events, nameById, options.highlightCount ?? 5);
  const winner: Side = scoreA > scoreB ? 'A' : 'B'; // the overtime loop above guarantees no tie here

  return {
    teamA: { teamId: teamA.teamId, teamName: teamA.teamName, score: scoreA },
    teamB: { teamId: teamB.teamId, teamName: teamB.teamName, score: scoreB },
    winner,
    boxScore: { teamA: boxA, teamB: boxB },
    possessionLog: events,
    highlights,
    overtimePeriods,
  };
}
