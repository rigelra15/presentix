import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedUser } from "./jwt-auth.guard.js";
import type { UserRole } from "../users/user-role.enum.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();

    if (!request.user) {
      throw new UnauthorizedException();
    }

    if (!requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      )
    }

    return true;
  }
}