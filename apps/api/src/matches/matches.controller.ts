import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../session/current-user.decorator';
import { SessionGuard } from '../session/session.guard';
import { User } from '@prisma/client';
import { CreateMatchRequest, CreateMatchResponse, GameResultDto, MatchStateDto, PickResultDto } from './dto';
import { MatchesService } from './matches.service';

@Controller('matches')
@UseGuards(SessionGuard)
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: CreateMatchRequest): Promise<CreateMatchResponse> {
    return this.matches.createMatch(user, body);
  }

  @Post(':roomCode/join')
  join(@Param('roomCode') roomCode: string, @CurrentUser() user: User): Promise<CreateMatchResponse> {
    return this.matches.joinMatch(roomCode, user);
  }

  @Get(':roomCode')
  getState(@Param('roomCode') roomCode: string, @CurrentUser() user: User): Promise<MatchStateDto> {
    return this.matches.getMatchState(roomCode, user);
  }

  /** Locks in a pick for the current round (spec 4c step 4). `position` is required only when the player has more than one eligible open position — see PickResultDto. */
  @Post('roster/:rosterId/pick')
  pick(@Param('rosterId') rosterId: string, @CurrentUser() user: User, @Body() body: { stintId: string; position?: string }): Promise<PickResultDto> {
    return this.matches.pickPlayer(rosterId, user, body.stintId, body.position);
  }

  @Post('roster/:rosterId/respin')
  respin(@Param('rosterId') rosterId: string, @CurrentUser() user: User, @Body() body: { type: 'team' | 'era' }): Promise<MatchStateDto> {
    return this.matches.respinCurrentRound(rosterId, user, body.type);
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
