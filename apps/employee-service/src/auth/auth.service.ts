import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { IsNull, Not, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { User } from '../users/entities/user.entity.js';
import { UserRole } from '../users/user-role.enum.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';

// A hash of a random password. When the email does not exist we still
// verify against this hash, so the answer takes about as long as for a
// wrong password. Otherwise the response time shows which emails exist.
const dummyHash = argon2.hash(randomUUID(), { type: argon2.argon2id });

// Access token: 15 minutes (see auth.module.ts). Refresh token: 7 days.
const ACCESS_TOKEN_SECONDS = 15 * 60;
export const REFRESH_TOKEN_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// What the controller needs: the JSON body, plus the refresh token
// that it puts in an httpOnly cookie (never in the JSON body).
export interface SessionResult {
  body: {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: { id: number; email: string; role: UserRole };
  };
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,

    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,

    private readonly jwtService: JwtService,
  ) { }

  async login(dto: LoginDto): Promise<SessionResult> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.users.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });

    if (!user) {
      await argon2.verify(await dummyHash, dto.password).catch(() => false);

      throw new UnauthorizedException(
        'Incorrect email or password',
      );
    }

    const validPassword = await argon2
      .verify(user.passwordHash, dto.password)
      .catch(() => false);

    if (!validPassword) {
      throw new UnauthorizedException(
        'Incorrect email or password',
      )
    }

    if (!(await this.canUseAccount(user))) {
      throw new UnauthorizedException(
        'The account cannot be used'
      );
    }

    return this.startSession(user);
  }

  // Swaps a valid refresh token for a new access token AND a new
  // refresh token (rotation). The old refresh token stops working.
  async refresh(token: string | undefined): Promise<SessionResult> {
    if (!token) {
      throw new UnauthorizedException('Not logged in');
    }

    const stored = await this.refreshTokens.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { user: true },
    });

    if (!stored || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Your session has expired. Please log in again.');
    }

    if (stored.revokedAt) {
      // revokedAt is only set when a token is rotated (below) or after
      // a suspected theft. So an old token was used again. Someone may have
      // copied it, so end every session of this user to be safe.
      await this.revokeAll(stored.user.id);
      throw new UnauthorizedException('Your session has expired. Please log in again.');
    }

    // E.g. HRD deactivated the employee since the last login
    if (!(await this.canUseAccount(stored.user))) {
      await this.revokeAll(stored.user.id);
      throw new UnauthorizedException('The account cannot be used');
    }

    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);

    return this.startSession(stored.user);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    await this.refreshTokens.delete({ tokenHash: hashToken(token) });
  }

  // Changes the password and logs out every OTHER session of the user.
  // The current browser stays logged in.
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
    currentToken: string | undefined,
  ): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const validPassword = await argon2
      .verify(user.passwordHash, dto.currentPassword)
      .catch(() => false);

    if (!validPassword) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.users.update({ id: user.id }, { passwordHash });

    // Deleted, not revoked: a revoked token used again means "stolen"
    // (see refresh), which these tokens are not.
    await this.refreshTokens.delete({
      user: { id: user.id },
      ...(currentToken ? { tokenHash: Not(hashToken(currentToken)) } : {}),
    });
  }

  // HRD can always log in. An employee only while active.
  private async canUseAccount(user: Pick<User, 'id' | 'role'>): Promise<boolean> {
    if (user.role !== UserRole.EMPLOYEE) {
      return true;
    }

    const employee = await this.employees.findOne({
      where: { user: { id: user.id } },
    });

    return !!employee?.isActive;
  }

  private async revokeAll(userId: number): Promise<void> {
    await this.refreshTokens.update(
      { user: { id: userId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async startSession(
    user: Pick<User, 'id' | 'email' | 'role'>,
  ): Promise<SessionResult> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    // 32 random bytes = impossible to guess
    const refreshToken = randomBytes(32).toString('base64url');

    await this.refreshTokens.insert({
      user: { id: user.id },
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
    });

    return {
      body: {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_SECONDS,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      refreshToken,
    };
  }
}
