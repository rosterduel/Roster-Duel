import { applyTripToBoxScore, createEmptyBoxScore } from './boxScore';
import { TripResult } from './possession';
import { PlayerRatingInput } from './types';

function player(id: string): PlayerRatingInput {
  return {
    id,
    name: id,
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
  };
}

describe('createEmptyBoxScore', () => {
  it('zeroes every stat for every player', () => {
    const lines = createEmptyBoxScore([player('a'), player('b')]);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.points).toBe(0);
      expect(line.rebounds).toBe(0);
      expect(line.fieldGoalsAttempted).toBe(0);
    }
  });
});

describe('applyTripToBoxScore', () => {
  it('credits a made 3 to the shooter and assister', () => {
    const offense = createEmptyBoxScore([player('shooter'), player('passer')]);
    const defense = createEmptyBoxScore([player('d1')]);
    const trip: TripResult = {
      outcome: 'make_3',
      points: 3,
      shooterId: 'shooter',
      isThreePointAttempt: true,
      madeShot: true,
      assisterId: 'passer',
      playType: 'three_pointer_made',
      startLocation: 'three_top',
      endLocation: 'paint',
    };

    applyTripToBoxScore(offense, defense, trip);

    const shooter = offense.find((l) => l.playerId === 'shooter')!;
    expect(shooter.points).toBe(3);
    expect(shooter.fieldGoalsMade).toBe(1);
    expect(shooter.fieldGoalsAttempted).toBe(1);
    expect(shooter.threesMade).toBe(1);
    expect(shooter.threesAttempted).toBe(1);

    const passer = offense.find((l) => l.playerId === 'passer')!;
    expect(passer.assists).toBe(1);
  });

  it('credits a missed defensive-rebound trip as an FGA with no make, plus rebound/block on defense', () => {
    const offense = createEmptyBoxScore([player('shooter')]);
    const defense = createEmptyBoxScore([player('rebounder'), player('blocker')]);
    const trip: TripResult = {
      outcome: 'miss_def_reb',
      points: 0,
      shooterId: 'shooter',
      isThreePointAttempt: false,
      madeShot: false,
      reboundPlayerId: 'rebounder',
      blockPlayerId: 'blocker',
      playType: 'block',
      startLocation: 'paint',
      endLocation: 'paint',
    };

    applyTripToBoxScore(offense, defense, trip);

    const shooter = offense.find((l) => l.playerId === 'shooter')!;
    expect(shooter.fieldGoalsAttempted).toBe(1);
    expect(shooter.fieldGoalsMade).toBe(0);

    expect(defense.find((l) => l.playerId === 'rebounder')!.rebounds).toBe(1);
    expect(defense.find((l) => l.playerId === 'blocker')!.blocks).toBe(1);
  });

  it('credits an offensive rebound to the offense, not the defense', () => {
    const offense = createEmptyBoxScore([player('shooter'), player('offRebounder')]);
    const defense = createEmptyBoxScore([player('d1')]);
    const trip: TripResult = {
      outcome: 'miss_off_reb',
      points: 0,
      shooterId: 'shooter',
      reboundPlayerId: 'offRebounder',
      playType: 'offensive_rebound',
      startLocation: 'mid_range',
      endLocation: 'paint',
    };

    applyTripToBoxScore(offense, defense, trip);

    expect(offense.find((l) => l.playerId === 'offRebounder')!.rebounds).toBe(1);
    expect(defense.every((l) => l.rebounds === 0)).toBe(true);
  });

  it('credits a turnover to the offense and a steal to the defense', () => {
    const offense = createEmptyBoxScore([player('ballhandler')]);
    const defense = createEmptyBoxScore([player('defender')]);
    const trip: TripResult = {
      outcome: 'turnover',
      points: 0,
      turnoverPlayerId: 'ballhandler',
      stealPlayerId: 'defender',
      playType: 'steal',
      startLocation: 'mid_range',
      endLocation: 'backcourt',
    };

    applyTripToBoxScore(offense, defense, trip);

    expect(offense.find((l) => l.playerId === 'ballhandler')!.turnovers).toBe(1);
    expect(defense.find((l) => l.playerId === 'defender')!.steals).toBe(1);
  });

  it('credits free throws made/attempted and points to the shooter', () => {
    const offense = createEmptyBoxScore([player('shooter')]);
    const defense = createEmptyBoxScore([player('d1')]);
    const trip: TripResult = {
      outcome: 'ft_trip',
      points: 2,
      shooterId: 'shooter',
      freeThrowsMade: 2,
      freeThrowsAttempted: 2,
      playType: 'free_throw',
      startLocation: 'free_throw_line',
      endLocation: 'paint',
    };

    applyTripToBoxScore(offense, defense, trip);

    const shooter = offense.find((l) => l.playerId === 'shooter')!;
    expect(shooter.freeThrowsMade).toBe(2);
    expect(shooter.freeThrowsAttempted).toBe(2);
    expect(shooter.points).toBe(2);
  });
});
