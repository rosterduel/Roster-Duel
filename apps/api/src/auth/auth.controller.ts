import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../session/current-user.decorator';
import { RequestWithUser, SessionGuard } from '../session/session.guard';
import { User } from '@prisma/client';
import { AuthResult, AuthService } from './auth.service';

interface CredentialsBody {
  email?: unknown;
  password?: unknown;
}

@Controller('auth')
@UseGuards(SessionGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signUp(@CurrentUser() user: User, @Body() body: CredentialsBody): Promise<AuthResult> {
    return this.auth.signUp(user, body?.email, body?.password);
  }

  @Post('login')
  @HttpCode(200)
  logIn(@CurrentUser() user: User, @Req() req: RequestWithUser, @Body() body: CredentialsBody): Promise<AuthResult> {
    return this.auth.logIn(user, req.sessionToken, body?.email, body?.password);
  }

  @Post('logout')
  @HttpCode(200)
  logOut(@Req() req: RequestWithUser): Promise<{ ok: true }> {
    return this.auth.logOut(req.sessionToken);
  }
}
