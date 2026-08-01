import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PlayerSummaryDto, PlayersService } from './players.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get()
  async list(@Query('sport') sport = 'nba'): Promise<PlayerSummaryDto[]> {
    if (sport !== 'nba') {
      // NFL isn't seeded/supported yet — Phase 1 is NBA-only (spec section 11).
      throw new BadRequestException(`Unsupported sport "${sport}" — only "nba" is available in Phase 1.`);
    }
    return this.players.findAllForDraft('nba');
  }
}
