import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

/** Just enough of PrismaService for AuthService, backed by arrays. */
function fakePrisma(users: User[], rosters: { id: string; userId: string }[] = []) {
  const sessions: { token: string; userId: string }[] = [];
  const prisma = {
    sessions,
    rosters,
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => users.find((u) => u.email === where.email) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
        if (data.email && users.some((u) => u.email === data.email && u.id !== where.id)) {
          const { Prisma } = jest.requireActual('@prisma/client');
          throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
        }
        const user = users.find((u) => u.id === where.id)!;
        Object.assign(user, data);
        return user;
      },
    },
    authSession: {
      create: async ({ data }: { data: { token: string; userId: string } }) => {
        sessions.push(data);
        return data;
      },
      deleteMany: async ({ where }: { where: { token: string } }) => {
        const before = sessions.length;
        for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].token === where.token) sessions.splice(i, 1);
        return { count: before - sessions.length };
      },
    },
    roster: {
      updateMany: async ({ where, data }: { where: { userId: string }; data: { userId: string } }) => {
        const hits = rosters.filter((r) => r.userId === where.userId);
        hits.forEach((r) => (r.userId = data.userId));
        return { count: hits.length };
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return prisma;
}

function user(overrides: Partial<User>): User {
  return { id: 'u1', sessionToken: 'tok-1', displayName: 'Player 1', createdAt: new Date(), email: null, passwordHash: null, resultEmails: true, ...overrides };
}

describe('AuthService', () => {
  it('signs up the current player and issues a new server token', async () => {
    const me = user({});
    const prisma = fakePrisma([me]);
    const service = new AuthService(prisma as never);

    const result = await service.signUp(me, ' Jeff@Example.com ', 'longenough');

    expect(result.user).toEqual({ id: 'u1', displayName: 'Player 1', email: 'jeff@example.com', resultEmails: true });
    expect(prisma.sessions).toEqual([{ token: result.token, userId: 'u1' }]);
    expect(me.sessionToken).not.toBe('tok-1');
    expect(me.passwordHash).toMatch(/^scrypt\$/);
  });

  it('refuses an email that already has an account', async () => {
    const taken = user({ id: 'u2', sessionToken: 'tok-2', displayName: 'Player 2', email: 'jeff@example.com' });
    const me = user({});
    const service = new AuthService(fakePrisma([me, taken]) as never);
    await expect(service.signUp(me, 'jeff@example.com', 'longenough')).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in, moves the anonymous games onto the account, and ends the old session', async () => {
    const account = user({ id: 'acct', sessionToken: 'x', displayName: 'Jeff', email: 'jeff@example.com', passwordHash: await hashPassword('longenough') });
    const anon = user({ id: 'anon', sessionToken: 'anon-tok', displayName: 'Player 9' });
    const rosters = [{ id: 'r1', userId: 'anon' }, { id: 'r2', userId: 'someone-else' }];
    const prisma = fakePrisma([account, anon], rosters);
    prisma.sessions.push({ token: 'anon-tok', userId: 'stale' });
    const service = new AuthService(prisma as never);

    const result = await service.logIn(anon, 'anon-tok', 'JEFF@example.com', 'longenough');

    expect(result.user.id).toBe('acct');
    expect(result.movedGames).toBe(1);
    expect(rosters).toEqual([{ id: 'r1', userId: 'acct' }, { id: 'r2', userId: 'someone-else' }]);
    expect(prisma.sessions).toEqual([{ token: result.token, userId: 'acct' }]);
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const account = user({ id: 'acct', email: 'jeff@example.com', passwordHash: await hashPassword('longenough') });
    const anon = user({ id: 'anon' });
    const service = new AuthService(fakePrisma([account, anon]) as never);

    await expect(service.logIn(anon, 't', 'jeff@example.com', 'wrong-password')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.logIn(anon, 't', 'nobody@example.com', 'wrong-password')).rejects.toThrow("That email and password don't match.");
  });

  it('logs out by deleting only this browser session', async () => {
    const prisma = fakePrisma([]);
    prisma.sessions.push({ token: 'mine', userId: 'a' }, { token: 'other-device', userId: 'a' });
    await new AuthService(prisma as never).logOut('mine');
    expect(prisma.sessions).toEqual([{ token: 'other-device', userId: 'a' }]);
  });
});
