import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController, LeaderboardController],
  providers: [StatsService],
})
export class StatsModule {}
