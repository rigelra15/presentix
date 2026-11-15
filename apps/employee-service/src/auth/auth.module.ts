import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { User } from '../users/entities/user.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import {
  jwtSecret,
  jwtIssuer,
  jwtAudience,
} from './jwt.config.js';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Employee]),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: '30m',
        issuer: jwtIssuer,
        audience: jwtAudience,
      },
    }),
    // Limits login attempts (only used on POST /auth/login).
    // Counted per IP address + email, so guessing one account's
    // password is blocked without locking out everyone behind the
    // same IP (in development all requests come through the Vite proxy).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
      errorMessage: 'Too many login attempts. Please wait a minute and try again.',
      getTracker: (request: { ip?: string; body?: { email?: unknown } }) => {
        const email =
          typeof request.body?.email === 'string'
            ? request.body.email.trim().toLowerCase()
            : '';

        return `${request.ip}:${email}`;
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, TypeOrmModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
