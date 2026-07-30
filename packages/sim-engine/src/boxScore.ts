import { TripResult } from './possession';
import { PlayerBoxScoreLine, PlayerRatingInput } from './types';

export function createEmptyBoxScore(players: PlayerRatingInput[]): PlayerBoxScoreLine[] {
  return players.map((p) => ({
    playerId: p.id,
    name: p.name,
    position: p.position,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threesMade: 0,
    threesAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  }));
}

/** Applies one trip's attributions to the offense's or defense's box score lines. */
export function applyTripToBoxScore(offenseLines: PlayerBoxScoreLine[], defenseLines: PlayerBoxScoreLine[], trip: TripResult): void {
  const find = (lines: PlayerBoxScoreLine[], id?: string) => (id ? lines.find((l) => l.playerId === id) : undefined);

  switch (trip.outcome) {
    case 'turnover': {
      const tov = find(offenseLines, trip.turnoverPlayerId);
      if (tov) tov.turnovers += 1;
      const stl = find(defenseLines, trip.stealPlayerId);
      if (stl) stl.steals += 1;
      break;
    }

    case 'miss_def_reb':
    case 'miss_off_reb': {
      const shooter = find(offenseLines, trip.shooterId);
      if (shooter) {
        shooter.fieldGoalsAttempted += 1;
        if (trip.isThreePointAttempt) shooter.threesAttempted += 1;
      }
      const rebounderLines = trip.outcome === 'miss_def_reb' ? defenseLines : offenseLines;
      const rebounder = find(rebounderLines, trip.reboundPlayerId);
      if (rebounder) rebounder.rebounds += 1;
      const blocker = find(defenseLines, trip.blockPlayerId);
      if (blocker) blocker.blocks += 1;
      break;
    }

    case 'make_2':
    case 'make_3': {
      const shooter = find(offenseLines, trip.shooterId);
      if (shooter) {
        shooter.fieldGoalsAttempted += 1;
        shooter.fieldGoalsMade += 1;
        shooter.points += trip.points;
        if (trip.isThreePointAttempt) {
          shooter.threesAttempted += 1;
          shooter.threesMade += 1;
        }
      }
      const assister = find(offenseLines, trip.assisterId);
      if (assister) assister.assists += 1;
      break;
    }

    case 'ft_trip': {
      const shooter = find(offenseLines, trip.shooterId);
      if (shooter) {
        shooter.freeThrowsAttempted += trip.freeThrowsAttempted ?? 0;
        shooter.freeThrowsMade += trip.freeThrowsMade ?? 0;
        shooter.points += trip.points;
      }
      break;
    }
  }
}
