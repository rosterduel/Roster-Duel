import { LEAGUE_AVG_PPP } from './constants';
import { simulateTrip } from './possession';
import { createSeededRandom } from './rng';
import { computeTeamRatings } from './teamRatings';
import { createFixedRandom } from './testUtils';
import { PlayerRatingInput, TeamInput } from './types';

function player(overrides: Partial<PlayerRatingInput> & { id: string }): PlayerRatingInput {
  return {
    name: overrides.id,
    position: 'PG',
    offenseRating: 50, // league average, so effectivePpp === LEAGUE_AVG_PPP === base outcome probs
    defenseRating: 50,
    usageRate: 0,
    assistRate: 0,
    reboundRate: 0,
    stealRate: 0,
    blockRate: 0,
    threePointRate: 0,
    freeThrowPct: 0.8,
    ...overrides,
  };
}

function team(teamId: string, players: PlayerRatingInput[]): TeamInput {
  return { teamId, teamName: teamId, players };
}

// With every rating at 50 (league average), calibrateOutcomeProbabilities
// returns exactly the spec's base per-trip distribution, in this key order:
// miss_off_reb [0, .10], make_2 (.10, .40], make_3 (.40, .50],
// ft_trip (.50, .55], turnover (.55, .68], miss_def_reb (.68, 1].
const OUTCOME_ROLL = {
  miss_off_reb: 0.05,
  make_2: 0.25,
  make_3: 0.45,
  ft_trip: 0.52,
  turnover: 0.6,
  miss_def_reb: 0.8,
};

describe('simulateTrip', () => {
  it('simulates a made 2 with an assist', () => {
    const offense = team('off', [
      player({ id: 'shooter', usageRate: 1, threePointRate: 0 }),
      player({ id: 'passer', assistRate: 1 }),
    ]);
    const defense = team('def', [player({ id: 'd1' })]);
    // Sequence: outcome, shooter pick, shot-zone pick, assist roll, assister pick.
    const rand = createFixedRandom([OUTCOME_ROLL.make_2, 0.5, 0.5, 0.1, 0.5]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.outcome).toBe('make_2');
    expect(result.points).toBe(2);
    expect(result.shooterId).toBe('shooter');
    expect(result.isThreePointAttempt).toBe(false);
    expect(result.assisterId).toBe('passer');
    expect(result.playType).toBe('two_pointer_made');
    expect(result.startLocation).toBe('paint');
    expect(result.endLocation).toBe('paint');
  });

  it('simulates a made 3 with no assist', () => {
    const offense = team('off', [
      player({ id: 'shooter', usageRate: 1, threePointRate: 1 }),
      player({ id: 'passer', assistRate: 1 }),
    ]);
    const defense = team('def', [player({ id: 'd1' })]);
    // Sequence: outcome, shooter pick, shot-zone pick (0.5 -> index 1 -> three_right), assist roll (fails).
    const rand = createFixedRandom([OUTCOME_ROLL.make_3, 0.5, 0.5, 0.9]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.outcome).toBe('make_3');
    expect(result.points).toBe(3);
    expect(result.shooterId).toBe('shooter');
    expect(result.isThreePointAttempt).toBe(true);
    expect(result.assisterId).toBeUndefined();
    expect(result.playType).toBe('three_pointer_made');
    expect(result.startLocation).toBe('three_right');
    expect(result.endLocation).toBe('paint');
  });

  it('simulates a turnover with a live-ball steal', () => {
    const offense = team('off', [player({ id: 'ballhandler', usageRate: 1 })]);
    const defense = team('def', [player({ id: 'defender', stealRate: 1 })]);
    const rand = createFixedRandom([OUTCOME_ROLL.turnover, 0.5, 0.1, 0.5]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.outcome).toBe('turnover');
    expect(result.points).toBe(0);
    expect(result.turnoverPlayerId).toBe('ballhandler');
    expect(result.stealPlayerId).toBe('defender');
    expect(result.playType).toBe('steal');
    expect(result.startLocation).toBe('mid_range');
    expect(result.endLocation).toBe('backcourt');
  });

  it('simulates a turnover with no steal', () => {
    const offense = team('off', [player({ id: 'ballhandler', usageRate: 1 })]);
    const defense = team('def', [player({ id: 'defender', stealRate: 1 })]);
    const rand = createFixedRandom([OUTCOME_ROLL.turnover, 0.5, 0.9]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.stealPlayerId).toBeUndefined();
    expect(result.playType).toBe('turnover');
  });

  it('simulates a defensive-rebound miss with a block', () => {
    const offense = team('off', [player({ id: 'shooter', usageRate: 1, threePointRate: 1 })]);
    const defense = team('def', [player({ id: 'defender', blockRate: 1, reboundRate: 1 })]);
    // Sequence: outcome, shooter pick, isThree roll, shot-zone pick (0.7 -> index 2 -> three_top), block roll, block-player pick, rebounder pick.
    const rand = createFixedRandom([OUTCOME_ROLL.miss_def_reb, 0.5, 0.05, 0.7, 0.1, 0.5, 0.5]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.outcome).toBe('miss_def_reb');
    expect(result.points).toBe(0);
    expect(result.shooterId).toBe('shooter');
    expect(result.isThreePointAttempt).toBe(true);
    expect(result.blockPlayerId).toBe('defender');
    expect(result.reboundPlayerId).toBe('defender');
    expect(result.playType).toBe('block');
    expect(result.startLocation).toBe('three_top');
    expect(result.endLocation).toBe('paint');
  });

  it('simulates a defensive-rebound miss with no block', () => {
    const offense = team('off', [player({ id: 'shooter', usageRate: 1, threePointRate: 0 })]);
    const defense = team('def', [player({ id: 'defender', blockRate: 1, reboundRate: 1 })]);
    // Sequence: outcome, shooter pick, isThree roll, shot-zone pick, block roll (fails), rebounder pick.
    const rand = createFixedRandom([OUTCOME_ROLL.miss_def_reb, 0.5, 0.9, 0.2, 0.9, 0.5]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.blockPlayerId).toBeUndefined();
    // Not blocked, so it's described by shot type — no standalone
    // "defensive_rebound" play type; see the PlayType doc comment for why.
    expect(result.playType).toBe('two_pointer_missed');
  });

  it('simulates an offensive-rebound miss (possession continues)', () => {
    const offense = team('off', [player({ id: 'shooter', usageRate: 1, threePointRate: 0, reboundRate: 1 })]);
    const defense = team('def', [player({ id: 'defender' })]);
    // Sequence: outcome, shooter pick, isThree roll, shot-zone pick (0.8 >= 0.6 -> mid_range), rebounder pick.
    const rand = createFixedRandom([OUTCOME_ROLL.miss_off_reb, 0.5, 0.9, 0.8, 0.5]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.outcome).toBe('miss_off_reb');
    expect(result.isThreePointAttempt).toBe(false);
    expect(result.reboundPlayerId).toBe('shooter');
    expect(result.playType).toBe('offensive_rebound');
    expect(result.startLocation).toBe('mid_range');
    expect(result.endLocation).toBe('paint');
  });

  it('simulates a shooting-foul free-throw trip', () => {
    const offense = team('off', [player({ id: 'shooter', usageRate: 1, freeThrowPct: 1 })]);
    const defense = team('def', [player({ id: 'defender' })]);
    const rand = createFixedRandom([OUTCOME_ROLL.ft_trip, 0.5, 0.9, 0.1, 0.1]);

    const result = simulateTrip(offense, defense, computeTeamRatings(offense, LEAGUE_AVG_PPP), computeTeamRatings(defense, LEAGUE_AVG_PPP), rand);

    expect(result.outcome).toBe('ft_trip');
    expect(result.shooterId).toBe('shooter');
    expect(result.freeThrowsAttempted).toBe(2);
    expect(result.freeThrowsMade).toBe(2);
    expect(result.points).toBe(2);
    expect(result.playType).toBe('free_throw');
    expect(result.startLocation).toBe('free_throw_line');
    expect(result.endLocation).toBe('paint');
  });
});

