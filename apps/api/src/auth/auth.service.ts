import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { checkCredentials } from './credentials';
import { LoginThrottle } from './loginThrottle';
import { hashPassword, verifyPassword } from './password';

export interface AccountUser {
  id: string;
  displayName: string;
  email: string | null;
  resultEmails: boolean;
}

export interface AuthResult {
  /** The new X-Session-Token for this browser. The client must replace its stored token with it. */
  token: string;
  user: AccountUser;
  /** Log-in only: how many of this browser's anonymous games were moved onto the account. */
  movedGames?: number;
}

export function toAccountUser(user: User): AccountUser {
  return { id: user.id, displayName: user.displayName, email: user.email ?? null, resultEmails: user.resultEmails };
}

@Injectable()
export class AuthService {
  private readonly throttle = new LoginThrottle();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Turns the browser's current anonymous player into an account, so every
   * game it already played stays on the account. The old client-chosen
   * token is retired (replaced by a random value nobody holds) and a
   * server-generated session token takes over for this browser.
   */
  async signUp(user: User, rawEmail: unknown, rawPassword: unknown): Promise<AuthResult> {
    if (user.email) {
      throw new ConflictException(`You're already signed in as ${user.email}.`);
    }
    const creds = checkCredentials(rawEmail, rawPassword);
    if (!creds.valid) throw new UnprocessableEntityException(creds.reason);

    const passwordHash = await hashPassword(creds.password);
    const token = randomUUID();
    try {
      const [updated] = await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: user.id },
          data: { email: creds.email, passwordHash, sessionToken: randomUUID() },
        }),
        this.prisma.authSession.create({ data: { token, userId: user.id } }),
      ]);
      return { token, user: toAccountUser(updated) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An account with that email already exists. Log in instead.');
      }
      throw err;
    }
  }

  /**
   * Signs this browser in to an existing account. If the browser was an
   * anonymous player, its games move onto the account so nothing played
   * before logging in is lost.
   */
  async logIn(currentUser: User, currentToken: string, rawEmail: unknown, rawPassword: unknown): Promise<AuthResult> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const password = typeof rawPassword === 'string' ? rawPassword : '';
    if (!email || !password) throw new UnprocessableEntityException('Enter your email and password.');

    if (this.throttle.isBlocked(email)) {
      throw new HttpException('Too many wrong passwords. Try again in a few minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const account = await this.prisma.user.findUnique({ where: { email } });
    let ok = false;
    if (account?.passwordHash) {
      ok = await verifyPassword(password, account.passwordHash);
    } else {
      // Same amount of work as a real check, so response time doesn't reveal which emails have accounts.
      await hashPassword(password);
    }
    if (!account || !ok) {
      this.throttle.recordFailure(email);
      throw new UnauthorizedException("That email and password don't match.");
    }
    this.throttle.reset(email);

    let movedGames = 0;
    if (currentUser.id !== account.id && !currentUser.email) {
      const moved = await this.prisma.roster.updateMany({ where: { userId: currentUser.id }, data: { userId: account.id } });
      movedGames = moved.count;
    }

    const token = randomUUID();
    await this.prisma.$transaction([
      // If this browser was signed in to some account already, that session ends here.
      this.prisma.authSession.deleteMany({ where: { token: currentToken } }),
      this.prisma.authSession.create({ data: { token, userId: account.id } }),
    ]);
    return { token, user: toAccountUser(account), movedGames };
  }

  /** Ends this browser's signed-in session. The client then starts a fresh anonymous token. */
  async logOut(currentToken: string): Promise<{ ok: true }> {
    await this.prisma.authSession.deleteMany({ where: { token: currentToken } });
    return { ok: true };
  }
}
