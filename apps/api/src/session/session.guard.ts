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
}

/**
 * Phase 1 has no real auth (spec: "anonymous sessions") — the client
 * generates a random token itself and sends it as X-Session-Token on every
 * request. This guard lazily creates a User row the first time a token is
 * seen and attaches it to the request. Not a security boundary: anyone who
 * learns another session's token can act as that session. Acceptable for a
 * casual friend-match MVP; would need real auth before any real launch.
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

    request.user = await this.upsertUser(token);
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
