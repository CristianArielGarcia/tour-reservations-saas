import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    // Apply JWT guard globally to all routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apply Roles guard globally — reads @Roles() metadata
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
