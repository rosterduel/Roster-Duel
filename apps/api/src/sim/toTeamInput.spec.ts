import { Prisma } from '@prisma/client';
import { PlayerWithStatsAndRating, toPlayerRatingInput, toTeamInput } from './toTeamInput';

function stat(playerId: string, statKey: string, value: number): PlayerWithStatsAndRating['stats'][number] {
  return {
    id: `${playerId}-${statKey}`,
    playerId,
    statKey,
    statValue: new Prisma.Decimal(value),
    scope: 'career',
  };
}

function makePlayer(overrides: Partial<PlayerWithStatsAndRating> = {}): PlayerWithStatsAndRating {
  const id = overrides.id ?? 'player-1';
  return {
    id,
    sport: 'nba',
    name: 'Test Player',
    primaryPosition: 'PG',
    eraStartYear: 2000,
    eraEndYear: 2015,
    isActive: false,
    photoUrl: null,
    stats: [
      stat(id, 'ast_rate', 0.3),
      stat(id, 'reb_rate', 0.08),
      stat(id, 'stl_rate', 0.02),
      stat(id, 'blk_rate', 0.01),
      stat(id, 'three_pt_rate', 0.25),
      stat(id, 'ft_pct', 0.85),
    ],
    rating: {
      playerId: id,
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
  it('maps offense/defense/usage from player_ratings and attribution rates from player_stats', () => {
    const player = makePlayer();
    const input = toPlayerRatingInput(player);

    expect(input).toEqual({
      id: player.id,
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

  it('throws if the player has no computed rating', () => {
    const player = makePlayer({ rating: null });
    expect(() => toPlayerRatingInput(player)).toThrow(/no computed rating/);
  });

  it('throws for a non-NBA position', () => {
    const player = makePlayer({ primaryPosition: 'QB' });
    expect(() => toPlayerRatingInput(player)).toThrow(/non-NBA position/);
  });

  it('throws if a required stat is missing', () => {
    const player = makePlayer({ stats: [stat('player-1', 'ast_rate', 0.3)] });
    expect(() => toPlayerRatingInput(player)).toThrow(/missing required stat "reb_rate"/);
  });
});

describe('toTeamInput', () => {
  it('wraps mapped players with team identity', () => {
    const players = [makePlayer({ id: 'p1', name: 'A' }), makePlayer({ id: 'p2', name: 'B', primaryPosition: 'SG' })];
    const team = toTeamInput('team-a', 'Team Alpha', players);

    expect(team.teamId).toBe('team-a');
    expect(team.teamName).toBe('Team Alpha');
    expect(team.players).toHaveLength(2);
    expect(team.players.map((p) => p.name)).toEqual(['A', 'B']);
  });
});
