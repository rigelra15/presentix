import { randomBytes } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { resolve } from 'node:path';
import argon2 from 'argon2';

import dataSource from '../dist/data-source.js';
import { User } from '../dist/users/entities/user.entity.js';
import { Employee } from '../dist/employees/entities/employee.entity.js';
import { UserRole } from '../dist/users/user-role.enum.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seed must not run in production');
}

const credentialsPath = resolve(
  process.cwd(),
  '../../docker/secrets/demo-accounts.json',
);

let credentials;

if (existsSync(credentialsPath)) {
  credentials = JSON.parse(
    readFileSync(credentialsPath, 'utf8'),
  );
} else {
  credentials = {
    hrd: {
      email: 'hrd.demo@dexagroup.com',
      password: randomBytes(24).toString('base64url'),
    },
    employee: {
      email: 'employee.demo@dexagroup.com',
      password: randomBytes(24).toString('base64url'),
    },
  };

  writeFileSync(
    credentialsPath,
    JSON.stringify(credentials, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
}

chmodSync(credentialsPath, 0o600);

async function main() {
  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);
    const employees = dataSource.getRepository(Employee);

    async function ensureUser(account, role) {
      let user = await users.findOne({
        where: { email: account.email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
        },
      });

      if (user) {
        const valid =
          user.role === role && await argon2.verify(
            user.passwordHash,
            account.password,
          );

        if (!valid) {
          throw new Error(
            `Existing demo account differs: ${account.email}`,
          );
        }

        console.log(`EXISTS: ${account.email}`);
        return user;
      }

      user = users.create({
        email: account.email,
        role,
        passwordHash: await argon2.hash(
          account.password,
          { type: argon2.argon2id },
        ),
      });

      user = await users.save(user);
      console.log(`CREATED: ${account.email}`);

      return user;
    }

    await ensureUser(credentials.hrd, UserRole.HRD);

    const employeeUser = await ensureUser(
      credentials.employee,
      UserRole.EMPLOYEE,
    );

    const existingEmployee = await employees.findOne({
      where: { user: { id: employeeUser.id } },
    });

    if (!existingEmployee) {
      await employees.save(
        employees.create({
          user: employeeUser,
          employeeCode: 'EMP-DEMO-001',
          fullName: 'Demo Employee',
          department: 'IT',
          isActive: true,
        }),
      );

      console.log('CREATED: Employee profile');
    } else {
      console.log('EXISTS: Employee profile');
    }

    console.log('Demo accounts are ready.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error.message)
  process.exitCode = 1;
});
