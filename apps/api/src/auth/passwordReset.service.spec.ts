import { BadRequestException } from '@nestjs/common';
import { hashResetToken, MAX_RESETS_PER_HOUR, PasswordResetService } from './passwordReset.service';
import { verifyPassword } from './password';

interface ResetRow {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

function setup() {
  const user = { id: 'u1', email: 'jeff@example.com', displayName: 'Jeff', passwordHash: 'old', resultEmails: true, sessionToken: 's', createdAt: new Date() };
  const resets: ResetRow[] = [];
  const sessions = [
    { token: 'phone', userId: 'u1' },
    { token: 'laptop', userId: 'u1' },
  ];
  const sent: { to: string; text: string }[] = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => (where.email === user.email ? user : null),
      update: async ({ data }: { data: { passwordHash: string } }) => Object.assign(user, data),
    },
    passwordReset: {
      count: async () => resets.length,
      create: async ({ data }: { data: Omit<ResetRow, 'id' | 'usedAt' | 'createdAt'> }) => {
        const row = { id: `r${resets.length}`, usedAt: null, createdAt: new Date(), ...data };
        resets.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => resets.find((r) => r.tokenHash === where.tokenHash) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { usedAt: Date } }) => Object.assign(resets.find((r) => r.id === where.id)!, data),
    },
    authSession: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].userId === where.userId) sessions.splice(i, 1);
      },
      create: async ({ data }: { data: { token: string; userId: string } }) => sessions.push(data),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const email = { send: async (to: string, content: { text: string }) => (sent.push({ to, text: content.text }), true) };
  return { user, resets, sessions, sent, service: new PasswordResetService(prisma as never, email as never) };
}

const tokenFrom = (text: string) => decodeURIComponent(/token=([^\s]+)/.exec(text)![1]);

describe('PasswordResetService', () => {
  it('emails a link, stores only a hash of its token, and the link resets the password once', async () => {
    const { user, resets, sessions, sent, service } = setup();
    await service.requestReset(' JEFF@example.com ');

    expect(sent).toHaveLength(1);
    const token = tokenFrom(sent[0].text);
    expect(resets[0].tokenHash).toBe(hashResetToken(token));
    expect(resets[0].tokenHash).not.toContain(token);

    const result = await service.completeReset(token, 'brand-new-pass');
    expect(await verifyPassword('brand-new-pass', user.passwordHash)).toBe(true);
    expect(sessions).toEqual([{ token: result.token, userId: 'u1' }]);

    await expect(service.completeReset(token, 'another-pass')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers the same for an unknown email and sends nothing', async () => {
    const { sent, service } = setup();
    await expect(service.requestReset('nobody@example.com')).resolves.toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('stops sending after too many requests in an hour', async () => {
    const { sent, service } = setup();
    for (let i = 0; i < MAX_RESETS_PER_HOUR + 2; i++) await service.requestReset('jeff@example.com');
    expect(sent).toHaveLength(MAX_RESETS_PER_HOUR);
  });

  it('refuses an expired link', async () => {
    const { resets, sent, service } = setup();
    await service.requestReset('jeff@example.com');
    resets[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.completeReset(tokenFrom(sent[0].text), 'brand-new-pass')).rejects.toBeInstanceOf(BadRequestException);
  });
});
