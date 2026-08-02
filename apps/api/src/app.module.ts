import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PlayersModule } from './players/players.module';
import { MatchesModule } from './matches/matches.module';
import { UsersModule } from './users/users.module';
import { StatsModule } from './stats/stats.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [PrismaModule, PlayersModule, MatchesModule, UsersModule, StatsModule, TeamsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
