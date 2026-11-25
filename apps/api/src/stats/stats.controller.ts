import { Controller, Get, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../session/current-user.decorator';
import { SessionGuard } from '../session/session.guard';
import { MatchHistory } from './matchHistory';
import { UserRecord } from './recordStats';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(SessionGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('me')
  getMyRecord(@CurrentUser() user: User): Promise<UserRecord> {
    return this.stats.getUserRecord(user.id);
  }

  @Get('me/history')
  getMyHistory(@CurrentUser() user: User): Promise<MatchHistory> {
    return this.stats.getMatchHistory(user.id);
  }
}
