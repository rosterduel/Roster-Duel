import { Prisma } from '@prisma/client';
import { SlottedStint, StintWithStatsAndRating, toPlayerRatingInput, toTeamInput } from './toTeamInput';

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
    eligiblePositions: ['PG'],
    teamId: 'team-1',
    era: 'nineties',
    stintStartYear: 1993,
    stintEndYear: 1997,
    isActive: false,
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

function makeSlotted(overrides: Partial<StintWithStatsAndRating> = {}, slotPosition: SlottedStint['slotPosition'] = 'PG'): SlottedStint {
  return { stint: makeStint(overrides), slotPosition };
}

describe('toPlayerRatingInput', () => {
  it('maps offense/defense/usage from player_stint_ratings and attribution rates from player_stint_stats', () => {
    const slotted = makeSlotted();
    const input = toPlayerRatingInput(slotted);

    expect(input).toEqual({
      id: slotted.stint.id,
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

  it('labels the player with the drafted SLOT position, not their eligiblePositions', () => {
    // Eligible for SF/PF/SG, but drafted into the PF slot on this roster.
    const slotted = makeSlotted({ eligiblePositions: ['SF', 'PF', 'SG'] }, 'PF');
    const input = toPlayerRatingInput(slotted);
    expect(input.position).toBe('PF');
  });

  it('throws if the stint has no computed rating', () => {
    const slotted = makeSlotted({ rating: null });
    expect(() => toPlayerRatingInput(slotted)).toThrow(/no computed rating/);
  });

  it('throws for a non-NBA slot position', () => {
    const slotted = { stint: makeStint(), slotPosition: 'QB' } as unknown as SlottedStint;
    expect(() => toPlayerRatingInput(slotted)).toThrow(/non-NBA slot/);
  });

  it('throws if a required stat is missing', () => {
    const slotted = makeSlotted({ stats: [stat('stint-1', 'ast_rate', 0.3)] });
    expect(() => toPlayerRatingInput(slotted)).toThrow(/missing required stat "reb_rate"/);
  });
});

describe('toTeamInput', () => {
  it('wraps mapped stints with team identity', () => {
    const slottedStints = [makeSlotted({ id: 's1', name: 'A' }, 'PG'), makeSlotted({ id: 's2', name: 'B' }, 'SG')];
    const team = toTeamInput('team-a', 'Team Alpha', slottedStints);

    expect(team.teamId).toBe('team-a');
    expect(team.teamName).toBe('Team Alpha');
    expect(team.players).toHaveLength(2);
    expect(team.players.map((p) => p.name)).toEqual(['A', 'B']);
  });
});
