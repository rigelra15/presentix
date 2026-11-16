import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import type { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';

import { AuthService } from './auth.service.js';
import type { User } from '../users/entities/user.entity.js';
import type { Employee } from '../employees/entities/employee.entity.js';
import type { RefreshToken } from './entities/refresh-token.entity.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

// Fake refresh_tokens table kept in an array.
// update() only understands the filters AuthService uses.
function createTokenStore(user: Partial<User> | null) {
  const rows: RefreshToken[] = [];

  function matches(row: RefreshToken, where: Record<string, unknown>) {
    for (const [key, value] of Object.entries(where)) {
      const rowValue = row[key as keyof RefreshToken];

      if (key === 'user') continue;
      if (value && typeof value === 'object' && '_type' in value) {
        const operator = value as { _type: string; _value?: unknown };
        if (operator._type === 'isNull' && rowValue !== null) return false;
        if (operator._type === 'not' && rowValue === operator._value) return false;
        continue;
      }
      if (rowValue !== value) return false;
    }
    return true;
  }

  const repo = {
    insert: async (data: Partial<RefreshToken>) => {
      rows.push({ id: rows.length + 1, revokedAt: null, ...data, user } as RefreshToken);
    },
    findOne: async ({ where }: { where: { tokenHash: string } }) =>
      rows.find(row => row.tokenHash === where.tokenHash) ?? null,
    save: async (row: RefreshToken) => row,
    update: async (where: Record<string, unknown>, data: Partial<RefreshToken>) => {
      rows.filter(row => matches(row, where)).forEach(row => Object.assign(row, data));
    },
    delete: async (where: Record<string, unknown>) => {
      const keep = rows.filter(row => !matches(row, where));
      rows.splice(0, rows.length, ...keep);
    },
  };

  return { rows, repo: repo as unknown as Repository<RefreshToken> };
}

// Fake repositories. "user" is what findOne returns for the email.
function createService(user: Partial<User> | null) {
  const users = {
    findOne: async () => user,
    update: async (_where: unknown, data: Partial<User>) => Object.assign(user ?? {}, data),
  } as unknown as Repository<User>;
  const employees = { findOne: async () => null } as unknown as Repository<Employee>;
  const jwt = { signAsync: async () => 'token' } as unknown as JwtService;
  const tokens = createTokenStore(user);

  return {
    service: new AuthService(users, employees, tokens.repo, jwt),
    tokens: tokens.rows,
  };
}

async function createHrd() {
  const passwordHash = await argon2.hash('Correct123', { type: argon2.argon2id });
  return { id: 1, email: 'hrd@test', passwordHash, role: 'HRD' } as Partial<User>;
}

describe('AuthService.login', () => {
  it('gives the same error for an unknown email and a wrong password', async () => {
    const hrd = await createHrd();

    await expect(
      createService(null).service.login({ email: 'nobody@test', password: 'Wrong123' }),
    ).rejects.toThrow('Incorrect email or password');

    await expect(
      createService(hrd).service.login({ email: 'hrd@test', password: 'Wrong123' }),
    ).rejects.toThrow('Incorrect email or password');
  });

  it('takes about as long for an unknown email as for a wrong password', async () => {
    const hrd = await createHrd();

    async function timeLogin(service: AuthService, email: string) {
      const start = performance.now();
      await service.login({ email, password: 'Wrong123' }).catch(() => undefined);
      return performance.now() - start;
    }

    // Warm up once, so the dummy hash is already created
    await timeLogin(createService(null).service, 'nobody@test');

    const unknownEmail = await timeLogin(createService(null).service, 'nobody@test');
    const wrongPassword = await timeLogin(createService(hrd).service, 'hrd@test');

    // Without the dummy hash the unknown email answers almost instantly
    expect(unknownEmail).toBeGreaterThan(wrongPassword / 3);
  });

  it('returns an access token and stores only a hash of the refresh token', async () => {
    const { service, tokens } = createService(await createHrd());

    const result = await service.login({ email: 'HRD@test ', password: 'Correct123' });

    expect(result.body.access_token).toBe('token');
    expect(result.body.user.role).toBe('HRD');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toBe(sha256(result.refreshToken));
    expect(tokens[0].tokenHash).not.toBe(result.refreshToken);
  });
});

describe('AuthService.refresh', () => {
  it('rotates the token: the old one stops working', async () => {
    const { service } = createService(await createHrd());
    const login = await service.login({ email: 'hrd@test', password: 'Correct123' });

    const refreshed = await service.refresh(login.refreshToken);

    expect(refreshed.body.access_token).toBe('token');
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
  });

  it('ends all sessions when an old token is reused', async () => {
    const { service, tokens } = createService(await createHrd());
    const login = await service.login({ email: 'hrd@test', password: 'Correct123' });
    const refreshed = await service.refresh(login.refreshToken);

    await expect(service.refresh(login.refreshToken)).rejects.toThrow('session has expired');
    await expect(service.refresh(refreshed.refreshToken)).rejects.toThrow('session has expired');
    expect(tokens.every(token => token.revokedAt !== null)).toBe(true);
  });

  it('rejects a missing or unknown token', async () => {
    const { service } = createService(await createHrd());

    await expect(service.refresh(undefined)).rejects.toThrow('Not logged in');
    await expect(service.refresh('made-up')).rejects.toThrow('session has expired');
  });
});

describe('AuthService.logout', () => {
  it('revokes the refresh token', async () => {
    const { service } = createService(await createHrd());
    const login = await service.login({ email: 'hrd@test', password: 'Correct123' });

    await service.logout(login.refreshToken);

    await expect(service.refresh(login.refreshToken)).rejects.toThrow();
  });
});

describe('AuthService.changePassword', () => {
  it('rejects a wrong current password', async () => {
    const { service } = createService(await createHrd());

    await expect(
      service.changePassword(1, { currentPassword: 'Wrong123', newPassword: 'NewPass123' }, undefined),
    ).rejects.toThrow('Current password is incorrect');
  });

  it('rejects the same password', async () => {
    const { service } = createService(await createHrd());

    await expect(
      service.changePassword(1, { currentPassword: 'Correct123', newPassword: 'Correct123' }, undefined),
    ).rejects.toThrow('must be different');
  });

  it('changes the password and logs out the other sessions only', async () => {
    const { service } = createService(await createHrd());
    const thisBrowser = await service.login({ email: 'hrd@test', password: 'Correct123' });
    const otherBrowser = await service.login({ email: 'hrd@test', password: 'Correct123' });

    await service.changePassword(
      1,
      { currentPassword: 'Correct123', newPassword: 'NewPass123' },
      thisBrowser.refreshToken,
    );

    await expect(service.refresh(otherBrowser.refreshToken)).rejects.toThrow();
    await expect(service.refresh(thisBrowser.refreshToken)).resolves.toBeDefined();
    await expect(
      service.login({ email: 'hrd@test', password: 'NewPass123' }),
    ).resolves.toBeDefined();
  });
});
