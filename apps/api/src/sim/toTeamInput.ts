import { PlayerStint, PlayerStintRating, PlayerStintStat } from '@prisma/client';
import { NbaPosition, PlayerRatingInput, TeamInput } from '@roster-duel/sim-engine';

export type StintWithStatsAndRating = PlayerStint & {
  stats: PlayerStintStat[];
  rating: PlayerStintRating | null;
};

export const NBA_POSITIONS: readonly NbaPosition[] = ['PG', 'SG', 'SF', 'PF', 'C', '6MAN'];

export function isNbaPosition(value: string): value is NbaPosition {
  return (NBA_POSITIONS as readonly string[]).includes(value);
}

/**
 * Maps a seeded PlayerStint (with its stint-scoped stats and computed
 * rating — see schema.prisma's PlayerStint doc comment for why a stint,
 * not a career player, is the draftable unit as of spec section 4c) into
 * the shape the sim engine's PlayerRatingInput expects. offense/defense
 * ratings and usage_rate come from player_stint_ratings (computed
 * offline); the per-trip attribution rates come from player_stint_stats,
 * matching how the seed script stored them (see prisma/seed.ts and
 * computeRatings.ts for the split). The sim engine itself is unaware this
 * ID refers to a stint rather than a person — nothing downstream of this
 * adapter needed to change.
 */
export function toPlayerRatingInput(stint: StintWithStatsAndRating): PlayerRatingInput {
  if (!stint.rating) {
    throw new Error(`Stint "${stint.name}" (${stint.id}) has no computed rating — run the seed/rating pipeline first.`);
  }
  if (!isNbaPosition(stint.primaryPosition)) {
    throw new Error(`Stint "${stint.name}" has non-NBA position "${stint.primaryPosition}" — this adapter is NBA-only for Phase 1.`);
  }

  const statByKey = new Map(stint.stats.map((s) => [s.statKey, Number(s.statValue)]));
  const requiredStat = (key: string): number => {
    const value = statByKey.get(key);
    if (value === undefined) {
      throw new Error(`Stint "${stint.name}" is missing required stat "${key}"`);
    }
    return value;
  };

  return {
    id: stint.id,
    name: stint.name,
    position: stint.primaryPosition,
    offenseRating: Number(stint.rating.offenseRating),
    defenseRating: Number(stint.rating.defenseRating),
    usageRate: Number(stint.rating.usageRate),
    assistRate: requiredStat('ast_rate'),
    reboundRate: requiredStat('reb_rate'),
    stealRate: requiredStat('stl_rate'),
    blockRate: requiredStat('blk_rate'),
    threePointRate: requiredStat('three_pt_rate'),
    freeThrowPct: requiredStat('ft_pct'),
  };
}

export function toTeamInput(teamId: string, teamName: string, stints: StintWithStatsAndRating[]): TeamInput {
  return {
    teamId,
    teamName,
    players: stints.map(toPlayerRatingInput),
  };
}
