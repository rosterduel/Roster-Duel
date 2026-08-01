import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../session/session.guard';
import { LeaderboardEntry } from './recordStats';
import { StatsService } from './stats.service';

@Controller('leaderboard')
@UseGuards(SessionGuard)
export class LeaderboardController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  getLeaderboard(@Query('limit') limit?: string): Promise<LeaderboardEntry[]> {
    const parsed = limit ? Number(limit) : undefined;
    return this.stats.getLeaderboard(parsed && Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : undefined);
  }
}
