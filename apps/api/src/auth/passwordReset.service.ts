import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { EmailService } from '../email/email.service';
import { passwordResetEmail } from '../email/templates';
import { webBaseUrl } from '../email/webBaseUrl';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResult, toAccountUser } from './auth.service';
import { checkEmailAddress, newPasswordProblem } from './credentials';
import { hashPassword } from './password';

export const RESET_VALID_MINUTES = 60;
/** At most this many reset emails per account per hour, so the form can't be used to flood someone's inbox. */
export const MAX_RESETS_PER_HOUR = 3;

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /**
   * Emails a single-use reset link if the address has an account. Always
   * answers the same way, so the form can't be used to find out who has an
   * account.
   */
  async requestReset(rawEmail: unknown): Promise<{ ok: true }> {
    const checked = checkEmailAddress(rawEmail);
    if (!checked.valid) throw new UnprocessableEntityException(checked.reason);

    const user = await this.prisma.user.findUnique({ where: { email: checked.email } });
    if (!user) return { ok: true };

    const recent = await this.prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } });
    if (recent >= MAX_RESETS_PER_HOUR) return { ok: true };

    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordReset.create({
      data: { tokenHash: hashResetToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_VALID_MINUTES * 60 * 1000) },
    });
    const url = `${webBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await this.email.send(user.email!, passwordResetEmail(url, RESET_VALID_MINUTES));
    return { ok: true };
  }

  /**
   * Sets the new password, signs out every browser on the account, and
   * signs this browser in.
   */
  async completeReset(rawToken: unknown, rawPassword: unknown): Promise<AuthResult> {
    const problem = newPasswordProblem(rawPassword);
    if (problem) throw new UnprocessableEntityException(problem);
    if (typeof rawToken !== 'string' || rawToken.length === 0) throw new BadRequestException('This reset link is invalid.');

    const reset = await this.prisma.passwordReset.findUnique({ where: { tokenHash: hashResetToken(rawToken) } });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This reset link has expired or was already used. Ask for a new one.');
    }

    const passwordHash = await hashPassword(rawPassword as string);
    const sessionToken = randomUUID();
    const [, , user] = await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.authSession.deleteMany({ where: { userId: reset.userId } }),
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.authSession.create({ data: { token: sessionToken, userId: reset.userId } }),
    ]);
    return { token: sessionToken, user: toAccountUser(user) };
  }
}
