import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../session/current-user.decorator';
import { SessionGuard } from '../session/session.guard';
import { UsersService } from './users.service';

// Only ever returned to the user it describes (/users/me), so including the
// account email is fine.
interface PublicUser {
  id: string;
  displayName: string;
  email: string | null;
  /** Whether "your matchup is ready" emails go to the account email. */
  resultEmails: boolean;
}

function toPublicUser(user: User): PublicUser {
  return { id: user.id, displayName: user.displayName, email: user.email ?? null, resultEmails: user.resultEmails };
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

  @Patch('me/result-emails')
  async setResultEmails(@CurrentUser() user: User, @Body() body: { enabled?: unknown }): Promise<PublicUser> {
    const updated = await this.users.setResultEmails(user, body?.enabled === true);
    return toPublicUser(updated);
  }
}
