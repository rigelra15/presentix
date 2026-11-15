import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import { User } from '../users/entities/user.entity.js';
import { UserRole } from '../users/user-role.enum.js';
import { Employee } from '../employees/entities/employee.entity.js';
import type { LoginDto } from './dto/login.dto.js';

// A hash of a random password. When the email does not exist we still
// verify against this hash, so the answer takes about as long as for a
// wrong password. Otherwise the response time shows which emails exist.
const dummyHash = argon2.hash(randomUUID(), { type: argon2.argon2id });

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,

    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,

    private readonly jwtService: JwtService,
  ) { }

  async login(dto: LoginDto) {
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

    if (user.role === UserRole.EMPLOYEE) {
      const employee = await this.employees.findOne({
        where: {
          user: { id: user.id },
        }
      });

      if (!employee || !employee.isActive) {
        throw new UnauthorizedException(
          'The account cannot be used'
        );
      }
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 1800,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    }
  }
}