import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/entities/user.entity.js';
import { UserRole } from '../users/user-role.enum.js';
import { Employee } from '../employees/entities/employee.entity.js';
import { jwtAudience, jwtIssuer, jwtSecret } from './jwt.config.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: UserRole;
  employeeId?: number;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,

    @InjectRepository(User)
    private readonly users: Repository<User>,

    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();

    const [scheme, token] =
      request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }

    let payload: { sub: number; role: UserRole };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: jwtSecret,
        issuer: jwtIssuer,
        audience: jwtAudience,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException();
    }

    if (!Number.isSafeInteger(payload.sub)) {
      throw new UnauthorizedException();
    }

    const user = await this.users.findOne({
      where: { id: payload.sub },
    });

    if (!user || user.role !== payload.role) {
      throw new UnauthorizedException();
    }

    let employeeId: number | undefined;

    if (user.role === UserRole.EMPLOYEE) { 
      const employee = await this.employees.findOne({
        where: { user: { id: user.id } },
      });

      if (!employee?.isActive) {
        throw new UnauthorizedException();
      }

      employeeId = employee.id;
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId,
    };

    return true;
  }
}