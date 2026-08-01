import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlayerSummaryDto {
  id: string;
  name: string;
  position: string;
  /** Cross-stint identity — see schema.prisma's PlayerStint doc comment. Needed client-side for the spec 4c "no duplicate real person" rule, landing in the draft-flow rework. */
  personKey: string;
  teamId: string;
  teamName: string;
  teamColorHex: string;
  era: string;
  stintStartYear: number;
  stintEndYear: number;
  isActive: boolean;
  skinTone: string;
  baseRating: number;
  offenseRating: number;
  defenseRating: number;
  clutchModifier: number;
  /**
   * Every stat we have for this player, flat statKey -> value. Which subset
   * to headline per position (spec section 8) is explicitly a display-only
   * concern, not something the backend decides — the frontend picks which
   * keys to show first per position, but nothing is filtered out here.
   */
  stats: Record<string, number>;
}

/**
 * INTERIM behavior notice: this still returns every stint at a position
 * across all teams/eras undifferentiated — the exact "free browse" shape
 * spec section 4c replaces with randomized team+era assignment. Kept
 * working in this shape only so the app stays functional end-to-end
 * through the data-model rebuild; the draft-flow step rebuilds this into
 * team+era-scoped endpoints (and the frontend that consumes them). See
 * README "Draft flow & matchmaking" for the full sequencing.
 */
@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForDraft(sport: 'nba' | 'nfl'): Promise<PlayerSummaryDto[]> {
    const stints = await this.prisma.playerStint.findMany({
      where: { sport },
      include: { stats: true, rating: true, team: true },
      orderBy: { name: 'asc' },
    });

    return stints
      .filter((s) => s.rating !== null)
      .map((s) => ({
        id: s.id,
        name: s.name,
        position: s.primaryPosition,
        personKey: s.personKey,
        teamId: s.teamId,
        teamName: s.team.name,
        teamColorHex: s.team.colorHex,
        era: s.era,
        stintStartYear: s.stintStartYear,
        stintEndYear: s.stintEndYear,
        isActive: s.isActive,
        skinTone: s.skinTone,
        baseRating: Number(s.rating!.baseRating),
        offenseRating: Number(s.rating!.offenseRating),
        defenseRating: Number(s.rating!.defenseRating),
        clutchModifier: Number(s.rating!.clutchModifier),
        stats: Object.fromEntries(s.stats.map((stat) => [stat.statKey, Number(stat.statValue)])),
      }));
  }
}
