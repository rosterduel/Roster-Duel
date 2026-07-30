import { LEAGUE_AVG_PPP } from './constants';
import { log5 } from './log5';
import { calibrateOutcomeProbabilities } from './outcomeProbabilities';
import { RandomFn, weightedRandom, weightedRandomBy } from './rng';
import { TeamRatings } from './teamRatings';
import { PlayerRatingInput, PossessionOutcomeType, TeamInput } from './types';

export interface TripResult {
  outcome: PossessionOutcomeType;
  points: number;
  shooterId?: string;
  isThreePointAttempt?: boolean;
  madeShot?: boolean;
  assisterId?: string;
  reboundPlayerId?: string;
  turnoverPlayerId?: string;
  stealPlayerId?: string;
  blockPlayerId?: string;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
}

// Rough NBA norms used to add realistic texture beyond the primary
// usage/assist/rebound/steal/block rate weighting.
const ASSIST_ON_MAKE_PROBABILITY = 0.55;
const LIVE_BALL_STEAL_PROBABILITY = 0.6;
const BLOCK_ON_MISS_PROBABILITY = 0.15;
const THREE_SHOT_FOUL_PROBABILITY = 0.15; // vs. 2-shot foul

function pickShooterForMake(
  offense: PlayerRatingInput[],
  outcome: 'make_2' | 'make_3',
  rand: RandomFn,
): PlayerRatingInput {
  const weightFn =
    outcome === 'make_3'
      ? (p: PlayerRatingInput) => p.usageRate * p.threePointRate
      : (p: PlayerRatingInput) => p.usageRate * (1 - p.threePointRate);
  return weightedRandomBy(offense, weightFn, rand);
}

function pickShooterForMiss(
  offense: PlayerRatingInput[],
  rand: RandomFn,
): { shooter: PlayerRatingInput; isThree: boolean } {
  const shooter = weightedRandomBy(offense, (p) => p.usageRate, rand);
  return { shooter, isThree: rand() < shooter.threePointRate };
}

function simulateFreeThrows(shooter: PlayerRatingInput, rand: RandomFn): { made: number; attempted: number } {
  const attempted = rand() < THREE_SHOT_FOUL_PROBABILITY ? 3 : 2;
  let made = 0;
  for (let i = 0; i < attempted; i++) {
    if (rand() < shooter.freeThrowPct) made++;
  }
  return { made, attempted };
}

/**
 * Simulates one trip down the floor (section 5.2's possession loop body).
 * A trip that ends in an offensive rebound doesn't end the possession —
 * the caller re-invokes this for the same team to represent the extra shot.
 */
export function simulateTrip(
  offense: TeamInput,
  defense: TeamInput,
  offenseRatings: TeamRatings,
  defenseRatings: TeamRatings,
  rand: RandomFn,
): TripResult {
  const effectivePpp = log5(offenseRatings.pppRating, defenseRatings.pppAllowedRating, LEAGUE_AVG_PPP);
  const probs = calibrateOutcomeProbabilities(effectivePpp, LEAGUE_AVG_PPP);
  const outcome = weightedRandom(probs, rand);

  switch (outcome) {
    case 'turnover': {
      const turnoverPlayer = weightedRandomBy(offense.players, (p) => p.usageRate, rand);
      const stealPlayer =
        rand() < LIVE_BALL_STEAL_PROBABILITY ? weightedRandomBy(defense.players, (p) => p.stealRate, rand) : undefined;
      return { outcome, points: 0, turnoverPlayerId: turnoverPlayer.id, stealPlayerId: stealPlayer?.id };
    }

    case 'miss_def_reb': {
      const { shooter, isThree } = pickShooterForMiss(offense.players, rand);
      const blockPlayer =
        rand() < BLOCK_ON_MISS_PROBABILITY ? weightedRandomBy(defense.players, (p) => p.blockRate, rand) : undefined;
      const rebounder = weightedRandomBy(defense.players, (p) => p.reboundRate, rand);
      return {
        outcome,
        points: 0,
        shooterId: shooter.id,
        isThreePointAttempt: isThree,
        madeShot: false,
        blockPlayerId: blockPlayer?.id,
        reboundPlayerId: rebounder.id,
      };
    }

    case 'miss_off_reb': {
      const { shooter, isThree } = pickShooterForMiss(offense.players, rand);
      const rebounder = weightedRandomBy(offense.players, (p) => p.reboundRate, rand);
      return {
        outcome,
        points: 0,
        shooterId: shooter.id,
        isThreePointAttempt: isThree,
        madeShot: false,
        reboundPlayerId: rebounder.id,
      };
    }

    case 'make_2':
    case 'make_3': {
      const shooter = pickShooterForMake(offense.players, outcome, rand);
      const points = outcome === 'make_2' ? 2 : 3;
      let assisterId: string | undefined;
      if (rand() < ASSIST_ON_MAKE_PROBABILITY) {
        const teammates = offense.players.filter((p) => p.id !== shooter.id);
        assisterId = weightedRandomBy(teammates, (p) => p.assistRate, rand).id;
      }
      return {
        outcome,
        points,
        shooterId: shooter.id,
        isThreePointAttempt: outcome === 'make_3',
        madeShot: true,
        assisterId,
      };
    }

    case 'ft_trip': {
      const shooter = weightedRandomBy(offense.players, (p) => p.usageRate, rand);
      const { made, attempted } = simulateFreeThrows(shooter, rand);
      return {
        outcome,
        points: made,
        shooterId: shooter.id,
        freeThrowsMade: made,
        freeThrowsAttempted: attempted,
      };
    }
  }
}
