import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../session/current-user.decorator';
import { SessionGuard } from '../session/session.guard';
import { User } from '@prisma/client';
import { CreateMatchResponse, GameResultDto, MatchStateDto } from './dto';
import { MatchesService } from './matches.service';

@Controller('matches')
@UseGuards(SessionGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: { draftTimerSeconds?: number }): Promise<CreateMatchResponse> {
    return this.matches.createMatch(user, body?.draftTimerSeconds);
  }

  @Post(':roomCode/join')
  join(@Param('roomCode') roomCode: string, @CurrentUser() user: User): Promise<CreateMatchResponse> {
    return this.matches.joinMatch(roomCode, user);
  }

  @Get(':roomCode')
  getState(@Param('roomCode') roomCode: string, @CurrentUser() user: User): Promise<MatchStateDto> {
    return this.matches.getMatchState(roomCode, user);
  }

  @Post('roster/:rosterId/slots')
  saveSlots(@Param('rosterId') rosterId: string, @CurrentUser() user: User, @Body() body: { slots?: Record<string, string> }): Promise<{ ok: true }> {
    return this.matches.saveDraftSlots(rosterId, user, body?.slots ?? {}).then(() => ({ ok: true as const }));
  }

  @Post('roster/:rosterId/lock')
  lock(@Param('rosterId') rosterId: string, @CurrentUser() user: User): Promise<MatchStateDto> {
    return this.matches.lockRoster(rosterId, user);
  }

  @Post(':roomCode/recap')
  regenerateRecap(@Param('roomCode') roomCode: string): Promise<GameResultDto> {
    return this.matches.regenerateRecap(roomCode);
  }
}
