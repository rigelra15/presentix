// Generate the secret files needed by Docker Compose and the services.
// Existing files are never overwritten, so it is safe to run this again.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const secretsDir = 'docker/secrets';

const secretFiles = [
  'mysql_root_password',
  'employee_db_password',
  'attendance_db_password',
  'jwt_access_secret',
];

mkdirSync(secretsDir, { recursive: true });

for (const name of secretFiles) {
  const path = `${secretsDir}/${name}`;

  if (existsSync(path)) {
    console.log(`SKIP: ${path} already exists`);
    continue;
  }

  // 32 random bytes -> 64 hex characters
  const value = randomBytes(32).toString('hex');

  writeFileSync(path, value + '\n', { mode: 0o644 });
  console.log(`CREATED: ${path}`);
}

console.log('Secrets are ready.');