describe('simulateTrip shot-zone distribution', () => {
  it('spreads made threes roughly evenly across the three 3PT zones over many trips', () => {
    const offense = team('off', [
      player({ id: 'shooter', usageRate: 1, threePointRate: 1 }),
      player({ id: 'teammate', assistRate: 1 }),
    ]);
    const defense = team('def', [player({ id: 'defender' })]);
    const offenseRatings = computeTeamRatings(offense, LEAGUE_AVG_PPP);
    const defenseRatings = computeTeamRatings(defense, LEAGUE_AVG_PPP);
    const rand = createSeededRandom(12345);

    const zoneCounts: Record<string, number> = {};
    let threes = 0;
    for (let i = 0; i < 3000; i++) {
      const result = simulateTrip(offense, defense, offenseRatings, defenseRatings, rand);
      if (result.outcome === 'make_3') {
        threes++;
        zoneCounts[result.startLocation] = (zoneCounts[result.startLocation] ?? 0) + 1;
      }
    }

    expect(threes).toBeGreaterThan(100);
    for (const zone of ['three_left', 'three_right', 'three_top']) {
      const share = (zoneCounts[zone] ?? 0) / threes;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.41);
    }
  });

  it('favors the paint over mid-range for made 2s, roughly matching the documented split', () => {
    const offense = team('off', [
      player({ id: 'shooter', usageRate: 1, threePointRate: 0 }),
      player({ id: 'teammate', assistRate: 1 }),
    ]);
    const defense = team('def', [player({ id: 'defender' })]);
    const offenseRatings = computeTeamRatings(offense, LEAGUE_AVG_PPP);
    const defenseRatings = computeTeamRatings(defense, LEAGUE_AVG_PPP);
    const rand = createSeededRandom(777);

    let paint = 0;
    let midRange = 0;
    for (let i = 0; i < 3000; i++) {
      const result = simulateTrip(offense, defense, offenseRatings, defenseRatings, rand);
      if (result.outcome === 'make_2') {
        if (result.startLocation === 'paint') paint++;
        else if (result.startLocation === 'mid_range') midRange++;
      }
    }

    const paintShare = paint / (paint + midRange);
    expect(paintShare).toBeGreaterThan(0.5);
    expect(paintShare).toBeLessThan(0.7);
  });
});
