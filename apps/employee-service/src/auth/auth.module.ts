import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { User } from '../users/entities/user.entity.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';

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
    TypeOrmModule.forFeature([User, Employee, RefreshToken]),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        // Short-lived. The browser gets a new one from POST /auth/refresh.
        expiresIn: '15m',
        issuer: jwtIssuer,
        audience: jwtAudience,
      },
    }),
    // Limits login and change-password attempts.
    // Login is counted per IP address + email, change-password per user, so guessing one account's
    // password is blocked without locking out everyone behind the
    // same IP (in development all requests come through the Vite proxy).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 5 }],
      errorMessage: 'Too many attempts. Please wait a minute and try again.',
      getTracker: (request: {
        ip?: string;
        body?: { email?: unknown };
        user?: { id: number };
      }) => {
        if (request.user) {
          return `user:${request.user.id}`;
        }

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
