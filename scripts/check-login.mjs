// Quick check: log in with the demo accounts and call /auth/me.
// Run from the repository root after the employee service is started.
import { readFileSync } from 'node:fs';

const baseUrl = process.env.EMPLOYEE_SERVICE_URL ?? 'http://localhost:3000';

const accounts = JSON.parse(
  readFileSync('docker/secrets/demo-accounts.json', 'utf8'),
);

for (const [name, credentials] of Object.entries(accounts)) {
  const loginResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const login = await loginResponse.json();

  const meResponse = await fetch(`${baseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${login.access_token}`,
    },
  });

  const me = await meResponse.json();

  console.log({
    account: name,
    loginStatus: loginResponse.status,
    meStatus: meResponse.status,
    role: me.role ?? null,
    employeeId: me.employeeId ?? null,
  });
}

const unauthorized = await fetch(`${baseUrl}/auth/me`);

console.log({
  test: 'without-token',
  status: unauthorized.status,
});
