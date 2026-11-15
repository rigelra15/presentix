import * as argon2 from 'argon2';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';

import { AuthService } from './auth.service.js';
import type { User } from '../users/entities/user.entity.js';
import type { Employee } from '../employees/entities/employee.entity.js';

// Fake repositories. "user" is what findOne returns for the email.
function createService(user: Partial<User> | null) {
  const users = { findOne: async () => user } as unknown as Repository<User>;
  const employees = { findOne: async () => null } as unknown as Repository<Employee>;
  const jwt = { signAsync: async () => 'token' } as unknown as JwtService;

  return new AuthService(users, employees, jwt);
}

describe('AuthService.login', () => {
  it('gives the same error for an unknown email and a wrong password', async () => {
    const passwordHash = await argon2.hash('Correct123', { type: argon2.argon2id });
    const hrd = { id: 1, email: 'hrd@test', passwordHash, role: 'HRD' } as Partial<User>;

    await expect(
      createService(null).login({ email: 'nobody@test', password: 'Wrong123' }),
    ).rejects.toThrow('Incorrect email or password');

    await expect(
      createService(hrd).login({ email: 'hrd@test', password: 'Wrong123' }),
    ).rejects.toThrow('Incorrect email or password');
  });

  it('takes about as long for an unknown email as for a wrong password', async () => {
    const passwordHash = await argon2.hash('Correct123', { type: argon2.argon2id });
    const hrd = { id: 1, email: 'hrd@test', passwordHash, role: 'HRD' } as Partial<User>;

    async function timeLogin(service: AuthService, email: string) {
      const start = performance.now();
      await service.login({ email, password: 'Wrong123' }).catch(() => undefined);
      return performance.now() - start;
    }

    // Warm up once, so the dummy hash is already created
    await timeLogin(createService(null), 'nobody@test');

    const unknownEmail = await timeLogin(createService(null), 'nobody@test');
    const wrongPassword = await timeLogin(createService(hrd), 'hrd@test');

    // Without the dummy hash the unknown email answers almost instantly
    expect(unknownEmail).toBeGreaterThan(wrongPassword / 3);
  });

  it('returns a token for the correct password', async () => {
    const passwordHash = await argon2.hash('Correct123', { type: argon2.argon2id });
    const hrd = { id: 1, email: 'hrd@test', passwordHash, role: 'HRD' } as Partial<User>;

    const result = await createService(hrd).login({ email: 'HRD@test ', password: 'Correct123' });

    expect(result.access_token).toBe('token');
    expect(result.user.role).toBe('HRD');
  });
});
