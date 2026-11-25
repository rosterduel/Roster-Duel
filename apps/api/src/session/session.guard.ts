import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_HEADER = 'x-session-token';
// A UUID is client-generated (crypto.randomUUID()) — loosely validate the
// shape so this can't be used to smuggle arbitrary strings into the column.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_GENERATION_ATTEMPTS = 5;

export interface RequestWithUser extends Request {
  user: User;
  /** The X-Session-Token this request came with (needed to log this browser out). */
  sessionToken: string;
}

/**
 * Every request carries X-Session-Token. Two kinds of token exist:
 *
 * - A signed-in browser holds a server-generated token stored in
 *   auth_sessions (issued at sign-up or log-in, see src/auth). That maps to
 *   the account's User row.
 * - Anyone else is an anonymous player: the client generates a random token
 *   itself, and this guard lazily creates a User row the first time that
 *   token is seen. Anyone who learns an anonymous token can act as that
 *   player, which is fine for casual play; accounts are the real identity.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.header(SESSION_HEADER);

    if (!token || !UUID_PATTERN.test(token)) {
      throw new BadRequestException(`Missing or invalid ${SESSION_HEADER} header — the client must generate and send a UUID.`);
    }

    const session = await this.prisma.authSession.findUnique({ where: { token }, include: { user: true } });
    request.user = session ? session.user : await this.upsertUser(token);
    request.sessionToken = token;
    return true;
  }

  /**
   * displayName is @unique (spec 9a — chosen names must be unique, and the
   * auto-generated default shares that constraint). upsert() only resolves
   * conflicts on the `where` field (sessionToken); a collision on the
   * *generated* display name during the create branch throws P2002, so this
   * retries with a fresh random name rather than failing the request.
   */
  private async upsertUser(token: string): Promise<User> {
    for (let attempt = 0; attempt < MAX_NAME_GENERATION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.user.upsert({
          where: { sessionToken: token },
          update: {},
          create: { sessionToken: token, displayName: generateDisplayName() },
        });
      } catch (err) {
        const isDisplayNameCollision = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!isDisplayNameCollision || attempt === MAX_NAME_GENERATION_ATTEMPTS - 1) throw err;
      }
    }
    throw new Error('Unreachable');
  }
}

function generateDisplayName(): string {
  return `Player ${Math.floor(1000 + Math.random() * 9000)}`;
}
