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

/** A stint paired with the roster SLOT it was actually drafted into. */
export interface SlottedStint {
  stint: StintWithStatsAndRating;
  slotPosition: NbaPosition;
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
 *
 * `slotPosition` — NOT a property read off the stint — is what this player
 * plays and is labeled as for THIS game (box score, sim bookkeeping). Spec
 * 4f made this necessary: a stint's `eligiblePositions` can list several
 * real positions (e.g. LeBron: SF/PF/SG), and which one he's actually
 * playing is determined by which roster slot he was drafted into, not any
 * property of the stint itself. The caller (matches.service.ts) is
 * responsible for passing the roster's own slot assignment here.
 */
export function toPlayerRatingInput({ stint, slotPosition }: SlottedStint): PlayerRatingInput {
  if (!stint.rating) {
    throw new Error(`Stint "${stint.name}" (${stint.id}) has no computed rating — run the seed/rating pipeline first.`);
  }
  if (!isNbaPosition(slotPosition)) {
    throw new Error(`Stint "${stint.name}" was drafted into non-NBA slot "${slotPosition}" — this adapter is NBA-only for Phase 1.`);
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
    position: slotPosition,
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

export function toTeamInput(teamId: string, teamName: string, slottedStints: SlottedStint[]): TeamInput {
  return {
    teamId,
    teamName,
    players: slottedStints.map(toPlayerRatingInput),
  };
}
