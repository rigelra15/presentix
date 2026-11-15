import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

export interface SessionUser {
  id: number;
  email: string;
  role: 'EMPLOYEE' | 'HRD';
  employeeId?: number;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user: SessionUser;
}

@Injectable()
export class AttendanceAuthGuard implements CanActivate {
  private readonly employeeServiceUrl =
    process.env.EMPLOYEE_SERVICE_URL ??
    'http://127.0.0.1:3000';

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    let response: Response;

    try {
      response = await fetch(
        `${this.employeeServiceUrl}/auth/me`,
        {
          headers: { Authorization: authorization },
          signal: AbortSignal.timeout(3000),
        },
      );
    } catch {
      throw new ServiceUnavailableException(
        'Employee Service unavailable',
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException();
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Unable to verify employee session',
      );
    }

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'Invalid employee service response',
      );
    }

    if (typeof data !== 'object' || data === null) {
      throw new ServiceUnavailableException(
        'Invalid session data',
      );
    }

    const session = data as Record<string, unknown>;

    if (
      !Number.isSafeInteger(session.id) ||
      typeof session.email !== 'string' ||
      !['EMPLOYEE', 'HRD'].includes(String(session.role)) ||
      (
        session.role === 'EMPLOYEE' &&
        !Number.isSafeInteger(session.employeeId)
      )
    ) {
      throw new ServiceUnavailableException(
        'Incomplete session data',
      );
    }

    request.user = session as unknown as SessionUser;

    return true;
  }
}