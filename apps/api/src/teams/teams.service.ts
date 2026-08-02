import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TeamDto {
  id: string;
  name: string;
  colorHex: string;
}

/**
 * Small, dedicated endpoint for populating the spec 4e era/team narrowing
 * picker on the match-creation settings screen — deliberately separate
 * from the legacy/interim `GET /players` (which returns 84 stint rows,
 * not a clean 12-team list, and is itself superseded — see README).
 */
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(sport: 'nba' | 'nfl'): Promise<TeamDto[]> {
    const teams = await this.prisma.team.findMany({ where: { sport }, orderBy: { name: 'asc' } });
    return teams.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex }));
  }
}
