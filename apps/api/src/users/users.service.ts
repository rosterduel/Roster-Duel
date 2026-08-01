import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { validateDisplayName } from './validateDisplayName';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async changeDisplayName(user: User, rawName: string): Promise<User> {
    const result = validateDisplayName(rawName);
    if (!result.valid) {
      throw new UnprocessableEntityException(result.reason);
    }

    try {
      return await this.prisma.user.update({
        where: { id: user.id },
        data: { displayName: result.normalized },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('That name is already taken.');
      }
      throw err;
    }
  }
}
