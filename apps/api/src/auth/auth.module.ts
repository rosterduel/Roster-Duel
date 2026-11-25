import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './passwordReset.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordResetService],
})
export class AuthModule {}
