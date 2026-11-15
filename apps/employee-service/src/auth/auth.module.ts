import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

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
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, TypeOrmModule, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
