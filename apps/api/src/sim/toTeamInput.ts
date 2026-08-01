import { Player, PlayerRating, PlayerStat } from '@prisma/client';
import { NbaPosition, PlayerRatingInput, TeamInput } from '@roster-duel/sim-engine';

export type PlayerWithStatsAndRating = Player & {
  stats: PlayerStat[];
  rating: PlayerRating | null;
};

export const NBA_POSITIONS: readonly NbaPosition[] = ['PG', 'SG', 'SF', 'PF', 'C', '6MAN'];

export function isNbaPosition(value: string): value is NbaPosition {
  return (NBA_POSITIONS as readonly string[]).includes(value);
}

/**
 * Maps a seeded Player (with its stats and computed rating) into the shape
 * the sim engine's PlayerRatingInput expects. offense/defense ratings and
 * usage_rate come from player_ratings (computed offline); the per-trip
 * attribution rates come from player_stats, matching how the seed script
 * stored them (see prisma/seed.ts and computeRatings.ts for the split).
 */
export function toPlayerRatingInput(player: PlayerWithStatsAndRating): PlayerRatingInput {
  if (!player.rating) {
    throw new Error(`Player "${player.name}" (${player.id}) has no computed rating — run the seed/rating pipeline first.`);
  }
  if (!isNbaPosition(player.primaryPosition)) {
    throw new Error(`Player "${player.name}" has non-NBA position "${player.primaryPosition}" — this adapter is NBA-only for Phase 1.`);
  }

  const statByKey = new Map(player.stats.map((s) => [s.statKey, Number(s.statValue)]));
  const requiredStat = (key: string): number => {
    const value = statByKey.get(key);
    if (value === undefined) {
      throw new Error(`Player "${player.name}" is missing required stat "${key}"`);
    }
    return value;
  };

  return {
    id: player.id,
    name: player.name,
    position: player.primaryPosition,
    offenseRating: Number(player.rating.offenseRating),
    defenseRating: Number(player.rating.defenseRating),
    usageRate: Number(player.rating.usageRate),
    assistRate: requiredStat('ast_rate'),
    reboundRate: requiredStat('reb_rate'),
    stealRate: requiredStat('stl_rate'),
    blockRate: requiredStat('blk_rate'),
    threePointRate: requiredStat('three_pt_rate'),
    freeThrowPct: requiredStat('ft_pct'),
  };
}

export function toTeamInput(teamId: string, teamName: string, players: PlayerWithStatsAndRating[]): TeamInput {
  return {
    teamId,
    teamName,
    players: players.map(toPlayerRatingInput),
  };
}
