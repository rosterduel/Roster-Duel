import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlayerSummaryDto {
  id: string;
  name: string;
  position: string;
  eraStartYear: number;
  eraEndYear: number | null;
  isActive: boolean;
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

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForDraft(sport: 'nba' | 'nfl'): Promise<PlayerSummaryDto[]> {
    const players = await this.prisma.player.findMany({
      where: { sport },
      include: { stats: true, rating: true },
      orderBy: { name: 'asc' },
    });

    return players
      .filter((p) => p.rating !== null)
      .map((p) => ({
        id: p.id,
        name: p.name,
        position: p.primaryPosition,
        eraStartYear: p.eraStartYear,
        eraEndYear: p.eraEndYear,
        isActive: p.isActive,
        baseRating: Number(p.rating!.baseRating),
        offenseRating: Number(p.rating!.offenseRating),
        defenseRating: Number(p.rating!.defenseRating),
        clutchModifier: Number(p.rating!.clutchModifier),
        stats: Object.fromEntries(p.stats.map((s) => [s.statKey, Number(s.statValue)])),
      }));
  }
}
