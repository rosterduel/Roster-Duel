import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../session/current-user.decorator';
import { SessionGuard } from '../session/session.guard';
import { UsersService } from './users.service';

interface PublicUser {
  id: string;
  displayName: string;
}

function toPublicUser(user: User): PublicUser {
  return { id: user.id, displayName: user.displayName };
}

@Controller('users')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: User): PublicUser {
    return toPublicUser(user);
  }

  @Patch('me/display-name')
  async changeDisplayName(@CurrentUser() user: User, @Body() body: { displayName?: string }): Promise<PublicUser> {
    const updated = await this.users.changeDisplayName(user, body?.displayName ?? '');
    return toPublicUser(updated);
  }
}
