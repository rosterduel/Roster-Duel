import { Prisma } from '@prisma/client';
import { StintWithStatsAndRating, toPlayerRatingInput, toTeamInput } from './toTeamInput';

function stat(stintId: string, statKey: string, value: number): StintWithStatsAndRating['stats'][number] {
  return {
    id: `${stintId}-${statKey}`,
    stintId,
    statKey,
    statValue: new Prisma.Decimal(value),
    scope: 'stint',
    estimateReason: null,
  };
}

function makeStint(overrides: Partial<StintWithStatsAndRating> = {}): StintWithStatsAndRating {
  const id = overrides.id ?? 'stint-1';
  return {
    id,
    sport: 'nba',
    personKey: 'test_player',
    name: 'Test Player',
    primaryPosition: 'PG',
    teamId: 'team-1',
    era: 'nineties',
    stintStartYear: 1993,
    stintEndYear: 1997,
    isActive: false,
    skinTone: 'medium',
    stats: [
      stat(id, 'ast_rate', 0.3),
      stat(id, 'reb_rate', 0.08),
      stat(id, 'stl_rate', 0.02),
      stat(id, 'blk_rate', 0.01),
      stat(id, 'three_pt_rate', 0.25),
      stat(id, 'ft_pct', 0.85),
    ],
    rating: {
      stintId: id,
      baseRating: new Prisma.Decimal(60),
      offenseRating: new Prisma.Decimal(65),
      defenseRating: new Prisma.Decimal(52),
      clutchModifier: new Prisma.Decimal(1.0),
      usageRate: new Prisma.Decimal(0.24),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

describe('toPlayerRatingInput', () => {
  it('maps offense/defense/usage from player_stint_ratings and attribution rates from player_stint_stats', () => {
    const stint = makeStint();
    const input = toPlayerRatingInput(stint);

    expect(input).toEqual({
      id: stint.id,
      name: 'Test Player',
      position: 'PG',
      offenseRating: 65,
      defenseRating: 52,
      usageRate: 0.24,
      assistRate: 0.3,
      reboundRate: 0.08,
      stealRate: 0.02,
      blockRate: 0.01,
      threePointRate: 0.25,
      freeThrowPct: 0.85,
    });
  });

  it('throws if the stint has no computed rating', () => {
    const stint = makeStint({ rating: null });
    expect(() => toPlayerRatingInput(stint)).toThrow(/no computed rating/);
  });

  it('throws for a non-NBA position', () => {
    const stint = makeStint({ primaryPosition: 'QB' });
    expect(() => toPlayerRatingInput(stint)).toThrow(/non-NBA position/);
  });

  it('throws if a required stat is missing', () => {
    const stint = makeStint({ stats: [stat('stint-1', 'ast_rate', 0.3)] });
    expect(() => toPlayerRatingInput(stint)).toThrow(/missing required stat "reb_rate"/);
  });
});

describe('toTeamInput', () => {
  it('wraps mapped stints with team identity', () => {
    const stints = [makeStint({ id: 's1', name: 'A' }), makeStint({ id: 's2', name: 'B', primaryPosition: 'SG' })];
    const team = toTeamInput('team-a', 'Team Alpha', stints);

    expect(team.teamId).toBe('team-a');
    expect(team.teamName).toBe('Team Alpha');
    expect(team.players).toHaveLength(2);
    expect(team.players.map((p) => p.name)).toEqual(['A', 'B']);
  });
});
