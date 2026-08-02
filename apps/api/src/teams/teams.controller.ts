import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { TeamDto, TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  async list(@Query('sport') sport = 'nba'): Promise<TeamDto[]> {
    if (sport !== 'nba') {
      throw new BadRequestException(`Unsupported sport "${sport}" — only "nba" is available in Phase 1.`);
    }
    return this.teams.findAll('nba');
  }
}
