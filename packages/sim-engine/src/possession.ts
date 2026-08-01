import { LEAGUE_AVG_PPP } from './constants';
import { log5 } from './log5';
import { calibrateOutcomeProbabilities } from './outcomeProbabilities';
import { RandomFn, weightedRandom, weightedRandomBy } from './rng';
import { TeamRatings } from './teamRatings';
import { CourtZone, PlayerRatingInput, PlayType, PossessionOutcomeType, TeamInput } from './types';

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
  playType: PlayType;
  startLocation: CourtZone;
  endLocation: CourtZone;
}

// Rough NBA norms used to add realistic texture beyond the primary
// usage/assist/rebound/steal/block rate weighting.
const ASSIST_ON_MAKE_PROBABILITY = 0.55;
const LIVE_BALL_STEAL_PROBABILITY = 0.6;
const BLOCK_ON_MISS_PROBABILITY = 0.15;
const THREE_SHOT_FOUL_PROBABILITY = 0.15; // vs. 2-shot foul
// Real NBA 2PA shot profiles skew toward the rim; not a rigorous model,
// just a reasonable default so 2-point attempts aren't a uniform coin flip.
const PAINT_SHOT_PROBABILITY = 0.6;
const THREE_POINT_ZONES: CourtZone[] = ['three_left', 'three_right', 'three_top'];

/**
 * Picks a simplified court zone for a shot attempt (spec section 4a) — not
 * a real court coordinate, just enough for a schematic animation to know
 * roughly where the shot came from. Every shot's ball ends up at the hoop
 * ('paint'), whether it goes in or not; only the start zone varies.
 */
function pickShotZone(isThree: boolean, rand: RandomFn): CourtZone {
  if (isThree) {
    return THREE_POINT_ZONES[Math.floor(rand() * THREE_POINT_ZONES.length)];
  }
  return rand() < PAINT_SHOT_PROBABILITY ? 'paint' : 'mid_range';
}

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
      return {
        outcome,
        points: 0,
        turnoverPlayerId: turnoverPlayer.id,
        stealPlayerId: stealPlayer?.id,
        playType: stealPlayer ? 'steal' : 'turnover',
        // Fixed, undramatic zones — a turnover isn't a shot attempt, so
        // there's no shot location to randomize; this just represents
        // "the ball changes hands out front and heads back the other way".
        startLocation: 'mid_range',
        endLocation: 'backcourt',
      };
    }

    case 'miss_def_reb': {
      const { shooter, isThree } = pickShooterForMiss(offense.players, rand);
      const shotZone = pickShotZone(isThree, rand);
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
        playType: blockPlayer ? 'block' : isThree ? 'three_pointer_missed' : 'two_pointer_missed',
        startLocation: shotZone,
        endLocation: 'paint',
      };
    }

    case 'miss_off_reb': {
      const { shooter, isThree } = pickShooterForMiss(offense.players, rand);
      const shotZone = pickShotZone(isThree, rand);
      const rebounder = weightedRandomBy(offense.players, (p) => p.reboundRate, rand);
      return {
        outcome,
        points: 0,
        shooterId: shooter.id,
        isThreePointAttempt: isThree,
        madeShot: false,
        reboundPlayerId: rebounder.id,
        playType: 'offensive_rebound',
        startLocation: shotZone,
        endLocation: 'paint',
      };
    }

    case 'make_2':
    case 'make_3': {
      const shooter = pickShooterForMake(offense.players, outcome, rand);
      const isThree = outcome === 'make_3';
      const shotZone = pickShotZone(isThree, rand);
      const points = isThree ? 3 : 2;
      let assisterId: string | undefined;
      if (rand() < ASSIST_ON_MAKE_PROBABILITY) {
        const teammates = offense.players.filter((p) => p.id !== shooter.id);
        assisterId = weightedRandomBy(teammates, (p) => p.assistRate, rand).id;
      }
      return {
        outcome,
        points,
        shooterId: shooter.id,
        isThreePointAttempt: isThree,
        madeShot: true,
        assisterId,
        playType: isThree ? 'three_pointer_made' : 'two_pointer_made',
        startLocation: shotZone,
        endLocation: 'paint',
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
        playType: 'free_throw',
        startLocation: 'free_throw_line',
        endLocation: 'paint',
      };
    }
  }
}
